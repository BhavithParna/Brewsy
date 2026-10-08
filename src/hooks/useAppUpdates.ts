import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { playerStore } from '@/audio/store';
import { toast } from '@/components/Toast';

/** How often to look for a new version while the app keeps getting reopened. */
const CHECK_EVERY_MS = 10 * 60 * 1000;
/** Away at least this long, a downloaded update is applied when the app comes back. */
const APPLY_AFTER_AWAY_MS = 60 * 1000;

let lastCheck = 0;
let downloaded = false;

async function checkAndFetch() {
  if (__DEV__ || !Updates.isEnabled || downloaded) return;
  if (Date.now() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = Date.now();
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return;
    downloaded = true;
    toast.show('A new version of Brewsy is ready', { label: 'Restart', onPress: () => Updates.reloadAsync() });
  } catch {
    // Offline or the update server is unreachable: try again next time.
  }
}

/**
 * Over-the-air updates. expo-updates only checks when the app starts from scratch, and on
 * Android "closing" an app (especially one that played audio) often leaves it running. So also
 * check whenever Brewsy comes back to the foreground, offer a restart, and otherwise apply the
 * new version the next time it's reopened after a minute away (never in the middle of listening).
 */
export function useAppUpdates() {
  useEffect(() => {
    checkAndFetch();
    let backgroundedAt = 0;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        backgroundedAt = Date.now();
        return;
      }
      const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
      if (downloaded && away >= APPLY_AFTER_AWAY_MS && !playerStore.get().playing) {
        Updates.reloadAsync().catch(() => {});
        return;
      }
      checkAndFetch();
    });
    return () => sub.remove();
  }, []);
}
