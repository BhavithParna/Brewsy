import { localAudioUri } from './downloads';
import type { Chapter, PhoneVoiceReason, Session } from './types';
import { backendConfigured } from '@/data/api';
import { readCachedEdition } from '@/data/editions';
import type { AudioEdition, Briefing, ListenMode, Story, Topic } from '@/data/types';
import { curateEdition, mutedMatcher, orderedTopics, type CuratedEdition, type LocalGroup } from '@/lib/curation';
import { formatShortDate, parseDateKey } from '@/lib/format';
import { storyKey, type SavedItem } from '@/state/readingList';
import type { Settings } from '@/state/settings';
import { TOPIC_LABEL } from '@/theme/themes';

/** What shapes a reader's own running order. */
export type ListenPrefs = Pick<Settings, 'topics' | 'focusTopics' | 'mutedWords' | 'disabledOutlets' | 'region'>;

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

/** A chapter the phone reads aloud. Stories are keyed by `date`, the date they're saved under. */
function spokenChapter(date: string, title: string, text: string, story?: Story): Chapter {
  const script = speakable(text);
  return {
    key: story ? storyKey(date, story.id) : null,
    storyId: story?.id ?? null,
    editionDate: date,
    title,
    uri: null,
    start: 0,
    duration: secondsFor(script),
    script,
    artworkUrl: story?.imageUrl ?? undefined,
  };
}

/** A story told from its text, when there's no script for it. */
function storyScript(s: Story, mode: ListenMode): string {
  return mode === 'quick'
    ? `${s.headline}. ${firstSentence(s.whatHappened)}`
    : `${s.headline}. ${s.whatHappened} Why it matters: ${s.whyItMatters}`;
}

/**
 * The local section as a group of chapters after the topics: "Next, in Canada." `first`: nothing
 * came before it.
 */
function localChapters(local: LocalGroup, mode: ListenMode, first: boolean): Chapter[] {
  const place = local.label.startsWith('United ') ? `the ${local.label}` : local.label;
  return local.stories.map((s, i) => {
    const lead = i > 0 ? `Also in ${place}.` : first ? `First, in ${place}.` : `Next, in ${place}.`;
    return spokenChapter(local.date, s.headline, `${lead} ${storyScript(s, mode)}`, s);
  });
}

/**
 * The edition read by the phone's own voice, for when the server has no audio
 * (sample edition, or the audio step hasn't run yet). Follows the same running order
 * as the server script: intro + 60-second summary, one chapter per story, outro.
 */
function deviceChapters(b: Briefing, mode: ListenMode, stories: Story[], local: LocalGroup | null): Chapter[] {
  const chapter = (title: string, text: string, story?: Story) => spokenChapter(b.date, title, text, story);
  const out: Chapter[] = [chapter('The 60-second briefing', introText(b.date, b.summary))];
  let lastTopic: Topic | null = null;
  stories.forEach((s, i) => {
    const lead = i === 0 ? 'First, ' : s.topic !== lastTopic ? `Next, in ${TOPIC_LABEL[s.topic]}. ` : 'Also. ';
    lastTopic = s.topic;
    out.push(chapter(s.headline, `${lead}${storyScript(s, mode)}`, s));
  });
  if (local) out.push(...localChapters(local, mode, stories.length === 0));
  out.push(chapter('Wrap-up', "That's your briefing. You're all caught up."));
  return out;
}

/** The server wrote each story as a lead-in plus a body, so the phone can make its own running order. */
function hasParts(audio: AudioEdition): boolean {
  return !audio.url && audio.chapters.some((c) => c.storyId != null && typeof c.body === 'string' && c.body.trim() !== '');
}

/** The greeting and the 60-second summary, as the phone says it. */
function introText(date: string, summary: string[]): string {
  return `Good morning, it's ${spokenDate(date)}. Here's what you need to know. ${summary.join(' ')}`;
}

/**
 * The reader's own running order, read by the phone: the intro, then only their topics (starred
 * ones first, stories hidden by muted words or turned-off outlets left out), each story's body
 * with a short way in of our own ("Next, in Business."), then the local section, then the outro.
 */
function personalChapters(
  b: Briefing,
  mode: ListenMode,
  audio: AudioEdition,
  curated: CuratedEdition,
  mutedWords: string[],
): Chapter[] {
  const chapters = audio.chapters;
  const byStory = new Map(chapters.flatMap((c) => (c.storyId ? [[c.storyId, c] as const] : [])));
  const intro = chapters[0] && !chapters[0].storyId ? chapters[0] : null;
  const last = chapters[chapters.length - 1];
  const outro = last && !last.storyId && last !== intro ? last : null;

  const out: Chapter[] = [];
  if (intro) {
    // An intro that mentions a muted word is told from Today's takeaways instead, which leave it out.
    const muted = mutedMatcher(mutedWords);
    const text = muted?.test(intro.script) ? introText(b.date, curated.summary) : intro.script;
    out.push(spokenChapter(b.date, intro.title, text));
  }
  let told = 0;
  for (const g of curated.groups) {
    const label = TOPIC_LABEL[g.topic];
    let inTopic = 0;
    for (const s of g.stories) {
      const c = byStory.get(s.id);
      if (!c) continue;
      const lead = told === 0 ? `First, in ${label}.` : inTopic === 0 ? `Next, in ${label}.` : `Also in ${label}.`;
      const text = c.body?.trim() ? `${lead} ${c.body}` : c.script;
      out.push(spokenChapter(b.date, c.title, text, s));
      told++;
      inTopic++;
    }
  }
  if (curated.local) out.push(...localChapters(curated.local, mode, told === 0));
  if (outro) out.push(spokenChapter(b.date, outro.title, outro.script));
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

/**
 * Everything after "Since this morning": the studio MP3 as made; the reader's own running order
 * when the server wrote chapters in parts (lead + body); older text-only editions as written;
 * and before any audio exists, the phone's version in Today's order.
 */
function editionChapters(b: Briefing, mode: ListenMode, prefs: ListenPrefs, curated: CuratedEdition): Chapter[] {
  const audio = b.audio?.[mode] ?? null;
  if (audio && hasParts(audio)) return personalChapters(b, mode, audio, curated, prefs.mutedWords);
  if (audio) return serverChapters(b, audio);
  const stories = orderedTopics(prefs).flatMap((t) => b.stories.filter((s) => s.topic === t));
  return deviceChapters(b, mode, stories, curated.local);
}

/**
 * The whole edition as a listening session. "Since this morning" stories go first, then the
 * stories in Today's order: by topic (the reader's, focus topics first), then rank, then the
 * local section.
 */
export function editionSession(b: Briefing, mode: ListenMode, prefs: ListenPrefs): Session {
  const audio = b.audio?.[mode] ?? null;
  const curated = curateEdition(b, prefs);
  const topics = orderedTopics(prefs);
  // The reader's own running order also leaves out what Today hides; older editions play as before.
  const updates =
    audio && hasParts(audio) ? curated.updates : (b.sinceThisMorning ?? []).filter((s) => topics.includes(s.topic));
  const chapters = [...updates.map((s) => updateChapter(s, b.date)), ...editionChapters(b, mode, prefs, curated)];
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
export function listenMinutes(b: Briefing, mode: ListenMode, prefs: ListenPrefs): number {
  const audio = b.audio?.[mode];
  const seconds =
    audio && !hasParts(audio)
      ? audio.duration
      : editionChapters(b, mode, prefs, curateEdition(b, prefs)).reduce((n, c) => n + c.duration, 0);
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
