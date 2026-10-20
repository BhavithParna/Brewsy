import sample from './mock-regional.json';
import type { AudioChapter, AudioEdition, Briefing, ListenMode, RegionalEdition } from '@/data/types';
import { regionLabel, type LocalRegion } from '@/lib/region';

/**
 * Development only, for the web preview: what the live backend can't show yet.
 *   ?local=sample   a sample local section on every edition (Canadian stories, labelled with
 *                   your region; pair it with ?region=CA)
 *   ?fallback=1     act as if today's edition isn't made yet, to see the earlier one with its note
 *   ?audio=parts    give each edition a listening script the way the server now writes it (a lead
 *                   and a body per chapter, no MP3), so Listen plays the reader's own running order
 * Does nothing in production builds.
 */
function flag(name: string): string | null {
  if (!__DEV__ || typeof window === 'undefined' || !window.location?.search) return null;
  return new URLSearchParams(window.location.search).get(name);
}

export const devEditionFlags = {
  sampleLocal: flag('local') === 'sample',
  fallback: flag('fallback') === '1',
  audioParts: flag('audio') === 'parts',
};

/** The sample local section for a date, or null when `?local=sample` isn't set. */
export function sampleRegional(date: string, region: LocalRegion): RegionalEdition | null {
  if (!__DEV__ || !devEditionFlags.sampleLocal) return null;
  return { ...(sample as RegionalEdition), region, date, label: regionLabel(region) };
}

/** With `?audio=parts`: the edition with a text-only script in parts (see AudioChapter.lead/body). */
export function withSampleAudioParts(b: Briefing): Briefing {
  if (!__DEV__ || !devEditionFlags.audioParts) return b;
  const make = (mode: ListenMode): AudioEdition => {
    const chapters: AudioChapter[] = [
      {
        storyId: null,
        title: 'The 60-second briefing',
        script: `Good morning. Here's what you need to know. ${b.summary.join(' ')}`,
        url: null,
        start: 0,
        duration: 30,
      },
      ...b.stories.map((s, i) => {
        const lead = i === 0 ? 'We start with this.' : 'Turning to the next story.';
        const body = mode === 'quick' ? `${s.headline}.` : `${s.headline}. ${s.whatHappened}`;
        return { storyId: s.id, title: s.headline, lead, body, script: `${lead} ${body}`, url: null, start: 0, duration: 20 };
      }),
      { storyId: null, title: 'Wrap-up', script: "That's your briefing. You're all caught up.", url: null, start: 0, duration: 3 },
    ];
    return { mode, chapters, url: null, duration: chapters.reduce((n, c) => n + c.duration, 0), voice: null };
  };
  return { ...b, audio: { generatedAt: b.generatedAt, quick: make('quick'), full: make('full') } };
}
