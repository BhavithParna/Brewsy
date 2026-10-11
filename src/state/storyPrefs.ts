import { TOPICS, type Topic } from '@/data/types';
import { settingsStore, updateSettings } from '@/state/settings';

// "More like this", "Less like this" and hidden words: small changes to the reader's settings that
// Today's curation (lib/curation.ts) picks up straight away.

/** Most topics a reader can ask for more of. */
export const MAX_FOCUS = 4;
/** Most words a reader can hide. */
const MAX_HIDDEN = 40;

/** Adds words to the hidden list (unique, ignoring case). Returns the ones that were new. */
export function hideWords(words: string[]): string[] {
  const current = settingsStore.get().mutedWords;
  const have = new Set(current.map((w) => w.toLowerCase()));
  const added: string[] = [];
  for (const raw of words) {
    const w = raw.trim().replace(/\s+/g, ' ');
    if (w.length < 2 || have.has(w.toLowerCase())) continue;
    have.add(w.toLowerCase());
    added.push(w);
  }
  if (added.length) updateSettings({ mutedWords: [...current, ...added].slice(-MAX_HIDDEN) });
  return added;
}

/** Stops hiding words. */
export function unhideWords(words: string[]) {
  const drop = new Set(words.map((w) => w.toLowerCase()));
  updateSettings({ mutedWords: settingsStore.get().mutedWords.filter((w) => !drop.has(w.toLowerCase())) });
}

export type FocusResult = 'added' | 'already' | 'full' | 'followed';

/**
 * "More like this": puts the topic first on Today with more stories. A topic the reader doesn't
 * follow is followed instead.
 */
export function focusTopic(topic: Topic): FocusResult {
  const s = settingsStore.get();
  if (!s.topics.includes(topic)) {
    updateSettings({ topics: TOPICS.filter((t) => t === topic || s.topics.includes(t)) });
    return 'followed';
  }
  if (s.focusTopics.includes(topic)) return 'already';
  if (s.focusTopics.length >= MAX_FOCUS) return 'full';
  updateSettings({ focusTopics: [...s.focusTopics, topic] });
  return 'added';
}

/** Back to the usual amount of a topic. */
export function unfocusTopic(topic: Topic) {
  updateSettings({ focusTopics: settingsStore.get().focusTopics.filter((t) => t !== topic) });
}

/** Takes a topic out of the edition. False when it's the only topic left. */
export function turnOffTopic(topic: Topic): boolean {
  const s = settingsStore.get();
  if (!s.topics.includes(topic)) return true;
  if (s.topics.length <= 1) return false;
  updateSettings({
    topics: s.topics.filter((t) => t !== topic),
    focusTopics: s.focusTopics.filter((t) => t !== topic),
  });
  return true;
}

/** Puts a topic back (for Undo), in its usual place. */
export function turnOnTopic(topic: Topic, focus = false) {
  const s = settingsStore.get();
  updateSettings({
    topics: TOPICS.filter((t) => t === topic || s.topics.includes(t)),
    focusTopics: focus && !s.focusTopics.includes(topic) ? [...s.focusTopics, topic] : s.focusTopics,
  });
}
