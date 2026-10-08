// The audio briefing: radio-style listening scripts → text-to-speech → MP3s.
//
// Runs as its own stage a few minutes after the edition (so the edition run
// stays within the function's time limit). Two versions:
//   quick ≈ 3 min   the 60-second summary + one or two sentences per story
//   full  ≈ 10 min  every story with what happened and why it matters
// Each story is its own chapter. Chapters are saved one file each, plus one
// combined file per version with exact chapter start times (see mp3.ts).
// Without text-to-speech the chapters keep their scripts and `url: null`; the
// app then reads them aloud on the phone.

import { KEEP_AUDIO_DAYS, type TtsProvider, voiceLabel, WORDS_PER_MINUTE } from './audio-config.ts';
import { type GenerateJsonOptions, type GenerateJsonResult, LlmError } from './llm.ts';
import { joinMp3, type Mp3Audio, parseMp3 } from './mp3.ts';
import { mapLimit } from './pipeline.ts';
import { SCRIPT_SYSTEM, scriptPrompt, scriptSchema, type ScriptStory } from './prompts.ts';
import { slugify, wordCount } from './text.ts';
import { type AudioChapter, type AudioEdition, type Briefing, type BriefingAudio, type ListenMode, TOPICS } from './types.ts';
import { type ScriptDraft, validateScript } from './validate.ts';

export type AudioDeps = {
  generateJson: (opts: GenerateJsonOptions) => Promise<GenerateJsonResult>;
  /** Text → MP3 piece(s). */
  synthesize: (text: string) => Promise<Uint8Array[]>;
  /** Saves a file and returns its public URL. */
  upload: (path: string, bytes: Uint8Array) => Promise<string>;
  provider: TtsProvider;
};

export type AudioStats = {
  scripts: Record<ListenMode, 'ai' | 'fallback'>;
  audio: Record<ListenMode, 'mp3' | 'text-only'>;
  chapters: number;
  ttsErrors: string[];
  seconds: Record<ListenMode, number>;
  ms: number;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

/** "2026-10-07" → "Wednesday, October 7th" */
export function spokenDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[day]}, ${MONTHS[m - 1]} ${ordinal(d)}`;
}

export function greeting(date: string): string {
  return `Good morning, it's ${spokenDate(date)}. Here's what you need to know.`;
}

export const OUTRO = "That's your briefing. You're all caught up.";

/** Last line of defence for the ear: no links, markup or symbols a listener can't hear. */
export function sanitizeScript(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)\]]+/gi, '')
    .replace(/\bwww\.[^\s)\]]+/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[*_#`>~|[\]{}]/g, '')
    .replace(/(\d)\s*%/g, '$1 percent')
    .replace(/%/g, ' percent')
    .replace(/\s&\s/g, ' and ')
    .replace(/\s+([,.!?;:)])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

/** The same order Today shows stories in: by topic, then rank. */
export function storiesInListenOrder(b: Briefing): Briefing['stories'] {
  return TOPICS.flatMap((t) => b.stories.filter((s) => s.topic === t));
}

function firstSentence(s: string): string {
  return (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
}

/** If the script call fails, a plain spoken version made from the edition text. */
export function fallbackScript(mode: ListenMode, b: Briefing): ScriptDraft {
  return {
    summary: b.summary.join(' '),
    stories: storiesInListenOrder(b).map((s, i) => ({
      storyId: s.id,
      text: `${i === 0 ? 'First' : 'Next'}: ${s.headline}. ${mode === 'quick' ? firstSentence(s.whatHappened) : `${s.whatHappened} Why it matters: ${s.whyItMatters}`}`,
    })),
  };
}

async function writeScript(mode: ListenMode, b: Briefing, deps: AudioDeps): Promise<{ script: ScriptDraft; ai: boolean }> {
  const stories = storiesInListenOrder(b);
  const input: ScriptStory[] = stories.map((s) => ({
    id: s.id, topic: s.topic, headline: s.headline, dek: s.dek, whatHappened: s.whatHappened, whyItMatters: s.whyItMatters, developing: s.developing,
  }));
  const ids = stories.map((s) => s.id);
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await deps.generateJson({
        system: SCRIPT_SYSTEM,
        prompt: scriptPrompt(mode, b.summary, input, spokenDate(b.date)) + feedback,
        schema: scriptSchema(),
        temperature: 0.4,
        maxOutputTokens: mode === 'quick' ? 4096 : 10_000,
        thinking: 'LOW',
        timeoutMs: 75_000,
      });
      const v = validateScript(res.data, ids);
      if (v.ok) return { script: v.value, ai: true };
      feedback = `\n\nYour previous reply was rejected: ${v.errors.join('; ')}. Return the full corrected JSON.`;
    } catch (e) {
      if (e instanceof LlmError && !e.retryable && e.status === null) break; // no key: use the fallback
    }
  }
  return { script: fallbackScript(mode, b), ai: false };
}

/** Chapters with scripts, before any audio. */
export function chaptersFor(b: Briefing, script: ScriptDraft): AudioChapter[] {
  const byId = new Map(b.stories.map((s) => [s.id, s]));
  const estimate = (text: string) => Math.round((wordCount(text) / WORDS_PER_MINUTE) * 60);
  const chapters: AudioChapter[] = [
    { storyId: null, title: 'The 60-second briefing', script: sanitizeScript(`${greeting(b.date)} ${script.summary}`), url: null, start: 0, duration: 0 },
    ...script.stories.map((s) => ({ storyId: s.storyId, title: byId.get(s.storyId)?.headline ?? 'Story', script: sanitizeScript(s.text), url: null, start: 0, duration: 0 })),
    { storyId: null, title: 'Wrap-up', script: OUTRO, url: null, start: 0, duration: 0 },
  ];
  let t = 0;
  for (const c of chapters) {
    c.duration = Math.max(2, estimate(c.script));
    c.start = t;
    t += c.duration;
  }
  return chapters;
}

function textOnly(mode: ListenMode, chapters: AudioChapter[]): AudioEdition {
  return { mode, chapters, url: null, duration: chapters.reduce((n, c) => n + c.duration, 0), voice: null };
}

/** Builds both versions. Never throws for TTS problems: a version without audio is still useful. */
export async function buildAudio(b: Briefing, deps: AudioDeps, opts: { stamp?: number } = {}): Promise<{ audio: BriefingAudio; stats: AudioStats }> {
  const started = Date.now();
  const stamp = opts.stamp ?? Date.now();
  const modes: ListenMode[] = ['quick', 'full'];

  const scripts = await Promise.all(modes.map((m) => writeScript(m, b, deps)));
  const chapters = Object.fromEntries(modes.map((m, i) => [m, chaptersFor(b, scripts[i].script)])) as Record<ListenMode, AudioChapter[]>;
  const ttsErrors: string[] = [];
  const editions = {} as Record<ListenMode, AudioEdition>;

  if (deps.provider === 'none') {
    for (const m of modes) editions[m] = textOnly(m, chapters[m]);
  } else {
    // Every chapter of both versions through one queue (4 at a time keeps rate limits happy).
    const jobs = modes.flatMap((mode) => chapters[mode].map((c, index) => ({ mode, index, text: c.script })));
    const results = await mapLimit(jobs, 4, async (job): Promise<Mp3Audio | null> => {
      try {
        const pieces = (await deps.synthesize(job.text)).map(parseMp3);
        const joined = joinMp3(pieces);
        if (!joined.bytes.length) throw new Error('no audio frames in the reply');
        return { frames: joined.bytes, duration: joined.duration, sampleRate: pieces[0].sampleRate, frameCount: pieces.reduce((n, p) => n + p.frameCount, 0) };
      } catch (e) {
        ttsErrors.push(`${job.mode} #${job.index}: ${String(e instanceof Error ? e.message : e).slice(0, 160)}`);
        return null;
      }
    });

    for (const mode of modes) {
      const audio = jobs.map((j, k) => (j.mode === mode ? results[k] : undefined)).filter((r) => r !== undefined) as (Mp3Audio | null)[];
      if (audio.some((a) => a === null)) {
        editions[mode] = textOnly(mode, chapters[mode]);
        continue;
      }
      const parts = audio as Mp3Audio[];
      const joined = joinMp3(parts);
      const folder = `${b.date}/${mode}-${stamp}`;
      try {
        const urls = await mapLimit(chapters[mode].map((c, i) => ({ c, i })), 4, ({ c, i }) =>
          deps.upload(`${folder}/${String(i).padStart(2, '0')}-${slugify(c.storyId ?? c.title, 40)}.mp3`, parts[i].frames));
        const url = await deps.upload(`${folder}/briefing.mp3`, joined.bytes);
        editions[mode] = {
          mode,
          url,
          duration: joined.duration,
          voice: voiceLabel(deps.provider),
          chapters: chapters[mode].map((c, i) => ({ ...c, url: urls[i], start: joined.starts[i], duration: Math.round(parts[i].duration * 1000) / 1000 })),
        };
      } catch (e) {
        ttsErrors.push(`${mode} upload: ${String(e instanceof Error ? e.message : e).slice(0, 160)}`);
        editions[mode] = textOnly(mode, chapters[mode]);
      }
    }
  }

  return {
    audio: { generatedAt: new Date().toISOString(), quick: editions.quick, full: editions.full },
    stats: {
      scripts: { quick: scripts[0].ai ? 'ai' : 'fallback', full: scripts[1].ai ? 'ai' : 'fallback' },
      audio: { quick: editions.quick.url ? 'mp3' : 'text-only', full: editions.full.url ? 'mp3' : 'text-only' },
      chapters: chapters.quick.length + chapters.full.length,
      ttsErrors,
      seconds: { quick: Math.round(editions.quick.duration), full: Math.round(editions.full.duration) },
      ms: Date.now() - started,
    },
  };
}

export { KEEP_AUDIO_DAYS };
