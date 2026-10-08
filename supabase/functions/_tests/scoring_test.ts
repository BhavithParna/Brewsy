// Importance scoring, the must-include rule, and the daytime "Since this morning" check.

import { assert, assertEquals } from 'jsr:@std/assert@1';

import type { ArticleText } from '../_shared/articles.ts';
import { alsoToStory, findStory, usedIds } from '../_shared/briefing.ts';
import { clusterAll } from '../_shared/dedupe.ts';
import type { FeedItem } from '../_shared/feeds.ts';
import type { GenerateJsonOptions } from '../_shared/llm.ts';
import type { PipelineDeps } from '../_shared/pipeline.ts';
import { DEFAULT_PREFS } from '../_shared/prefs.ts';
import { editionTokenSets, isPushWorthy, MUST_INCLUDE_MAJOR_OUTLETS, rankClusters, scoreCluster } from '../_shared/scoring.ts';
import type { Briefing } from '../_shared/types.ts';
import { checkForUpdates, MAX_UPDATES_PER_CHECK, newMajorClusters, publishedTokens } from '../_shared/updates.ts';
import { goodStory, item, NOW, sampleItems } from './fixtures.ts';

const MAJORS = ['Reuters', 'Associated Press', 'BBC News', 'The New York Times', 'The Guardian', 'The Wall Street Journal', 'Bloomberg', 'NPR'];

/** One event covered by the first `n` major outlets. */
function event(n: number, words: string, extra: Partial<FeedItem> = {}): FeedItem[] {
  return MAJORS.slice(0, n).map((outlet, i) =>
    item({ outlet, topicHint: 'world', title: `${words} ${['', 'today', 'officials say', 'reports', 'latest', 'update', 'live', 'news'][i]}`.trim(), summary: `${words} on Wednesday, according to officials and witnesses.`, publishedAt: '2026-10-07T10:00:00Z', ...extra }));
}

const quake = () => event(5, 'Magnitude 7.8 earthquake strikes northern Chile tsunami warning issued');

Deno.test('must-include: 5 major outlets → always included; 4 → not', () => {
  assertEquals(MUST_INCLUDE_MAJOR_OUTLETS, 5);
  const five = clusterAll(quake(), { now: NOW }).clusters[0];
  const s5 = scoreCluster(five, { now: NOW });
  assertEquals(s5.majorOutlets, 5);
  assert(s5.mustInclude);
  const four = clusterAll(event(4, 'Magnitude 7.8 earthquake strikes northern Chile tsunami warning issued'), { now: NOW }).clusters[0];
  assert(!scoreCluster(four, { now: NOW }).mustInclude);
});

Deno.test('must-include: a wire "breaking" flag counts on its own; the same flag elsewhere only boosts', () => {
  const wire = clusterAll([item({ outlet: 'Reuters', topicHint: 'world', title: 'Central bank chief resigns unexpectedly', breaking: true })], { now: NOW }).clusters[0];
  assert(scoreCluster(wire, { now: NOW }).mustInclude);
  const blog = clusterAll([item({ outlet: 'Ars Technica', topicHint: 'tech', title: 'Central bank chief resigns unexpectedly', breaking: true })], { now: NOW }).clusters[0];
  const s = scoreCluster(blog, { now: NOW });
  assert(!s.mustInclude && !s.breaking);
});

Deno.test('breadth beats everything else; trust and impact break ties; follow-ups to yesterday rank lower', () => {
  const items = [...quake(), ...sampleItems()];
  const { clusters } = clusterAll(items, { now: NOW });
  const { ranked, scores } = rankClusters(clusters, { now: NOW });
  assert(/earthquake/i.test(ranked[0].title));
  assert(scores.get(ranked[0].id)!.why[0].startsWith('5 outlets (5 major)'));
  // Two-outlet stories outrank one-outlet ones.
  const firstSingle = ranked.findIndex((c) => c.outlets.length === 1);
  assert(ranked.slice(firstSingle).every((c) => c.outlets.length === 1));
  // Impact: the bond sell-off (markets + rates) beats the Nobel chemistry story (no impact rules).
  const bonds = ranked.find((c) => /Treasury/.test(c.title))!;
  assert(scores.get(bonds.id)!.why.includes('markets moved'));

  const yesterday = editionTokenSets([{ headline: 'Strong earthquake strikes northern Chile, tsunami warning issued' }]);
  const again = rankClusters(clusters, { now: NOW, previous: yesterday });
  const q = again.scores.get(ranked[0].id)!;
  assert(q.isUpdate);
  assert(q.score < scores.get(ranked[0].id)!.score);
  assert(q.mustInclude, 'still must-include: big follow-ups are still news');
});

Deno.test('push-worthy is a higher bar than must-include', () => {
  const five = scoreCluster(clusterAll(quake(), { now: NOW }).clusters[0], { now: NOW });
  assert(!isPushWorthy(five));
  const seven = scoreCluster(clusterAll(event(7, 'Magnitude 7.8 earthquake strikes northern Chile tsunami warning issued'), { now: NOW }).clusters[0], { now: NOW });
  assert(isPushWorthy(seven));
});

// ─── Daytime updates ───

const MORNING: Briefing = {
  date: '2026-10-07',
  generatedAt: '2026-10-07T00:00:00Z',
  summary: ['A.'],
  stories: [{ ...goodStory('x'), id: 'finland', headline: 'Finland orders halt to work on two Google data centres', readTimeMinutes: 1, sources: [], allSources: [], imageUrl: null }],
  calendar: [],
  markets: [],
  alsoHappening: [{ id: 'also-kenya', topic: 'world', headline: "Kenya's first Ebola case: ten people quarantined", whatHappened: 'x', whyItMatters: 'y', sources: [{ name: 'BBC News', url: 'https://bbc.example/k' }] }],
};

Deno.test('newMajorClusters: only must-include stories not already published today', () => {
  const finlandMajor = event(5, 'Finland orders halt to work on two Google data centres');
  const { clusters } = clusterAll([...finlandMajor, ...quake(), ...sampleItems()], { now: NOW });
  const { ranked, scores } = rankClusters(clusters, { now: NOW });
  const fresh = newMajorClusters(ranked, scores, publishedTokens(MORNING, []));
  assertEquals(fresh.length, 1);
  assert(/earthquake/i.test(fresh[0].title));
  // Once it's published as an update, it's not new any more.
  const asUpdate = [{ ...MORNING.stories[0], id: 'quake', headline: 'Magnitude 7.8 earthquake strikes northern Chile; tsunami warning issued' }];
  assertEquals(newMajorClusters(ranked, scores, publishedTokens(MORNING, asUpdate)).length, 0);
});

function updateDeps(items: () => FeedItem[], seen: GenerateJsonOptions[]): PipelineDeps {
  return {
    fetchFeeds: () => Promise.resolve({ items: items(), statuses: [{ sourceId: 'reuters', outlet: 'Reuters', category: 'wire', ok: false, items: 0, ms: 1, error: 'fetch failed' }] }),
    fetchArticle: (): Promise<ArticleText> => Promise.resolve({ ok: false, ogImage: null, title: null, text: '' }),
    fetchMarkets: () => Promise.resolve([]),
    generateJson: (o) => {
      seen.push(o);
      const ids = [...o.prompt.matchAll(/=== STORY \d+ · clusterIds: ([^·]+) ·/g)].map((m) => m[1].split(',')[0].trim());
      const data = { stories: ids.map((id) => ({ ...goodStory(id, 'world'), headline: 'Strong quake hits Chile', developing: true })) };
      return Promise.resolve({ data, text: '', model: 'fake', finishReason: 'end_turn', usage: {} });
    },
  };
}

Deno.test('checkForUpdates: writes up a new major story (at most two), marks it developing + new', async () => {
  const seen: GenerateJsonOptions[] = [];
  const res = await checkForUpdates({
    prefs: DEFAULT_PREFS, now: NOW, date: '2026-10-07', briefing: MORNING, updates: [], deadlineMs: Date.now() + 120_000,
    deps: updateDeps(() => [...quake(), ...sampleItems()], seen),
  });
  assertEquals(seen.length, 1);
  assertEquals(res.added.length, 1);
  const s = res.added[0].story;
  assertEquals(s.headline, 'Strong quake hits Chile');
  assertEquals(s.developing, true);
  assert(s.addedAt && Date.parse(s.addedAt) > 0);
  assertEquals(s.sources.length > 0, true);
  assert(!res.added[0].pushWorthy);
  assertEquals(res.stats.feedsFailed, ['reuters']);
  assert(res.contexts.some((c) => c.story_id === s.id));
  assert(MAX_UPDATES_PER_CHECK <= 2);
});

Deno.test('checkForUpdates: nothing new → no AI call at all', async () => {
  const seen: GenerateJsonOptions[] = [];
  const res = await checkForUpdates({
    prefs: DEFAULT_PREFS, now: NOW, date: '2026-10-07', briefing: MORNING, updates: [], deadlineMs: Date.now() + 120_000,
    deps: updateDeps(sampleItems, seen),
  });
  assertEquals(res.added.length, 0);
  assertEquals(seen.length, 0);
});

Deno.test('findStory finds main stories, updates and "also happening" items (for Go deeper / Ask)', () => {
  const update = { ...MORNING.stories[0], id: 'quake', headline: 'Quake' };
  assertEquals(findStory(MORNING, [update], 'finland')?.id, 'finland');
  assertEquals(findStory(MORNING, [update], 'quake')?.headline, 'Quake');
  const also = findStory(MORNING, [], 'also-kenya')!;
  assertEquals(also, alsoToStory(MORNING.alsoHappening![0]));
  assertEquals(also.sources[0].name, 'BBC News');
  assertEquals(findStory(MORNING, null, 'nope'), null);
  assertEquals([...usedIds(MORNING, [update])].sort(), ['also-kenya', 'finland', 'quake']);
});
