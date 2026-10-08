// The daily edition pipeline:
//
//   feeds → group into stories → score (breadth, source weight, impact, newness)
//     → AI picks (must-includes forced in; every topic with real news gets one)
//     → in parallel: editor checklist (additions + "Also happening"),
//                    read articles + write stories in batches,
//                    the 60-second version
//     → write the editor's additions → markets → edition
//
// One edition covers all 13 topics; the app shows each reader the topics they
// follow. Big topics get several full stories, small beats (games, sport, cars…)
// one each, and "Also happening" carries the rest of every beat in one line.
//
// Network and AI calls are injectable so the whole thing can be tested offline.

import { type ArticleText, fetchArticle } from './articles.ts';
import { alsoToStory, uniqueId } from './briefing.ts';
import { type Cluster, clusterAll } from './dedupe.ts';
import { feedHealth, fetchAllFeeds, isHeadlineOnly, type FeedItem, type FeedStatus } from './feeds.ts';
import { generateJson, type GenerateJsonOptions, type GenerateJsonResult, LlmError } from './llm.ts';
import { fetchMarkets } from './markets.ts';
import type { Prefs } from './prefs.ts';
import {
  EDITION_SYSTEM, EDITOR_SYSTEM, editorPrompt, editorSchema, PICK_SYSTEM, pickPrompt, pickSchema, type ScoredCandidate,
  type StoryBlock, storiesPrompt, storiesSchema, summaryPrompt, summarySchema,
} from './prompts.ts';
import { type ClusterScore, editionTokenSets, rankClusters } from './scoring.ts';
import { type FeedSource, SOURCES } from './sources.ts';
import { truncate, wordCount } from './text.ts';
import { type AlsoItem, type Briefing, type CalendarEvent, type Coverage, type MarketQuote, type SourceRef, type Story, type Topic, TOPICS } from './types.ts';
import {
  type AlsoDraft, type EditorResult, type Pick, type StoryDraft, validateEditor, validatePicks, validateStories,
  validateSummary,
} from './validate.ts';

export type PipelineDeps = {
  fetchFeeds: (sources: FeedSource[], now: Date) => Promise<{ items: FeedItem[]; statuses: FeedStatus[] }>;
  fetchArticle: (url: string) => Promise<ArticleText>;
  fetchMarkets: () => Promise<MarketQuote[]>;
  generateJson: (opts: GenerateJsonOptions) => Promise<GenerateJsonResult>;
};

export const defaultDeps: PipelineDeps = {
  fetchFeeds: (sources, now) => fetchAllFeeds(sources, now),
  fetchArticle,
  fetchMarkets,
  generateJson,
};

export type StoryContext = { story_id: string; sources: { name: string; url: string; title: string; text: string }[] };

export type PipelineStats = {
  feeds: FeedStatus[];
  items: number;
  clusters: number;
  picks: number;
  mustInclude: number;
  additions: number;
  alsoHappening: number;
  articlesRead: number;
  pickFallback: boolean;
  editorFailed: boolean;
  /** Why the editor call failed (it degrades quietly to headline-only "also" lines). */
  editorError?: string;
  batchesFailed: number;
  editionAttempts: number;
  /** Topic-coverage picks added in code (topics the AI left without a story). */
  topicFills: number;
  /** Full stories and "Also happening" lines per topic. */
  byTopic: Partial<Record<Topic, { stories: number; also: number }>>;
  model?: string;
  ms: number;
};

const MAX_ARTICLES_PER_STORY = 3;
const ARTICLE_TEXT_CHARS = 2800;
const STORY_BLOCK_CHARS = 7000;
/** Regular picks (must-includes come on top of these). */
const TARGET_STORIES = 12;
/**
 * Hard cap so the writing still fits in one function run: 6 batches of 3, all
 * started at once. With the pick, editor and summary calls that's 9 calls, what
 * two Gemini free-tier models allow in a minute (5 each).
 */
const MAX_STORIES = 18;
const STORIES_PER_BATCH = 3;
const MAX_PARALLEL_BATCHES = 6;
/** Candidates shown to the AI (best-scored first, plus the best few of every topic). */
const PROMPT_CANDIDATES = 160;
const EDITOR_CANDIDATES = 140;
/** Each topic's best clusters always reach the AI, however low they score overall. */
const PER_TOPIC_CANDIDATES = 4;
/** "Also happening" lines kept. */
const MAX_ALSO = 30;
/** Don't start an AI call with less time than this left. */
const MIN_CALL_MS = 40_000;

// ─── Collect ───────────────────────────────────────────────────────────────

export type Candidates = {
  items: FeedItem[];
  statuses: FeedStatus[];
  /** Best-scored first. */
  clusters: Cluster[];
  scores: Map<string, ClusterScore>;
  /** Distinct stories found before the list was capped. */
  totalClusters: number;
};

export async function collectCandidates(
  prefs: Prefs,
  now: Date,
  deps: PipelineDeps = defaultDeps,
  /** Yesterday's edition: follow-ups to its stories rank lower than brand-new news. */
  previous?: Briefing | null,
): Promise<Candidates> {
  const sources = SOURCES.filter((s) => !prefs.disabledSources.includes(s.outlet));
  const fetched = await deps.fetchFeeds(sources, now);
  // Google News topic items are credited to the real publisher: honour the reader's switches there too.
  const items = fetched.items.filter((it) => !prefs.disabledSources.includes(it.outlet));
  const statuses = fetched.statuses;
  const { clusters, total } = clusterAll(items, { now });
  const { ranked, scores } = rankClusters(clusters, { now, previous: previous ? editionTokenSets(previous.stories) : [] });
  return { items, statuses, clusters: ranked, scores, totalClusters: total };
}

/** Maps a source's topic hint onto an enabled topic (used when the AI gave none). */
export function hintToTopic(c: Cluster, topics: Topic[] = TOPICS): Topic | null {
  const hint = c.topicHints.find((h) => h !== 'mixed');
  if (hint && topics.includes(hint as Topic)) return hint as Topic;
  return topics.includes('world') ? 'world' : topics[0] ?? null;
}

/**
 * The candidates shown to the AI: the best-scored `max`, but always including
 * the best few of every topic hint, so a small beat isn't crowded out by the
 * general news. Keeps the best-first order.
 */
export function candidateSlate(clusters: Cluster[], max: number, perTopic = PER_TOPIC_CANDIDATES): Cluster[] {
  if (clusters.length <= max) return clusters;
  const keep = new Set<Cluster>();
  for (const topic of TOPICS) {
    clusters.filter((c) => c.topicHints.includes(topic)).slice(0, perTopic).forEach((c) => keep.add(c));
  }
  for (const c of clusters) {
    if (keep.size >= max) break;
    keep.add(c);
  }
  return clusters.filter((c) => keep.has(c));
}

/** Shopping deals, reviews and how-to-watch posts: never a topic's one story. */
const JUNK_RE = /\b(best deals?|deals? of the day|deal alert|prime day|black friday|cyber monday|on sale|discounts?|coupons?|promo codes?|hands-on|how to watch|where to watch|live stream|horoscopes?|quiz|crossword|wordle)\b|% off|\bsave \$|\breview(:|\s+[-–—|]|$)/i;

/**
 * Topics the AI left without a story get their best candidate, if it is real
 * news (two or more outlets, not a deal or a review), while there's room.
 */
export function fillTopics(picks: Pick[], cand: Candidates, room: number): Pick[] {
  const covered = new Set(picks.map((p) => p.topic));
  const taken = new Set(picks.flatMap((p) => p.clusterIds));
  const fills: Pick[] = [];
  for (const topic of TOPICS) {
    if (fills.length >= room) break;
    if (covered.has(topic)) continue;
    const best = cand.clusters.find(
      (c) => !taken.has(c.id) && c.topicHints.includes(topic) && c.outlets.length >= 2 && !JUNK_RE.test(c.title),
    );
    if (best) fills.push({ clusterIds: [best.id], topic });
  }
  return fills;
}

// ─── Pick ──────────────────────────────────────────────────────────────────

function scored(c: Candidates, list: Cluster[]): ScoredCandidate[] {
  return list.map((cluster) => ({ cluster, score: c.scores.get(cluster.id)! }));
}

/**
 * The AI ranks and adds; the must-include rule is enforced here, in code:
 * any must-include the AI left out is put back at the top.
 */
export async function pickStories(
  cand: Candidates,
  date: string,
  now: Date,
  deps: PipelineDeps,
  followed: Topic[] = TOPICS,
): Promise<{ picks: Pick[]; fallback: boolean; model?: string; fills: number }> {
  const shown = candidateSlate(cand.clusters, PROMPT_CANDIDATES);
  const known = new Set(shown.map((c) => c.id));
  const must = cand.clusters.filter((c) => cand.scores.get(c.id)?.mustInclude);
  const byId = new Map(cand.clusters.map((c) => [c.id, c]));
  let feedback = '';
  let picks: Pick[] | null = null;
  let model: string | undefined;
  for (let attempt = 0; attempt < 2 && !picks; attempt++) {
    try {
      const res = await deps.generateJson({
        system: PICK_SYSTEM,
        prompt: pickPrompt(scored(cand, shown), TOPICS, date, now, TARGET_STORIES, followed) + feedback,
        schema: pickSchema(TOPICS),
        temperature: 0.2,
        maxOutputTokens: 4096,
        thinking: 'LOW',
        timeoutMs: 45_000,
      });
      model = res.model;
      const v = validatePicks(res.data, known, TOPICS, Math.max(0, Math.min(5, known.size) - must.length));
      if (v.ok) picks = v.value;
      else feedback = `\n\nYour previous reply had problems: ${v.errors.join('; ')}. Fix them.`;
    } catch (e) {
      if (e instanceof LlmError && !e.retryable && e.status === null) throw e; // e.g. missing key
      feedback = '';
    }
  }

  const fallback = !picks;
  if (!picks) {
    // The best-scoring clusters. The edition still gets written; it's just less curated.
    picks = [];
    for (const c of cand.clusters) {
      if (picks.length >= TARGET_STORIES) break;
      if (cand.scores.get(c.id)?.mustInclude) continue;
      const topic = hintToTopic(c);
      if (topic) picks.push({ clusterIds: [c.id], topic });
    }
  }

  // Must-includes are never dropped, whatever the story limit.
  const covered = new Set(picks.flatMap((p) => p.clusterIds));
  const missing: Pick[] = [];
  for (const c of must) {
    if (covered.has(c.id)) continue;
    const topic = hintToTopic(c);
    if (topic) missing.push({ clusterIds: [c.id], topic });
  }
  const mustSet = new Set(must.map((c) => c.id));
  const all = [...missing, ...picks];
  // Keep every must-include; trim regular picks if the list gets too long to write in time.
  const isMust = (p: Pick) => p.clusterIds.some((id) => mustSet.has(id));
  const room = Math.max(0, MAX_STORIES - all.filter(isMust).length);
  const keepRegular = new Set(all.filter((p) => !isMust(p)).slice(0, room));
  const final = all.filter((p) => isMust(p) || keepRegular.has(p));
  // Last: one story for each topic that has real news but no pick yet.
  const fills = fillTopics(final, cand, Math.max(0, MAX_STORIES - final.length));
  const out = [...final, ...fills].filter((p) => p.clusterIds.every((id) => byId.has(id)));
  return { picks: out, fallback, model, fills: fills.length };
}

// ─── Editor checklist ──────────────────────────────────────────────────────

async function runEditor(
  cand: Candidates,
  picks: Pick[],
  date: string,
  now: Date,
  deps: PipelineDeps,
): Promise<{ editor: EditorResult | null; error?: string }> {
  const taken = new Set(picks.flatMap((p) => p.clusterIds));
  const byId = new Map(cand.clusters.map((c) => [c.id, c]));
  const selected = picks.map((p) => ({ cluster: byId.get(p.clusterIds[0])!, score: cand.scores.get(p.clusterIds[0])! }));
  const rest = candidateSlate(cand.clusters.filter((c) => !taken.has(c.id)), EDITOR_CANDIDATES);
  if (!rest.length) return { editor: { additions: [], alsoHappening: [] } };
  try {
    const res = await deps.generateJson({
      system: EDITOR_SYSTEM,
      prompt: editorPrompt(selected, scored(cand, rest), date, now),
      schema: editorSchema(TOPICS),
      temperature: 0.2,
      maxOutputTokens: 14_000,
      thinking: 'LOW',
      timeoutMs: 60_000,
    });
    return { editor: validateEditor(res.data, { known: new Set(rest.map((c) => c.id)), taken, topics: TOPICS }) };
  } catch (e) {
    if (e instanceof LlmError && !e.retryable && e.status === null) throw e;
    return { editor: null, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
  }
}

function headlineAlso(c: Cluster, topic: Topic): AlsoDraft {
  return { clusterIds: [c.id], topic, headline: c.title, whatHappened: c.summary || c.title, whyItMatters: '', developing: false };
}

/**
 * If the editor call fails, "Also happening" still lists the next best stories
 * by their headlines, at most two per topic so every beat gets a look in.
 */
function fallbackAlso(cand: Candidates, taken: Set<string>): AlsoDraft[] {
  const out: AlsoDraft[] = [];
  const perTopic = new Map<Topic, number>();
  for (const c of cand.clusters) {
    if (out.length >= 15) break;
    if (taken.has(c.id) || c.outlets.length < 2 || JUNK_RE.test(c.title)) continue;
    const topic = hintToTopic(c);
    if (!topic || (perTopic.get(topic) ?? 0) >= 2) continue;
    perTopic.set(topic, (perTopic.get(topic) ?? 0) + 1);
    out.push(headlineAlso(c, topic));
  }
  return out;
}

/**
 * Every topic with any news ends up somewhere: a topic with no full story and no
 * "Also happening" line gets its best candidate's headline (not a deal or a review).
 */
export function topUpAlso(also: AlsoDraft[], storyTopics: Set<Topic>, cand: Candidates, taken: Set<string>, perTopic = 2): AlsoDraft[] {
  const covered = new Set([...storyTopics, ...also.map((a) => a.topic)]);
  const used = new Set([...taken, ...also.flatMap((a) => a.clusterIds)]);
  const extra: AlsoDraft[] = [];
  for (const topic of TOPICS) {
    if (covered.has(topic)) continue;
    const best = cand.clusters.filter((c) => !used.has(c.id) && c.topicHints.includes(topic) && !JUNK_RE.test(c.title)).slice(0, perTopic);
    extra.push(...best.map((c) => headlineAlso(c, topic)));
  }
  return [...also, ...extra];
}

/** Full stories and "Also happening" lines per topic (for the logs). */
export function countByTopic(stories: { topic: Topic }[], also: { topic: Topic }[]): Partial<Record<Topic, { stories: number; also: number }>> {
  const out: Partial<Record<Topic, { stories: number; also: number }>> = {};
  for (const t of TOPICS) {
    const n = stories.filter((s) => s.topic === t).length;
    const a = also.filter((s) => s.topic === t).length;
    if (n || a) out[t] = { stories: n, also: a };
  }
  return out;
}

// ─── Read + write ──────────────────────────────────────────────────────────

function itemText(item: FeedItem, article: ArticleText | undefined): string {
  if (article?.ok && article.text.length >= 300) return article.text;
  return item.content || item.summary || '';
}

const headlineOnly = (it: FeedItem) => isHeadlineOnly(it.kind);

/** Items of a story, best first: ones with real text, then the rest; one per link. */
function storyItems(clusterIds: string[], byId: Map<string, Cluster>): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const id of clusterIds) {
    for (const it of byId.get(id)?.items ?? []) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      out.push(it);
    }
  }
  return out.sort((a, b) => Number(headlineOnly(a)) - Number(headlineOnly(b)) || b.content.length + b.summary.length - (a.content.length + a.summary.length));
}

function readMinutes(s: { headline: string; dek: string; whatHappened: string; whyItMatters: string }): number {
  return Math.max(1, Math.ceil(wordCount(`${s.headline} ${s.dek} ${s.whatHappened} ${s.whyItMatters}`) / 200));
}

/** The four main sources (one per outlet) and every source, from our own feed data. */
function sourceRefs(items: FeedItem[]): { sources: SourceRef[]; allSources: SourceRef[] } {
  const allSources: SourceRef[] = items.map((it) => ({ name: it.outlet, url: it.link, title: it.title }));
  const sources: SourceRef[] = [];
  for (const s of allSources) {
    if (sources.length >= 4) break;
    if (!sources.some((x) => x.name === s.name)) sources.push(s);
  }
  return { sources, allSources };
}

/** Builds final stories. Links, sources and images come from our data, never from the AI. */
export function assembleStories(
  drafts: StoryDraft[],
  byId: Map<string, Cluster>,
  articles: Map<string, ArticleText>,
  used: Set<string> = new Set(),
): { stories: Story[]; contexts: StoryContext[] } {
  const stories: Story[] = [];
  const contexts: StoryContext[] = [];
  for (const d of drafts) {
    const items = storyItems(d.clusterIds, byId);
    const id = uniqueId(d.headline, used);
    const { sources, allSources } = sourceRefs(items);
    const imageUrl =
      items.map((it) => articles.get(it.id)?.ogImage).find(Boolean) ?? items.map((it) => it.imageUrl).find(Boolean) ?? null;

    stories.push({
      id,
      topic: d.topic,
      headline: d.headline,
      dek: d.dek,
      whatHappened: d.whatHappened,
      whyItMatters: d.whyItMatters,
      explainSimply: d.explainSimply,
      background: d.background,
      keyPlayers: d.keyPlayers,
      keyTerms: d.keyTerms,
      whatToWatch: d.whatToWatch,
      readTimeMinutes: readMinutes(d),
      sources,
      allSources,
      imageUrl,
      ...(d.developing ? { developing: true } : {}),
    });
    contexts.push({
      story_id: id,
      sources: items.map((it) => ({
        name: it.outlet,
        url: it.link,
        title: it.title,
        text: truncate(itemText(it, articles.get(it.id)) || it.title, 6000),
      })),
    });
  }
  return { stories, contexts };
}

/** "Also happening" items with sources and context from our data. */
export function assembleAlso(
  drafts: AlsoDraft[],
  byId: Map<string, Cluster>,
  used: Set<string>,
): { items: AlsoItem[]; contexts: StoryContext[] } {
  const items: AlsoItem[] = [];
  const contexts: StoryContext[] = [];
  for (const d of drafts) {
    const feed = storyItems(d.clusterIds, byId);
    if (!feed.length) continue;
    const id = uniqueId(d.headline, used, 'also-');
    items.push({
      id,
      topic: d.topic,
      headline: d.headline,
      whatHappened: d.whatHappened,
      whyItMatters: d.whyItMatters,
      ...(d.developing ? { developing: true } : {}),
      sources: sourceRefs(feed).sources,
    });
    contexts.push({
      story_id: id,
      sources: feed.map((it) => ({ name: it.outlet, url: it.link, title: it.title, text: truncate(it.content || it.summary || it.title, 3000) })),
    });
  }
  return { items, contexts };
}

export async function mapLimit<T, R>(list: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i]);
      }
    }),
  );
  return out;
}

/** Reads the chosen articles for fuller text and og:images. */
export async function readArticles(picks: Pick[], byId: Map<string, Cluster>, deps: PipelineDeps): Promise<Map<string, ArticleText>> {
  const toRead = picks.flatMap((p) => storyItems(p.clusterIds, byId).filter((it) => !headlineOnly(it)).slice(0, MAX_ARTICLES_PER_STORY));
  const read = await mapLimit(toRead, 10, async (it) => [it.id, await deps.fetchArticle(it.link)] as const);
  return new Map<string, ArticleText>(read);
}

export function buildBlocks(picks: Pick[], byId: Map<string, Cluster>, articles: Map<string, ArticleText>, blockChars = STORY_BLOCK_CHARS): StoryBlock[] {
  return picks.map((p) => {
    let budget = blockChars;
    const arts = storyItems(p.clusterIds, byId).slice(0, 6).map((it) => {
      const text = truncate(itemText(it, articles.get(it.id)) || '(headline only)', Math.max(200, Math.min(ARTICLE_TEXT_CHARS, budget)));
      budget -= text.length;
      return { outlet: it.outlet, title: it.title, publishedAt: it.publishedAt, text };
    });
    return { clusterIds: p.clusterIds, topic: p.topic, articles: arts };
  });
}

export type WriteContext = { prefs: Prefs; date: string; deadlineMs: number; deps: PipelineDeps };

/**
 * Writes stories in parallel batches. A failed batch is retried once (time
 * permitting); if it still fails, those stories are dropped, not the edition.
 * Returns drafts in the same order as `blocks`.
 */
export async function writeStories(blocks: StoryBlock[], ctx: WriteContext): Promise<{ drafts: StoryDraft[]; failedBatches: number; attempts: number; model?: string }> {
  const chunks: StoryBlock[][] = [];
  for (let i = 0; i < blocks.length; i += STORIES_PER_BATCH) chunks.push(blocks.slice(i, i + STORIES_PER_BATCH));
  let attempts = 0;
  let model: string | undefined;
  // All batches at once: llm.ts paces them to the free-tier limit.
  const results = await mapLimit(chunks, MAX_PARALLEL_BATCHES, async (chunk): Promise<StoryDraft[] | null> => {
    const known = new Set(chunk.flatMap((b) => b.clusterIds));
    let feedback = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0 && Date.now() > ctx.deadlineMs - MIN_CALL_MS) break;
      attempts++;
      try {
        const res = await ctx.deps.generateJson({
          system: EDITION_SYSTEM,
          prompt: storiesPrompt(chunk, ctx.date, ctx.prefs.timezone) + feedback,
          schema: storiesSchema(TOPICS, chunk.length),
          temperature: 0.3,
          maxOutputTokens: 16_000,
          thinking: 'LOW',
          timeoutMs: Math.max(30_000, Math.min(100_000, ctx.deadlineMs - Date.now() - 10_000)),
        });
        model = res.model;
        const v = validateStories(res.data, { known, topics: TOPICS, minStories: Math.min(1, chunk.length) });
        if (v.ok) return v.value;
        feedback = `\n\nYour previous reply was rejected for these reasons: ${v.errors.slice(0, 8).join('; ')}. Return the full corrected JSON.`;
      } catch (e) {
        if (e instanceof LlmError && !e.retryable && e.status === null) throw e;
      }
    }
    return null;
  });

  // Put drafts back in block order (a reply may skip or reorder stories).
  const byKey = new Map<string, StoryDraft>();
  for (const d of results.flat()) if (d) byKey.set(d.clusterIds[0], d);
  const drafts: StoryDraft[] = [];
  for (const b of blocks) {
    const d = b.clusterIds.map((id) => byKey.get(id)).find(Boolean);
    if (d && !drafts.includes(d)) drafts.push(d);
  }
  return { drafts, failedBatches: results.filter((r) => r === null).length, attempts, model };
}

async function writeSummary(blocks: StoryBlock[], ctx: WriteContext): Promise<{ summary: string[]; calendar: CalendarEvent[] } | null> {
  const top = blocks.slice(0, 8).map((b) => ({ ...b, articles: b.articles.slice(0, 2).map((a) => ({ ...a, text: truncate(a.text, 1200) })) }));
  try {
    const res = await ctx.deps.generateJson({
      system: EDITION_SYSTEM,
      prompt: summaryPrompt(top, ctx.date, ctx.prefs.timezone),
      schema: summarySchema(TOPICS),
      temperature: 0.3,
      maxOutputTokens: 4096,
      thinking: 'LOW',
      timeoutMs: 60_000,
    });
    const v = validateSummary(res.data, TOPICS);
    return v.ok ? v.value : null;
  } catch (e) {
    if (e instanceof LlmError && !e.retryable && e.status === null) throw e;
    return null;
  }
}

/** First sentence of each top story: a factual stand-in if the summary call fails. */
function fallbackSummary(stories: Story[]): string[] {
  return stories.slice(0, 4).map((s) => (s.whatHappened.match(/^.*?[.!?](\s|$)/)?.[0] ?? s.whatHappened).trim());
}

// ─── The edition ───────────────────────────────────────────────────────────

export function buildCoverage(cand: Candidates, fullStories: number, also: number, mustInclude: number, addedByEditor: number): Coverage {
  const health = feedHealth(cand.statuses);
  return {
    articlesScanned: cand.items.length,
    feedsOk: health.ok,
    feedsTotal: health.total,
    feedsFailed: health.failed,
    outlets: new Set(cand.items.map((it) => it.outlet)).size,
    storiesGrouped: cand.totalClusters,
    fullStories,
    alsoHappening: also,
    mustInclude,
    addedByEditor,
  };
}

export async function buildEdition(opts: {
  prefs: Prefs;
  now: Date;
  date: string;
  /** Epoch ms after which we don't start another AI attempt. */
  deadlineMs: number;
  deps?: PipelineDeps;
  previous?: Briefing | null;
}): Promise<{ briefing: Briefing; contexts: StoryContext[]; stats: PipelineStats }> {
  const { prefs, now, date, deadlineMs } = opts;
  const deps = opts.deps ?? defaultDeps;
  const started = Date.now();
  const ctx: WriteContext = { prefs, date, deadlineMs, deps };

  const marketsPromise = deps.fetchMarkets().catch(() => [] as MarketQuote[]);
  const cand = await collectCandidates(prefs, now, deps, opts.previous);
  if (cand.clusters.length < 5) throw new Error(`Only ${cand.clusters.length} candidate stories came in from the feeds.`);
  const byId = new Map(cand.clusters.map((c) => [c.id, c]));
  const mustIds = new Set(cand.clusters.filter((c) => cand.scores.get(c.id)?.mustInclude).map((c) => c.id));

  const { picks, fallback, model: pickModel, fills } = await pickStories(cand, date, now, deps, prefs.topics);

  // Three things at once: the editor's checklist, the stories, the 60-second version.
  const editorPromise = runEditor(cand, picks, date, now, deps);
  const articles = await readArticles(picks, byId, deps);
  const blocks = buildBlocks(picks, byId, articles);
  const [written, summaryResult, { editor, error: editorError }] = await Promise.all([
    writeStories(blocks, ctx),
    writeSummary(blocks, ctx),
    editorPromise,
  ]);

  // The editor's additions get full stories too, if there's time; otherwise one line each.
  const additions = editor?.additions ?? [];
  let addedDrafts: StoryDraft[] = [];
  let extraAlso: AlsoDraft[] = [];
  let failedBatches = written.failedBatches;
  let attempts = written.attempts;
  if (additions.length) {
    const addPicks: Pick[] = additions.map((a) => ({ clusterIds: [a.clusterId], topic: a.topic }));
    if (Date.now() < deadlineMs - MIN_CALL_MS) {
      const addArticles = await readArticles(addPicks, byId, deps);
      addArticles.forEach((v, k) => articles.set(k, v));
      const res = await writeStories(buildBlocks(addPicks, byId, articles), ctx);
      addedDrafts = res.drafts;
      failedBatches += res.failedBatches;
      attempts += res.attempts;
    }
    const writtenIds = new Set(addedDrafts.flatMap((d) => d.clusterIds));
    extraAlso = additions
      .filter((a) => !writtenIds.has(a.clusterId))
      .map((a) => {
        const c = byId.get(a.clusterId)!;
        return { clusterIds: [a.clusterId], topic: a.topic, headline: c.title, whatHappened: c.summary || c.title, whyItMatters: '', developing: false };
      });
  }

  const minStories = Math.min(5, picks.length);
  if (written.drafts.length < minStories) {
    throw new Error(`The AI's edition failed validation: only ${written.drafts.length} of ${picks.length} stories were written.`);
  }

  const used = new Set<string>();
  const main = assembleStories([...written.drafts, ...addedDrafts], byId, articles, used);
  const taken = new Set([...picks.flatMap((p) => p.clusterIds), ...additions.map((a) => a.clusterId)]);
  const storyTopics = new Set(main.stories.map((s) => s.topic));
  const alsoDrafts = topUpAlso(
    [...extraAlso, ...(editor ? editor.alsoHappening : fallbackAlso(cand, taken))].slice(0, MAX_ALSO),
    storyTopics,
    cand,
    taken,
  );
  const also = assembleAlso(alsoDrafts, byId, used);

  const mustInStories = new Set([...written.drafts, ...addedDrafts].flatMap((d) => d.clusterIds).filter((id) => mustIds.has(id))).size;
  const coverage = buildCoverage(cand, main.stories.length, also.items.length, mustInStories, addedDrafts.length);

  const briefing: Briefing = {
    date,
    generatedAt: new Date().toISOString(),
    summary: summaryResult?.summary ?? fallbackSummary(main.stories),
    stories: main.stories,
    calendar: summaryResult?.calendar ?? [],
    markets: await marketsPromise,
    alsoHappening: also.items,
    coverage,
  };

  return {
    briefing,
    contexts: [...main.contexts, ...also.contexts],
    stats: {
      feeds: cand.statuses,
      items: cand.items.length,
      clusters: cand.totalClusters,
      picks: picks.length,
      mustInclude: mustIds.size,
      additions: addedDrafts.length,
      alsoHappening: also.items.length,
      articlesRead: [...articles.values()].filter((a) => a.ok).length,
      pickFallback: fallback,
      editorFailed: editor === null,
      ...(editorError ? { editorError } : {}),
      batchesFailed: failedBatches,
      editionAttempts: attempts,
      topicFills: fills,
      byTopic: countByTopic(main.stories, also.items),
      model: written.model ?? pickModel,
      ms: Date.now() - started,
    },
  };
}

export { alsoToStory };
