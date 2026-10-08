import { useSyncExternalStore } from 'react';

/**
 * Which edition the Today tab shows. `null` means "today".
 * Shared so the past-editions sheet and notification taps can change it.
 */
let selected: string | null = null;
const listeners = new Set<() => void>();

export function setSelectedEdition(date: string | null) {
  selected = date;
  listeners.forEach((l) => l());
}

export function useSelectedEdition(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selected,
    () => selected,
  );
}
