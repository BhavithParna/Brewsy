// The 13 topics: every beat has sources, reaches the AI, and ends up in the edition somewhere.

import { assert, assertEquals } from 'jsr:@std/assert@1';

import { type Cluster, clusterAll } from '../_shared/dedupe.ts';
import { type Candidates, candidateSlate, countByTopic, fillTopics, topUpAlso } from '../_shared/pipeline.ts';
import { editorSchema, pickPrompt, pickSchema, scriptPrompt } from '../_shared/prompts.ts';
import { rankClusters } from '../_shared/scoring.ts';
import { isMajorOutlet, outletInfo, SOURCES, type TopicHint } from '../_shared/sources.ts';
import { TOPICS, type Topic } from '../_shared/types.ts';
import { item, NOW } from './fixtures.ts';

function cluster(id: string, hint: TopicHint, outlets: string[], title = `${hint} story ${id}`): Cluster {
  return {
    id,
    items: outlets.map((outlet) => item({ outlet, topicHint: hint, title })),
    outlets,
    topicHints: [hint],
    title,
    summary: `${title}, with details.`,
    latestAt: NOW.toISOString(),
    score: outlets.length,
  };
}

function candidates(clusters: Cluster[]): Candidates {
  const { ranked, scores } = rankClusters(clusters, { now: NOW });
  return { items: clusters.flatMap((c) => c.items), statuses: [], clusters: ranked, scores, totalClusters: clusters.length };
}

Deno.test('sources: every topic has at least two feeds; specialist press is never a "major outlet"', () => {
  for (const topic of TOPICS) {
    const feeds = SOURCES.filter((s) => s.topicHint === topic);
    assert(feeds.length >= 2, `${topic} has ${feeds.length} feed(s)`);
  }
  const specialist = SOURCES.filter((s) => s.category === 'specialist');
  assert(specialist.length >= 20);
  assert(specialist.every((s) => s.trust !== 'high' && !isMajorOutlet(s.outlet)), 'specialist press counts as coverage, not as a major newsroom');
  assertEquals(outletInfo('ESPNcricinfo').category, 'specialist');
  assert(isMajorOutlet('The Hindu') && isMajorOutlet('The Indian Express'));
});

Deno.test('candidateSlate: best-first, but each topic keeps its best few even if they score low', () => {
  const big = Array.from({ length: 30 }, (_, i) => cluster(`w${i}`, 'world', ['Reuters', 'BBC News', 'NPR']));
  const games = [cluster('g1', 'gaming', ['IGN']), cluster('g2', 'gaming', ['Polygon']), cluster('g3', 'gaming', ['Kotaku'])];
  const all = [...big, ...games];
  const slate = candidateSlate(all, 10, 2);
  assertEquals(slate.length, 10);
  assertEquals(slate.filter((c) => c.topicHints.includes('gaming')).map((c) => c.id), ['g1', 'g2']);
  assertEquals(slate[0].id, 'w0', 'order stays best-first');
  assertEquals(candidateSlate(all.slice(0, 5), 10).length, 5, 'a short list is returned as is');
});

Deno.test('fillTopics: one story for each uncovered topic with real (2+ outlet) news; no deals, no reviews', () => {
  const cand = candidates([
    cluster('w1', 'world', ['Reuters', 'BBC News']),
    cluster('g1', 'gaming', ['IGN', 'Polygon'], 'Studio behind hit game announces sequel'),
    cluster('s1', 'sports', ['ESPNcricinfo'], 'India win the third Test'),
    cluster('c1', 'crypto', ['CoinDesk', 'Decrypt'], 'Best deals on hardware wallets this week'),
    cluster('a1', 'autos', ['Autocar', 'Motor1'], 'New electric hatchback review: quick and quiet'),
    cluster('a2', 'autos', ['Electrek', 'InsideEVs'], 'Carmaker recalls 200,000 EVs over battery fires'),
  ]);
  const fills = fillTopics([{ clusterIds: ['w1'], topic: 'world' }], cand, 10);
  assertEquals(fills.map((p) => [p.topic, p.clusterIds[0]]), [['autos', 'a2'], ['gaming', 'g1']]);
  assertEquals(fillTopics([{ clusterIds: ['w1'], topic: 'world' }], cand, 1).length, 1, 'never more than the room left');
  const covered = [{ clusterIds: ['w1'], topic: 'world' as Topic }, { clusterIds: ['g1'], topic: 'gaming' as Topic }, { clusterIds: ['a2'], topic: 'autos' as Topic }];
  assertEquals(fillTopics(covered, cand, 10).length, 0, 'crypto only has a deals post, sports only one outlet');
});

Deno.test('topUpAlso: a topic with no story and no line gets its best headline; covered topics are left alone', () => {
  const cand = candidates([
    cluster('w1', 'world', ['Reuters', 'BBC News']),
    cluster('s1', 'sports', ['ESPNcricinfo'], 'India win the third Test'),
    cluster('s2', 'sports', ['Sky Sports'], 'Arsenal sign striker'),
    cluster('s3', 'sports', ['CBS Sports'], 'How to watch tonight’s game'),
    cluster('e1', 'entertainment', ['Variety'], 'Studio sets release date for sequel'),
  ]);
  const also = [{ clusterIds: ['e1'], topic: 'entertainment' as Topic, headline: 'Sequel dated', whatHappened: 'x', whyItMatters: '', developing: false }];
  const out = topUpAlso(also, new Set<Topic>(['world']), cand, new Set(['w1']));
  assertEquals(out.length, 3);
  assertEquals(out.slice(1).map((a) => [a.topic, a.clusterIds[0]]), [['sports', 's1'], ['sports', 's2']]);
  assertEquals(out[1].headline, 'India win the third Test');
});

Deno.test('countByTopic: per-topic counts for the logs, empty topics left out', () => {
  assertEquals(countByTopic([{ topic: 'ai' }, { topic: 'ai' }, { topic: 'sports' }], [{ topic: 'sports' }, { topic: 'crypto' }]), {
    ai: { stories: 2, also: 0 },
    sports: { stories: 1, also: 1 },
    crypto: { stories: 0, also: 1 },
  });
});

Deno.test('clusterAll: the cap keeps a share of every beat, not only the best-covered general news', () => {
  const items = [
    ...Array.from({ length: 40 }, (_, k) => {
      const words = ['zephyr', 'quartz', 'nimbus', 'ember'].map((w) => `${w}${k}x`).join(' ');
      return ['Reuters', 'BBC News', 'NPR'].map((outlet, i) => item({ outlet, topicHint: 'world', title: `${words} update ${i}`, link: `https://w.example/${k}/${i}` }));
    }).flat(),
    item({ outlet: 'IGN', topicHint: 'gaming', title: 'Console maker cuts handheld price in Japan', link: 'https://ign.example/1' }),
    item({ outlet: 'ESPNcricinfo', topicHint: 'sports', title: 'Spinner takes six wickets on debut', link: 'https://cricinfo.example/1' }),
  ];
  const { clusters } = clusterAll(items, { now: NOW, maxClusters: 28 });
  assertEquals(clusters.length, 28);
  assert(clusters.some((c) => c.topicHints.includes('gaming')), 'a gaming story survives the cap');
  assert(clusters.some((c) => c.topicHints.includes('sports')), 'a sports story survives the cap');
});

Deno.test('prompts: all 13 topics are offered; schemas stay within what Gemini accepts; audio length follows the story count', () => {
  const prompt = pickPrompt([], TOPICS, '2026-10-08', NOW, 12);
  assert(prompt.includes('Topics to include: ai, tech, business, world, politics, science, health, climate, autos, gaming, sports, entertainment, crypto.'));
  assert(prompt.includes('its single most important story'));
  assert(!/\bsports, horoscopes\b/.test(prompt), 'sport is a topic now, not junk');
  assert(!prompt.includes('The reader follows'), 'no focus line when every topic is followed');
  const focused = pickPrompt([], TOPICS, '2026-10-08', NOW, 12, ['ai', 'tech', 'business']);
  assert(focused.includes('The reader follows ai, tech, business') && focused.includes('2–4 stories'), 'followed topics get depth');
  assert(focused.includes('Topics to include: ai, tech, business, world, politics,'), 'but the edition still covers every topic');
  // deno-lint-ignore no-explicit-any
  const editor = editorSchema(TOPICS) as any;
  assertEquals(editor.properties.alsoHappening.maxItems, 15, 'Gemini rejects the editor schema at 30 items (HTTP 400)');
  // deno-lint-ignore no-explicit-any
  assert((pickSchema(TOPICS) as any).properties.picks.maxItems <= 16);
  assertEquals(editor.properties.alsoHappening.items.properties.topic.enum, TOPICS);
  const story = { id: 's', topic: 'ai' as Topic, headline: 'h', dek: 'd', whatHappened: 'w', whyItMatters: 'y' };
  assert(scriptPrompt('full', ['a'], Array(10).fill(story), 'Thursday').includes('roughly 1,160 words'));
  assert(scriptPrompt('quick', ['a'], Array(18).fill(story), 'Thursday').includes('roughly 690 words'));
});
