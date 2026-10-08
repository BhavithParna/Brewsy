import { DEFAULT_TOPICS } from '@/data/topics';
import { TOPICS, type ListenMode, type Topic } from '@/data/types';
import { createPersistedStore, useStore } from '@/lib/persisted';
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
  /** Outlet names (from supabase/functions/_shared/sources.ts) to skip. */
  disabledOutlets: string[];
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
  /** 2 = the 13-topic list. Older saves had 4 topics, where World also covered politics, science and health. */
  topicsVersion: number;
};

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  theme: 'dune',
  wakeTime: { hour: 5, minute: 30 },
  topics: [...DEFAULT_TOPICS],
  disabledOutlets: [],
  morningPush: true,
  remindTonight: true,
  remindWeekend: true,
  breakingPush: 'major',
  listenMode: 'full',
  listenRate: 1,
  listenVoice: null,
  topicsVersion: 2,
};

/** World used to include politics, science and health; keep those for readers who followed it. */
function migrateTopics(s: Settings): Settings {
  if (s.topicsVersion >= 2) return s;
  const split: Topic[] = s.topics.includes('world') ? ['politics', 'science', 'health'] : [];
  const topics = TOPICS.filter((t) => s.topics.includes(t) || split.includes(t));
  return { ...s, topics, topicsVersion: 2 };
}

export const settingsStore = createPersistedStore<Settings>('brewsy:settings', DEFAULT_SETTINGS, (stored, init) =>
  // Saves from before topicsVersion existed count as version 1.
  migrateTopics({ ...init, topicsVersion: 1, ...(stored as Partial<Settings>) }),
);

export function useSettings(): Settings {
  return useStore(settingsStore);
}

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set((s) => ({ ...s, ...patch }));
}
