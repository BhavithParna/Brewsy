import { useSyncExternalStore } from 'react';

import sample from '@/data/mock-briefing.json';
import type { Briefing } from '@/data/types';
import { isRegion } from '@/lib/region';
import { readingListStore, saveStory, setDone, storyKey, type Bucket } from '@/state/readingList';
import { updateSettings } from '@/state/settings';
import { themes, type ThemeName } from '@/theme/themes';

/**
 * Development helper: long-press the Brewsy logo on Today to cycle through
 * the loading, empty and error screens without breaking anything.
 * Does nothing in production builds.
 */
export type PreviewState = 'live' | 'loading' | 'empty' | 'error';

const ORDER: PreviewState[] = ['live', 'loading', 'empty', 'error'];

// On the web preview, `?preview=empty` (etc.) opens straight into a state.
function initialState(): PreviewState {
  if (!__DEV__ || typeof window === 'undefined' || !window.location?.search) return 'live';
  const value = new URLSearchParams(window.location.search).get('preview') as PreviewState | null;
  return value && ORDER.includes(value) ? value : 'live';
}

let current: PreviewState = initialState();
const listeners = new Set<() => void>();

export function cyclePreviewState() {
  if (!__DEV__) return;
  current = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreviewState(): PreviewState {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

/**
 * Web preview only: URL flags for screenshots and quick testing.
 *   ?onboarded=1   skip onboarding     ?onboarded=0   show it again
 *   ?seed=1        fill the Reading List with sample stories
 *   ?tour=0        mark the first-run tour as seen     ?tour=1   show it again
 *                  (?onboarded=1 without a tour flag also skips the tour, so screenshots stay clear)
 *   ?theme=atlantis   switch theme. Classic: glass | whales | space | atlantis | highlands | alpine.
 *                     Films: dune | matrix | tron | bladerunner | budapest | starwars | hogwarts | lalaland | ghibli |
 *                            fightclub.
 *                     Horror: nosferatu | thering | midsommar | scream | insidious.
 *   ?eggs=1        film themes: put every rare section-heading touch (some days only) on every topic at once
 *                  (read in components/headings/films.tsx)
 *   ?glass=dark    Glass appearance: light | dark | auto
 *   ?blur=0        draw frosted glass the way Android does: no blur, just the fills (read in GlassCard)
 *   ?region=CA     where the local section comes from: IN | CA | US | UK | AU | WORLD
 *   ?local=sample  a sample local section · ?fallback=1  today's edition "not out yet" (dev/devEditions.ts)
 */
export function applyDevUrlFlags() {
  if (!__DEV__ || typeof window === 'undefined' || !window.location?.search) return;
  const params = new URLSearchParams(window.location.search);
  const onboarded = params.get('onboarded');
  if (onboarded != null) updateSettings({ onboarded: onboarded === '1' });
  const tour = params.get('tour');
  if (tour != null) updateSettings({ tourDone: tour === '0' });
  else if (onboarded === '1') updateSettings({ tourDone: true });
  const theme = params.get('theme');
  if (theme && theme in themes) updateSettings({ theme: theme as ThemeName });
  const region = params.get('region');
  if (isRegion(region)) updateSettings({ region });
  const glass = params.get('glass');
  if (glass === 'light' || glass === 'dark' || glass === 'auto') updateSettings({ glassAppearance: glass });
  if (params.get('seed') === '1' && readingListStore.get().items.length === 0) seedReadingList();
}

function seedReadingList() {
  const edition = sample as Briefing;
  const plan: [number, Bucket, string][] = [
    [0, 'tonight', 'Ask Dad what this means for his bonds'],
    [3, 'tonight', ''],
    [1, 'weekend', ''],
    [6, 'weekend', 'Compare with the Llama release'],
    [4, 'week', ''],
    [8, 'norush', ''],
  ];
  plan.forEach(([i, bucket, note]) =>
    saveStory({ story: edition.stories[i], editionDate: edition.date, bucket, note }),
  );
  const done = edition.stories[9];
  saveStory({ story: done, editionDate: edition.date, bucket: 'norush' });
  setDone(storyKey(edition.date, done.id), true);
}
