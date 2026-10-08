import { useEffect, useState } from 'react';

import { fetchAndCacheEdition, readCachedEdition, shiftDate, todayKey } from '@/data/editions';
import type { Briefing } from '@/data/types';
import { usePreviewState } from '@/dev/previewState';

export type EditionState =
  | { status: 'loading' }
  | { status: 'ready'; briefing: Briefing; offline: boolean }
  | { status: 'empty' }
  | { status: 'error'; message: string };

type Update = (state: EditionState) => void;

/** Cached copy first (instant, works offline), then the fresh one from the server. */
async function load(date: string, update: Update) {
  const cached = await readCachedEdition(date);
  if (cached) update({ status: 'ready', briefing: cached, offline: false });
  try {
    const fresh = await fetchAndCacheEdition(date);
    if (fresh) update({ status: 'ready', briefing: fresh, offline: false });
    else if (!cached) update({ status: 'empty' });
  } catch (e) {
    if (cached) update({ status: 'ready', briefing: cached, offline: true });
    else update({ status: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
  }
}

/** Loads one day's edition with loading / empty / error / offline states. */
export function useEdition(date: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: EditionState } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const key = `${date}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    load(date, (state) => {
      if (!cancelled) setResult({ key, state });
    }).then(() => {
      // Keep the previous day ready too, so swiping back is instant.
      if (!cancelled && date === todayKey()) fetchAndCacheEdition(shiftDate(date, -1)).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [date, key]);

  const loaded: EditionState = result?.key === key ? result.state : { status: 'loading' };

  const preview = usePreviewState();
  const state: EditionState =
    preview === 'loading'
      ? { status: 'loading' }
      : preview === 'empty'
        ? { status: 'empty' }
        : preview === 'error'
          ? { status: 'error', message: 'This is a preview of the error screen. Long-press the logo to move on.' }
          : loaded;

  return {
    state,
    refreshing,
    /** Pull-to-refresh: keeps the current edition on screen while reloading. */
    refresh: async () => {
      setRefreshing(true);
      await load(date, (s) => setResult({ key, state: s }));
      setRefreshing(false);
    },
    retry: () => setAttempt((n) => n + 1),
  };
}
