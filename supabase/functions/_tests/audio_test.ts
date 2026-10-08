// The audio briefing: MP3 joining, spoken text, chapters, the TTS request shapes.

import { assert, assertAlmostEquals, assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { buildAudio, chaptersFor, fallbackScript, greeting, OUTRO, sanitizeScript, spokenDate, storiesInListenOrder } from '../_shared/audio.ts';
import type { GenerateJsonOptions } from '../_shared/llm.ts';
import { LlmError } from '../_shared/llm.ts';
import { joinMp3, parseMp3 } from '../_shared/mp3.ts';
import { SCRIPT_SYSTEM } from '../_shared/prompts.ts';
import { staleDateFolders } from '../_shared/storage.ts';
import { splitForTts, synthesize, TtsError } from '../_shared/tts.ts';
import type { Briefing, Story, Topic } from '../_shared/types.ts';

// ─── Synthetic MP3s: MPEG-1 Layer III, 128 kbps, 44.1 kHz, stereo → 417-byte frames ───

const FRAME = 417;
const FRAME_SECONDS = 1152 / 44100;

function frame(fill = 0x55): Uint8Array {
  const f = new Uint8Array(FRAME).fill(fill);
  f.set([0xff, 0xfb, 0x90, 0x00]);
  return f;
}

function infoFrame(): Uint8Array {
  const f = frame(0);
  f.set([...'Info'].map((c) => c.charCodeAt(0)), 4 + 32);
  return f;
}

function id3(payload = 20): Uint8Array {
  const t = new Uint8Array(10 + payload);
  t.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, payload]);
  return t;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const frames = (n: number, fill = 0x55) => concat(...Array.from({ length: n }, () => frame(fill)));

Deno.test('mp3: skips the ID3 tag and the Info header frame; exact duration', () => {
  const a = parseMp3(concat(id3(), infoFrame(), frames(10)));
  assertEquals(a.frameCount, 10);
  assertEquals(a.frames.length, 10 * FRAME);
  assertEquals(a.sampleRate, 44100);
  assertAlmostEquals(a.duration, 10 * FRAME_SECONDS, 1e-9);
  assertEquals(a.frames[0], 0xff);
});

Deno.test('mp3: resyncs over junk bytes and drops an ID3v1 trailer', () => {
  const tag = new Uint8Array(128);
  tag.set([0x54, 0x41, 0x47]); // "TAG"
  const b = parseMp3(concat(frames(3), new Uint8Array([0xff, 0x00, 0x12]), frames(2), tag));
  assertEquals(b.frameCount, 5);
  assertEquals(b.frames.length, 5 * FRAME);
});

Deno.test('mp3: joining gives one clean file and exact chapter starts', () => {
  const parts = [parseMp3(concat(id3(), infoFrame(), frames(10))), parseMp3(concat(infoFrame(), frames(5, 0x66))), parseMp3(frames(7))];
  const joined = joinMp3(parts);
  assertEquals(joined.bytes.length, 22 * FRAME);
  assertEquals(joined.starts, [0, Math.round(10 * FRAME_SECONDS * 1000) / 1000, Math.round(15 * FRAME_SECONDS * 1000) / 1000]);
  assertAlmostEquals(joined.duration, 22 * FRAME_SECONDS, 1e-3);
  // Only the first file's frames come first; no header frame left in the middle.
  const again = parseMp3(joined.bytes);
  assertEquals(again.frameCount, 22);
  assertEquals(joined.bytes[10 * FRAME + 4], 0x66);
});

// ─── Spoken text ───

Deno.test('spokenDate + greeting read like radio', () => {
  assertEquals(spokenDate('2026-10-07'), 'Wednesday, October 7th');
  assertEquals(spokenDate('2026-10-01'), 'Thursday, October 1st');
  assertEquals(spokenDate('2026-10-22'), 'Thursday, October 22nd');
  assertEquals(spokenDate('2026-10-13'), 'Tuesday, October 13th');
  assertEquals(greeting('2026-10-07'), "Good morning, it's Wednesday, October 7th. Here's what you need to know.");
  assertEquals(OUTRO, "That's your briefing. You're all caught up.");
});

Deno.test('sanitizeScript removes what a listener cannot hear', () => {
  assertEquals(
    sanitizeScript('Shares rose 4.5% (see https://example.com/x) — **big** move & more.\nNext: [AI] www.foo.com news'),
    'Shares rose 4.5 percent (see) — big move and more. Next: AI news',
  );
});

// ─── Chapters + the whole audio stage with fakes ───

function story(id: string, topic: Topic, words = 40): Story {
  return {
    id, topic, headline: `Headline ${id}`, dek: 'Dek.', whatHappened: `${'Something happened today. '.repeat(words / 4)}`.trim(),
    whyItMatters: 'It matters a lot.', explainSimply: '', background: '', keyPlayers: [], keyTerms: [], whatToWatch: [],
    readTimeMinutes: 1, sources: [], allSources: [], imageUrl: null,
  };
}

const BRIEFING: Briefing = {
  date: '2026-10-07',
  generatedAt: '2026-10-07T00:00:00Z',
  summary: ['One happened.', 'Two happened.', 'Three happened.', 'Four happened.'],
  stories: [story('w1', 'world'), story('a1', 'ai'), story('t1', 'tech'), story('b1', 'business')],
  calendar: [],
  markets: [],
};

Deno.test('listen order follows the topics, like Today', () => {
  assertEquals(storiesInListenOrder(BRIEFING).map((s) => s.id), ['a1', 't1', 'b1', 'w1']);
});

Deno.test('chapters: intro (greeting + 60-second version), one per story, wrap-up; estimated times add up', () => {
  const ch = chaptersFor(BRIEFING, fallbackScript('full', BRIEFING));
  assertEquals(ch.length, 6);
  assertEquals(ch[0].title, 'The 60-second briefing');
  assert(ch[0].script.startsWith("Good morning, it's Wednesday, October 7th."));
  assertEquals(ch[1].storyId, 'a1');
  assertEquals(ch[1].title, 'Headline a1');
  assert(ch[1].script.startsWith('First: Headline a1.'));
  assert(ch[2].script.includes('Why it matters'));
  assertEquals(ch[5].script, OUTRO);
  for (let i = 1; i < ch.length; i++) assertEquals(ch[i].start, ch[i - 1].start + ch[i - 1].duration);
  assert(ch.every((c) => c.url === null && c.duration >= 2));
});

/** Fake TTS: one frame per word, so longer chapters are longer. */
function fakeAudioDeps(opts: { failOn?: (text: string) => boolean; scriptFails?: boolean; provider?: 'openai' | 'none' } = {}) {
  const uploads: string[] = [];
  const ttsCalls: string[] = [];
  const seen: GenerateJsonOptions[] = [];
  return {
    uploads,
    ttsCalls,
    seen,
    deps: {
      provider: opts.provider ?? ('openai' as const),
      generateJson: (o: GenerateJsonOptions) => {
        seen.push(o);
        if (opts.scriptFails) return Promise.reject(new LlmError('ANTHROPIC_API_KEY is not set', null, false));
        const ids = [...o.prompt.matchAll(/storyId: (\S+) ·/g)].map((m) => m[1]);
        const data = { summary: 'Here are the main points, see https://x.com, up 5%.', stories: (ids.length ? ids : ['a1', 't1', 'b1', 'w1']).map((id) => ({ storyId: id, text: `Story ${id} in spoken form.` })) };
        return Promise.resolve({ data, text: '', model: 'fake', finishReason: 'end_turn', usage: {} });
      },
      synthesize: (text: string) => {
        ttsCalls.push(text);
        if (opts.failOn?.(text)) return Promise.reject(new TtsError('HTTP 500', true));
        return Promise.resolve([concat(id3(), infoFrame(), frames(text.split(/\s+/).length))]);
      },
      upload: (path: string, bytes: Uint8Array) => {
        uploads.push(`${path}:${bytes.length}`);
        return Promise.resolve(`https://cdn.example/${path}`);
      },
    },
  };
}

Deno.test('buildAudio: Quick + Full, one MP3 per chapter + combined file, exact starts', async () => {
  const f = fakeAudioDeps();
  const { audio, stats } = await buildAudio(BRIEFING, f.deps, { stamp: 42 });
  assertEquals(f.seen.length, 2);
  assert(f.seen.every((o) => o.system === SCRIPT_SYSTEM));
  for (const mode of ['quick', 'full'] as const) {
    const e = audio[mode]!;
    assertEquals(e.mode, mode);
    assertEquals(e.url, `https://cdn.example/2026-10-07/${mode}-42/briefing.mp3`);
    assertEquals(e.voice, 'OpenAI · marin');
    assertEquals(e.chapters.length, 6);
    assert(e.chapters.every((c) => c.url?.startsWith(`https://cdn.example/2026-10-07/${mode}-42/`)));
    assertEquals(e.chapters[0].start, 0);
    for (let i = 1; i < e.chapters.length; i++) assertAlmostEquals(e.chapters[i].start, e.chapters[i - 1].start + e.chapters[i - 1].duration, 2e-3);
    assertAlmostEquals(e.duration, e.chapters.reduce((n, c) => n + c.duration, 0), 5e-3);
  }
  // The listener never hears a link or a symbol.
  assert(!audio.quick!.chapters[0].script.includes('http'));
  assert(audio.quick!.chapters[0].script.includes('5 percent'));
  assertEquals(stats.audio, { quick: 'mp3', full: 'mp3' });
  assertEquals(stats.scripts, { quick: 'ai', full: 'ai' });
  assertEquals(f.uploads.length, 2 * 7);
  assertEquals(f.ttsCalls.length, 12);
});

Deno.test('buildAudio: a failed chapter makes that version text-only (the phone reads it aloud)', async () => {
  const f = fakeAudioDeps({ failOn: (t) => t.includes('Story t1') && f.ttsCalls.filter((x) => x.includes('Story t1')).length > 1 });
  const { audio, stats } = await buildAudio(BRIEFING, f.deps, { stamp: 1 });
  const textOnly = (['quick', 'full'] as const).filter((m) => audio[m]!.url === null);
  assertEquals(textOnly.length, 1);
  const e = audio[textOnly[0]]!;
  assert(e.chapters.every((c) => c.url === null && c.script.length > 0));
  assertEquals(e.voice, null);
  assertEquals(stats.ttsErrors.length, 1);
});

Deno.test('buildAudio: no AI key → plain fallback scripts; provider none → no TTS at all', async () => {
  const f = fakeAudioDeps({ scriptFails: true, provider: 'none' });
  const { audio, stats } = await buildAudio(BRIEFING, f.deps);
  assertEquals(stats.scripts, { quick: 'fallback', full: 'fallback' });
  assertEquals(f.ttsCalls.length, 0);
  assertEquals(f.uploads.length, 0);
  assertEquals(audio.full!.url, null);
  assert(audio.full!.chapters[1].script.startsWith('First: Headline a1.'));
  assert(audio.full!.duration > 0);
});

// ─── TTS requests ───

Deno.test('splitForTts splits long text at sentence ends', () => {
  const text = 'One two three. '.repeat(400);
  const parts = splitForTts(text, 1000);
  assert(parts.length > 1);
  assert(parts.every((p) => p.length <= 1000 && p.endsWith('.')));
  assertEquals(parts.join(' ').replace(/\s+/g, ' '), text.trim().replace(/\s+/g, ' '));
});

Deno.test('TTS: OpenAI and ElevenLabs request shapes; retries once on 5xx; no key → clear error', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  let fail = 1;
  const fake = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (fail-- > 0) return Promise.resolve(new Response('busy', { status: 503 }));
    return Promise.resolve(new Response(frames(2)));
  }) as unknown as typeof fetch;

  Deno.env.set('OPENAI_API_KEY', 'sk-test');
  try {
    const out = await synthesize('Hello there.', 'openai', fake);
    assertEquals(out.length, 1);
    assertEquals(calls.length, 2);
    assertEquals(calls[1].url, 'https://api.openai.com/v1/audio/speech');
    const body = JSON.parse(String(calls[1].init.body));
    assertEquals([body.model, body.voice, body.input, body.response_format], ['gpt-4o-mini-tts', 'marin', 'Hello there.', 'mp3']);
    assert(body.instructions.length > 20);
    assertEquals(new Headers(calls[1].init.headers).get('authorization'), 'Bearer sk-test');
  } finally {
    Deno.env.delete('OPENAI_API_KEY');
  }

  Deno.env.set('ELEVENLABS_API_KEY', 'xi-test');
  try {
    await synthesize('Hi.', 'elevenlabs', fake);
    const last = calls[calls.length - 1];
    assertEquals(last.url, 'https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128');
    assertEquals(new Headers(last.init.headers).get('xi-api-key'), 'xi-test');
    assertEquals(JSON.parse(String(last.init.body)), { text: 'Hi.', model_id: 'eleven_multilingual_v2' });
  } finally {
    Deno.env.delete('ELEVENLABS_API_KEY');
  }

  const e = await assertRejects(() => synthesize('x', 'openai', fake), TtsError);
  assert(!e.retryable);
});

Deno.test('old audio folders are found by date', () => {
  assertEquals(staleDateFolders(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-07', 'misc'], '2026-10-07', 7), ['2026-09-29']);
});
