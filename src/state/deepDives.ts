import type { DeepDive } from '@/data/types';
import { createPersistedStore } from '@/lib/persisted';

/** On-device cache of "Go deeper" results, so reopening one is instant and works offline. */
type DeepDiveCache = Record<string, DeepDive>;

const MAX_ENTRIES = 40;

export const deepDiveStore = createPersistedStore<DeepDiveCache>('brewsy:deep-dives', {});

export function cachedDeepDive(key: string): DeepDive | undefined {
  return deepDiveStore.get()[key];
}

export function cacheDeepDive(key: string, deepDive: DeepDive) {
  deepDiveStore.set((cache) => {
    const next = { ...cache, [key]: deepDive };
    const keys = Object.keys(next);
    if (keys.length > MAX_ENTRIES) {
      // Drop the oldest entries.
      keys
        .sort((a, b) => next[a].generatedAt.localeCompare(next[b].generatedAt))
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete next[k]);
    }
    return next;
  });
}
