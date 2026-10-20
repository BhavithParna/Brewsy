// Regional sections, local feeds, the Ask / Go deeper caps, fitting sources into small
// requests, and lead/body audio scripts.

import { assert, assertEquals } from 'jsr:@std/assert@1';

import type { ArticleText } from '../_shared/articles.ts';
import { CAP_MESSAGE, capsFor, DEFAULT_CAPS, overCap } from '../_shared/caps.ts';
import type { FeedItem } from '../_shared/feeds.ts';
import type { GenerateJsonOptions } from '../_shared/llm.ts';
import { type PipelineDeps, WORLD_SOURCES } from '../_shared/pipeline.ts';
import { fitSources, type SourceText } from '../_shared/prompts.ts';
import { buildRegionalEdition, mentionsRegion, REGION_PROMPT_CHARS, regionSources } from '../_shared/region.ts';
import { isMajorOutlet, type LocalRegion, normalizeOutlet, OUTLET_REGION, SOURCES } from '../_shared/sources.ts';
import type { Briefing } from '../_shared/types.ts';
import { validateScript } from '../_shared/validate.ts';
import { goodStory, item, NOW } from './fixtures.ts';

// ─── Local feeds ───

Deno.test('local feeds: kept out of the world edition; India\'s national news is IN, its beats stay global', () => {
  assert(WORLD_SOURCES.every((s) => !s.region));
  assertEquals(WORLD_SOURCES.length + SOURCES.filter((s) => s.region).length, SOURCES.length);
  for (const id of ['hindu-national', 'indian-express']) assertEquals(SOURCES.find((s) => s.id === id)?.region, 'IN', id);
  for (const id of ['espncricinfo', 'hindu-movies', 'ht-tamil-cinema', 'autocar-india', 'bollywood-hungama']) {
    assertEquals(SOURCES.find((s) => s.id === id)?.region, undefined, `${id} is a topic beat`);
  }
  for (const r of ['IN', 'CA', 'US', 'UK', 'AU'] as LocalRegion[]) {
    const n = SOURCES.filter((s) => s.region === r).length;
    assert(n >= 4, `${r} has ${n} local feeds`);
  }
});

Deno.test('local feeds: outlets only local to one region are listed for its readers; aliases and majors', () => {
  assertEquals(OUTLET_REGION['CBC News'], 'CA');
  assertEquals(OUTLET_REGION['Guardian Australia'], 'AU');
  assertEquals(OUTLET_REGION['The i Paper'], 'UK');
  assertEquals(OUTLET_REGION['PBS News'], 'US');
  assertEquals(OUTLET_REGION['BBC News'], undefined, 'BBC also feeds the world edition');
  assertEquals(OUTLET_REGION['The Hindu'], undefined, 'its film desk is global');
  assertEquals(normalizeOutlet('Sydney Morning Herald'), 'The Sydney Morning Herald');
  assertEquals(normalizeOutlet('The Globe and Mail'), 'The Globe and Mail');
  assert(isMajorOutlet('CBC News') && isMajorOutlet('Toronto Star'));
});

Deno.test('mentionsRegion: names, cities and institutions; British Columbia is not the UK; "us" is not the US', () => {
  const m = (title: string, r: LocalRegion) => mentionsRegion({ title, summary: '' }, r);
  assert(m('Ottawa sets out new budget rules', 'CA'));
  assert(m('Bank of England holds rates', 'UK'));
  assert(!m('Wildfires spread across British Columbia', 'UK'));
  assert(m('Wildfires spread across British Columbia', 'CA'));
  assert(m('U.S. Senate passes the bill', 'US'));
  assert(!m('Tell us what you think', 'US'));
  assert(m('Sensex closes higher as RBI holds', 'IN'));
  assert(m('Sydney train strike ends', 'AU'));
});

Deno.test('regionSources: the region\'s own feeds, plus the general world feeds searched for mentions', () => {
  const { local, world } = regionSources('CA');
  assert(local.length >= 6 && local.every((s) => s.region === 'CA'));
  assert(world.every((s) => !s.region && ['mixed', 'world', 'politics', 'business'].includes(s.topicHint)));
  assert(!world.some((s) => s.topicHint === 'gaming' || s.kind === 'sec-8k'));
});

// ─── Building a section ───

const local = (sourceId: string, outlet: string, title: string, summary: string): FeedItem =>
  item({ sourceId, outlet, title, summary, topicHint: 'mixed', link: `https://ca.example/${sourceId}/${encodeURIComponent(title.slice(0, 20))}` });

function canadaItems(): FeedItem[] {
  return [
    local('cbc-top', 'CBC News', 'Alberta referendum on leaving Canada draws record turnout', 'Albertans voted in record numbers in the referendum on separation, officials said.'),
    local('globe-canada', 'The Globe and Mail', 'Record turnout in Alberta referendum on leaving Canada', 'Turnout in the Alberta separation referendum hit a record, officials said.'),
    local('ctv-canada', 'CTV News', 'Ottawa announces housing grants for first-time buyers', 'The federal government announced grants for first-time home buyers.'),
    local('national-post', 'National Post', 'First-time buyers get federal housing grants from Ottawa', 'Ottawa announced new grants for first-time home buyers on Tuesday.'),
    local('global-canada', 'Global News', 'Wildfire smoke forces evacuations in northern Saskatchewan town', 'Hundreds were told to leave as smoke thickened.'),
    local('globe-canada', 'The Globe and Mail', 'Bank of Canada governor signals pause on interest rate cuts', 'The governor said inflation needed watching.'),
    local('cbc-top', 'CBC News', 'Toronto transit strike ends after three weeks of talks', 'Subway service resumes Thursday morning.'),
    local('ctv-canada', 'CTV News', 'Quebec passes law on religious symbols in public hospitals', 'The legislature voted late on Tuesday.'),
    // Already in the world edition: left out.
    local('cbc-top', 'CBC News', 'Fire at Wainwright military base kills six soldiers', 'Six soldiers died in a fire at CFB Wainwright, the military said.'),
    // World feeds: one names Canada, one doesn't.
    item({ sourceId: 'bbc-world', outlet: 'BBC News', topicHint: 'world', title: 'Canada and Mexico sign trade pact ahead of summit', summary: 'The two countries agreed to cut tariffs on steel.' }),
    item({ sourceId: 'bbc-world', outlet: 'BBC News', topicHint: 'world', title: 'Japan elects new prime minister after snap vote', summary: 'The ruling party kept its majority.' }),
  ];
}

const world: Briefing = {
  date: '2026-10-07', generatedAt: '2026-10-07T00:00:00Z', summary: [], calendar: [], markets: [],
  stories: [{ ...goodStory('x'), id: 'fire-at-wainwright', headline: 'Fire at Wainwright military base kills six soldiers', readTimeMinutes: 1, sources: [], allSources: [{ name: 'Reuters', url: 'https://r.example', title: 'Fire at Wainwright military base kills six soldiers' }], imageUrl: null, developing: false, topic: 'world' } as never],
};

function regionDeps(seen: GenerateJsonOptions[], pick: (o: GenerateJsonOptions, ids: string[]) => unknown, fetched: { ids: string[] } = { ids: [] }): PipelineDeps {
  return {
    fetchFeeds: (sources) => {
      fetched.ids = sources.map((s) => s.id);
      return Promise.resolve({ items: canadaItems(), statuses: [] });
    },
    fetchArticle: (): Promise<ArticleText> => Promise.resolve({ ok: true, ogImage: null, title: null, text: 'Full article text about the referendum. '.repeat(20) }),
    fetchMarkets: () => Promise.resolve([]),
    generateJson: (o) => {
      seen.push(o);
      const ids = [...o.prompt.matchAll(/^\[(c\d+)\]/gm)].map((m) => m[1]);
      const blockIds = [...o.prompt.matchAll(/=== STORY \d+ · clusterIds: ([^·]+) ·/g)].map((m) => m[1].split(',')[0].trim());
      const data = o.purpose === 'region' ? pick(o, ids) : { stories: blockIds.map((id) => goodStory(id, 'politics')) };
      if (data instanceof Error) return Promise.reject(data);
      return Promise.resolve({ data, text: '', provider: 'groq', model: 'fake', finishReason: 'stop', usage: {} });
    },
  };
}

const titleOf = (o: GenerateJsonOptions, id: string) => o.prompt.match(new RegExp(`^\\[${id}\\].*· (.+?)(?: — |$)`, 'm'))?.[1] ?? '';

Deno.test('region: local feeds + world items naming the country, minus the world edition; one light call, one writing call', async () => {
  const seen: GenerateJsonOptions[] = [];
  const fetched = { ids: [] as string[] };
  const { edition, contexts, stats } = await buildRegionalEdition({
    region: 'CA', date: '2026-10-07', now: NOW, deadlineMs: Date.now() + 120_000, world: { briefing: world, updates: [] },
    deps: regionDeps(seen, (o, ids) => {
      const referendum = ids.find((id) => /referendum/i.test(titleOf(o, id)))!;
      const others = ids.filter((id) => id !== referendum);
      return {
        stories: [referendum, 'c999'],
        also: others.slice(0, 5).map((id) => ({ clusterIds: [id], topic: 'politics', headline: `Line for ${titleOf(o, id)}.`, whatHappened: 'It happened.', whyItMatters: '', developing: false })),
      };
    }, fetched),
  });

  assert(fetched.ids.includes('cbc-top') && fetched.ids.includes('bbc-world') && !fetched.ids.includes('ign'));
  assertEquals(seen.map((o) => o.purpose), ['region', 'region-stories']);
  const pick = seen[0];
  assert(pick.prompt.length <= REGION_PROMPT_CHARS && pick.fitPrompt, 'about 3k tokens, and it can shrink further');
  assert(pick.system.includes('Canada'));
  assert(pick.prompt.includes('Canada and Mexico sign trade pact'), 'world items that name Canada are in');
  assert(!pick.prompt.includes('Japan elects'), 'world items that do not are out');
  assert(!pick.prompt.includes('Wainwright'), 'the world edition already has it');
  assertEquals(stats.inWorldEdition, 1);

  assertEquals([edition.region, edition.label, edition.date], ['CA', 'Canada', '2026-10-07']);
  assertEquals(edition.stories.length, 1, 'an unknown id from the AI is ignored');
  assert(edition.stories[0].id.startsWith('ca-'));
  assert(edition.stories[0].allSources.some((s) => s.name === 'CBC News') && edition.stories[0].allSources.some((s) => s.name === 'The Globe and Mail'));
  assertEquals(edition.also.length, 5);
  assert(edition.also.every((a) => a.id.startsWith('ca-') && a.sources.length > 0));
  assert(!edition.also.some((a) => /referendum/i.test(a.headline)), 'the story is not repeated as a line');
  assertEquals(contexts.length, 6, 'Go deeper and Ask find every item');
});

Deno.test('region: if the light call fails, the best stories are written anyway and headlines fill the lines', async () => {
  const seen: GenerateJsonOptions[] = [];
  const { edition, stats } = await buildRegionalEdition({
    region: 'CA', date: '2026-10-07', now: NOW, deadlineMs: Date.now() + 120_000, world: null,
    deps: regionDeps(seen, () => new Error('Groq HTTP 429')),
  });
  assert(stats.pickFallback);
  assertEquals(edition.stories.length, 2, 'the two best stories covered by two outlets');
  assert(edition.stories.every((s) => s.allSources.length >= 2));
  assert(edition.also.length >= 4);
  assert(edition.stories.concat().every((s) => s.id.startsWith('ca-')));
});

Deno.test('region: a story that cannot be written becomes the first line instead', async () => {
  const seen: GenerateJsonOptions[] = [];
  const deps = regionDeps(seen, (_, ids) => ({ stories: [ids[0]], also: [] }));
  const write = deps.generateJson;
  deps.generateJson = (o) => (o.purpose === 'region-stories' ? Promise.reject(new Error('down')) : write(o));
  const { edition } = await buildRegionalEdition({ region: 'CA', date: '2026-10-07', now: NOW, deadlineMs: Date.now() + 120_000, world: null, deps });
  assertEquals(edition.stories.length, 0);
  assert(edition.also.length >= 4 && edition.also.length <= 6);
});

// ─── Ask and Go deeper caps ───

Deno.test('caps: per device, in total, and a shared bucket for requests without a device id', () => {
  assertEquals(DEFAULT_CAPS, { ask: { perDevice: 5, total: 60, noDevice: 10 }, deeper: { perDevice: 8, total: 30, noDevice: 10 } });
  const ask = DEFAULT_CAPS.ask;
  assertEquals(overCap('ask', true, { mine: 4, total: 20 }, ask), null);
  assertEquals(overCap('ask', true, { mine: 5, total: 20 }, ask), CAP_MESSAGE.ask);
  assertEquals(overCap('ask', true, { mine: 0, total: 60 }, ask), CAP_MESSAGE.ask);
  assertEquals(overCap('ask', false, { mine: 9, total: 20 }, ask), null, 'older apps share ten');
  assertEquals(overCap('ask', false, { mine: 10, total: 20 }, ask), CAP_MESSAGE.ask);
  assertEquals(overCap('deeper', true, { mine: 8, total: 8 }, DEFAULT_CAPS.deeper), "You've used today's deep dives. They reset tomorrow.");
  assertEquals(CAP_MESSAGE.ask, "You've used today's questions. They reset tomorrow.");
});

Deno.test('caps: secrets override the defaults (0 turns a feature off)', () => {
  Deno.env.set('DEEPER_CAP_TOTAL', '12');
  Deno.env.set('ASK_CAP_DEVICE', '0');
  try {
    assertEquals(capsFor('deeper'), { perDevice: 8, total: 12, noDevice: 10 });
    assertEquals(capsFor('ask').perDevice, 0);
    assertEquals(overCap('ask', true, { mine: 0, total: 0 }), CAP_MESSAGE.ask);
  } finally {
    Deno.env.delete('DEEPER_CAP_TOTAL');
    Deno.env.delete('ASK_CAP_DEVICE');
  }
});

// ─── Fitting sources into a small request ───

Deno.test('fitSources: shares the room fairly, keeps short sources whole, drops the ones left with too little', () => {
  const src = (name: string, n: number): SourceText => ({ name, url: '', title: name, text: `${name} `.repeat(n).trim() });
  const sources = [src('alpha', 2000), src('beta', 30), src('gamma', 2000)];
  const fitted = fitSources(sources, 4000);
  // The block exactly as askPrompt / deepDivePrompt write it.
  const total = fitted.map((s, i) => `[S${i + 1}] ${s.name} — "${s.title ?? ''}"\n${s.text}`).join('\n\n').length;
  assert(total <= 4000, `fits: ${total}`);
  assertEquals(fitted.find((s) => s.name === 'beta')!.text, sources[1].text, 'a short source keeps all its text');
  assert(Math.abs(fitted[0].text.length - fitted[2].text.length) < 50, 'the long ones get equal shares');
  const tight = fitSources([src('alpha', 2000), src('gamma', 2000), src('delta', 2000)], 900);
  assertEquals(tight.map((s) => s.name), ['alpha', 'gamma'], 'the last is dropped rather than cut to nothing');
  assertEquals(fitSources([src('alpha', 2000)], 100).length, 1, 'the first source always stays');
});

// ─── Audio scripts: lead + body ───

Deno.test('validateScript: lead and body kept apart, text = both; an old-style reply with only text still works', () => {
  const v = validateScript({ summary: 'S.', stories: [{ storyId: 'a', lead: 'Next, in tech.', body: 'Chips got faster.' }, { storyId: 'b', text: 'Old style.' }] }, ['a', 'b']);
  assert(v.ok);
  assertEquals(v.value.stories[0], { storyId: 'a', lead: 'Next, in tech.', body: 'Chips got faster.', text: 'Next, in tech. Chips got faster.' });
  assertEquals(v.value.stories[1], { storyId: 'b', lead: '', body: 'Old style.', text: 'Old style.' });
  assert(!validateScript({ summary: 'S.', stories: [{ storyId: 'a', lead: 'Next.', body: '' }] }, ['a']).ok, 'a lead alone is not a script');
});
