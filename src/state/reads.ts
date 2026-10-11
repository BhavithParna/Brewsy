import { useEffect, useSyncExternalStore } from 'react';

import { shiftDate, todayKey } from '@/data/editions';
import { createPersistedStore, useStore } from '@/lib/persisted';

/**
 * What the reader has opened, and on which days they came to read. Kept on this phone only.
 * A story counts as opened when its "Learn more" is opened, it's read aloud, or it's shared.
 */
export type ReadsState = {
  /** Story ids opened, by edition date (YYYY-MM-DD). */
  byEdition: Record<string, string[]>;
  /** Local days (YYYY-MM-DD) the reader opened their edition, oldest first. */
  days: string[];
};

const EMPTY: ReadsState = { byEdition: {}, days: [] };
/** Editions and days to remember: enough for any streak worth showing. */
const KEEP_EDITIONS = 45;
const KEEP_DAYS = 400;

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Whatever was stored, as a valid state (storage can hold anything from an older version). */
function clean(stored: unknown): ReadsState {
  const s = (stored ?? {}) as Partial<ReadsState>;
  const byEdition: Record<string, string[]> = {};
  if (s.byEdition && typeof s.byEdition === 'object') {
    for (const [date, ids] of Object.entries(s.byEdition)) {
      if (isDay(date) && Array.isArray(ids)) byEdition[date] = ids.filter((id) => typeof id === 'string');
    }
  }
  const days = Array.isArray(s.days) ? s.days.filter(isDay) : [];
  return { byEdition, days };
}

export const readsStore = createPersistedStore<ReadsState>('brewsy:reads', EMPTY, clean);

let hydration: Promise<void> | null = null;

/**
 * Loads what was saved. Safe to call any number of times; every reader of this store calls it,
 * so it works even before app startup hydrates it.
 */
export function hydrateReads(): Promise<void> {
  hydration ??= readsStore.hydrate();
  return hydration;
}

function withDay(days: string[], day: string): string[] {
  if (days.includes(day)) return days;
  return [...days, day].sort().slice(-KEEP_DAYS);
}

/** Marks a story as opened. Waits for saved data first, so nothing saved is overwritten. */
export function markRead(editionDate: string, storyId: string) {
  void hydrateReads().then(() =>
    readsStore.set((s) => {
      const ids = s.byEdition[editionDate] ?? [];
      if (ids.includes(storyId)) return s;
      const byEdition = { ...s.byEdition, [editionDate]: [...ids, storyId] };
      const dates = Object.keys(byEdition).sort();
      for (const old of dates.slice(0, Math.max(0, dates.length - KEEP_EDITIONS))) delete byEdition[old];
      return { byEdition, days: withDay(s.days, todayKey()) };
    }),
  );
}

/** Records that today's edition was opened (it keeps the days-in-a-row count going). */
export function noteReadingDay() {
  void hydrateReads().then(() => {
    const today = todayKey();
    if (!readsStore.get().days.includes(today)) readsStore.set((s) => ({ ...s, days: withDay(s.days, today) }));
  });
}

/** Days in a row with an edition opened, ending today (or yesterday, if today's isn't open yet). */
export function streakDays(days: string[], today = todayKey()): number {
  const set = new Set(days);
  let day = set.has(today) ? today : shiftDate(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = shiftDate(day, -1);
  }
  return n;
}

export function useReads(): ReadsState {
  useEffect(() => {
    void hydrateReads();
  }, []);
  return useStore(readsStore);
}

/** True once this story has been opened. Re-renders only when that answer changes. */
export function useIsRead(editionDate: string, storyId: string): boolean {
  useEffect(() => {
    void hydrateReads();
  }, []);
  return useSyncExternalStore(
    readsStore.subscribe,
    () => readsStore.get().byEdition[editionDate]?.includes(storyId) ?? false,
    () => false,
  );
}
