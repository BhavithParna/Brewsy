// "Since this morning": the lighter daytime check, added to the latest world edition.
// It runs just before each region's local section is made (so a reader there wakes up to
// what happened overnight) and twice in the owner's day (prefs.ts planTick).
//
// Same feeds, grouping and scoring as the morning run, but only a story that
// passes the major bar (the must-include rule: 5+ major outlets, or a wire
// "breaking" flag) and isn't in today's edition yet gets written up. At most
// two per check, so a busy news day can't turn the edition into a feed.
//
// Topics the reader asked for more of have a lower bar: a story in one of them
// that broke after the edition was made and that 4+ outlets already cover can
// take one of the two places. It never sends a push (only the major bar does).

import { usedIds } from './briefing.ts';
import type { Cluster } from './dedupe.ts';
import {
  assembleStories, buildBlocks, collectCandidates, defaultDeps, hintToTopic, type PipelineDeps, readArticles, type StoryContext,
  writeStories,
} from './pipeline.ts';
import type { Prefs } from './prefs.ts';
import { type ClusterScore, editionTokenSets, isPushWorthy, matchesAny } from './scoring.ts';
import type { Briefing, Story, Topic } from './types.ts';
import type { Pick } from './validate.ts';

export const MAX_UPDATES_PER_CHECK = 2;
/** Of those, at most this many may come from the lower "more of this" bar. */
export const MAX_FOCUS_UPDATES_PER_CHECK = 1;
/** The lower bar for a focus topic: this many distinct outlets… */
export const FOCUS_UPDATE_MIN_OUTLETS = 4;
/** …all of whose coverage started after the edition was made (minus this lead). */
const FOCUS_UPDATE_LEAD_MS = 60 * 60_000;

export type UpdateResult = {
  added: { story: Story; score: ClusterScore; pushWorthy: boolean }[];
  contexts: StoryContext[];
  stats: { items: number; clusters: number; feedsFailed: string[]; candidates: { id: string; title: string; why: string[] }[]; ms: number };
};

/** Everything already published today, as word sets (headlines + source titles). */
export function publishedTokens(b: Briefing, updates: Story[]): Set<string>[] {
  return [
    ...editionTokenSets(b.stories),
    ...editionTokenSets(updates),
    ...editionTokenSets((b.alsoHappening ?? []).map((a) => ({ headline: a.headline, allSources: a.sources }))),
  ];
}

/** Major, and not already in today's edition: best-scored first. Pure; tested. */
export function newMajorClusters(clusters: Cluster[], scores: Map<string, ClusterScore>, published: Set<string>[]): Cluster[] {
  return clusters
    .filter((c) => scores.get(c.id)?.mustInclude && !matchesAny(c, published))
    .sort((a, b) => scores.get(b.id)!.score - scores.get(a.id)!.score);
}

/**
 * "More of this" topics: well-covered (FOCUS_UPDATE_MIN_OUTLETS+), brand-new since the
 * edition, not yet published, and not major (those come through newMajorClusters).
 * Best-scored first, each with the focus topic it belongs to. Pure; tested.
 */
export function newFocusClusters(
  clusters: Cluster[],
  scores: Map<string, ClusterScore>,
  published: Set<string>[],
  focus: Topic[],
  editionAt: string,
): { cluster: Cluster; topic: Topic }[] {
  const since = Date.parse(editionAt) - FOCUS_UPDATE_LEAD_MS;
  if (!focus.length || !Number.isFinite(since)) return [];
  const out: { cluster: Cluster; topic: Topic }[] = [];
  for (const c of clusters) {
    const topic = focus.find((t) => c.topicHints.includes(t));
    const score = scores.get(c.id);
    if (!topic || !score || score.mustInclude || c.outlets.length < FOCUS_UPDATE_MIN_OUTLETS) continue;
    if (Math.min(...c.items.map((it) => Date.parse(it.publishedAt))) < since) continue;
    if (matchesAny(c, published)) continue;
    out.push({ cluster: c, topic });
  }
  return out.sort((a, b) => scores.get(b.cluster.id)!.score - scores.get(a.cluster.id)!.score);
}

export async function checkForUpdates(opts: {
  prefs: Prefs;
  now: Date;
  date: string;
  briefing: Briefing;
  updates: Story[];
  deadlineMs: number;
  deps?: PipelineDeps;
}): Promise<UpdateResult> {
  const started = Date.now();
  const { prefs, now, date, briefing, updates, deadlineMs } = opts;
  const deps = opts.deps ?? defaultDeps;

  const cand = await collectCandidates(prefs, now, deps);
  const published = publishedTokens(briefing, updates);
  const major = newMajorClusters(cand.clusters, cand.scores, published).slice(0, MAX_UPDATES_PER_CHECK);
  const focusPicks = newFocusClusters(cand.clusters, cand.scores, published, prefs.focusTopics ?? [], briefing.generatedAt)
    .slice(0, Math.min(MAX_FOCUS_UPDATES_PER_CHECK, MAX_UPDATES_PER_CHECK - major.length));
  const fresh = [...major, ...focusPicks.map((f) => f.cluster)];
  const focusTopic = new Map(focusPicks.map((f) => [f.cluster.id, f.topic]));
  const stats = {
    items: cand.items.length,
    clusters: cand.totalClusters,
    feedsFailed: cand.statuses.filter((s) => !s.ok && !s.skipped).map((s) => s.sourceId),
    candidates: fresh.map((c) => ({
      id: c.id,
      title: c.title,
      why: [...cand.scores.get(c.id)!.why, ...(focusTopic.has(c.id) ? [`more of ${focusTopic.get(c.id)}`] : [])],
    })),
    ms: 0,
  };
  if (!fresh.length) return { added: [], contexts: [], stats: { ...stats, ms: Date.now() - started } };

  const byId = new Map(cand.clusters.map((c) => [c.id, c]));
  const picks: Pick[] = fresh.flatMap((c) => {
    const topic = focusTopic.get(c.id) ?? hintToTopic(c);
    return topic ? [{ clusterIds: [c.id], topic }] : [];
  });
  const articles = await readArticles(picks, byId, deps);
  const { drafts } = await writeStories(buildBlocks(picks, byId, articles), { prefs, date, deadlineMs, deps, purpose: 'refresh' });
  const { stories, contexts } = assembleStories(drafts, byId, articles, usedIds(briefing, updates));

  const addedAt = new Date().toISOString();
  const added = stories.map((story, i) => {
    const id = drafts[i].clusterIds[0];
    const score = cand.scores.get(id)!;
    // A "more of this" story is added quietly: pushes are for genuinely major news only.
    return { story: { ...story, addedAt }, score, pushWorthy: !focusTopic.has(id) && isPushWorthy(score) };
  });
  return { added, contexts, stats: { ...stats, ms: Date.now() - started } };
}
