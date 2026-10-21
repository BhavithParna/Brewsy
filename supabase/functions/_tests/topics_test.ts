// The 15 topics: every beat has sources, reaches the AI, and ends up in the edition somewhere.
// "More of this" (focus) topics get more of everything.

import { assert, assertEquals } from 'jsr:@std/assert@1';

import { type Cluster, clusterAll, spreadAcrossOutlets } from '../_shared/dedupe.ts';
import {
  type Candidates, candidateSlate, countByTopic, fallbackAlso, fillTopics, FOCUS_TOPIC_CANDIDATES, storyTarget, topUpAlso,
} from '../_shared/pipeline.ts';
import { editorPrompt, editorSchema, PICK_SYSTEM, pickPrompt, pickSchema, scriptPrompt } from '../_shared/prompts.ts';
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
  // A "more of this" beat keeps three times its share.
  const films = Array.from({ length: 8 }, (_, k) =>
    item({ outlet: 'Variety', topicHint: 'movies', title: ['orbit', 'lantern', 'harbor', 'meadow'].map((w) => `${w}${k}m`).join(' '), link: `https://variety.example/${k}` }));
  const count = (focus: Topic[]) => clusterAll([...items, ...films], { now: NOW, maxClusters: 30, focus }).clusters.filter((c) => c.topicHints.includes('movies')).length;
  assertEquals(count([]), 1);
  assertEquals(count(['movies']), 3);
});

Deno.test('prompts: all 15 topics are offered; schemas stay within what Gemini accepts; audio length follows the story count', () => {
  const prompt = pickPrompt([], TOPICS, '2026-10-08', NOW, 12);
  assert(prompt.includes('Topics to include: ai, tech, business, world, politics, science, health, climate, oceans, autos, gaming, sports, entertainment, movies, crypto.'));
  assert(prompt.includes('Oceans, gaming, sports, entertainment, movies, autos and crypto get one story each'));
  assert(!prompt.includes('asked for more of'), 'no "more of" line without focus topics');
  assert(prompt.includes('its single most important story'));
  assert(!/\bsports, horoscopes\b/.test(prompt), 'sport is a topic now, not junk');
  assert(!prompt.includes('The reader follows'), 'no focus line when every topic is followed');
  const focused = pickPrompt([], TOPICS, '2026-10-08', NOW, 12, ['ai', 'tech', 'business']);
  assert(focused.includes('The reader follows ai, tech and business') && focused.includes('2–4 stories'), 'followed topics get depth');
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

// ─── Movies ───

Deno.test('movies: its own beat, fed by Hollywood trades, world and indie film press, and Indian cinema desks', () => {
  const film = SOURCES.filter((s) => s.topicHint === 'movies');
  assert(film.length >= 35, `${film.length} film feeds`);
  const outlets = new Set(film.map((s) => s.outlet));
  for (const o of ['Variety', 'Deadline', 'The Hollywood Reporter', 'IndieWire', 'Screen Daily', 'Bollywood Hungama', 'Cinema Express', 'The Hindu']) {
    assert(outlets.has(o), `${o} feeds the movies beat`);
  }
  // World cinema, not just Hollywood and Bollywood: one outlet per region or beat at least.
  const world: Record<string, string[]> = {
    'the trades\' international desks': ['variety-global', 'variety-international', 'deadline-international'],
    'South Indian film': ['ht-tamil-cinema', 'ht-telugu-cinema', 'onmanorama-movies'],
    'East and Southeast Asia': ['scmp-film', 'city-on-fire', 'rappler-movies'],
    'the Middle East and Turkey': ['the-national-film', 'daily-sabah-cinema'],
    'Africa': ['afrocritik', 'nollycritic', 'sinema-focus', 'bizcommunity-film'],
    'Europe, Australia and Canada': ['guardian-film', 'cinecitta-news', 'if-magazine', 'playback'],
    'animation and documentary': ['cartoon-brew', 'animation-magazine', 'pov-magazine', 'business-doc-europe'],
  };
  const ids = new Set(film.map((s) => s.id));
  for (const [region, list] of Object.entries(world)) {
    for (const id of list) assert(ids.has(id), `${id} feeds the movies beat (${region})`);
  }
  assert(film.every((s) => s.category === 'specialist' || s.category === 'major'));
  assert(film.filter((s) => s.category === 'major').every((s) => isMajorOutlet(s.outlet)), 'newsroom film desks keep their newsroom standing');
  assertEquals(outletInfo('Hindustan Times').category, 'major');
  assertEquals(outletInfo('South China Morning Post').category, 'major');
  assertEquals(outletInfo('Bollywood Hungama').category, 'specialist');
  assertEquals(outletInfo('Afrocritik').category, 'specialist');
  assert(!isMajorOutlet('The National') && !isMajorOutlet('Daily Sabah'), 'newsrooms we only read for film count as film press');
  assert(PICK_SYSTEM.includes('- movies: films from Hollywood, Bollywood'), 'the AI knows what movies covers');
  assert(PICK_SYSTEM.includes('films go under movies'), 'and that films are not entertainment');
});

// ─── Oceans ───

Deno.test('oceans: its own beat, fed by a newsroom ocean desk, specialist ocean press and the research institutes', () => {
  const sea = SOURCES.filter((s) => s.topicHint === 'oceans');
  assert(sea.length >= 8, `${sea.length} ocean feeds`);
  const ids = new Set(sea.map((s) => s.id));
  const beats: Record<string, string[]> = {
    'a major newsroom': ['guardian-oceans', 'guardian-marine-life'],
    'conservation, fisheries and marine protection': ['mongabay-marine', 'inside-climate-oceans', 'dialogue-earth-ocean'],
    'sea life and ocean news': ['oceanographic', 'mongabay-india-oceans'],
    'ocean science, the deep sea and sea ice': ['sciencedaily-oceanography', 'whoi', 'mbari'],
  };
  for (const [beat, list] of Object.entries(beats)) {
    for (const id of list) assert(ids.has(id), `${id} feeds the oceans beat (${beat})`);
  }
  assert(sea.every((s) => !s.region), 'ocean news is a world beat, never one region\'s local section');
  assert(sea.every((s) => s.kind === 'rss'));
  assertEquals(outletInfo('The Guardian').category, 'major', 'its ocean desk keeps the newsroom\'s standing');
  assertEquals(outletInfo('Mongabay').category, 'specialist');
  assertEquals(outletInfo('ScienceDaily').trust, 'low', 'press-release aggregators count lightly, like Phys.org');
  assertEquals(outletInfo('WHOI').category, 'official');
  assert(!isMajorOutlet('Oceanographic Magazine') && !isMajorOutlet('MBARI'));
  // It's an opt-in topic: in the edition for everyone, but new readers don't start with it.
  assert(TOPICS.indexOf('oceans') === TOPICS.indexOf('climate') + 1, 'Oceans comes right after Climate on Today');
  assert(PICK_SYSTEM.includes('- oceans: the oceans and seas and what lives in them: whales, sharks, coral reefs'), 'the AI knows what oceans covers');
  assert(PICK_SYSTEM.includes('a story mainly about the sea or sea life is oceans, not science or climate'));
  assert(PICK_SYSTEM.includes('the seas and sea life go under oceans'), 'and the climate line agrees');
  const editor = editorPrompt([], [], '2026-10-08', NOW, { topics: TOPICS, followed: ['world', 'oceans'], more: [] });
  assert(editor.includes('Oceans works well at a glance'));
  assert(!editorPrompt([], [], '2026-10-08', NOW, { topics: TOPICS, followed: ['world', 'movies'], more: [] }).includes('Oceans works well'));
});

Deno.test('oceans: a quiet beat still gets its one story or line, and a sea story from a science feed can land there', () => {
  const cand = candidates([
    cluster('w1', 'world', ['Reuters', 'BBC News']),
    cluster('o1', 'oceans', ['Mongabay', 'The Guardian'], 'Nations agree to protect a deep-sea ridge from bottom trawling'),
    cluster('o2', 'oceans', ['Oceanographic Magazine'], 'Rare beaked whale filmed alive for the first time'),
  ]);
  const fills = fillTopics([{ clusterIds: ['w1'], topic: 'world' }], cand, 10, { followed: ['world', 'oceans'] });
  assertEquals(fills.map((p) => [p.topic, p.clusterIds[0]]), [['oceans', 'o1']]);
  const also = topUpAlso([], new Set<Topic>(['world']), cand, new Set(['w1']));
  assert(also.some((a) => a.topic === 'oceans' && a.clusterIds[0] === 'o1'), 'and a headline line when it has no story');
  // The grouping cap keeps a share of the ocean beat too.
  const items = [
    ...Array.from({ length: 40 }, (_, k) =>
      ['Reuters', 'BBC News', 'NPR'].map((outlet, i) =>
        item({ outlet, topicHint: 'world', title: `${['zephyr', 'quartz', 'nimbus'].map((w) => `${w}${k}x`).join(' ')} update ${i}`, link: `https://w.example/${k}/${i}` }))).flat(),
    item({ outlet: 'Mongabay', topicHint: 'oceans', title: 'Silky shark numbers fall as longline fleets move west', link: 'https://mongabay.example/1' }),
  ];
  assert(clusterAll(items, { now: NOW, maxClusters: 28 }).clusters.some((c) => c.topicHints.includes('oceans')), 'an ocean story survives the cap');
});

// ─── "More of this" (focus topics) ───

Deno.test('storyTarget: two more stories for each focus topic, capped so the writing still fits in six batches', () => {
  assertEquals(storyTarget([]), 12);
  assertEquals(storyTarget(['ai']), 14);
  assertEquals(storyTarget(['ai', 'movies']), 16);
  assertEquals(storyTarget(['ai', 'movies', 'sports', 'tech']), 16);
});

Deno.test('candidateSlate: a focus topic keeps its best 10, other topics their best 4', () => {
  const big = Array.from({ length: 60 }, (_, i) => cluster(`w${i}`, 'world', ['Reuters', 'BBC News', 'NPR']));
  const films = Array.from({ length: 12 }, (_, i) => cluster(`m${i}`, 'movies', ['Variety']));
  const games = Array.from({ length: 12 }, (_, i) => cluster(`g${i}`, 'gaming', ['IGN']));
  const all = [...big, ...films, ...games];
  const slate = candidateSlate(all, 30, 4, ['movies']);
  assertEquals(slate.filter((c) => c.topicHints.includes('movies')).length, FOCUS_TOPIC_CANDIDATES);
  assertEquals(slate.filter((c) => c.topicHints.includes('gaming')).length, 4);
  assertEquals(candidateSlate(all, 30, 4).filter((c) => c.topicHints.includes('movies')).length, 4, 'no focus, no extra');
});

Deno.test('a beat\'s reserved places go to different outlets first, so one prolific feed can\'t take them all', () => {
  const big = Array.from({ length: 30 }, (_, i) => cluster(`w${i}`, 'world', ['Reuters', 'BBC News', 'NPR']));
  const variety = Array.from({ length: 6 }, (_, i) => cluster(`m${i}`, 'movies', ['Variety']));
  const africa = [cluster('a1', 'movies', ['Afrocritik']), cluster('n1', 'movies', ['Nollycritic'])];
  const ranked = candidates([...big, ...variety, ...africa]).clusters;
  const films = (focus: Topic[] = []) =>
    candidateSlate(ranked, 34, 4, focus).filter((c) => c.topicHints.includes('movies')).map((c) => c.id);
  assertEquals(films(), ['m0', 'm1', 'a1', 'n1'], 'the best Variety story, then each other outlet\'s best, then the next best');
  assertEquals(films(['movies']).length, 8, 'a focus topic still gets its 10 places, here all 8 film stories');
  // Most-covered stories first; a story that brings no new outlet waits for the second pass.
  const trades = cluster('t1', 'movies', ['Variety', 'Deadline']);
  const spread = spreadAcrossOutlets([trades, cluster('t2', 'movies', ['Deadline']), cluster('t3', 'movies', ['Afrocritik']), cluster('t4', 'movies', ['Variety'])], 3);
  assertEquals(spread.map((c) => c.id), ['t1', 't2', 't3'], 'best-first order kept');
  assertEquals(spreadAcrossOutlets([trades], 3).map((c) => c.id), ['t1'], 'a short list is returned as is');
  // The grouping cap (280 stories) spreads each beat's share the same way.
  const items = [
    ...Array.from({ length: 40 }, (_, k) =>
      ['Reuters', 'BBC News', 'NPR'].map((outlet, i) =>
        item({ outlet, topicHint: 'world', title: `${['zephyr', 'quartz', 'nimbus'].map((w) => `${w}${k}x`).join(' ')} update ${i}`, link: `https://w.example/${k}/${i}` }))).flat(),
    ...Array.from({ length: 6 }, (_, k) =>
      item({ outlet: 'Variety', topicHint: 'movies', title: ['orbit', 'lantern', 'harbor'].map((w) => `${w}${k}m`).join(' '), link: `https://variety.example/${k}` })),
    item({ outlet: 'Nollycritic', topicHint: 'movies', title: 'Lagos epic leads African film award nominations', link: 'https://nollycritic.example/1' }),
  ];
  const kept = clusterAll(items, { now: NOW, maxClusters: 30, focus: ['movies'] }).clusters.filter((c) => c.topicHints.includes('movies'));
  assertEquals(kept.length, 3);
  assert(kept.some((c) => c.outlets.includes('Nollycritic')), 'the Nollywood story survives the cap next to Variety\'s');
});

Deno.test('fillTopics: the reader\'s topics first, then a second story for focus topics, then the rest', () => {
  const cand = candidates([
    cluster('w1', 'world', ['Reuters', 'BBC News']),
    cluster('m1', 'movies', ['Variety', 'Deadline'], 'Studio dates its space epic for next summer'),
    cluster('m2', 'movies', ['Bollywood Hungama', 'Cinema Express'], 'Telugu period drama crosses 300 crore worldwide'),
    cluster('m3', 'movies', ['IndieWire', 'Screen Daily'], 'Festival names its competition line-up'),
    cluster('g1', 'gaming', ['IGN', 'Polygon'], 'Console maker confirms handheld successor'),
    cluster('c1', 'crypto', ['CoinDesk', 'Decrypt'], 'Exchange halts withdrawals after hack'),
  ]);
  const picks = [{ clusterIds: ['w1'], topic: 'world' as Topic }];
  const reader = { followed: ['world', 'movies', 'crypto'] as Topic[], focus: ['movies'] as Topic[] };
  assertEquals(fillTopics(picks, cand, 10, reader).map((p) => [p.topic, p.clusterIds[0]]), [
    ['movies', 'm1'], ['crypto', 'c1'], ['movies', 'm2'], ['gaming', 'g1'],
  ]);
  assertEquals(fillTopics(picks, cand, 2, reader).map((p) => p.topic), ['movies', 'crypto'], 'little room: the reader\'s own topics win');
});

Deno.test('prompts: focus topics ask for 4–6 stories and more "Also happening" lines; Movies works at a glance', () => {
  const pick = pickPrompt([], TOPICS, '2026-10-08', NOW, 14, ['ai', 'tech', 'movies'], ['movies']);
  assert(pick.includes('The reader asked for more of movies') && pick.includes('4–6 stories'));
  assert(pick.includes('The reader follows ai, tech and movies'));
  const editor = editorPrompt([], [], '2026-10-08', NOW, { topics: TOPICS, followed: ['ai', 'tech', 'movies'], more: ['movies'] });
  assert(editor.includes('up to 4 items for each topic the reader asked for more of (movies)'));
  assert(editor.includes('2 items for each other topic they follow (ai, tech)'));
  assert(editor.includes('Movies works well at a glance'));
  const everyone = editorPrompt([], [], '2026-10-08', NOW);
  assert(everyone.includes('give every topic at least one item (including science, health, climate, oceans, autos, gaming, sports, entertainment, movies and crypto)'));
  assert(!everyone.includes('at a glance'));
});

Deno.test('fallbackAlso: if the editor fails, focus topics get up to 4 headline lines, every other topic at most 2', () => {
  const cand = candidates([
    ...Array.from({ length: 6 }, (_, i) => cluster(`m${i}`, 'movies', ['Variety', 'Deadline'], `Film story number ${i}`)),
    ...Array.from({ length: 4 }, (_, i) => cluster(`w${i}`, 'world', ['Reuters', 'BBC News'], `World story number ${i}`)),
    cluster('j1', 'movies', ['Variety', 'Deadline'], 'Best deals on streaming bundles this week'),
  ]);
  const out = fallbackAlso(cand, new Set(['w0']), { followed: ['world', 'movies'], focus: ['movies'] });
  assertEquals(out.filter((a) => a.topic === 'movies').length, 4);
  assertEquals(out.filter((a) => a.topic === 'world').length, 2);
  assertEquals(out[0].topic, 'movies', 'focus topics first');
  assert(!out.some((a) => a.clusterIds.includes('w0') || a.clusterIds.includes('j1')), 'nothing already taken, no deals');
  assertEquals(fallbackAlso(cand, new Set()).filter((a) => a.topic === 'movies').length, 2, 'without focus, two per topic');
});
