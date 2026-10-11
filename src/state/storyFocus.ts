import { useSyncExternalStore } from 'react';

import { setSelectedEdition } from './editionNav';
import { todayKey } from '@/data/editions';

/** A request for Today to open a story and scroll to it. `seq` makes repeat requests distinct. */
export type StoryFocus = { date: string; storyId: string; seq: number };

let current: StoryFocus | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/**
 * Shows that story's edition on Today, then opens the story there (used by Search and
 * notification taps). Navigate to Today yourself; Today calls clearStoryFocus() once it's done.
 */
export function focusStory(date: string, storyId: string) {
  setSelectedEdition(date === todayKey() ? null : date);
  current = { date, storyId, seq: ++seq };
  emit();
}

export function clearStoryFocus() {
  if (!current) return;
  current = null;
  emit();
}

export function useStoryFocus(): StoryFocus | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
