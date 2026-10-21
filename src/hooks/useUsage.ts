import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { backendConfigured, logUsage } from '@/data/api';
import { appVersion } from '@/lib/appVersion';
import { deviceId } from '@/lib/device';
import { settingsStore } from '@/state/settings';
import { forgetSentDays, hydrateUsage, noteOpen, usageStore } from '@/state/usage';

/** Back after at least this long away counts as opening the app again. */
const NEW_OPEN_AFTER_MS = 10 * 60 * 1000;
/** A moment after launch, once the device row has been saved (useAppSync), send what's waiting. */
const FIRST_SEND_MS = 8000;

let sending = false;

/** Sends each kept day's totals so far. Days before today are dropped once the server has them. */
async function sendUsage() {
  if (sending || !backendConfigured || !settingsStore.get().onboarded) return;
  // The web preview isn't a reader's device (see useAppSync).
  if (Platform.OS === 'web' && __DEV__) return;
  sending = true;
  try {
    await hydrateUsage();
    const id = await deviceId();
    const { theme } = settingsStore.get();
    const sent: string[] = [];
    for (const [day, u] of Object.entries(usageStore.get().days).sort(([a], [b]) => a.localeCompare(b))) {
      try {
        await logUsage(id, {
          p_day: day,
          p_opens: u.opens,
          p_theme: theme,
          p_topics: u.topics,
          p_opened: u.opened,
          p_listens: u.listens,
          p_saves: u.saves,
          p_shares: u.shares,
          p_app_version: appVersion(),
        });
        sent.push(day);
      } catch {
        // Offline, or a backend without usage yet: the day stays here for next time.
        break;
      }
    }
    forgetSentDays(sent);
  } finally {
    sending = false;
  }
}

/**
 * Counts opens (launches, and returns after ten minutes away) and sends the day's usage when
 * Brewsy goes to the background. What's counted is in state/usage.ts.
 */
export function useUsage() {
  useEffect(() => {
    if (settingsStore.get().onboarded) noteOpen();
    const first = setTimeout(() => void sendUsage(), FIRST_SEND_MS);
    let awaySince = 0;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (awaySince && Date.now() - awaySince >= NEW_OPEN_AFTER_MS && settingsStore.get().onboarded) noteOpen();
        awaySince = 0;
      } else if (!awaySince) {
        awaySince = Date.now();
        void sendUsage();
      }
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, []);
}
