// The AI providers. The only file that knows which AI we use; everything else calls
// `generateJson()` with a `purpose` and validates what comes back.
//
// Everything runs on free tiers ($0). Each purpose has a route: models tried in order,
// moving on when one is rate-limited (429), says the request is too large (413), fails
// (5xx or a bad reply), times out, or has used up its known daily allowance (counted in
// the `ai_usage` table, so a model is skipped before it hits its limit).
//
//   edition (pick, editor, writing)   SambaNova DeepSeek-V3.1 → SambaNova DeepSeek-V3.2 → Cloudflare
//   script, refresh, region-stories   SambaNova gpt-oss-120b → SambaNova DeepSeek-V3.2 → Groq → Cloudflare
//   deeper                            SambaNova Llama 3.3 70B → SambaNova gpt-oss-120b → Groq → Cloudflare
//   region (one-line local items)     Groq → Cloudflare
//   ask                               Groq gpt-oss-120b → Groq gpt-oss-20b → Cloudflare → SambaNova Llama 3.3 70B
//
// SambaNova's free limits are per model, so each kind of work gets its own model first:
// an edition's ~11 calls fit inside DeepSeek-V3.1's day on their own.
// Only Cloudflare can take an edition's ~16k-token prompts when SambaNova can't answer
// (Groq's free tier stops at 8k tokens a minute), so everything else tries Groq first and
// leaves Cloudflare's last CLOUDFLARE_EDITION_RESERVE neurons of the day to the edition.
// A 402 ("payment required") is about the whole account: that provider is skipped for
// the rest of the run.
// Ask never goes to Mistral (its free mode may train on what it's sent, and readers
// type their own words there) or to Gemini, whatever LLM_ROUTES says.
//
// LLM_ROUTES (secret, JSON) replaces the route of any purpose, e.g.
//   {"edition": ["sambanova:gpt-oss-120b", "cloudflare"], "ask": ["groq:openai/gpt-oss-20b"]}
// Each step is "provider" or "provider:model". Claude ("anthropic"), Gemini and Mistral
// are only used when LLM_ROUTES names them: Claude costs money, Gemini's free tier may
// not serve the UK and EEA, and Mistral's free API isn't available to Brewsy's account.
//
// SambaNova, Groq, Cloudflare Workers AI, OpenRouter and Mistral all speak the OpenAI
// chat-completions dialect; one adapter covers them. Checked against their docs (Oct 2026):
// - SambaNova Cloud (docs.sambanova.ai/docs/en/models/rate-limits): free while no payment
//   method is linked (adding one moves the account to the paid Developer tier). Every model
//   gets 20 requests a minute, 20 a day and 200,000 tokens a day: DeepSeek-V3.1,
//   Meta-Llama-3.3-70B-Instruct and gpt-oss-120b (128k context), DeepSeek-V3.2 (32k) and
//   gemma-4-31B-it. `response_format` json_schema is accepted but `strict` isn't enforced
//   yet, so it gets `json_object` plus the schema in the instructions. On 2026-10-20 the
//   API answered every model with 402 PAYMENT_METHOD_REQUIRED for Brewsy's key, docs
//   notwithstanding, so every route still works without SambaNova.
// - Groq (console.groq.com/docs/rate-limits): `openai/gpt-oss-120b` and `-20b` free = 30
//   requests and 8,000 tokens a minute, 1,000 requests and 200,000 tokens a day, each.
//   Strict `json_schema`. Reasoning tokens count, so `reasoning_effort` is low and each
//   request stays under 7k tokens.
// - Cloudflare Workers AI (developers.cloudflare.com/workers-ai): 10,000 free neurons a day
//   (reset 00:00 UTC), shared by every model on the account; gpt-oss-120b costs 31,818
//   neurons per million input tokens and 68,182 per million output. Its `json_schema`
//   shape differs from OpenAI's, so it gets `json_object` plus the schema too.
// - OpenRouter (openrouter.ai/docs): `:free` models, 50 requests a day without credits.
// - Mistral (docs.mistral.ai): `mistral-medium-latest` = Medium 3.5, strict `json_schema`.

import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';

import { rpc, select } from './db.ts';

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

export type JsonSchema = Record<string, unknown>;
export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

/** What a call is for: picks its route of providers. */
export type Purpose = 'edition' | 'script' | 'refresh' | 'region' | 'region-stories' | 'deeper' | 'ask';
export const PURPOSES: Purpose[] = ['edition', 'script', 'refresh', 'region', 'region-stories', 'deeper', 'ask'];

export type ProviderId = 'mistral' | 'groq' | 'cloudflare' | 'sambanova' | 'openrouter' | 'anthropic' | 'gemini';

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    /** True for rate limits / overloads / timeouts — worth retrying later. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export type GenerateJsonOptions = {
  system: string;
  prompt: string;
  schema: JsonSchema;
  /** Which route to take (default 'edition'). */
  purpose?: Purpose;
  /**
   * Builds the prompt for a provider that only takes `maxChars` of it (Groq's free tier
   * is small). Without it, a prompt too big for a provider skips that provider.
   */
  fitPrompt?: (maxChars: number) => string;
  /** Not sent to Claude Opus 5.5 (it rejects sampling parameters). */
  temperature?: number;
  maxOutputTokens?: number;
  thinking?: ThinkingLevel;
  /** The whole call, fallbacks and waiting for a free slot included. */
  timeoutMs?: number;
};

export type GenerateJsonResult = {
  data: unknown;
  text: string;
  /** Which provider answered (fakes in tests may leave it out). */
  provider?: ProviderId;
  model: string;
  finishReason: string | null;
  usage: { input?: number; output?: number };
};

// ─── Providers and models ──────────────────────────────────────────────────

/** How we ask for JSON: a strict schema, plain JSON mode (+ schema in the prompt), or the prompt alone. */
export type JsonMode = 'json_schema' | 'json_object' | 'prompt';

export type ModelSpec = {
  /** Requests we start per minute… */
  rpm: number;
  /** …at least this far apart. */
  minGapMs: number;
  /** Tokens (input + output) per minute, where the provider counts them. */
  tpm?: number;
  /** Largest request we send, estimated input + output tokens. */
  maxRequestTokens: number;
  maxOutputTokens: number;
  json: JsonMode;
  /** Free daily allowance per model (UTC day); we stop a little short of it. */
  perDay?: { calls?: number; tokens?: number };
  /** Cloudflare neurons per million tokens (the account's free 10k a day are shared by all models). */
  neurons?: { in: number; out: number };
  reasoningEffort?: 'low' | 'medium';
};

type OpenAiProvider = {
  label: string;
  keyName: string;
  /** The chat-completions URL, or null when an account setting is missing. */
  url: () => string | null;
  key: () => string | undefined;
  maxTokensField: 'max_tokens' | 'max_completion_tokens';
  defaultModel: string;
  /** Used for a model we have no entry for. */
  defaults: ModelSpec;
};

const env = (name: string) => Deno.env.get(name)?.trim() || undefined;
const num = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const GROQ_FREE: ModelSpec = {
  rpm: 28, minGapMs: 0, tpm: 7_500, maxRequestTokens: 7_000, maxOutputTokens: 3_000, json: 'json_schema',
  perDay: { calls: 950, tokens: 190_000 }, reasoningEffort: 'low',
};

/** Cloudflare's free daily neurons, minus a little headroom. */
export const CLOUDFLARE_DAILY_NEURONS = 9_500;
/** Kept for the world edition (one costs ~3,500 on gpt-oss-120b): other work stops short of them. */
export const CLOUDFLARE_EDITION_RESERVE = 4_500;

export const PROVIDERS: Record<Exclude<ProviderId, 'anthropic' | 'gemini'>, OpenAiProvider> = {
  mistral: {
    label: 'Mistral',
    keyName: 'MISTRAL_API_KEY',
    url: () => 'https://api.mistral.ai/v1/chat/completions',
    key: () => env('MISTRAL_API_KEY'),
    maxTokensField: 'max_tokens',
    defaultModel: 'mistral-medium-latest',
    defaults: {
      rpm: num('MISTRAL_RPM', 50), minGapMs: 1_100, maxRequestTokens: 120_000, maxOutputTokens: 16_000, json: 'json_schema',
    },
  },
  groq: {
    label: 'Groq',
    keyName: 'GROQ_API_KEY',
    url: () => 'https://api.groq.com/openai/v1/chat/completions',
    key: () => env('GROQ_API_KEY'),
    maxTokensField: 'max_completion_tokens',
    defaultModel: 'openai/gpt-oss-120b',
    defaults: { ...GROQ_FREE, reasoningEffort: undefined },
  },
  cloudflare: {
    label: 'Cloudflare',
    keyName: 'CLOUDFLARE_API_TOKEN',
    url: () => {
      const account = env('CLOUDFLARE_ACCOUNT_ID');
      return account ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/v1/chat/completions` : null;
    },
    key: () => env('CLOUDFLARE_API_TOKEN'),
    maxTokensField: 'max_tokens',
    defaultModel: '@cf/openai/gpt-oss-120b',
    defaults: { rpm: 60, minGapMs: 0, maxRequestTokens: 60_000, maxOutputTokens: 16_000, json: 'json_object', neurons: { in: 31_818, out: 68_182 } },
  },
  sambanova: {
    label: 'SambaNova',
    keyName: 'SAMBANOVA_API_KEY',
    url: () => 'https://api.sambanova.ai/v1/chat/completions',
    key: () => env('SAMBANOVA_API_KEY'),
    maxTokensField: 'max_tokens',
    defaultModel: 'gpt-oss-120b',
    // 20 a minute, 20 a day, 200k tokens a day per model; we stop one request and 10k tokens short.
    defaults: { rpm: 18, minGapMs: 1_000, maxRequestTokens: 100_000, maxOutputTokens: 8_000, json: 'json_object', perDay: { calls: 19, tokens: 190_000 } },
  },
  openrouter: {
    label: 'OpenRouter',
    keyName: 'OPENROUTER_API_KEY',
    url: () => 'https://openrouter.ai/api/v1/chat/completions',
    key: () => env('OPENROUTER_API_KEY'),
    maxTokensField: 'max_tokens',
    defaultModel: 'openai/gpt-oss-120b:free',
    defaults: { rpm: 15, minGapMs: 0, maxRequestTokens: 60_000, maxOutputTokens: 16_000, json: 'json_object', perDay: { calls: 45 } },
  },
};

/** Models we know more about than their provider's defaults. Keyed "provider:model". */
export const MODELS: Record<string, Partial<ModelSpec>> = {
  'mistral:mistral-medium-latest': {},
  'mistral:mistral-large-latest': {},
  'mistral:mistral-small-latest': {},
  'groq:openai/gpt-oss-120b': GROQ_FREE,
  'groq:openai/gpt-oss-20b': GROQ_FREE,
  'groq:qwen/qwen3.8-27b': { ...GROQ_FREE, reasoningEffort: undefined },
  'cloudflare:@cf/openai/gpt-oss-120b': { neurons: { in: 31_818, out: 68_182 }, json: 'json_object', reasoningEffort: 'low' },
  'cloudflare:@cf/google/gemma-4-26b-a4b-it': { neurons: { in: 9_091, out: 27_273 }, json: 'json_schema' },
  'cloudflare:@cf/meta/llama-3.3-70b-instruct-fp8-fast': { neurons: { in: 26_668, out: 204_805 }, maxRequestTokens: 20_000, maxOutputTokens: 4_000 },
  'sambanova:gpt-oss-120b': { reasoningEffort: 'low' },
  'sambanova:DeepSeek-V3.1': {},
  // 32k context: the editor's long candidate list still fits with a smaller reply budget.
  'sambanova:DeepSeek-V3.2': { maxRequestTokens: 31_000, maxOutputTokens: 8_000 },
  'sambanova:Meta-Llama-3.3-70B-Instruct': {},
  'sambanova:gemma-4-31B-it': {},
};

export function modelSpec(provider: Exclude<ProviderId, 'anthropic' | 'gemini'>, model: string): ModelSpec {
  return { ...PROVIDERS[provider].defaults, ...MODELS[`${provider}:${model}`] };
}

// ─── Routes ────────────────────────────────────────────────────────────────

export type RouteStep = { provider: ProviderId; model?: string };

const CLOUDFLARE: RouteStep = { provider: 'cloudflare' };
const groq = (model: string): RouteStep => ({ provider: 'groq', model });
// Groq first wherever a request fits its 7k-token cap (two models, two daily allowances), so
// Cloudflare's daily neurons are left for the edition.
const WRITING: RouteStep[] = [groq('openai/gpt-oss-120b'), groq('qwen/qwen3.8-27b'), CLOUDFLARE];

// SambaNova isn't in any default route: in Oct 2026 its "free tier" answered every model with 402
// PAYMENT_METHOD_REQUIRED. Name it in LLM_ROUTES if that changes.
export const DEFAULT_ROUTES: Record<Purpose, RouteStep[]> = {
  // The pick and editor prompts (~16k tokens) only fit Cloudflare; Groq is the shrunken last resort.
  edition: [CLOUDFLARE, { provider: 'cloudflare', model: '@cf/google/gemma-4-26b-a4b-it' }, groq('openai/gpt-oss-120b')],
  script: WRITING,
  refresh: WRITING,
  'region-stories': WRITING,
  deeper: WRITING,
  region: WRITING,
  ask: [groq('openai/gpt-oss-120b'), groq('openai/gpt-oss-20b'), CLOUDFLARE],
};

const PROVIDER_NAMES: Record<string, ProviderId> = {
  mistral: 'mistral', groq: 'groq', cloudflare: 'cloudflare', cf: 'cloudflare', 'workers-ai': 'cloudflare',
  sambanova: 'sambanova', openrouter: 'openrouter', anthropic: 'anthropic', claude: 'anthropic', gemini: 'gemini', google: 'gemini',
};

/** Providers that never see what readers type (see the top of this file). */
const NEVER_FOR_ASK: ProviderId[] = ['mistral', 'gemini'];

function parseStep(raw: unknown): RouteStep | null {
  if (typeof raw !== 'string') return null;
  const i = raw.indexOf(':');
  const name = (i === -1 ? raw : raw.slice(0, i)).trim().toLowerCase();
  const model = i === -1 ? '' : raw.slice(i + 1).trim();
  const provider = PROVIDER_NAMES[name];
  return provider ? { provider, ...(model ? { model } : {}) } : null;
}

/** The route for a purpose: LLM_ROUTES if it names one, else the default. Pure given the secret. */
export function routeFor(purpose: Purpose, routesJson = Deno.env.get('LLM_ROUTES')): RouteStep[] {
  let route = DEFAULT_ROUTES[purpose];
  if (routesJson?.trim()) {
    try {
      const parsed = JSON.parse(routesJson) as Record<string, unknown>;
      const custom = parsed?.[purpose];
      if (Array.isArray(custom)) {
        const steps = custom.map(parseStep).filter((s): s is RouteStep => s !== null);
        if (steps.length) route = steps;
      }
    } catch {
      console.error(JSON.stringify({ event: 'llm_routes_invalid', message: 'LLM_ROUTES is not valid JSON; using the default routes.' }));
    }
  }
  return purpose === 'ask' ? route.filter((s) => !NEVER_FOR_ASK.includes(s.provider)) : route;
}

function stepModel(step: RouteStep): string {
  if (step.provider === 'anthropic') return step.model ?? claudeModel();
  if (step.provider === 'gemini') return step.model ?? geminiModel();
  return step.model ?? PROVIDERS[step.provider].defaultModel;
}

function configured(step: RouteStep): boolean {
  if (step.provider === 'anthropic') return Boolean(env('ANTHROPIC_API_KEY'));
  if (step.provider === 'gemini') return Boolean(env('GEMINI_API_KEY'));
  const p = PROVIDERS[step.provider];
  return Boolean(p.key() && p.url());
}

/** "mistral:mistral-medium-latest", the first set-up step of a route (for logs). */
export function activeModel(purpose: Purpose = 'edition'): string {
  const step = routeFor(purpose).find(configured);
  return step ? `${step.provider}:${stepModel(step)}` : 'none';
}

function keyNames(route: RouteStep[]): string {
  const names = route.map((s) =>
    s.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : s.provider === 'gemini' ? 'GEMINI_API_KEY'
    : s.provider === 'cloudflare' ? 'CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN' : PROVIDERS[s.provider].keyName
  );
  return [...new Set(names)].join(' or ');
}

// ─── Schemas ───────────────────────────────────────────────────────────────

const LIMIT_KEYS = ['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'maxItems', 'exclusiveMinimum', 'exclusiveMaximum'];

/**
 * OpenAI-style strict mode: every object closed and every property required. A
 * property that was optional becomes nullable instead (our validators treat null as
 * missing). Length and number limits aren't accepted everywhere, so they're dropped;
 * the validators enforce them after the reply.
 */
export function toStrictSchema(schema: JsonSchema): JsonSchema {
  // deno-lint-ignore no-explicit-any
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    // deno-lint-ignore no-explicit-any
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (LIMIT_KEYS.includes(k) || k === 'minItems') continue;
      if (k === 'properties' || k === 'required') continue;
      out[k] = walk(v);
    }
    if (node.properties && typeof node.properties === 'object') {
      const required = new Set<string>(Array.isArray(node.required) ? node.required : []);
      out.properties = Object.fromEntries(Object.entries(node.properties).map(([name, sub]) => {
        const s = walk(sub);
        return [name, required.has(name) ? s : nullable(s)];
      }));
      out.required = Object.keys(node.properties);
    }
    if (out.type === 'object') out.additionalProperties = false;
    return out;
  };
  return walk(schema);
}

// deno-lint-ignore no-explicit-any
function nullable(s: any): any {
  if (typeof s.type === 'string' && !s.enum) return { ...s, type: [s.type, 'null'] };
  const { description, ...rest } = s;
  return { ...(description ? { description } : {}), anyOf: [rest, { type: 'null' }] };
}

/** For JSON mode without a schema parameter: the shape goes in the instructions. */
export function schemaInstruction(schema: JsonSchema): string {
  return `\n\nReply with one JSON object only (no prose, no code fences) that matches this JSON Schema:\n${JSON.stringify(schema)}`;
}

/** Rough token count for English text and JSON (errs on the high side). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/** Pulls JSON out of a reply even if the model wrapped it in ``` fences. */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('The AI reply was not valid JSON.');
  }
}

// ─── Usage (the ai_usage table) ────────────────────────────────────────────

export type UsageRow = { day: string; provider: string; model: string; calls: number; tokens_in: number; tokens_out: number };

export type UsageStore = {
  load: (day: string) => Promise<UsageRow[]>;
  add: (row: UsageRow) => Promise<void>;
};

/** The database, when there is one (not in tests or local dry runs). */
const dbUsageStore: UsageStore = {
  load: (day) =>
    Deno.env.get('SUPABASE_URL')
      ? select<UsageRow>('ai_usage', `select=day,provider,model,calls,tokens_in,tokens_out&day=eq.${day}`)
      : Promise.resolve([]),
  add: async (r) => {
    if (!Deno.env.get('SUPABASE_URL')) return;
    await rpc('ai_usage_add', { p_day: r.day, p_provider: r.provider, p_model: r.model, p_calls: r.calls, p_tokens_in: r.tokens_in, p_tokens_out: r.tokens_out });
  },
};

let usageStore: UsageStore = dbUsageStore;
/** Today's usage as this run knows it: loaded once, then counted locally. */
let usageCache: { day: string; loadedAt: number; rows: Map<string, UsageRow> } | null = null;
const USAGE_RELOAD_MS = 5 * 60_000;

export const usageDay = (now = new Date()) => now.toISOString().slice(0, 10);

async function todaysUsage(): Promise<Map<string, UsageRow>> {
  const day = usageDay();
  if (usageCache && usageCache.day === day && Date.now() - usageCache.loadedAt < USAGE_RELOAD_MS) return usageCache.rows;
  let rows: UsageRow[] = [];
  try {
    rows = await usageStore.load(day);
  } catch (e) {
    console.error(JSON.stringify({ event: 'ai_usage_load_failed', message: String(e).slice(0, 200) }));
  }
  usageCache = { day, loadedAt: Date.now(), rows: new Map(rows.map((r) => [`${r.provider}|${r.model}`, { ...r }])) };
  return usageCache.rows;
}

/** Counts one call. Never throws: the count must not break the call. */
async function recordUsage(provider: ProviderId, model: string, tokensIn: number, tokensOut: number): Promise<void> {
  const rows = await todaysUsage();
  const key = `${provider}|${model}`;
  const row = rows.get(key) ?? { day: usageDay(), provider, model, calls: 0, tokens_in: 0, tokens_out: 0 };
  row.calls += 1;
  row.tokens_in += tokensIn;
  row.tokens_out += tokensOut;
  rows.set(key, row);
  try {
    await usageStore.add({ day: row.day, provider, model, calls: 1, tokens_in: tokensIn, tokens_out: tokensOut });
  } catch (e) {
    console.error(JSON.stringify({ event: 'ai_usage_add_failed', message: String(e).slice(0, 200) }));
  }
}

/** Neurons used today across every Cloudflare model. */
function cloudflareNeurons(rows: Iterable<UsageRow>): number {
  let n = 0;
  for (const r of rows) {
    if (r.provider !== 'cloudflare') continue;
    const cost = modelSpec('cloudflare', r.model).neurons;
    if (cost) n += (r.tokens_in * cost.in + r.tokens_out * cost.out) / 1e6;
  }
  return n;
}

/**
 * Share (0–1+) of a model's known daily allowance used, by calls, tokens or neurons.
 * With a `purpose` other than the edition, Cloudflare's allowance excludes the edition's reserve.
 */
export function budgetShare(
  provider: ProviderId,
  model: string,
  rows: UsageRow[],
  extra = { calls: 0, tokensIn: 0, tokensOut: 0 },
  purpose?: Purpose,
): number {
  if (provider === 'anthropic' || provider === 'gemini') return 0;
  const spec = modelSpec(provider, model);
  const r = rows.find((x) => x.provider === provider && x.model === model);
  const calls = (r?.calls ?? 0) + extra.calls;
  const tokens = (r?.tokens_in ?? 0) + (r?.tokens_out ?? 0) + extra.tokensIn + extra.tokensOut;
  const shares = [
    spec.perDay?.calls ? calls / spec.perDay.calls : 0,
    spec.perDay?.tokens ? tokens / spec.perDay.tokens : 0,
  ];
  if (provider === 'cloudflare' && spec.neurons) {
    const more = (extra.tokensIn * spec.neurons.in + extra.tokensOut * spec.neurons.out) / 1e6;
    const allowance = purpose && purpose !== 'edition' ? CLOUDFLARE_DAILY_NEURONS - CLOUDFLARE_EDITION_RESERVE : CLOUDFLARE_DAILY_NEURONS;
    shares.push((cloudflareNeurons(rows) + more) / allowance);
  }
  return Math.max(...shares);
}

/** Models at or past `share` of their daily allowance today (for the owner's alert). */
export function budgetWarnings(rows: UsageRow[], share = 0.8): { provider: string; model: string; share: number }[] {
  return rows
    .filter((r) => PROVIDER_NAMES[r.provider])
    .map((r) => ({ provider: r.provider, model: r.model, share: budgetShare(r.provider as ProviderId, r.model, rows) }))
    .filter((w) => w.share >= share)
    .sort((a, b) => b.share - a.share);
}

export async function loadUsage(day = usageDay()): Promise<UsageRow[]> {
  return await usageStore.load(day);
}

// ─── Pacing ────────────────────────────────────────────────────────────────

// Per "provider:model", for this function run: request starts, tokens sent, and until
// when a model said "too many requests", "busy" or "done for today".
const startedAt = new Map<string, number[]>();
const tokensAt = new Map<string, { t: number; tokens: number }[]>();
const coolingUntil = new Map<string, number>();
const doneForToday = new Map<string, string>();
/** Providers that answered 402 (no free credit, or "payment method required"): the whole account. */
const refusedProvider = new Map<ProviderId, string>();
/** JSON modes a model turned down; remembered for the run. */
const jsonModeOverride = new Map<string, JsonMode>();
/** Models that turned down `reasoning_effort`. */
const noReasoningParam = new Set<string>();
let pacingOn = true;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** When `key` may start a request of `tokens`, keeping under its per-minute limits. */
function nextSlot(key: string, spec: ModelSpec, now: number, tokens: number): number {
  if (!pacingOn) return Math.max(now, coolingUntil.get(key) ?? 0);
  const recent = (startedAt.get(key) ?? []).filter((t) => now - t < 60_000);
  startedAt.set(key, recent);
  let at = recent.length < spec.rpm ? now : recent[recent.length - spec.rpm] + 60_000 + 250;
  if (recent.length) at = Math.max(at, recent[recent.length - 1] + spec.minGapMs);
  if (spec.tpm) {
    const sent = (tokensAt.get(key) ?? []).filter((x) => now - x.t < 60_000);
    tokensAt.set(key, sent);
    let used = sent.reduce((n, x) => n + x.tokens, 0);
    // Wait for the oldest requests to leave the window until this one fits.
    for (const x of sent) {
      if (used + tokens <= spec.tpm) break;
      used -= x.tokens;
      at = Math.max(at, x.t + 60_000 + 250);
    }
  }
  return Math.max(at, coolingUntil.get(key) ?? 0);
}

function markStarted(key: string, tokens: number) {
  const now = Date.now();
  startedAt.set(key, [...(startedAt.get(key) ?? []), now]);
  tokensAt.set(key, [...(tokensAt.get(key) ?? []), { t: now, tokens }]);
}

/** "retry-after: 18" (seconds), else Gemini's "retryDelay", else 20 s; at most a minute. */
function retryAfterMs(headers: Headers | null, text: string): number {
  const header = Number(headers?.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return Math.min(60_000, header * 1000 + 250);
  const m = text.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.min(60_000, Number(m[1]) * 1000 + 500) : 20_000;
}

// ─── The OpenAI-compatible adapter ─────────────────────────────────────────

/** Leave at least this long for a request (a story batch takes about a minute). */
const MIN_TRY_MS = 20_000;

type Attempt =
  | { ok: true; result: GenerateJsonResult }
  | { ok: false; error: LlmError; retrySameStep?: boolean };

/** Body sent to a chat-completions endpoint. Exported for tests. */
export function chatBody(
  provider: Exclude<ProviderId, 'anthropic' | 'gemini'>,
  model: string,
  opts: GenerateJsonOptions,
  prompt: string,
  mode: JsonMode,
  maxOut: number,
  withReasoning = true,
): Record<string, unknown> {
  const spec = modelSpec(provider, model);
  const system = mode === 'json_schema' ? opts.system : opts.system + schemaInstruction(opts.schema);
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    temperature: opts.temperature ?? 0.3,
    [PROVIDERS[provider].maxTokensField]: maxOut,
  };
  if (mode === 'json_schema') {
    body.response_format = { type: 'json_schema', json_schema: { name: 'brewsy_reply', schema: toStrictSchema(opts.schema), strict: true } };
  } else if (mode === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  // gpt-oss thinks before it answers, and the thinking comes out of max_tokens: kept short.
  if (spec.reasoningEffort && withReasoning) body.reasoning_effort = spec.reasoningEffort;
  return body;
}

/** The text of a reply; some models send a list of parts (thinking + text). */
// deno-lint-ignore no-explicit-any
function replyText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((p) => p?.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('');
  return '';
}

async function tryOpenAi(
  provider: Exclude<ProviderId, 'anthropic' | 'gemini'>,
  model: string,
  opts: GenerateJsonOptions,
  giveUpAt: number,
  isLast: boolean,
): Promise<Attempt> {
  const cfg = PROVIDERS[provider];
  const spec = modelSpec(provider, model);
  const key = `${provider}:${model}`;
  const label = `${cfg.label} (${model})`;
  const mode = jsonModeOverride.get(key) ?? spec.json;

  // Fit the request under this model's cap: the prompt shrinks if the caller can shrink it.
  const maxOut = Math.min(opts.maxOutputTokens ?? 4096, spec.maxOutputTokens);
  const systemTokens = estimateTokens(opts.system + (mode === 'json_schema' ? JSON.stringify(opts.schema) : schemaInstruction(opts.schema)));
  const room = spec.maxRequestTokens - maxOut - systemTokens - 50;
  const prompt = opts.fitPrompt ? opts.fitPrompt(Math.max(0, Math.floor(room * 3.5))) : opts.prompt;
  const estimate = systemTokens + estimateTokens(prompt) + maxOut;
  if (room <= 0 || estimate > spec.maxRequestTokens) {
    return { ok: false, error: new LlmError(`${label}: request too large for its free tier (~${estimate} tokens, limit ${spec.maxRequestTokens}).`, 413, true) };
  }

  const refused = refusedProvider.get(provider);
  if (refused) return { ok: false, error: new LlmError(`${label}: free usage used up (${refused}).`, 402, true) };
  const rows = [...(await todaysUsage()).values()];
  if (doneForToday.has(key) || budgetShare(provider, model, rows, { calls: 1, tokensIn: estimate - maxOut, tokensOut: maxOut }, opts.purpose ?? 'edition') > 1) {
    return { ok: false, error: new LlmError(`${label}: free-tier daily limit reached${doneForToday.get(key) ? ` (${doneForToday.get(key)})` : ''}.`, 429, true) };
  }

  const now = Date.now();
  const startAt = nextSlot(key, spec, now, estimate);
  if (startAt + MIN_TRY_MS > giveUpAt) {
    return { ok: false, error: new LlmError(`${label}: rate limit, no request slot left in time.`, 429, true) };
  }
  if (startAt > now) await sleep(startAt - now);
  markStarted(key, estimate);

  const remaining = giveUpAt - Date.now();
  const timeoutMs = isLast ? remaining : Math.max(MIN_TRY_MS, Math.round(remaining * 0.7));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  let text: string;
  try {
    res = await fetch(cfg.url()!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key()}` },
      body: JSON.stringify(chatBody(provider, model, opts, prompt, mode, maxOut, !noReasoningParam.has(key))),
      signal: controller.signal,
    });
    text = await res.text();
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    return { ok: false, error: new LlmError(aborted ? `${label}: request timed out.` : `${label}: request failed: ${String(e).slice(0, 160)}`, null, true) };
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) {
    // Out for the day (Cloudflare 3036, SambaNova quota, Groq per-day limits), or just for now.
    const daily = /\b3036\b|daily free allocation|insufficient_quota|per day|\(RPD\)|\(TPD\)|tokens per day|requests per day/i.test(text);
    if (daily) doneForToday.set(key, 'out of free requests for today');
    else coolingUntil.set(key, Date.now() + retryAfterMs(res.headers, text));
    const hint = daily ? 'free-tier daily limit' : 'rate limit';
    return { ok: false, error: new LlmError(`${label} HTTP 429 (${hint}): ${text.slice(0, 200)}`, 429, true) };
  }
  if (res.status === 402) {
    // Not served, so not counted. Logged on its own: it needs the owner, not a retry.
    refusedProvider.set(provider, 'HTTP 402 earlier in this run');
    console.error(JSON.stringify({ event: 'llm_provider_refused', provider, model, message: text.slice(0, 300) }));
    return { ok: false, error: new LlmError(`${label} HTTP 402 (free usage used up): ${text.slice(0, 200)}`, 402, true) };
  }
  // Answered: it counts as one of the day's requests (its tokens are added below).
  await recordUsage(provider, model, 0, 0);
  if (res.status === 400 && spec.reasoningEffort && !noReasoningParam.has(key) && /reasoning/i.test(text)) {
    noReasoningParam.add(key);
    return { ok: false, error: new LlmError(`${label} HTTP 400 (reasoning_effort): ${text.slice(0, 200)}`, 400, false), retrySameStep: true };
  }
  if (res.status === 400 && mode !== 'prompt' && /response_format|json_schema|json_object|schema|structured/i.test(text)) {
    // This model won't take that JSON mode: step down (strict schema → JSON mode → prompt only).
    jsonModeOverride.set(key, mode === 'json_schema' ? 'json_object' : 'prompt');
    return { ok: false, error: new LlmError(`${label} HTTP 400 (JSON mode): ${text.slice(0, 200)}`, 400, false), retrySameStep: true };
  }
  if (res.status >= 500) coolingUntil.set(key, Date.now() + 15_000);
  if (!res.ok) {
    return { ok: false, error: new LlmError(`${label} HTTP ${res.status}: ${text.slice(0, 300)}`, res.status, res.status === 413 || res.status >= 500) };
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: new LlmError(`${label}: the reply was not JSON.`, res.status, true) };
  }
  // Reasoning tokens count against the free limits too; some providers report them apart.
  const u = payload?.usage ?? {};
  const reasoning = u.completion_tokens_details?.reasoning_tokens ?? 0;
  const output = typeof u.completion_tokens === 'number'
    ? Math.max(u.completion_tokens, typeof u.total_tokens === 'number' ? u.total_tokens - (u.prompt_tokens ?? 0) : 0, reasoning)
    : undefined;
  const usage = { input: u.prompt_tokens, output };
  await fixUsage(provider, model, usage.input ?? estimate - maxOut, usage.output ?? 0);
  const choice = payload?.choices?.[0];
  const finishReason: string | null = choice?.finish_reason ?? null;
  const out = replyText(choice?.message?.content);
  if (finishReason === 'length') return { ok: false, error: new LlmError(`${label} hit the output token limit (thinking included).`, 200, true) };
  // An empty answer usually means the thinking used up max_tokens: the next provider may do better.
  if (!out.trim()) return { ok: false, error: new LlmError(`${label} returned no text (finish_reason ${finishReason ?? 'unknown'}).`, 200, true) };
  try {
    return { ok: true, result: { data: parseJsonText(out), text: out, provider, model, finishReason, usage } };
  } catch {
    return { ok: false, error: new LlmError(`${label}: the reply was not valid JSON.`, 200, true) };
  }
}

/**
 * Every answered request counts as a call; its tokens are added once the reply says
 * how many. (Split in two so a failed request still counts against the daily calls.)
 */
async function fixUsage(provider: ProviderId, model: string, tokensIn: number, tokensOut: number): Promise<void> {
  const rows = await todaysUsage();
  const row = rows.get(`${provider}|${model}`);
  if (row) {
    row.tokens_in += tokensIn;
    row.tokens_out += tokensOut;
  }
  try {
    await usageStore.add({ day: usageDay(), provider, model, calls: 0, tokens_in: tokensIn, tokens_out: tokensOut });
  } catch (e) {
    console.error(JSON.stringify({ event: 'ai_usage_add_failed', message: String(e).slice(0, 200) }));
  }
}

// ─── generateJson ──────────────────────────────────────────────────────────

/** Calls the purpose's providers in order and returns parsed JSON (not yet validated against our types). */
export async function generateJson(opts: GenerateJsonOptions): Promise<GenerateJsonResult> {
  const purpose = opts.purpose ?? 'edition';
  const route = routeFor(purpose).filter(configured);
  if (!route.length) {
    throw new LlmError(`No AI provider is set up for "${purpose}": set ${keyNames(routeFor(purpose))} (supabase secrets set …).`, null, false);
  }
  const giveUpAt = Date.now() + (opts.timeoutMs ?? 90_000);
  const errors: LlmError[] = [];

  for (let i = 0; i < route.length; i++) {
    const step = route[i];
    const model = stepModel(step);
    const isLast = i === route.length - 1;
    if (giveUpAt - Date.now() < MIN_TRY_MS / 2) break;

    if (step.provider === 'anthropic' || step.provider === 'gemini') {
      try {
        const remaining = giveUpAt - Date.now();
        const timeoutMs = isLast ? remaining : Math.max(MIN_TRY_MS, Math.round(remaining * 0.7));
        const result = step.provider === 'anthropic'
          ? await generateClaude({ ...opts, timeoutMs }, model)
          : await generateGemini({ ...opts, timeoutMs }, step.model);
        await recordUsage(step.provider, result.model, result.usage.input ?? 0, result.usage.output ?? 0);
        return result;
      } catch (e) {
        errors.push(e instanceof LlmError ? e : new LlmError(String(e).slice(0, 300), null, true));
        continue;
      }
    }

    // Two tries on one step only when the model turned down our JSON mode.
    for (let k = 0; k < 3; k++) {
      const attempt = await tryOpenAi(step.provider, model, opts, giveUpAt, isLast);
      if (attempt.ok) {
        if (errors.length) console.log(JSON.stringify({ event: 'llm_fallback', purpose, used: `${step.provider}:${model}`, skipped: errors.map((e) => e.message.slice(0, 120)) }));
        return attempt.result;
      }
      errors.push(attempt.error);
      if (!attempt.retrySameStep) break;
    }
  }

  const allDaily = errors.length > 0 && errors.every((e) => /daily limit|used up/.test(e.message));
  const summary = errors.map((e) => e.message.slice(0, 160)).join(' | ') || 'no time left to try';
  if (allDaily) throw new LlmError(`Every AI provider for "${purpose}" is at its free-tier daily limit: ${summary}`, 429, true);
  const retryable = errors.length === 0 || errors.some((e) => e.retryable);
  const status = errors.find((e) => e.status === 429)?.status ?? errors[errors.length - 1]?.status ?? null;
  throw new LlmError(`No AI provider could answer "${purpose}": ${summary}`, status ?? 503, retryable);
}

// ─── Claude (only when LLM_ROUTES names it) ────────────────────────────────
//
// Official SDK, pinned. Model: the route's model, else CLAUDE_MODEL, else `claude-opus-5-5`.
// - Opus 5.5 always thinks; depth is set with `output_config.effort` (its
//   default is `medium`, so we always send it). Sampling params such as
//   `temperature` are rejected, so they're never sent.
// - JSON comes back through structured outputs (`output_config.format`); the
//   schema is simplified to what structured outputs accept (see toClaudeSchema).
// - `fallbacks: "default"` lets the API retry a safety-classifier decline on
//   Anthropic's recommended fallback model instead of failing the edition.

export function claudeModel(): string {
  return Deno.env.get('CLAUDE_MODEL')?.trim() || DEFAULT_CLAUDE_MODEL;
}

const EFFORT: Record<ThinkingLevel, 'low' | 'medium' | 'high'> = { MINIMAL: 'low', LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

/** Non-streaming requests stay under the SDK's HTTP timeout at this size. */
const CLAUDE_MAX_TOKENS = 16_000;

/**
 * Structured outputs accept a subset of JSON Schema: every object needs
 * `additionalProperties: false`, and length/number limits aren't supported.
 * Our hand-written validators enforce those limits after the reply instead.
 */
export function toClaudeSchema(schema: JsonSchema): JsonSchema {
  // deno-lint-ignore no-explicit-any
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    // deno-lint-ignore no-explicit-any
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (LIMIT_KEYS.includes(k)) continue;
      if (k === 'minItems' && typeof v === 'number' && v > 1) continue;
      if (k === 'properties' && v && typeof v === 'object') {
        out.properties = Object.fromEntries(Object.entries(v).map(([name, sub]) => [name, walk(sub)]));
        continue;
      }
      out[k] = walk(v);
    }
    if (out.type === 'object') out.additionalProperties = false;
    return out;
  };
  return walk(schema);
}

async function generateClaude(opts: GenerateJsonOptions, model = claudeModel()): Promise<GenerateJsonResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new LlmError('ANTHROPIC_API_KEY is not set (supabase secrets set ANTHROPIC_API_KEY=...).', null, false);
  // Short retries only: the cron tick retries a failed edition 30 min later anyway.
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: opts.timeoutMs ?? 90_000 });
  // Haiku has no server-side fallback; on the others a classifier decline is retried server-side.
  const fallback = /haiku/i.test(model) ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await client.beta.messages.create({
      model,
      max_tokens: Math.min(opts.maxOutputTokens ?? CLAUDE_MAX_TOKENS, CLAUDE_MAX_TOKENS),
      system: opts.system,
      messages: [{ role: 'user', content: opts.prompt }],
      output_config: {
        effort: EFFORT[opts.thinking ?? 'LOW'],
        format: { type: 'json_schema', schema: toClaudeSchema(opts.schema) },
      },
      ...fallback,
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new LlmError(`Claude HTTP 429 (rate limit): ${e.message.slice(0, 200)}`, 429, true);
    if (e instanceof Anthropic.AuthenticationError) throw new LlmError(`Claude HTTP 401: the ANTHROPIC_API_KEY was rejected.`, 401, false);
    if (e instanceof Anthropic.NotFoundError) throw new LlmError(`Claude HTTP 404: model "${model}" isn't available to this key.`, 404, false);
    if (e instanceof Anthropic.BadRequestError) throw new LlmError(`Claude HTTP 400: ${e.message.slice(0, 300)}`, 400, false);
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new LlmError('Claude request timed out.', null, true);
    if (e instanceof Anthropic.APIConnectionError) throw new LlmError(`Claude request failed: ${e.message.slice(0, 200)}`, null, true);
    if (e instanceof Anthropic.APIError) {
      const status = typeof e.status === 'number' ? e.status : null;
      throw new LlmError(`Claude HTTP ${status ?? '?'}: ${e.message.slice(0, 200)}`, status, status === null || status >= 500);
    }
    throw new LlmError(`Claude request failed: ${String(e).slice(0, 200)}`, null, true);
  }

  if (message.stop_reason === 'refusal') {
    throw new LlmError(`Claude declined this request (${message.stop_details?.category ?? 'no category'}).`, 200, false);
  }
  if (message.stop_reason === 'max_tokens') throw new LlmError('Claude hit the output token limit.', 200, false);
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (!text) throw new LlmError(`Claude returned no text (stop_reason ${message.stop_reason ?? 'unknown'}).`, 200, false);
  return {
    data: parseJsonText(text),
    text,
    provider: 'anthropic',
    model: message.model,
    finishReason: message.stop_reason ?? null,
    usage: { input: message.usage?.input_tokens, output: message.usage?.output_tokens },
  };
}

// ─── Gemini (only when LLM_ROUTES names it) ────────────────────────────────
//
// REST generateContent, verified against ai.google.dev (Oct 2026). Its free tier may not
// serve readers in the UK and EEA, and Google may use free-tier text to improve its
// products, so it's never a default and never sees Ask.
// - Docs recommend `gemini-3.8-flash` for new projects. The free tier covers it.
// - Structured output: `generationConfig.responseFormat.text = { mimeType: 'APPLICATION_JSON', schema }`.
//   The older `responseMimeType` + `responseJsonSchema` pair is used as a fallback.
// - Gemini 3 models take `thinkingConfig.thinkingLevel` (MINIMAL | LOW | MEDIUM | HIGH).

// Remembers which request shape worked so a run doesn't re-discover it per call.
let structuredStyle: 'responseFormat' | 'legacy' = 'responseFormat';
let thinkingSupported = true;

export function geminiModel(): string {
  return Deno.env.get('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
}

/**
 * Used when the main Gemini model is busy (503) or at its limit (429). Google's
 * free-tier limits are per model, so a second model roughly doubles what a run can do.
 * Set GEMINI_FALLBACK_MODEL=none to turn this off.
 */
export function geminiFallbackModel(): string | null {
  const m = Deno.env.get('GEMINI_FALLBACK_MODEL')?.trim() || DEFAULT_GEMINI_FALLBACK_MODEL;
  return m.toLowerCase() === 'none' || m === geminiModel() ? null : m;
}

/** Requests per minute per model we allow ourselves (the free tier allowed 5 in Oct 2026). */
function geminiRpm(): number {
  return num('GEMINI_RPM', 5);
}

function buildGeminiBody(opts: GenerateJsonOptions, style: typeof structuredStyle, withThinking: boolean) {
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.3,
    maxOutputTokens: opts.maxOutputTokens ?? 16_384,
  };
  if (style === 'responseFormat') {
    generationConfig.responseFormat = { text: { mimeType: 'APPLICATION_JSON', schema: opts.schema } };
  } else {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseJsonSchema = opts.schema;
  }
  if (withThinking && opts.thinking) generationConfig.thinkingConfig = { thinkingLevel: opts.thinking };
  return {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
    generationConfig,
  };
}

async function callGemini(opts: GenerateJsonOptions, model: string, timeoutMs: number, style: typeof structuredStyle, withThinking: boolean) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new LlmError('GEMINI_API_KEY is not set (supabase secrets set GEMINI_API_KEY=...).', null, false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GEMINI_API}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(buildGeminiBody(opts, style, withThinking)),
      signal: controller.signal,
    });
    const text = await res.text();
    return { res, text, model };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    throw new LlmError(aborted ? 'Gemini request timed out.' : `Gemini request failed: ${String(e)}`, null, true);
  } finally {
    clearTimeout(timer);
  }
}

const GEMINI_SPEC = (): ModelSpec => ({ rpm: geminiRpm(), minGapMs: 0, maxRequestTokens: 1_000_000, maxOutputTokens: 65_536, json: 'json_schema' });

async function generateGemini(opts: GenerateJsonOptions, model?: string): Promise<GenerateJsonResult> {
  if (!Deno.env.get('GEMINI_API_KEY')) throw new LlmError('GEMINI_API_KEY is not set (supabase secrets set GEMINI_API_KEY=...).', null, false);
  let style = structuredStyle;
  let withThinking = thinkingSupported;
  const models = model ? [model] : [geminiModel(), geminiFallbackModel()].filter((m): m is string => Boolean(m));
  const spec = GEMINI_SPEC();
  // The caller's time budget covers waiting for a slot too.
  const giveUpAt = Date.now() + (opts.timeoutMs ?? 90_000);
  let lastBusy: LlmError | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    // The model that can start soonest (the main one when both are free).
    const now = Date.now();
    const slot = (m: string) => nextSlot(`gemini:${m}`, spec, now, 0);
    const pick = models.reduce((best, m) => (slot(m) < slot(best) ? m : best), models[0]);
    const wait = slot(pick) - now;
    if (now + wait + 15_000 > giveUpAt) {
      throw lastBusy ?? new LlmError('Gemini free-tier limit: no request slot left in this run. Try again in a minute.', 429, true);
    }
    if (wait > 0) await sleep(wait);
    markStarted(`gemini:${pick}`, 0);

    const { res, text } = await callGemini(opts, pick, giveUpAt - Date.now(), style, withThinking);
    if (res.status === 429 || res.status === 503) {
      // At its limit or overloaded: rest this model and try the other one (or wait).
      coolingUntil.set(`gemini:${pick}`, Date.now() + (res.status === 429 ? retryAfterMs(null, text) : 15_000));
      // The free tier also caps requests per day; that quota ID only appears deep in the reply.
      const daily = res.status === 429 && /PerDay/i.test(text);
      const hint = daily ? ' (free-tier daily limit)' : res.status === 429 ? ' (free-tier rate limit)' : ' (model busy)';
      lastBusy = new LlmError(`Gemini HTTP ${res.status}${hint}: ${text.slice(0, 200)}`, res.status, true);
      continue;
    }
    if (res.status === 400) {
      // Adapt to API shape differences instead of failing the whole edition.
      if (withThinking && /thinking/i.test(text)) {
        withThinking = thinkingSupported = false;
        continue;
      }
      if (style === 'responseFormat' && /responseFormat|response_format|Unknown name|Invalid JSON payload/i.test(text)) {
        style = structuredStyle = 'legacy';
        continue;
      }
    }
    if (!res.ok) {
      throw new LlmError(`Gemini HTTP ${res.status} (${pick}): ${text.slice(0, 300)}`, res.status, res.status >= 500);
    }

    // deno-lint-ignore no-explicit-any
    const payload: any = JSON.parse(text);
    const candidate = payload?.candidates?.[0];
    const finishReason: string | null = candidate?.finishReason ?? null;
    const parts: { text?: string; thought?: boolean }[] = candidate?.content?.parts ?? [];
    const out = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
    if (!out) {
      const blocked = payload?.promptFeedback?.blockReason;
      throw new LlmError(`Gemini returned no text (finishReason ${finishReason ?? blocked ?? 'unknown'}).`, res.status, false);
    }
    if (finishReason === 'MAX_TOKENS') throw new LlmError('Gemini hit the output token limit.', res.status, false);
    return {
      data: parseJsonText(out),
      text: out,
      provider: 'gemini',
      model: pick,
      finishReason,
      usage: { input: payload?.usageMetadata?.promptTokenCount, output: payload?.usageMetadata?.candidatesTokenCount },
    };
  }
  throw lastBusy ?? new LlmError('Gemini rejected every request shape we tried.', 400, false);
}

// ─── Test hooks ────────────────────────────────────────────────────────────

/** Test hook: forget pacing, JSON modes, daily flags and cached usage. */
export function _resetLlmStateForTests() {
  structuredStyle = 'responseFormat';
  thinkingSupported = true;
  startedAt.clear();
  tokensAt.clear();
  coolingUntil.clear();
  doneForToday.clear();
  refusedProvider.clear();
  jsonModeOverride.clear();
  noReasoningParam.clear();
  usageCache = null;
}

/** Test hook: where usage is loaded from and counted (null = the database). */
export function _setUsageStoreForTests(store: UsageStore | null) {
  usageStore = store ?? dbUsageStore;
  usageCache = null;
}

/** Test hook: turn the per-minute pacing off (waiting a second per call slows tests down). */
export function _setPacingForTests(on: boolean) {
  pacingOn = on;
}
