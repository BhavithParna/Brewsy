// The free providers: routes, the OpenAI-compatible request shapes, fallback on 429 / 413 /
// 5xx / timeouts / empty replies, daily budgets from ai_usage, pacing, and strict schemas.

import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';

import {
  _resetLlmStateForTests, _setPacingForTests, _setUsageStoreForTests, budgetWarnings, DEFAULT_ROUTES, generateJson, type GenerateJsonOptions,
  LlmError, routeFor, toStrictSchema, type UsageRow, usageDay,
} from '../_shared/llm.ts';
import { pickSchema } from '../_shared/prompts.ts';
import { aiErrorResponse } from '../_shared/request.ts';
import { TOPICS } from '../_shared/types.ts';

const KEYS = ['SAMBANOVA_API_KEY', 'GROQ_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'MISTRAL_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LLM_ROUTES'];

// deno-lint-ignore no-explicit-any
type Call = { url: string; body: any; headers: Headers };

/** A chat-completions reply. */
const chat = (content: string, usage: Record<string, unknown> = { prompt_tokens: 100, completion_tokens: 20 }, finish = 'stop') =>
  Response.json({ choices: [{ message: { role: 'assistant', content }, finish_reason: finish }], usage });

const which = (c: Call) =>
  c.url.includes('sambanova') ? `sambanova:${c.body.model}` : c.url.includes('groq') ? `groq:${c.body.model}` : c.url.includes('cloudflare') ? `cloudflare:${c.body.model}` : c.url;

// The fallback and budget tests run on fixed routes (SambaNova first, as first planned), so they
// test the machinery and don't change when the defaults do. Ask and region keep their defaults.
const WRITING_FIXTURE = ['sambanova:gpt-oss-120b', 'sambanova:DeepSeek-V3.2', 'groq:openai/gpt-oss-120b', 'cloudflare'];
const FIXTURE_ROUTES = JSON.stringify({
  edition: ['sambanova:DeepSeek-V3.1', 'sambanova:DeepSeek-V3.2', 'cloudflare'],
  script: WRITING_FIXTURE,
  refresh: WRITING_FIXTURE,
  'region-stories': WRITING_FIXTURE,
  deeper: ['sambanova:Meta-Llama-3.3-70B-Instruct', 'sambanova:gpt-oss-120b', 'groq:openai/gpt-oss-120b', 'cloudflare'],
});

async function withProviders(
  handler: (c: Call, n: number) => Response | Promise<Response>,
  fn: (calls: Call[], usage: { rows: UsageRow[]; added: UsageRow[] }) => Promise<void>,
  opts: { usage?: UsageRow[]; pacing?: boolean } = {},
) {
  const original = globalThis.fetch;
  const saved = Object.fromEntries(KEYS.map((k) => [k, Deno.env.get(k)]));
  const calls: Call[] = [];
  const usage = { rows: opts.usage ?? [], added: [] as UsageRow[] };
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(input), body: init.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init.headers) };
    calls.push(call);
    if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return await handler(call, calls.length);
  }) as typeof fetch;
  for (const k of KEYS) Deno.env.delete(k);
  Deno.env.set('SAMBANOVA_API_KEY', 'sn-test');
  Deno.env.set('GROQ_API_KEY', 'gq-test');
  Deno.env.set('CLOUDFLARE_ACCOUNT_ID', 'acc123');
  Deno.env.set('CLOUDFLARE_API_TOKEN', 'cf-test');
  Deno.env.set('LLM_ROUTES', FIXTURE_ROUTES);
  _resetLlmStateForTests();
  _setPacingForTests(opts.pacing ?? false);
  _setUsageStoreForTests({ load: () => Promise.resolve(usage.rows), add: (r) => (usage.added.push(r), Promise.resolve()) });
  try {
    await fn(calls, usage);
  } finally {
    globalThis.fetch = original;
    for (const k of KEYS) saved[k] === undefined ? Deno.env.delete(k) : Deno.env.set(k, saved[k]!);
    _setUsageStoreForTests(null);
    _setPacingForTests(true);
  }
}

const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] };
const opts = (over: Partial<GenerateJsonOptions> = {}): GenerateJsonOptions => ({ system: 'sys', prompt: 'p', schema, timeoutMs: 60_000, ...over });

// ─── Routes ───

Deno.test('routes: Cloudflare writes the edition, Groq the rest; no SambaNova, Claude, Gemini or Mistral by default', () => {
  assertEquals(routeFor('edition', undefined).map((s) => `${s.provider}:${s.model ?? ''}`), [
    'cloudflare:', 'cloudflare:@cf/google/gemma-4-26b-a4b-it', 'groq:openai/gpt-oss-120b',
  ]);
  // Groq's two models before Cloudflare wherever a request can fit Groq, so Cloudflare is left for the edition.
  for (const p of ['script', 'refresh', 'region-stories', 'deeper', 'region'] as const) {
    assertEquals(routeFor(p, undefined).map((s) => s.model ?? s.provider), ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'cloudflare'], p);
  }
  assertEquals(routeFor('ask', undefined).map((s) => s.model ?? s.provider), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'cloudflare']);
  for (const route of Object.values(DEFAULT_ROUTES)) assert(route.every((s) => !['sambanova', 'anthropic', 'gemini', 'mistral'].includes(s.provider)));
});

Deno.test('routes: LLM_ROUTES replaces a purpose; Ask never goes to Mistral or Gemini; bad JSON keeps the defaults', () => {
  const custom = JSON.stringify({ edition: ['claude:claude-sonnet-5-5', 'cf:@cf/google/gemma-4-26b-a4b-it'], ask: ['mistral', 'gemini', 'groq:openai/gpt-oss-20b', 'nonsense'] });
  assertEquals(routeFor('edition', custom), [{ provider: 'anthropic', model: 'claude-sonnet-5-5' }, { provider: 'cloudflare', model: '@cf/google/gemma-4-26b-a4b-it' }]);
  assertEquals(routeFor('ask', custom), [{ provider: 'groq', model: 'openai/gpt-oss-20b' }]);
  assertEquals(routeFor('script', custom), DEFAULT_ROUTES.script, 'purposes it leaves out keep their default');
  assertEquals(routeFor('edition', '{not json'), DEFAULT_ROUTES.edition);
  // OpenRouter model ids have colons of their own.
  assertEquals(routeFor('deeper', JSON.stringify({ deeper: ['openrouter:openai/gpt-oss-120b:free'] })), [{ provider: 'openrouter', model: 'openai/gpt-oss-120b:free' }]);
});

// ─── Request shapes ───

Deno.test('SambaNova: JSON mode with the schema in the instructions (its strict mode is not enforced); usage counted', async () => {
  await withProviders(() => chat('{"ok":true}', { prompt_tokens: 1200, completion_tokens: 300 }), async (calls, usage) => {
    const r = await generateJson(opts({ purpose: 'edition', maxOutputTokens: 16_000 }));
    assertEquals(r.data, { ok: true });
    assertEquals([r.provider, r.model], ['sambanova', 'DeepSeek-V3.1']);
    const c = calls[0];
    assertEquals(c.url, 'https://api.sambanova.ai/v1/chat/completions');
    assertEquals(c.headers.get('authorization'), 'Bearer sn-test');
    assertEquals(c.body.response_format, { type: 'json_object' });
    assert(c.body.messages[0].content.includes('"required":["ok"]'), 'the schema is in the system message');
    assertEquals(c.body.messages[1], { role: 'user', content: 'p' });
    assertEquals(c.body.max_tokens, 8000, 'capped to what the free model is sent');
    const total = usage.added.reduce((n, a) => ({ calls: n.calls + a.calls, in: n.in + a.tokens_in, out: n.out + a.tokens_out }), { calls: 0, in: 0, out: 0 });
    assertEquals(total, { calls: 1, in: 1200, out: 300 });
    assertEquals(usage.added[0].day, usageDay());
  });
});

Deno.test('Groq: strict json_schema, low reasoning effort, max_completion_tokens; reasoning tokens are counted', async () => {
  await withProviders(() => chat('{"ok":true}', { prompt_tokens: 500, completion_tokens: 50, total_tokens: 900 }), async (calls, usage) => {
    await generateJson(opts({ purpose: 'ask', maxOutputTokens: 1500 }));
    const b = calls[0].body;
    assertEquals(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
    assertEquals(b.model, 'openai/gpt-oss-120b');
    assertEquals(b.response_format.type, 'json_schema');
    assertEquals(b.response_format.json_schema.strict, true);
    assertEquals(b.response_format.json_schema.schema.additionalProperties, false);
    assertEquals(b.reasoning_effort, 'low');
    assertEquals(b.max_completion_tokens, 1500);
    assertEquals(b.max_tokens, undefined);
    assertEquals(usage.added.reduce((n, a) => n + a.tokens_out, 0), 400, 'total minus prompt: the thinking counts');
  });
});

Deno.test('Cloudflare: the account URL, JSON mode, explicit max_tokens', async () => {
  await withProviders(() => chat('{"ok":true}'), async (calls) => {
    Deno.env.delete('GROQ_API_KEY');
    const r = await generateJson(opts({ purpose: 'region', maxOutputTokens: 2500 }));
    assertEquals(r.provider, 'cloudflare');
    assertEquals(calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/acc123/ai/v1/chat/completions');
    assertEquals(calls[0].body.model, '@cf/openai/gpt-oss-120b');
    assertEquals(calls[0].body.response_format, { type: 'json_object' });
    assertEquals(calls[0].body.max_tokens, 2500);
  });
});

// ─── Fallback ───

Deno.test('fallback: 429, 413, 5xx, an empty reply and a timeout each move on to the next model', async () => {
  const cases: [string, (c: Call) => Response | Promise<Response>][] = [
    ['429', () => new Response('{"error":{"message":"rate limited"}}', { status: 429, headers: { 'retry-after': '30' } })],
    ['413', () => new Response('{"error":{"message":"too large"}}', { status: 413 })],
    ['503', () => new Response('busy', { status: 503 })],
    ['empty', () => chat('', { prompt_tokens: 10, completion_tokens: 20 }, 'stop')],
    ['timeout', () => new Promise<Response>((_, reject) => setTimeout(() => reject(new DOMException('aborted', 'AbortError')), 5))],
  ];
  for (const [name, fail] of cases) {
    await withProviders((c) => (c.body.model === 'DeepSeek-V3.1' ? fail(c) : chat('{"ok":true}')), async (calls) => {
      const r = await generateJson(opts({ purpose: 'edition' }));
      assertEquals([r.provider, r.model], ['sambanova', 'DeepSeek-V3.2'], name);
      assertEquals(calls.map(which), ['sambanova:DeepSeek-V3.1', 'sambanova:DeepSeek-V3.2'], name);
    });
  }
});

Deno.test('fallback: a model that rejects the JSON mode or reasoning_effort is asked again without it', async () => {
  await withProviders((_, n) => {
    if (n === 1) return new Response('{"error":{"message":"response_format json_schema is not supported"}}', { status: 400 });
    if (n === 2) return new Response('{"error":{"message":"unknown parameter: reasoning_effort"}}', { status: 400 });
    return chat('{"ok":true}');
  }, async (calls) => {
    const r = await generateJson(opts({ purpose: 'ask' }));
    assertEquals(r.model, 'openai/gpt-oss-120b');
    assertEquals(calls[0].body.response_format.type, 'json_schema');
    assertEquals(calls[1].body.response_format, { type: 'json_object' });
    assertEquals(calls[1].body.reasoning_effort, 'low');
    assertEquals(calls[2].body.reasoning_effort, undefined);
  });
});

Deno.test('fallback: a 402 (SambaNova\'s "payment method required") skips all that provider\'s models for the run, uncounted', async () => {
  const refused = () => new Response('{"error":{"balance_units":0,"code":"PAYMENT_METHOD_REQUIRED","message":"A payment method is required."}}', { status: 402 });
  await withProviders((c) => (c.url.includes('sambanova') ? refused() : chat('{"ok":true}')), async (calls, usage) => {
    assertEquals((await generateJson(opts({ purpose: 'script' }))).provider, 'groq');
    assertEquals((await generateJson(opts({ purpose: 'deeper' }))).provider, 'groq');
    assertEquals(calls.map(which), ['sambanova:gpt-oss-120b', 'groq:openai/gpt-oss-120b', 'groq:openai/gpt-oss-120b']);
    assert(usage.added.every((u) => u.provider !== 'sambanova'), 'a refused request is not one of the day\'s calls');
  });
});

Deno.test('fallback: every model failing is one retryable error that names them all', async () => {
  await withProviders(() => new Response('down', { status: 502 }), async (calls) => {
    const e = await assertRejects(() => generateJson(opts({ purpose: 'edition' })), LlmError);
    assert(e.retryable);
    assert(e.message.includes('DeepSeek-V3.1') && e.message.includes('Cloudflare'), e.message);
    assertEquals(calls.length, 3);
  });
});

// ─── Size: Groq's free tier takes about 7k tokens a request ───

Deno.test('size: Groq gets a prompt cut to fit; a prompt that can\'t be cut skips Groq', async () => {
  await withProviders(() => chat('{"ok":true}'), async (calls) => {
    const big = 'x'.repeat(60_000);
    let asked = 0;
    await generateJson(opts({ purpose: 'ask', prompt: big, maxOutputTokens: 1500, fitPrompt: (max) => (asked = max, big.slice(0, max)) }));
    assertEquals(which(calls[0]), 'groq:openai/gpt-oss-120b');
    assert(asked > 10_000 && asked < 20_000, `room for about 5k tokens of prompt, got ${asked} chars`);
    assert(calls[0].body.messages[1].content.length <= asked);

    const r = await generateJson(opts({ purpose: 'ask', prompt: big, maxOutputTokens: 1500 }));
    assertEquals(r.provider, 'cloudflare');
    assertEquals(calls.slice(1).map(which), ['cloudflare:@cf/openai/gpt-oss-120b'], 'no request is sent to Groq at all');
  });
});

// ─── Daily budgets (ai_usage) ───

const used = (provider: string, model: string, calls: number, tokensIn = 0, tokensOut = 0): UsageRow =>
  ({ day: usageDay(), provider, model, calls, tokens_in: tokensIn, tokens_out: tokensOut });

Deno.test('budget: a SambaNova model with its 20 requests (or 200k tokens) used today is skipped before it is asked', async () => {
  await withProviders(() => chat('{"ok":true}'), async (calls) => {
    const r = await generateJson(opts({ purpose: 'edition' }));
    assertEquals(r.model, 'DeepSeek-V3.2');
    assertEquals(calls.map(which), ['sambanova:DeepSeek-V3.2']);
  }, { usage: [used('sambanova', 'DeepSeek-V3.1', 19)] });
  await withProviders(() => chat('{"ok":true}'), async (calls) => {
    await generateJson(opts({ purpose: 'edition' }));
    assertEquals(calls.map(which), ['sambanova:DeepSeek-V3.2']);
  }, { usage: [used('sambanova', 'DeepSeek-V3.1', 10, 150_000, 39_000)] });
});

Deno.test('budget: Cloudflare stops near 10k neurons a day across all its models', async () => {
  await withProviders(() => chat('{"ok":true}'), async (calls) => {
    Deno.env.delete('GROQ_API_KEY');
    // 295k tokens in on gpt-oss-120b ≈ 9,400 neurons: an 8k-token reply would pass the line.
    const e = await assertRejects(() => generateJson(opts({ purpose: 'region', maxOutputTokens: 8000 })), LlmError);
    assertEquals(calls.length, 0);
    assert(e.message.startsWith('Every AI provider for "region" is at its free-tier daily limit'), e.message);
    assertEquals(aiErrorResponse(e).status, 429, 'the app is told the free allowance is used up for today');
  }, { usage: [used('cloudflare', '@cf/openai/gpt-oss-120b', 40, 295_000, 0)] });
});

Deno.test('budget: Cloudflare keeps its last 4,500 neurons of the day for the edition', async () => {
  await withProviders(() => chat('{"ok":true}'), async (calls) => {
    Deno.env.delete('SAMBANOVA_API_KEY');
    Deno.env.delete('GROQ_API_KEY');
    // 163k tokens in ≈ 5,200 neurons: past what other work may use, well inside the edition's day.
    const e = await assertRejects(() => generateJson(opts({ purpose: 'deeper' })), LlmError);
    assert(e.message.startsWith('Every AI provider for "deeper" is at its free-tier daily limit'), e.message);
    assertEquals(calls.length, 0);
    assertEquals((await generateJson(opts({ purpose: 'edition' }))).provider, 'cloudflare');
    assertEquals(calls.length, 1);
  }, { usage: [used('cloudflare', '@cf/openai/gpt-oss-120b', 30, 163_000, 0)] });
});

Deno.test('budget: "done for today" replies (Cloudflare 3036, Groq per-day) stop asking that model for the run', async () => {
  await withProviders((c) =>
    c.url.includes('groq')
      ? new Response('{"error":{"message":"Rate limit reached on tokens per day (TPD): Limit 200000"}}', { status: 429 })
      : chat('{"ok":true}'), async (calls) => {
    Deno.env.set('LLM_ROUTES', JSON.stringify({ region: ['groq:openai/gpt-oss-120b', 'cloudflare'] }));
    await generateJson(opts({ purpose: 'region' }));
    await generateJson(opts({ purpose: 'region' }));
    assertEquals(calls.map(which), ['groq:openai/gpt-oss-120b', 'cloudflare:@cf/openai/gpt-oss-120b', 'cloudflare:@cf/openai/gpt-oss-120b']);
  });
});

Deno.test('budget: the owner is warned at 80% of a model\'s daily allowance', () => {
  const w = budgetWarnings([used('sambanova', 'DeepSeek-V3.1', 16), used('sambanova', 'gpt-oss-120b', 3), used('groq', 'openai/gpt-oss-120b', 10, 150_000, 10_000)]);
  assertEquals(w.map((x) => `${x.provider}:${x.model}`), ['sambanova:DeepSeek-V3.1', 'groq:openai/gpt-oss-120b']);
  assert(w[0].share >= 0.8 && w[0].share < 1);
});

// ─── Pacing ───

Deno.test('pacing: Groq\'s 8k tokens a minute; a request that would have to wait past the deadline goes elsewhere', async () => {
  await withProviders(() => chat('{"ok":true}'), async (calls) => {
    const prompt = 'y'.repeat(14_000); // ~4k tokens + 1.5k reply each: two don't fit in one minute
    await generateJson(opts({ purpose: 'ask', prompt, maxOutputTokens: 1500, timeoutMs: 30_000 }));
    await generateJson(opts({ purpose: 'ask', prompt, maxOutputTokens: 1500, timeoutMs: 30_000 }));
    assertEquals(calls.map(which), ['groq:openai/gpt-oss-120b', 'groq:openai/gpt-oss-20b'], 'the second Groq model has its own minute');
    await generateJson(opts({ purpose: 'ask', prompt, maxOutputTokens: 1500, timeoutMs: 30_000 }));
    assertEquals(which(calls[2]), 'cloudflare:@cf/openai/gpt-oss-120b');
  }, { pacing: true });
});

Deno.test('no provider set up for a purpose: a clear, non-retryable error', async () => {
  await withProviders(() => chat('{}'), async () => {
    for (const k of ['SAMBANOVA_API_KEY', 'GROQ_API_KEY', 'CLOUDFLARE_API_TOKEN']) Deno.env.delete(k);
    const e = await assertRejects(() => generateJson(opts({ purpose: 'deeper' })), LlmError);
    assertEquals([e.status, e.retryable], [null, false]);
    assert(e.message.includes('SAMBANOVA_API_KEY'), e.message);
    assertEquals(aiErrorResponse(e).error, 'The AI key is not set up on the server.');
  });
});

// ─── Strict schemas ───

Deno.test('toStrictSchema: closed objects, every property required, optional ones nullable, no length limits', () => {
  // deno-lint-ignore no-explicit-any
  const strict = toStrictSchema(pickSchema(TOPICS)) as any;
  const item = strict.properties.picks.items;
  assertEquals(strict.additionalProperties, false);
  assertEquals(strict.properties.picks.maxItems, undefined);
  assertEquals(item.additionalProperties, false);
  assertEquals(item.required, ['clusterId', 'topic', 'alsoClusterIds']);
  assertEquals(item.properties.alsoClusterIds.type, ['array', 'null'], 'alsoClusterIds was optional');
  assertEquals(item.properties.clusterId.type, 'string');
  assertEquals(item.properties.topic.enum, TOPICS);
  // An optional enum can't just add "null" to its type: it becomes a choice.
  // deno-lint-ignore no-explicit-any
  const e = toStrictSchema({ type: 'object', properties: { t: { type: 'string', enum: ['a'], description: 'd', maxLength: 3 } } }) as any;
  assertEquals(e.properties.t, { description: 'd', anyOf: [{ type: 'string', enum: ['a'] }, { type: 'null' }] });
  assertEquals(e.required, ['t']);
});
