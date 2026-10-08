// Small helpers around a published edition: ids, "Also happening" items as
// stories, and finding any story (main, also-happening or daytime update).

import { slugify } from './text.ts';
import type { AlsoItem, Briefing, Story } from './types.ts';

/** A slug not yet in `used` (and adds it). */
export function uniqueId(text: string, used: Set<string>, prefix = ''): string {
  const base = `${prefix}${slugify(text, 60 - prefix.length)}`;
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${prefix}${slugify(text, 55 - prefix.length)}-${n}`;
  used.add(id);
  return id;
}

/**
 * "Also happening" items only have the short layers. As a Story they can be
 * saved to the Reading List and used by Go deeper / Ask like any other story.
 */
export function alsoToStory(a: AlsoItem): Story {
  return {
    id: a.id,
    topic: a.topic,
    headline: a.headline,
    dek: '',
    whatHappened: a.whatHappened,
    whyItMatters: a.whyItMatters,
    explainSimply: '',
    background: '',
    keyPlayers: [],
    keyTerms: [],
    whatToWatch: [],
    readTimeMinutes: 1,
    sources: a.sources,
    allSources: a.sources,
    imageUrl: null,
    ...(a.developing ? { developing: true } : {}),
  };
}

/** Any story of a day: a main story, a daytime update, or an "Also happening" item. */
export function findStory(briefing: Briefing, updates: Story[] | null | undefined, storyId: string): Story | null {
  const main = briefing.stories.find((s) => s.id === storyId);
  if (main) return main;
  const update = (updates ?? []).find((s) => s.id === storyId);
  if (update) return update;
  const also = (briefing.alsoHappening ?? []).find((a) => a.id === storyId);
  return also ? alsoToStory(also) : null;
}

/** Every story id already used on a day. */
export function usedIds(briefing: Briefing, updates: Story[] = []): Set<string> {
  return new Set([
    ...briefing.stories.map((s) => s.id),
    ...(briefing.alsoHappening ?? []).map((a) => a.id),
    ...updates.map((s) => s.id),
  ]);
}
