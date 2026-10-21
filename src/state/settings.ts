import { DEFAULT_TOPICS } from '@/data/topics';
import { TOPICS, type ListenMode, type Topic } from '@/data/types';
import { createPersistedStore, useStore } from '@/lib/persisted';
import { guessRegion, isRegion, type Region } from '@/lib/region';
import type { ThemeName } from '@/theme/themes';

export type WakeTime = { hour: number; minute: number };

export type Settings = {
  /** False until the first-launch onboarding is finished. */
  onboarded: boolean;
  theme: ThemeName;
  /** When the morning edition notification arrives. */
  wakeTime: WakeTime;
  /** Topics included in the edition, in display order. */
  topics: Topic[];
  /** Followed topics the reader wants more of: more stories, shown first on Today. */
  focusTopics: Topic[];
  /** Words and phrases whose stories are hidden on Today (case-insensitive, whole words). */
  mutedWords: string[];
  /** Reading text size, as a multiplier of the theme's sizes (1 = as designed). */
  textScale: number;
  /** The first-run tour of Today has been shown (or skipped). */
  tourDone: boolean;
  /** The latest "what's new" note shown over Today (WHATS_NEW_VERSION in tour/WhatsNewTour.tsx). */
  whatsNewSeen: number;
  /** Name to sign feedback with (optional, remembered between notes). */
  feedbackName: string;
  /** Glass theme: always light, always dark, or light by day and dark at night. */
  glassAppearance: 'auto' | 'light' | 'dark';
  /** Outlet names (from supabase/functions/_shared/sources.ts) to skip. */
  disabledOutlets: string[];
  /** Where the local section on Today comes from (WORLD: none). */
  region: Region;
  /** "Your edition is ready" push each morning. */
  morningPush: boolean;
  /** 8pm reminder when something is saved for tonight. */
  remindTonight: boolean;
  /** Saturday 10am reminder when something is saved for the weekend. */
  remindWeekend: boolean;
  /** Push for genuinely major breaking news (at most 2 a day). */
  breakingPush: 'off' | 'major';
  /** Which listening version "Listen" starts with. */
  listenMode: ListenMode;
  /** Playback speed. */
  listenRate: number;
  /** Phone voice for editions without studio audio (`null` = the best one on the phone). */
  listenVoice: string | null;
  /**
   * 3 = Movies split out of Entertainment. 2 = the 13-topic list.
   * Older saves had 4 topics, where World also covered politics, science and health.
   */
  topicsVersion: number;
};

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  theme: 'dune',
  wakeTime: { hour: 5, minute: 30 },
  topics: [...DEFAULT_TOPICS],
  focusTopics: [],
  mutedWords: [],
  textScale: 1,
  tourDone: false,
  whatsNewSeen: 0,
  feedbackName: '',
  glassAppearance: 'auto',
  disabledOutlets: [],
  // Onboarding starts from where the phone seems to be; saves from before regions get the same guess.
  region: guessRegion(),
  morningPush: true,
  remindTonight: true,
  remindWeekend: true,
  breakingPush: 'major',
  listenMode: 'full',
  listenRate: 1,
  listenVoice: null,
  topicsVersion: 3,
};

/**
 * Topics that were split out of one a reader already follows: World used to include politics,
 * science and health (version 2), and Entertainment used to include film (version 3).
 */
function migrateTopics(s: Settings): Settings {
  if (s.topicsVersion >= 3) return s;
  const split: Topic[] = [];
  if (s.topicsVersion < 2 && s.topics.includes('world')) split.push('politics', 'science', 'health');
  if (s.topics.includes('entertainment')) split.push('movies');
  const topics = TOPICS.filter((t) => s.topics.includes(t) || split.includes(t));
  return { ...s, topics, topicsVersion: 3 };
}

/** Fields added later, made safe whatever an older or damaged save holds. */
function sanitize(s: Settings): Settings {
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    ...s,
    // A topic can only be starred while it's followed.
    focusTopics: list(s.focusTopics).filter((t): t is Topic => s.topics.includes(t as Topic)),
    mutedWords: list(s.mutedWords),
    textScale: typeof s.textScale === 'number' && s.textScale >= 0.8 && s.textScale <= 1.5 ? s.textScale : 1,
    glassAppearance: s.glassAppearance === 'light' || s.glassAppearance === 'dark' ? s.glassAppearance : 'auto',
    disabledOutlets: list(s.disabledOutlets),
    region: isRegion(s.region) ? s.region : guessRegion(),
    whatsNewSeen: typeof s.whatsNewSeen === 'number' ? s.whatsNewSeen : 0,
    feedbackName: typeof s.feedbackName === 'string' ? s.feedbackName.slice(0, 60) : '',
  };
}

export const settingsStore = createPersistedStore<Settings>('brewsy:settings', DEFAULT_SETTINGS, (stored, init) =>
  // Saves from before topicsVersion existed count as version 1.
  sanitize(migrateTopics({ ...init, topicsVersion: 1, ...(stored as Partial<Settings>) })),
);

export function useSettings(): Settings {
  return useStore(settingsStore);
}

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set((s) => ({ ...s, ...patch }));
}
