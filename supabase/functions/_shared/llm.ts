// The AI provider: Claude (Anthropic) or Google Gemini (free tier).
// The only file that knows which AI provider we use; everything else calls
// `generateJson()` and validates what comes back.
//
// Which one runs:
//   LLM_PROVIDER=anthropic | gemini   (secret; optional)
//   default: Claude when ANTHROPIC_API_KEY is set, otherwise Gemini.
//
// Claude (official SDK, pinned):
// - Model: CLAUDE_MODEL secret, default `claude-opus-5-5`.
// - Opus 5.5 always thinks; depth is set with `output_config.effort` (its
//   default is `medium`, so we always send it). Sampling params such as
//   `temperature` are rejected, so they're never sent.
// - JSON comes back through structured outputs (`output_config.format`); the
//   schema is simplified to what structured outputs accept (see toClaudeSchema).
// - `fallbacks: "default"` lets the API retry a safety-classifier decline on
//   Anthropic's recommended fallback model instead of failing the edition.
//
// Gemini (REST generateContent), verified against ai.google.dev (Oct 2026):
// - Docs recommend `gemini-3.8-flash` for new projects; the 2.5 models are
//   limited to past users. The free tier covers 3.8 Flash (input + output).
// - Structured output: `generationConfig.responseFormat.text = { mimeType: 'APPLICATION_JSON', schema }`.
//   The older `responseMimeType` + `responseJsonSchema` pair is used as a fallback.
// - Gemini 3 models take `thinkingConfig.thinkingLevel` (MINIMAL | LOW | MEDIUM | HIGH).

import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export type JsonSchema = Record<string, unknown>;
export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

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
  /** Gemini only (Claude Opus 5.5 rejects sampling parameters). */
  temperature?: number;
  maxOutputTokens?: number;
  thinking?: ThinkingLevel;
  timeoutMs?: number;
};

export type GenerateJsonResult = {
  data: unknown;
  text: string;
  model: string;
  finishReason: string | null;
  usage: { input?: number; output?: number };
};

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
  const n = Number(Deno.env.get('GEMINI_RPM'));
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export type Provider = 'anthropic' | 'gemini';

export function llmProvider(): Provider {
  const chosen = Deno.env.get('LLM_PROVIDER')?.trim().toLowerCase();
  if (chosen === 'anthropic' || chosen === 'claude') return 'anthropic';
  if (chosen === 'gemini' || chosen === 'google') return 'gemini';
  return Deno.env.get('ANTHROPIC_API_KEY') ? 'anthropic' : 'gemini';
}

export function claudeModel(): string {
  return Deno.env.get('CLAUDE_MODEL')?.trim() || DEFAULT_CLAUDE_MODEL;
}

/** Name of the model the next call will use (for logs). */
export function activeModel(): string {
  return llmProvider() === 'anthropic' ? claudeModel() : geminiModel();
}

function buildBody(opts: GenerateJsonOptions, style: typeof structuredStyle, withThinking: boolean) {
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

async function call(opts: GenerateJsonOptions, model: string, timeoutMs: number, style: typeof structuredStyle, withThinking: boolean) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new LlmError('GEMINI_API_KEY is not set (supabase secrets set GEMINI_API_KEY=...).', null, false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(buildBody(opts, style, withThinking)),
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

/** Calls the configured AI and returns parsed JSON (not yet validated against our types). */
export function generateJson(opts: GenerateJsonOptions): Promise<GenerateJsonResult> {
  return llmProvider() === 'anthropic' ? generateClaude(opts) : generateGemini(opts);
}

// ─── Claude ────────────────────────────────────────────────────────────────

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
      if (['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'maxItems', 'exclusiveMinimum', 'exclusiveMaximum'].includes(k)) continue;
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

async function generateClaude(opts: GenerateJsonOptions): Promise<GenerateJsonResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new LlmError('ANTHROPIC_API_KEY is not set (supabase secrets set ANTHROPIC_API_KEY=...).', null, false);
  const model = claudeModel();
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
    model: message.model,
    finishReason: message.stop_reason ?? null,
    usage: { input: message.usage?.input_tokens, output: message.usage?.output_tokens },
  };
}

// ─── Gemini ────────────────────────────────────────────────────────────────

// Free-tier pacing, per model, for this function run: start times of recent requests,
// and until when a model said "busy" or "too many requests".
const startedAt = new Map<string, number[]>();
const coolingUntil = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** When `model` may start its next request, keeping under the per-minute limit. */
function nextSlot(model: string, now: number): number {
  const recent = (startedAt.get(model) ?? []).filter((t) => now - t < 60_000);
  startedAt.set(model, recent);
  const byRate = recent.length < geminiRpm() ? now : recent[0] + 60_000 + 250;
  return Math.max(byRate, coolingUntil.get(model) ?? 0);
}

/** "Please retry in 18s" from a 429 reply, in milliseconds (default 20 s). */
function retryDelayMs(text: string): number {
  const m = text.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.min(60_000, Number(m[1]) * 1000 + 500) : 20_000;
}

/** Test hook: forget the pacing state. */
export function _resetGeminiPacingForTests() {
  startedAt.clear();
  coolingUntil.clear();
}

async function generateGemini(opts: GenerateJsonOptions): Promise<GenerateJsonResult> {
  if (!Deno.env.get('GEMINI_API_KEY')) throw new LlmError('GEMINI_API_KEY is not set (supabase secrets set GEMINI_API_KEY=...).', null, false);
  let style = structuredStyle;
  let withThinking = thinkingSupported;
  const models = [geminiModel(), geminiFallbackModel()].filter((m): m is string => Boolean(m));
  // The caller's time budget covers waiting for a slot too.
  const giveUpAt = Date.now() + (opts.timeoutMs ?? 90_000);
  let lastBusy: LlmError | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    // The model that can start soonest (the main one when both are free).
    const now = Date.now();
    const model = models.reduce((best, m) => (nextSlot(m, now) < nextSlot(best, now) ? m : best), models[0]);
    const wait = nextSlot(model, now) - now;
    if (now + wait + 15_000 > giveUpAt) {
      throw lastBusy ?? new LlmError('Gemini free-tier limit: no request slot left in this run. Try again in a minute.', 429, true);
    }
    if (wait > 0) await sleep(wait);
    startedAt.get(model)!.push(Date.now());

    const { res, text } = await call(opts, model, giveUpAt - Date.now(), style, withThinking);
    if (res.status === 429 || res.status === 503) {
      // At its limit or overloaded: rest this model and try the other one (or wait).
      coolingUntil.set(model, Date.now() + (res.status === 429 ? retryDelayMs(text) : 15_000));
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
      throw new LlmError(`Gemini HTTP ${res.status} (${model}): ${text.slice(0, 300)}`, res.status, res.status >= 500);
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
      model,
      finishReason,
      usage: { input: payload?.usageMetadata?.promptTokenCount, output: payload?.usageMetadata?.candidatesTokenCount },
    };
  }
  throw lastBusy ?? new LlmError('Gemini rejected every request shape we tried.', 400, false);
}

/** Test hook: reset the remembered request shape. */
export function _resetLlmStateForTests() {
  structuredStyle = 'responseFormat';
  thinkingSupported = true;
  _resetGeminiPacingForTests();
}
