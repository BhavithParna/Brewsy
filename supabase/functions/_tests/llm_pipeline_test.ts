// Exercises the Claude and Gemini request code and the whole edition pipeline with fakes.

import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';

import type { ArticleText } from '../_shared/articles.ts';
import type { FeedItem } from '../_shared/feeds.ts';
import { _resetLlmStateForTests, activeModel, generateJson, LlmError, parseJsonText, toClaudeSchema } from '../_shared/llm.ts';
import { parseCnbcQuotes } from '../_shared/markets.ts';
import { buildEdition, collectCandidates, type PipelineDeps } from '../_shared/pipeline.ts';
import { DEFAULT_PREFS } from '../_shared/prefs.ts';
import { EDITOR_SYSTEM, PICK_SYSTEM, SCRIPT_SYSTEM } from '../_shared/prompts.ts';
import { breakingPush, editionPush, sendExpoPush } from '../_shared/push.ts';
import type { GenerateJsonOptions } from '../_shared/llm.ts';
import { goodStory, item, NOW, sampleItems } from './fixtures.ts';

const gemini = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text, thought: false }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }), { status: 200 });

async function withFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>, fn: (calls: { url: string; body: any; headers: Headers }[]) => Promise<void>) {
  const original = globalThis.fetch;
  const calls: { url: string; body: any; headers: Headers }[] = [];
  globalThis.fetch = ((input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init.headers) });
    return Promise.resolve(handler(url, init));
  }) as typeof fetch;
  Deno.env.set('GEMINI_API_KEY', 'test-key');
  Deno.env.delete('GEMINI_MODEL');
  Deno.env.delete('ANTHROPIC_API_KEY');
  Deno.env.delete('LLM_PROVIDER');
  _resetLlmStateForTests();
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const opts: GenerateJsonOptions = { system: 'sys', prompt: 'p', schema: { type: 'object' }, thinking: 'LOW' };

Deno.test('Gemini: modern request shape, key in header (not URL), JSON parsed', async () => {
  await withFetch(() => gemini('{"ok":true}'), async (calls) => {
    const r = await generateJson(opts);
    assertEquals(r.data, { ok: true });
    assertEquals(r.model, 'gemini-3.8-flash');
    assert(calls[0].url.endsWith('/models/gemini-3.8-flash:generateContent'));
    assert(!calls[0].url.includes('test-key'));
    assertEquals(calls[0].headers.get('x-goog-api-key'), 'test-key');
    assertEquals(calls[0].body.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
    assertEquals(calls[0].body.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });
    assertEquals(calls[0].body.systemInstruction.parts[0].text, 'sys');
  });
});

Deno.test('Gemini: falls back to responseMimeType + responseJsonSchema if responseFormat is rejected', async () => {
  let n = 0;
  await withFetch(() => (n++ === 0 ? new Response('{"error":{"message":"Invalid JSON payload received. Unknown name \\"responseFormat\\""}}', { status: 400 }) : gemini('```json\n{"a":1}\n```')), async (calls) => {
    const r = await generateJson(opts);
    assertEquals(r.data, { a: 1 });
    assertEquals(calls[1].body.generationConfig.responseMimeType, 'application/json');
    assert(calls[1].body.generationConfig.responseJsonSchema);
  });
});

Deno.test('Gemini: drops thinkingConfig if the model rejects it', async () => {
  let n = 0;
  await withFetch(() => (n++ === 0 ? new Response('{"error":{"message":"thinking_level is not supported"}}', { status: 400 }) : gemini('{"a":2}')), async (calls) => {
    assertEquals((await generateJson(opts)).data, { a: 2 });
    assertEquals(calls[1].body.generationConfig.thinkingConfig, undefined);
  });
});

Deno.test('Gemini: 429 on both models is a retryable LlmError (no waiting past the budget); missing key is not', async () => {
  await withFetch(() => new Response('{"error":{"code":429,"details":[{"retryDelay":"18s"}]}}', { status: 429 }), async (calls) => {
    const e = await assertRejects(() => generateJson({ ...opts, timeoutMs: 20_000 }), LlmError);
    assert(e.retryable);
    assert(e.message.includes('rate limit'));
    // The main model, then the fallback; then it gives up instead of waiting 18 s.
    assertEquals(calls.map((c) => c.url.match(/models\/([^:]+)/)?.[1]), ['gemini-3.8-flash', 'gemini-3.5-flash']);
  });
  Deno.env.delete('GEMINI_API_KEY');
  const e = await assertRejects(() => generateJson(opts), LlmError);
  assert(!e.retryable);
});

Deno.test('parseJsonText tolerates fences and chatter', () => {
  assertEquals(parseJsonText('Here you go:\n{"x": [1]}\nThanks'), { x: [1] });
});

// ─── Claude ───

const claudeMessage = (text: string, over: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
    content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 }, ...over,
  }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });

// deno-lint-ignore no-explicit-any
async function withClaude(handler: (url: string) => Response, fn: (calls: { url: string; body: any; headers: Headers }[]) => Promise<void>) {
  await withFetch(handler, async (calls) => {
    Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant-test');
    Deno.env.delete('CLAUDE_MODEL');
    try {
      await fn(calls);
    } finally {
      Deno.env.delete('ANTHROPIC_API_KEY');
    }
  });
}

Deno.test('Claude: chosen when ANTHROPIC_API_KEY is set; structured output, effort, fallback beta', async () => {
  await withClaude(() => claudeMessage('{"ok":true}'), async (calls) => {
    assertEquals(activeModel(), 'claude-opus-5-5');
    const r = await generateJson({ ...opts, schema: { type: 'object', properties: { xs: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string', maxLength: 9 } } } } });
    assertEquals(r.data, { ok: true });
    assertEquals(r.model, 'claude-opus-5-5');
    assert(calls[0].url.endsWith('/v1/messages?beta=true'), calls[0].url);
    assertEquals(calls[0].headers.get('x-api-key'), 'sk-ant-test');
    assert(calls[0].headers.get('anthropic-beta')?.includes('server-side-fallback-2026-07-01'));
    const body = calls[0].body;
    assertEquals(body.model, 'claude-opus-5-5');
    assertEquals(body.system, 'sys');
    assertEquals(body.messages, [{ role: 'user', content: 'p' }]);
    assertEquals(body.fallbacks, 'default');
    assertEquals(body.temperature, undefined);
    assertEquals(body.output_config.effort, 'low');
    assertEquals(body.output_config.format.type, 'json_schema');
    // Limits the structured-output grammar doesn't support are stripped; objects are closed.
    assertEquals(body.output_config.format.schema, {
      type: 'object', additionalProperties: false, properties: { xs: { type: 'array', items: { type: 'string' } } },
    });
  });
});

Deno.test('Claude: LLM_PROVIDER=gemini overrides an Anthropic key', async () => {
  await withClaude(() => gemini('{"g":1}'), async (calls) => {
    Deno.env.set('LLM_PROVIDER', 'gemini');
    try {
      assertEquals((await generateJson(opts)).data, { g: 1 });
      assert(calls[0].url.includes('generativelanguage'));
    } finally {
      Deno.env.delete('LLM_PROVIDER');
    }
  });
});

Deno.test('Claude: refusal and max_tokens are non-retryable errors; 429 is retryable', async () => {
  await withClaude(() => claudeMessage('', { content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' } }), async () => {
    const e = await assertRejects(() => generateJson(opts), LlmError);
    assert(!e.retryable);
    assert(e.message.includes('declined'));
  });
  await withClaude(() => claudeMessage('{"a":', { stop_reason: 'max_tokens' }), async () => {
    const e = await assertRejects(() => generateJson(opts), LlmError);
    assert(e.message.includes('token limit'));
  });
  await withClaude(() => new Response('{"type":"error","error":{"type":"rate_limit_error","message":"slow down"}}', { status: 429, headers: { 'retry-after': '0' } }), async () => {
    const e = await assertRejects(() => generateJson(opts), LlmError);
    assert(e.retryable);
    assertEquals(e.status, 429);
  });
});

Deno.test('toClaudeSchema keeps minItems 0/1 and nested objects closed', () => {
  assertEquals(toClaudeSchema({ type: 'array', minItems: 1, items: { type: 'object', properties: { a: { type: 'number', minimum: 0 } } } }), {
    type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, properties: { a: { type: 'number' } } },
  });
});

// ─── Whole pipeline with fake network + fake AI ───

type Kind = 'pick' | 'editor' | 'stories' | 'summary' | 'script';
type Handler = (o: GenerateJsonOptions, ids: string[]) => unknown;

function kindOf(o: GenerateJsonOptions): Kind {
  if (o.system === PICK_SYSTEM) return 'pick';
  if (o.system === EDITOR_SYSTEM) return 'editor';
  if (o.system === SCRIPT_SYSTEM) return 'script';
  // deno-lint-ignore no-explicit-any
  return (o.schema as any).properties?.summary ? 'summary' : 'stories';
}

/** Cluster ids of the STORY blocks in a writing prompt, in order. */
const blockIds = (prompt: string) => [...prompt.matchAll(/=== STORY \d+ · clusterIds: ([^·]+) ·/g)].map((m) => m[1].split(',')[0].trim());

const SUMMARY = { summary: ['A.', 'B.', 'C.', 'D.'], calendar: [] };
const writeAll: Handler = (_, ids) => ({ stories: ids.map((id) => goodStory(id)) });

function deps(handlers: Partial<Record<Kind, Handler>>, seen: GenerateJsonOptions[], items: () => FeedItem[] = sampleItems): PipelineDeps {
  const all: Record<Kind, Handler> = {
    pick: () => ({ picks: [] }),
    editor: () => ({ additions: [], alsoHappening: [] }),
    stories: writeAll,
    summary: () => SUMMARY,
    script: () => ({ summary: '', stories: [] }),
    ...handlers,
  };
  return {
    fetchFeeds: () => Promise.resolve({ items: items(), statuses: [] }),
    fetchArticle: (url: string): Promise<ArticleText> =>
      Promise.resolve(url.includes('cnbc.com/finland')
        ? { ok: true, ogImage: 'https://image.cnbcfm.com/finland.jpg', title: null, text: 'Finnish Licensing and Supervision Agency (LVV) issued a notice. '.repeat(10) }
        : { ok: false, ogImage: null, title: null, text: '' }),
    fetchMarkets: () => Promise.resolve([{ id: 'spx', label: 'S&P 500', value: 7768.3, change: -0.65, changeUnit: 'percent', format: 'index' }]),
    generateJson: (o: GenerateJsonOptions) => {
      seen.push(o);
      const reply = all[kindOf(o)](o, blockIds(o.prompt));
      if (reply instanceof Error) return Promise.reject(reply);
      return Promise.resolve({ data: reply, text: JSON.stringify(reply), model: 'fake', finishReason: 'STOP', usage: {} });
    },
  };
}

Deno.test('pipeline: picks → articles → stories (bad batch retried once) + summary + editor → links/images from our data', async () => {
  const seen: GenerateJsonOptions[] = [];
  const probe = await collectCandidates(DEFAULT_PREFS, NOW, deps({}, []));
  const finland = probe.clusters.find((c) => c.title.includes('Finland'))!.id;
  const others = probe.clusters.filter((c) => c.id !== finland).slice(0, 5).map((c) => c.id);
  const kenya = probe.clusters.find((c) => c.title.includes('Kenya'))!.id;
  const pickedIds = [finland, ...others.filter((id) => id !== kenya)].slice(0, 5);

  let firstBatchCalls = 0;
  const { briefing, contexts, stats } = await buildEdition({
    prefs: DEFAULT_PREFS, now: NOW, date: '2026-10-07', deadlineMs: Date.now() + 120_000,
    deps: deps({
      pick: () => ({ picks: pickedIds.map((id) => ({ clusterId: id, topic: 'tech' })) }),
      stories: (_, ids) => {
        if (ids.includes(finland) && firstBatchCalls++ === 0) return { stories: [] }; // invalid → retried with feedback
        return { stories: ids.map((id) => ({ ...goodStory(id), headline: id === finland ? 'Finland halts work on two Google data centres' : `Story ${id}`, sources: [{ name: 'Fake', url: 'https://evil.example' }] })) };
      },
      editor: () => ({
        additions: [{ clusterId: finland, topic: 'tech', category: 'tech', reason: 'already picked: ignored' }],
        alsoHappening: [
          { clusterIds: [kenya], topic: 'world', headline: 'Kenya quarantines ten people after first Ebola case.', whatHappened: 'Ten contacts were isolated.', whyItMatters: 'Ebola spreads fast.', developing: true },
          { clusterIds: [finland], topic: 'tech', headline: 'Duplicate of a main story', whatHappened: 'x', whyItMatters: 'y', developing: false },
        ],
      }),
    }, seen),
  });

  const storyCalls = seen.filter((o) => kindOf(o) === 'stories');
  assert(storyCalls.some((o) => o.prompt.includes('rejected')), 'retry prompt should include the validation errors');
  assertEquals(stats.editionAttempts, storyCalls.length);
  assertEquals(stats.pickFallback, false);
  assertEquals(stats.editorFailed, false);
  assertEquals(stats.additions, 0);
  assertEquals(briefing.stories.length, 5);
  assertEquals(briefing.summary, ['A.', 'B.', 'C.', 'D.']);
  assertEquals(briefing.markets[0].id, 'spx');

  const top = briefing.stories[0];
  assertEquals(top.id, 'finland-halts-work-on-two-google-data-centres');
  assertEquals(top.sources.map((s) => s.name).sort(), ['BBC News', 'CNBC']);
  assert(top.allSources.every((s) => !s.url.includes('evil')), 'AI-supplied URLs must be ignored');
  assertEquals(top.imageUrl, 'https://image.cnbcfm.com/finland.jpg');
  assertEquals(top.readTimeMinutes, 1);
  const ctx = contexts.find((c) => c.story_id === top.id)!;
  assert(ctx.sources.some((s) => s.text.startsWith('Finnish Licensing')));
  assert(storyCalls.some((o) => o.prompt.includes('Finnish Licensing and Supervision Agency')), 'the AI is given the article text');

  // "Also happening": only clusters not already in the edition, links from our data.
  assertEquals(briefing.alsoHappening!.length, 1);
  const also = briefing.alsoHappening![0];
  assertEquals(also.headline, 'Kenya quarantines ten people after first Ebola case');
  assert(also.id.startsWith('also-'));
  assertEquals(also.developing, true);
  assertEquals(also.sources[0].name, 'BBC News');
  assert(contexts.some((c) => c.story_id === also.id), 'also items get context so Go deeper works on them');

  const cov = briefing.coverage!;
  assertEquals(cov.articlesScanned, sampleItems().length);
  assertEquals(cov.fullStories, 5);
  assertEquals(cov.alsoHappening, 1);
  assertEquals(cov.storiesGrouped, probe.totalClusters);
});

/** Twelve stories, each covered by two outlets: more than one edition can hold. */
const pairs = (): FeedItem[] =>
  Array.from({ length: 12 }, (_, k) => {
    const words = ['zephyr', 'quartz', 'nimbus', 'ember'].map((w) => `${w}${String.fromCharCode(97 + k)}`).join(' ');
    return [
      item({ outlet: 'BBC News', topicHint: 'world', title: `${words} report`, summary: `${words} details emerged on Wednesday from officials.`, link: `https://bbc.example/${k}` }),
      item({ outlet: 'The Guardian', topicHint: 'world', title: `${words} latest`, summary: `${words} details emerged on Wednesday, officials said.`, link: `https://guardian.example/${k}` }),
    ];
  }).flat();

Deno.test('pipeline: if story picking fails twice, falls back to top clusters; editor failure → fallback "also"', async () => {
  const seen: GenerateJsonOptions[] = [];
  let pickCalls = 0;
  const { stats, briefing } = await buildEdition({
    prefs: { ...DEFAULT_PREFS, topics: ['world', 'tech', 'business', 'ai'] }, now: NOW, date: '2026-10-07', deadlineMs: Date.now() + 120_000,
    deps: deps({
      pick: () => (pickCalls++ === 0 ? new LlmError('overloaded', 503, true) : { picks: [] }),
      editor: () => new LlmError('overloaded', 503, true),
      stories: (_, ids) => ({ stories: ids.map((id) => goodStory(id, 'world')) }),
    }, seen, () => [...sampleItems(), ...pairs()]),
  });
  assert(stats.pickFallback);
  assert(stats.editorFailed);
  assert(stats.editorError?.includes('overloaded'), 'the reason is logged');
  assertEquals(briefing.stories.length, 12, 'the top TARGET_STORIES clusters');
  assert(briefing.alsoHappening!.length > 0, 'fallback "also" lists the next multi-outlet stories');
  const perTopic = new Map<string, number>();
  briefing.alsoHappening!.forEach((a) => perTopic.set(a.topic, (perTopic.get(a.topic) ?? 0) + 1));
  assert([...perTopic.values()].every((n) => n <= 2), 'fallback "also" takes at most two per topic');
  const mainUrls = new Set(briefing.stories.flatMap((s) => s.allSources.map((x) => x.url)));
  assert(briefing.alsoHappening!.every((a) => a.sources.every((x) => !mainUrls.has(x.url))), 'fallback also items never repeat a main story');
});

Deno.test('pipeline: topics the AI left out get one story each (2+ outlets) and every beat gets an "also" line', async () => {
  const seen: GenerateJsonOptions[] = [];
  const beats = (): FeedItem[] => [
    item({ outlet: 'IGN', topicHint: 'gaming', title: 'Console maker confirms handheld successor for next spring', summary: 'The company confirmed a new handheld console for next spring at an investor briefing.', link: 'https://ign.example/handheld' }),
    item({ outlet: 'Polygon', topicHint: 'gaming', title: 'Handheld successor confirmed for next spring by console maker', summary: 'A new handheld console is coming next spring, the company confirmed at an investor briefing.', link: 'https://polygon.example/handheld' }),
    item({ outlet: 'ESPNcricinfo', topicHint: 'sports', title: 'Spinner takes six wickets on Test debut', summary: 'A debutant spinner took six wickets on the opening day.', link: 'https://cricinfo.example/debut' }),
  ];
  const { briefing, stats } = await buildEdition({
    prefs: DEFAULT_PREFS, now: NOW, date: '2026-10-07', deadlineMs: Date.now() + 120_000,
    deps: deps({
      // The AI only picks tech and world stories.
      pick: (o) => {
        const ids = [...o.prompt.matchAll(/^\[(c\d+)\].*hint (?:tech|world|business|mixed)/gm)].map((m) => m[1]).slice(0, 5);
        return { picks: ids.map((id) => ({ clusterId: id, topic: 'world' })) };
      },
      stories: (_, ids) => ({ stories: ids.map((id) => goodStory(id, 'world')) }),
    }, seen, () => [...sampleItems(), ...beats()]),
  });
  const pick = seen.find((o) => kindOf(o) === 'pick')!;
  assert(pick.prompt.includes('gaming, sports, entertainment, crypto'), 'the AI is offered all 13 topics');
  assert(/IGN, Polygon · hint gaming/.test(pick.prompt), 'the gaming story reaches the AI');
  assertEquals(stats.topicFills, 1, 'gaming (two outlets) gets a full story; the one-outlet cricket story does not');
  const gaming = briefing.stories.filter((s) => s.allSources.some((x) => x.url.includes('ign.example')));
  assertEquals(gaming.length, 1);
  assert(briefing.alsoHappening!.some((a) => a.topic === 'sports' && a.headline.includes('six wickets')), 'cricket still gets a line');
  assertEquals(stats.byTopic.sports, { stories: 0, also: 1 });
});

/** Five major outlets on one event: the must-include rule. */
const quake = (): FeedItem[] =>
  ['Reuters', 'Associated Press', 'BBC News', 'The New York Times', 'The Guardian'].map((outlet, i) =>
    item({ outlet, topicHint: 'world', title: `Magnitude 7.8 earthquake strikes northern Chile, tsunami warning issued ${['', 'for coast', 'as buildings shake', 'officials say', 'residents flee'][i]}`.trim(), summary: 'A powerful magnitude 7.8 earthquake struck northern Chile on Wednesday, prompting a tsunami warning along the coast.' }));

Deno.test('pipeline: a must-include story is in the edition even when the AI leaves it out; editor additions get written', async () => {
  const seen: GenerateJsonOptions[] = [];
  const items = () => [...sampleItems(), ...quake()];
  const probe = await collectCandidates(DEFAULT_PREFS, NOW, deps({}, [], items));
  const quakeCluster = probe.clusters.find((c) => /earthquake/i.test(c.title))!;
  assert(probe.scores.get(quakeCluster.id)!.mustInclude, 'five major outlets → must include');
  assertEquals(probe.clusters[0].id, quakeCluster.id, 'and it ranks first');

  const rest = probe.clusters.filter((c) => c.id !== quakeCluster.id);
  const picked = rest.slice(0, 5).map((c) => c.id);
  const extra = rest.find((c) => !picked.includes(c.id))!.id;
  const { briefing, stats } = await buildEdition({
    prefs: DEFAULT_PREFS, now: NOW, date: '2026-10-07', deadlineMs: Date.now() + 120_000,
    deps: deps({
      pick: () => ({ picks: picked.map((id) => ({ clusterId: id, topic: 'tech' })) }),
      editor: () => ({ additions: [{ clusterId: extra, topic: 'tech', category: 'ai', reason: 'major model launch' }], alsoHappening: [] }),
    }, seen, items),
  });
  const pickPrompt = seen.find((o) => kindOf(o) === 'pick')!.prompt;
  assert(pickPrompt.includes(quakeCluster.id) && /MUST/.test(pickPrompt), 'the pick prompt flags the must-include');
  assertEquals(stats.mustInclude, 1);
  assertEquals(stats.additions, 1);
  assertEquals(briefing.stories.length, 7);
  assertEquals(briefing.coverage!.mustInclude, 1);
  assertEquals(briefing.coverage!.addedByEditor, 1);
  assert(briefing.stories.some((s) => s.allSources.some((x) => x.name === 'Reuters')), 'the earthquake story is there');
});

Deno.test('markets: CNBC payload → quotes, yield change in bp, unknown symbols ignored', () => {
  const q = parseCnbcQuotes({ FormattedQuoteResult: { FormattedQuote: [
    { symbol: '.SPX', last: '7,765.73', change: '-53.20', change_pct: '-0.68%' },
    { symbol: 'US10Y', last: '5.307%', change: '+0.036', change_pct: '+0.683%' },
    { symbol: '@CL.1', last: 'N/A', change: '', change_pct: '' },
    { symbol: 'ZZZ', last: '1', change: '0', change_pct: '0%' },
  ] } });
  assertEquals(q, [
    { id: 'spx', label: 'S&P 500', changeUnit: 'percent', format: 'index', value: 7765.73, change: -0.68 },
    { id: 'us10y', label: '10Y yield', changeUnit: 'bp', format: 'percent', value: 5.307, change: 4 },
  ]);
});

Deno.test('push: edition and breaking messages carry what the app expects', () => {
  const b = { date: '2026-10-07', generatedAt: '', summary: ['One.'], stories: [{ ...goodStory('c1'), id: 's1', headline: 'Top story', dek: 'Dek', whatHappened: 'x', whyItMatters: 'y' }], calendar: [], markets: [] };
  // deno-lint-ignore no-explicit-any
  const e = editionPush(b as any);
  assertEquals(e.data, { kind: 'edition', date: '2026-10-07' });
  assertEquals(e.categoryId, 'edition');
  assert(e.title.startsWith('Your Brewsy edition is ready'));
  // deno-lint-ignore no-explicit-any
  const br = breakingPush('2026-10-07', b.stories[0] as any);
  assertEquals(br.title, 'Breaking: Top story');
  assertEquals(br.body, 'Dek');
  assertEquals(br.data, { kind: 'breaking', date: '2026-10-07', storyId: 's1' });
});

Deno.test('push: sends to valid Expo tokens and reports DeviceNotRegistered', async () => {
  const fake = ((_: string, init: RequestInit) => {
    const msgs = JSON.parse(String(init.body));
    assertEquals(msgs[0].title, 'Hi');
    return Promise.resolve(new Response(JSON.stringify({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] })));
  }) as unknown as typeof fetch;
  const r = await sendExpoPush(['ExponentPushToken[a]', 'ExponentPushToken[b]', 'not-a-token'], { title: 'Hi', body: 'B' }, fake);
  assertEquals(r, { sent: 1, failed: 1, invalidTokens: ['ExponentPushToken[b]'] });
});

Deno.test('Gemini: a busy main model falls back to the second model', async () => {
  let n = 0;
  const ok = { candidates: [{ content: { parts: [{ text: '{"x":1}' }] }, finishReason: 'STOP' }] };
  await withFetch(() => (n++ === 0 ? new Response('{"error":{"code":503}}', { status: 503 }) : Response.json(ok)), async (calls) => {
    const res = await generateJson(opts);
    assertEquals(res.data, { x: 1 });
    assertEquals(res.model, 'gemini-3.5-flash');
    assertEquals(calls.length, 2);
  });
});

Deno.test('aiErrorResponse: the free-tier daily cap says so, instead of "try again in a minute"', async () => {
  const { aiErrorResponse } = await import('../_shared/request.ts');
  const daily = aiErrorResponse(new Error('Gemini HTTP 429 (free-tier daily limit): quota exceeded'));
  assertEquals(daily.status, 429);
  assertEquals(/tomorrow/.test(daily.error), true);
  const perMinute = aiErrorResponse(new Error('Gemini HTTP 429 (free-tier rate limit): slow down'));
  assertEquals(perMinute.status, 503);
});
