import { AppState } from 'react-native';

import { createPersistedStore } from '@/lib/persisted';

/**
 * "New" badges: anything added after you last left the app counts as new
 * for this visit. `baseline` is the moment you last closed (backgrounded) Brewsy.
 */
const seenStore = createPersistedStore<{ leftAt: string | null }>('brewsy:seen', { leftAt: null });

let baseline: number | null = null;

export async function hydrateSeen() {
  await seenStore.hydrate();
  const left = seenStore.get().leftAt;
  baseline = left ? Date.parse(left) : null;
  AppState.addEventListener('change', (state) => {
    if (state === 'background') seenStore.set({ leftAt: new Date().toISOString() });
    else if (state === 'active') {
      const at = seenStore.get().leftAt;
      baseline = at ? Date.parse(at) : baseline;
    }
  });
}

/** True for things added since your last visit (never on the very first launch). */
export function isNew(addedAt: string | undefined): boolean {
  if (!addedAt || baseline == null) return false;
  return Date.parse(addedAt) > baseline;
}
