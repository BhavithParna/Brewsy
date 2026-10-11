import { useEffect } from 'react';

import { createPersistedStore, useStore } from '@/lib/persisted';

/** The reader's last few searches, newest first. Kept on this phone only. */
const MAX = 6;

const recentStore = createPersistedStore<string[]>('brewsy:recent-searches', [], (stored) =>
  Array.isArray(stored) ? stored.filter((s): s is string => typeof s === 'string').slice(0, MAX) : [],
);

let hydration: Promise<void> | null = null;

export function hydrateRecentSearches(): Promise<void> {
  hydration ??= recentStore.hydrate();
  return hydration;
}

export function rememberSearch(query: string) {
  const q = query.trim().replace(/\s+/g, ' ');
  if (q.length < 2) return;
  void hydrateRecentSearches().then(() =>
    recentStore.set((list) => [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX)),
  );
}

export function forgetSearch(query: string) {
  recentStore.set((list) => list.filter((x) => x !== query));
}

export function clearRecentSearches() {
  recentStore.set([]);
}

export function useRecentSearches(): string[] {
  useEffect(() => {
    void hydrateRecentSearches();
  }, []);
  return useStore(recentStore);
}
