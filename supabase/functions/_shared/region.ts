// A region's local section ("News from Canada"): 1–2 full local stories and 4–6 one-line
// items, made at 05:00 in the region (prefs.ts planTick) and shown under the world news.
//
//   the region's own feeds (`region` in sources.ts) + general world-feed items that
//   mention the country
//     → leave out what the world edition (and its updates) already covers
//     → group + score, as the world edition does
//     → one light AI call (Groq, ~3k tokens in): pick the 1–2 stories, write the one-liners
//     → read those articles, one writing call (purpose 'region-stories')
//
// Network and AI calls are injectable (PipelineDeps), like the world edition.

import { type Cluster, clusterAll } from './dedupe.ts';
import type { FeedItem, FeedStatus } from './feeds.ts';
import type { GenerateJsonResult } from './llm.ts';
import {
  assembleAlso, assembleStories, buildBlocks, defaultDeps, hintToTopic, type PipelineDeps, readArticles, type StoryContext,
  WORLD_SOURCES, writeStories,
} from './pipeline.ts';
import { DEFAULT_PREFS, regionTimeZone } from './prefs.ts';
import { regionPrompt, regionSchema, regionSystem, type ScoredCandidate } from './prompts.ts';
import { type ClusterScore, matchesAny, rankClusters } from './scoring.ts';
import { type FeedSource, type LocalRegion, REGIONS, SOURCES, type TopicHint } from './sources.ts';
import { type Briefing, type RegionalEdition, type Story, TOPICS } from './types.ts';
import { publishedTokens } from './updates.ts';
import { type AlsoDraft, type Pick as StoryPick, validateRegion } from './validate.ts';

/** How a headline or teaser names the country (case matters: "US", not "us"). */
export const REGION_TERMS: Record<LocalRegion, RegExp> = {
  IN: /\b(India|Indian|Indians|New Delhi|Delhi|Mumbai|Bengaluru|Bangalore|Kolkata|Chennai|Hyderabad|Modi|Lok Sabha|Rajya Sabha|Reserve Bank of India|Sensex|Nifty)\b/,
  CA: /\b(Canada|Canadian|Canadians|Ottawa|Toronto|Montreal|Vancouver|Calgary|Alberta|Ontario|Quebec|British Columbia|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Bank of Canada)\b/,
  UK: /\b(UK|Britain|British(?! Columbia)|England|Scotland|Scottish|Wales|Welsh|Northern Ireland|London|Westminster|Downing Street|Bank of England|NHS)\b|\bU\.K\./,
  AU: /\b(Australia|Australian|Australians|Canberra|Sydney|Melbourne|Brisbane|Adelaide|Queensland|New South Wales|Tasmania|Reserve Bank of Australia)\b/,
  US: /\b(US|USA|United States|America|American|Americans|Congress|Senate|White House|Pentagon|Supreme Court|Federal Reserve)\b|\bU\.S\./,
};

export function mentionsRegion(item: Pick<FeedItem, 'title' | 'summary'>, region: LocalRegion): boolean {
  return REGION_TERMS[region].test(`${item.title} ${item.summary}`);
}

/** World feeds searched for mentions: general news only (a games feed rarely has a country's news). */
const GENERAL_HINTS: TopicHint[] = ['mixed', 'world', 'politics', 'business'];

export function regionSources(region: LocalRegion): { local: FeedSource[]; world: FeedSource[] } {
  return {
    local: SOURCES.filter((s) => s.region === region),
    world: WORLD_SOURCES.filter((s) => GENERAL_HINTS.includes(s.topicHint) && s.kind !== 'sec-8k' && s.kind !== 'html-list'),
  };
}

/** Candidates shown to the local editor. */
const REGION_CANDIDATES = 30;
/** About 3k tokens of candidates: Groq's free tier allows 8k tokens a minute, reply included. */
export const REGION_PROMPT_CHARS = 10_500;
export const REGION_STORIES = 2;
export const REGION_ALSO_MIN = 4;
export const REGION_ALSO_MAX = 6;

export type RegionStats = {
  region: LocalRegion;
  items: number;
  localItems: number;
  worldMentions: number;
  clusters: number;
  /** Stories the world edition already has, left out. */
  inWorldEdition: number;
  pickFallback: boolean;
  pickError?: string;
  storiesWritten: number;
  also: number;
  feedsFailed: string[];
  model?: string;
  ms: number;
};

export type RegionCandidates = {
  items: FeedItem[];
  statuses: FeedStatus[];
  /** Items from the region's own feeds (the rest are world items that name the country). */
  localItems: number;
  /** Every group found, and the ones the world edition doesn't cover yet, best-scored first. */
  clusters: Cluster[];
  ranked: Cluster[];
  scores: Map<string, ClusterScore>;
};

/** The region's own feeds plus world items that name the country, grouped and scored. */
export async function collectRegionCandidates(
  region: LocalRegion,
  now: Date,
  deps: PipelineDeps = defaultDeps,
  world: { briefing: Briefing; updates: Story[] } | null = null,
): Promise<RegionCandidates> {
  const { local, world: general } = regionSources(region);
  const localIds = new Set(local.map((s) => s.id));
  const fetched = await deps.fetchFeeds([...local, ...general], now);
  const items = fetched.items.filter((it) => localIds.has(it.sourceId) || mentionsRegion(it, region));
  // What the world edition (and its updates) already tells its readers isn't repeated.
  const published = world ? publishedTokens(world.briefing, world.updates) : [];
  const { clusters } = clusterAll(items, { now });
  const { ranked, scores } = rankClusters(clusters.filter((c) => !matchesAny(c, published)), { now });
  return { items, statuses: fetched.statuses, localItems: items.filter((it) => localIds.has(it.sourceId)).length, clusters, ranked, scores };
}

function headlineDraft(c: Cluster): AlsoDraft {
  return { clusterIds: [c.id], topic: hintToTopic(c) ?? 'world', headline: c.title, whatHappened: c.summary || c.title, whyItMatters: '', developing: false };
}

export async function buildRegionalEdition(opts: {
  region: LocalRegion;
  /** The region's local date. */
  date: string;
  now: Date;
  /** Epoch ms after which we don't start another AI attempt. */
  deadlineMs: number;
  /** The latest world edition and its updates: their stories aren't repeated. */
  world: { briefing: Briefing; updates: Story[] } | null;
  deps?: PipelineDeps;
}): Promise<{ edition: RegionalEdition; contexts: StoryContext[]; stats: RegionStats }> {
  const started = Date.now();
  const { region, date, now, deadlineMs, world } = opts;
  const deps = opts.deps ?? defaultDeps;
  const label = REGIONS.find((r) => r.id === region)?.label ?? region;
  const timezone = regionTimeZone(region);

  const cand = await collectRegionCandidates(region, now, deps, world);
  const { items, localItems, clusters, ranked, scores } = cand;
  if (ranked.length < 3) throw new Error(`Only ${ranked.length} local stories came in for ${label}.`);
  const byId = new Map(ranked.map((c) => [c.id, c]));
  const shown: ScoredCandidate[] = ranked.slice(0, REGION_CANDIDATES).map((cluster) => ({ cluster, score: scores.get(cluster.id)! }));
  const known = new Set(shown.map((c) => c.cluster.id));

  // The local editor: which 1–2 get a full story, and the one-liners.
  let storyIds: string[] = [];
  let also: AlsoDraft[] = [];
  let pickError: string | undefined;
  let model: string | undefined;
  try {
    const res: GenerateJsonResult = await deps.generateJson({
      purpose: 'region',
      system: regionSystem(label),
      prompt: regionPrompt(label, shown, date, now, REGION_PROMPT_CHARS),
      fitPrompt: (maxChars) => regionPrompt(label, shown, date, now, Math.min(maxChars, REGION_PROMPT_CHARS)),
      schema: regionSchema(TOPICS),
      temperature: 0.2,
      maxOutputTokens: 2500,
      thinking: 'LOW',
      timeoutMs: 45_000,
    });
    model = res.provider ? `${res.provider}:${res.model}` : res.model;
    ({ stories: storyIds, also } = validateRegion(res.data, { known, topics: TOPICS }));
  } catch (e) {
    pickError = (e instanceof Error ? e.message : String(e)).slice(0, 300);
  }
  const pickFallback = !storyIds.length && !also.length;

  // Fill gaps in code: the best-scored stories first (two or more outlets preferred).
  const taken = new Set([...storyIds, ...also.flatMap((a) => a.clusterIds)]);
  const rest = () => ranked.filter((c) => !taken.has(c.id));
  if (!storyIds.length) {
    storyIds = [...rest().filter((c) => c.outlets.length >= 2), ...rest()].slice(0, pickFallback ? REGION_STORIES : 1).map((c) => c.id);
    storyIds.forEach((id) => taken.add(id));
  }
  for (const c of rest()) {
    if (also.length >= REGION_ALSO_MIN) break;
    also.push(headlineDraft(c));
    taken.add(c.id);
  }

  // Write the full stories from the articles themselves.
  const picks: StoryPick[] = storyIds.map((id) => ({ clusterIds: [id], topic: hintToTopic(byId.get(id)!) ?? 'world' }));
  const articles = await readArticles(picks, byId, deps);
  const written = picks.length
    ? await writeStories(buildBlocks(picks, byId, articles), {
      prefs: { ...DEFAULT_PREFS, timezone }, date, deadlineMs, deps, purpose: 'region-stories',
    })
    : { drafts: [], failedBatches: 0, attempts: 0, model: undefined };
  // A story that couldn't be written still gets its line, at the top.
  const writtenIds = new Set(written.drafts.flatMap((d) => d.clusterIds));
  const unwritten = storyIds.filter((id) => !writtenIds.has(id)).map((id) => headlineDraft(byId.get(id)!));
  also = [...unwritten, ...also].slice(0, REGION_ALSO_MAX);

  // Ids: "ca-…", never one already used by the world edition of the same date.
  const used = new Set<string>();
  if (world?.briefing.date === date) {
    for (const s of [...world.briefing.stories, ...world.updates]) used.add(s.id);
    for (const a of world.briefing.alsoHappening ?? []) used.add(a.id);
  }
  const prefix = `${region.toLowerCase()}-`;
  const main = assembleStories(written.drafts.slice(0, REGION_STORIES), byId, articles, used, prefix);
  const lines = assembleAlso(also, byId, used, prefix);

  const edition: RegionalEdition = {
    region,
    date,
    generatedAt: new Date().toISOString(),
    label,
    stories: main.stories,
    also: lines.items,
  };
  return {
    edition,
    contexts: [...main.contexts, ...lines.contexts],
    stats: {
      region,
      items: items.length,
      localItems,
      worldMentions: items.length - localItems,
      clusters: clusters.length,
      inWorldEdition: clusters.length - ranked.length,
      pickFallback,
      ...(pickError ? { pickError } : {}),
      storiesWritten: main.stories.length,
      also: lines.items.length,
      feedsFailed: cand.statuses.filter((s) => !s.ok && !s.skipped).map((s) => s.sourceId),
      model: written.model ?? model,
      ms: Date.now() - started,
    },
  };
}
