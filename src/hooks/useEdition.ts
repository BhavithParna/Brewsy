import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  fetchAndCacheEdition,
  latestEditionBefore,
  readCachedEdition,
  regionalFor,
  shiftDate,
  todayKey,
} from '@/data/editions';
import type { Briefing } from '@/data/types';
import { devEditionFlags, withSampleAudioParts } from '@/dev/devEditions';
import { usePreviewState } from '@/dev/previewState';
import { useSettings } from '@/state/settings';

/** While today's edition is being made, `ready` can hold an earlier one (`briefing.date` before the day asked for). */
export type EditionState =
  | { status: 'loading' }
  | { status: 'ready'; briefing: Briefing; offline: boolean }
  | { status: 'empty' }
  | { status: 'error'; message: string };

type Update = (state: EditionState) => void;

/**
 * No edition for today yet (an Australian at 7 am, before the shared one is made): the latest one
 * from the days before, with today's local section if it's already out. Otherwise the "still
 * brewing" state. `offline`: only look at the copies on this phone.
 */
async function earlierEdition(date: string, offline = false): Promise<EditionState | null> {
  if (date !== todayKey()) return null;
  const found = await latestEditionBefore(date, { offline });
  if (!found) return null;
  const regional = found.offline ? undefined : await regionalFor(date);
  const briefing = { ...found.briefing, regional: regional ?? found.briefing.regional ?? null };
  return { status: 'ready', briefing, offline: found.offline };
}

/** Cached copy first (instant, works offline), then the fresh one from the server. */
async function load(date: string, show: Update) {
  // Development: ?audio=parts gives the edition a script in parts (dev/devEditions.ts).
  const update: Update = (s) =>
    show(__DEV__ && s.status === 'ready' ? { ...s, briefing: withSampleAudioParts(s.briefing) } : s);
  // Development: ?fallback=1 acts as if today's edition isn't made yet.
  const skip = __DEV__ && devEditionFlags.fallback && date === todayKey();
  const cached = skip ? null : await readCachedEdition(date);
  if (cached) update({ status: 'ready', briefing: cached, offline: false });
  try {
    const fresh = skip ? null : await fetchAndCacheEdition(date);
    if (fresh) update({ status: 'ready', briefing: fresh, offline: false });
    else if (!cached) update((await earlierEdition(date)) ?? { status: 'empty' });
  } catch (e) {
    if (cached) update({ status: 'ready', briefing: cached, offline: true });
    else {
      update(
        (await earlierEdition(date, true)) ?? {
          status: 'error',
          message: e instanceof Error ? e.message : 'Something went wrong.',
        },
      );
    }
  }
}

/** Loads one day's edition with loading / empty / error / offline states. */
export function useEdition(date: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: EditionState } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // A new region brings its own local section.
  const { region } = useSettings();
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
  }, [date, key, region]);

  const loaded: EditionState = result?.key === key ? result.state : { status: 'loading' };

  // Showing an earlier edition while today's is made: look again whenever the app comes back.
  const earlier = loaded.status === 'ready' && loaded.briefing.date < date;
  useEffect(() => {
    if (!earlier) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load(date, (state) => setResult({ key, state }));
    });
    return () => sub.remove();
  }, [earlier, date, key]);

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
