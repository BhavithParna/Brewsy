import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * A tiny global store that saves itself to AsyncStorage (on-device storage).
 * Components re-render when it changes. Call `hydrate()` once at startup.
 */
export type PersistedStore<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  hydrate: () => Promise<void>;
};

export function createPersistedStore<T>(
  key: string,
  initial: T,
  /** Combine stored data with defaults (handles fields added in later versions). */
  merge: (stored: unknown, initial: T) => T = (stored, init) => ({ ...init, ...(stored as object) }),
): PersistedStore<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  let writeTimer: ReturnType<typeof setTimeout> | null = null;

  const persist = () => {
    if (writeTimer) clearTimeout(writeTimer);
    // Batch quick successive changes into one write.
    writeTimer = setTimeout(() => {
      AsyncStorage.setItem(key, JSON.stringify(state)).catch(() => {});
    }, 120);
  };

  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      listeners.forEach((l) => l());
      persist();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async hydrate() {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          state = merge(JSON.parse(raw), initial);
          listeners.forEach((l) => l());
        }
      } catch {
        // Corrupt or unavailable storage: keep defaults.
      }
    },
  };
}

/** Subscribe a component to a store. */
export function useStore<T>(store: PersistedStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
