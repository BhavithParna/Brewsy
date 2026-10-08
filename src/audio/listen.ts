import { downloadAudio } from './downloads';
import { play } from './engine';
import { chapterFor, editionSession, readingListSession } from './sessions';
import { playerStore } from './store';
import { toast } from '@/components/Toast';
import { fetchAndCacheEdition, readCachedEdition } from '@/data/editions';
import type { Briefing, ListenMode } from '@/data/types';
import type { SavedItem } from '@/state/readingList';
import { settingsStore, updateSettings } from '@/state/settings';

/** Plays an edition, from where you stopped or from one story. */
export async function listenToEdition(b: Briefing, opts: { mode?: ListenMode; storyId?: string } = {}) {
  const settings = settingsStore.get();
  const mode = opts.mode ?? settings.listenMode;
  if (opts.mode && opts.mode !== settings.listenMode) updateSettings({ listenMode: opts.mode });
  const session = editionSession(b, mode, settings.topics);
  if (opts.storyId) {
    const index = chapterFor(session, opts.storyId);
    await play(session, { index: Math.max(0, index) });
  } else {
    await play(session);
  }
}

/** Notification "Listen now", the brewsy://listen link and voice shortcuts land here. */
export async function listenToDate(date: string, mode?: ListenMode) {
  try {
    const b = (await readCachedEdition(date)) ?? (await fetchAndCacheEdition(date));
    if (!b) {
      toast.show("Today's edition isn't ready yet");
      return;
    }
    await listenToEdition(b, { mode });
  } catch {
    toast.show("Couldn't load the edition to play it");
  }
}

export async function listenToReadingList(items: SavedItem[], startKey?: string) {
  if (!items.length) return;
  const session = await readingListSession(items);
  const index = startKey ? session.chapters.findIndex((c) => c.key === startKey) : 0;
  await play(session, { index: Math.max(0, index) });
}

/** Saves today's audio on the phone in the background, so it plays instantly and offline. */
export function prefetchEditionAudio(b: Briefing) {
  const url = b.audio?.[settingsStore.get().listenMode]?.url;
  if (url) downloadAudio(url);
}

/** True when this edition is the one loaded in the player. */
export function isPlayingEdition(date: string): boolean {
  return playerStore.get().session?.editionDate === date;
}
