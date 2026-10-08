import { localAudioUri } from './downloads';
import type { Chapter, PhoneVoiceReason, Session } from './types';
import { backendConfigured } from '@/data/api';
import { readCachedEdition } from '@/data/editions';
import type { AudioEdition, Briefing, ListenMode, Story, Topic } from '@/data/types';
import { formatShortDate, parseDateKey } from '@/lib/format';
import { storyKey, type SavedItem } from '@/state/readingList';
import { TOPIC_LABEL } from '@/theme/themes';

/** Words per minute of a calm news read at 1×. */
const WPM = 160;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

/** "Wednesday, October 7th" */
export function spokenDate(date: string): string {
  const d = parseDateKey(date);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}`;
}

export function secondsFor(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round((words / WPM) * 60));
}

/** Makes on-screen text safe to read aloud: no links, symbols the voice would spell out. */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(\d)\s?%/g, '$1 percent')
    .replace(/&/g, ' and ')
    .replace(/[*_#•→]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

function updateChapter(s: Story, date: string): Chapter {
  const script = speakable(`Since this morning. ${s.headline}. ${s.whatHappened} ${s.whyItMatters}`);
  return {
    key: storyKey(date, s.id),
    storyId: s.id,
    editionDate: date,
    title: s.headline,
    uri: null,
    start: 0,
    duration: secondsFor(script),
    script,
    artworkUrl: s.imageUrl ?? undefined,
  };
}

/**
 * The edition read by the phone's own voice, for when the server has no audio
 * (sample edition, or the audio step hasn't run yet). Follows the same running order
 * as the server script: intro + 60-second summary, one chapter per story, outro.
 */
function deviceChapters(b: Briefing, mode: ListenMode, stories: Story[]): Chapter[] {
  const chapter = (title: string, text: string, story?: Story): Chapter => {
    const script = speakable(text);
    return {
      key: story ? storyKey(b.date, story.id) : null,
      storyId: story?.id ?? null,
      editionDate: b.date,
      title,
      uri: null,
      start: 0,
      duration: secondsFor(script),
      script,
      artworkUrl: story?.imageUrl ?? undefined,
    };
  };
  const out: Chapter[] = [
    chapter(
      'The 60-second briefing',
      `Good morning, it's ${spokenDate(b.date)}. Here's what you need to know. ${b.summary.join(' ')}`,
    ),
  ];
  let lastTopic: Topic | null = null;
  stories.forEach((s, i) => {
    const lead = i === 0 ? 'First, ' : s.topic !== lastTopic ? `Next, in ${TOPIC_LABEL[s.topic]}. ` : 'Also. ';
    lastTopic = s.topic;
    const body =
      mode === 'quick'
        ? `${s.headline}. ${firstSentence(s.whatHappened)}`
        : `${s.headline}. ${s.whatHappened} Why it matters: ${s.whyItMatters}`;
    out.push(chapter(s.headline, `${lead}${body}`, s));
  });
  out.push(chapter('Wrap-up', "That's your briefing. You're all caught up."));
  return out;
}

function serverChapters(b: Briefing, audio: AudioEdition): Chapter[] {
  // Every chapter plays from the one combined file (downloaded copy if there is one).
  const uri = audio.url ? (localAudioUri(audio.url) ?? audio.url) : null;
  const byId = new Map(b.stories.map((s) => [s.id, s]));
  return audio.chapters.map((c) => ({
    key: c.storyId ? storyKey(b.date, c.storyId) : null,
    storyId: c.storyId,
    editionDate: b.date,
    title: c.title,
    uri,
    start: uri ? c.start : 0,
    duration: c.duration,
    script: c.script,
    artworkUrl: (c.storyId && byId.get(c.storyId)?.imageUrl) || undefined,
  }));
}

export function editionSessionId(date: string, mode: ListenMode) {
  return `edition:${date}:${mode}`;
}

/** The whole edition as a listening session. "Since this morning" stories go first. */
export function editionSession(b: Briefing, mode: ListenMode, topics: Topic[]): Session {
  const stories = b.stories.filter((s) => topics.includes(s.topic));
  const audio = b.audio?.[mode] ?? null;
  const chapters = [
    ...(b.sinceThisMorning ?? []).filter((s) => topics.includes(s.topic)).map((s) => updateChapter(s, b.date)),
    ...(audio ? serverChapters(b, audio) : deviceChapters(b, mode, stories)),
  ];
  return {
    id: editionSessionId(b.date, mode),
    kind: 'edition',
    title: `${mode === 'quick' ? 'Quick listen' : 'Full briefing'} · ${formatShortDate(b.date)}`,
    mode,
    editionDate: b.date,
    chapters,
    hasServerAudio: Boolean(audio?.url),
    phoneVoice: audio?.url ? undefined : phoneVoiceReason(b),
  };
}

/** Why an edition has no studio voice. */
export function phoneVoiceReason(b: Briefing): PhoneVoiceReason {
  if (b.isSample || !backendConfigured) return 'sample';
  // The audio stage ran but made no MP3s: no voice key on the server (or it failed).
  return b.audio?.generatedAt ? 'off' : 'pending';
}

/** Total listening time in whole minutes (for "Listen · 8 min"). */
export function listenMinutes(b: Briefing, mode: ListenMode, topics: Topic[]): number {
  const audio = b.audio?.[mode];
  const seconds = audio
    ? audio.duration
    : deviceChapters(b, mode, b.stories.filter((s) => topics.includes(s.topic))).reduce((n, c) => n + c.duration, 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** Index of the chapter that reads this story, or -1. */
export function chapterFor(session: Session, storyId: string): number {
  return session.chapters.findIndex((c) => c.storyId === storyId);
}

/**
 * Saved stories back to back. Each uses its edition's own MP3 chapter when the
 * edition (with audio) is on the phone, else the narrator script, else the story text.
 */
export async function readingListSession(items: SavedItem[]): Promise<Session> {
  const editions = new Map<string, Briefing | null>();
  for (const date of new Set(items.map((i) => i.editionDate))) editions.set(date, await readCachedEdition(date));

  let serverAudio = false;
  const chapters: Chapter[] = items.map((item, i) => {
    const { story } = item;
    const full = editions.get(item.editionDate)?.audio?.full;
    const c = full?.chapters.find((x) => x.storyId === story.id);
    const lead = i === 0 ? '' : 'Next. ';
    if (c?.url) serverAudio = true;
    const script = c?.script ?? speakable(`${lead}${story.headline}. ${story.whatHappened} Why it matters: ${story.whyItMatters}`);
    return {
      key: item.key,
      storyId: story.id,
      editionDate: item.editionDate,
      title: story.headline,
      uri: c?.url ? (localAudioUri(c.url) ?? c.url) : null,
      start: 0,
      duration: c?.duration ?? secondsFor(script),
      script,
      artworkUrl: story.imageUrl ?? undefined,
    };
  });
  return {
    id: `list:${items.map((i) => i.key).join('|')}`,
    kind: 'list',
    title: items.length === 1 ? 'From your reading list' : 'Your reading list',
    chapters,
    hasServerAudio: serverAudio,
  };
}
