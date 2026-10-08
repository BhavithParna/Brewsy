import { useSyncExternalStore } from 'react';

import type { PlayerState } from './types';
import { settingsStore } from '@/state/settings';

/** Live player state. Not persisted (where you stopped lives in progress.ts). */
let state: PlayerState = {
  session: null,
  index: 0,
  playing: false,
  buffering: false,
  position: 0,
  rate: 1,
  engine: null,
  finished: false,
  error: null,
};
const listeners = new Set<() => void>();

export const playerStore = {
  get: () => state,
  set(patch: Partial<PlayerState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * Subscribe to one slice of the player. The selector must return a primitive or an
 * object that keeps its identity (like `session`), or the component re-renders forever.
 */
export function usePlayer<T>(selector: (s: PlayerState) => T): T {
  return useSyncExternalStore(
    playerStore.subscribe,
    () => selector(state),
    () => selector(state),
  );
}

/** Key of the story being read right now (`date:storyId`), for highlighting it. */
export function usePlayingKey(): string | null {
  return usePlayer((s) => (s.session ? (s.session.chapters[s.index]?.key ?? null) : null));
}

export function initialRate(): number {
  return settingsStore.get().listenRate ?? 1;
}
