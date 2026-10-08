// Text → MP3 with the provider chosen in audio-config.ts.

import { ELEVENLABS, OPENAI, type TtsProvider } from './audio-config.ts';
import { fetchWithTimeout } from './http.ts';

export class TtsError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'TtsError';
  }
}

/** OpenAI takes up to ~2,000 tokens per request; stay well under it. */
const MAX_CHARS = 3500;

/** Splits long text at sentence ends so each request stays within limits. */
export function splitForTts(text: string, max = MAX_CHARS): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && cur.length + s.length > max) {
      out.push(cur.trim());
      cur = '';
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function openai(text: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new TtsError('OPENAI_API_KEY is not set.', false);
  const res = await fetchImpl('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI.model, voice: OPENAI.voice, input: text, instructions: OPENAI.instructions, response_format: 'mp3' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new TtsError(`OpenAI TTS HTTP ${res.status}: ${body.slice(0, 200)}`, res.status === 429 || res.status >= 500);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function elevenlabs(text: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const key = Deno.env.get('ELEVENLABS_API_KEY');
  if (!key) throw new TtsError('ELEVENLABS_API_KEY is not set.', false);
  const voice = Deno.env.get('ELEVENLABS_VOICE_ID')?.trim() || ELEVENLABS.voiceId;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${ELEVENLABS.outputFormat}`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: ELEVENLABS.model }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new TtsError(`ElevenLabs HTTP ${res.status}: ${body.slice(0, 200)}`, res.status === 429 || res.status >= 500);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * One MP3 per text piece (long texts come back as several pieces; mp3.ts
 * joins frames). Retries once on rate limits / server errors.
 */
export async function synthesize(text: string, provider: TtsProvider, fetchImpl: typeof fetch = (u, i) => fetchWithTimeout(String(u), i ?? {}, 60_000)): Promise<Uint8Array[]> {
  if (provider === 'none') throw new TtsError('Text-to-speech is turned off.', false);
  const call = provider === 'openai' ? openai : elevenlabs;
  const out: Uint8Array[] = [];
  for (const piece of splitForTts(text)) {
    try {
      out.push(await call(piece, fetchImpl));
    } catch (e) {
      if (!(e instanceof TtsError) || !e.retryable) throw e;
      await new Promise((r) => setTimeout(r, 2000));
      out.push(await call(piece, fetchImpl));
    }
  }
  return out;
}
