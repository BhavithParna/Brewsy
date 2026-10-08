// "Since this morning": the lighter daytime check (every 2 hours, 7am–10pm).
//
// Same feeds, grouping and scoring as the morning run, but only a story that
// passes the major bar (the must-include rule: 5+ major outlets, or a wire
// "breaking" flag) and isn't in today's edition yet gets written up. At most
// two per check, so a busy news day can't turn the edition into a feed.

import { usedIds } from './briefing.ts';
import type { Cluster } from './dedupe.ts';
import {
  assembleStories, buildBlocks, collectCandidates, defaultDeps, hintToTopic, type PipelineDeps, readArticles, type StoryContext,
  writeStories,
} from './pipeline.ts';
import type { Prefs } from './prefs.ts';
import { type ClusterScore, editionTokenSets, isPushWorthy, matchesAny } from './scoring.ts';
import type { Briefing, Story } from './types.ts';
import type { Pick } from './validate.ts';

export const MAX_UPDATES_PER_CHECK = 2;

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
  const fresh = newMajorClusters(cand.clusters, cand.scores, publishedTokens(briefing, updates)).slice(0, MAX_UPDATES_PER_CHECK);
  const stats = {
    items: cand.items.length,
    clusters: cand.totalClusters,
    feedsFailed: cand.statuses.filter((s) => !s.ok && !s.skipped).map((s) => s.sourceId),
    candidates: fresh.map((c) => ({ id: c.id, title: c.title, why: cand.scores.get(c.id)!.why })),
    ms: 0,
  };
  if (!fresh.length) return { added: [], contexts: [], stats: { ...stats, ms: Date.now() - started } };

  const byId = new Map(cand.clusters.map((c) => [c.id, c]));
  const picks: Pick[] = fresh.flatMap((c) => {
    const topic = hintToTopic(c);
    return topic ? [{ clusterIds: [c.id], topic }] : [];
  });
  const articles = await readArticles(picks, byId, deps);
  const { drafts } = await writeStories(buildBlocks(picks, byId, articles), { prefs, date, deadlineMs, deps });
  const { stories, contexts } = assembleStories(drafts, byId, articles, usedIds(briefing, updates));

  const addedAt = new Date().toISOString();
  const added = stories.map((story, i) => {
    const score = cand.scores.get(drafts[i].clusterIds[0])!;
    return { story: { ...story, addedAt }, score, pushWorthy: isPushWorthy(score) };
  });
  return { added, contexts, stats: { ...stats, ms: Date.now() - started } };
}
