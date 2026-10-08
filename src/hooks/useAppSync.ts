import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { listenToDate } from '@/audio/listen';
import { todayKey } from '@/data/editions';
import { rememberPushToken, syncDevice } from '@/lib/device';
import {
  LISTEN_ACTION,
  Notifications,
  notificationsAllowed,
  registerForPush,
  syncReminders,
  type NotificationData,
} from '@/lib/notifications';
import { setSelectedEdition } from '@/state/editionNav';
import { activeCount, readingListStore, useReadingList } from '@/state/readingList';
import { settingsStore, useSettings } from '@/state/settings';

/**
 * Background jobs that follow the app's state:
 * - re-plans reading reminders when the Reading List or reminder settings change
 * - sends wake-up time, topics and sources to the backend when they change
 * - opens the right screen when a notification is tapped
 */
export function useAppSync() {
  const items = useReadingList();
  const settings = useSettings();

  // Only what affects reminders, so unrelated changes don't reschedule them.
  const reminderKey = [
    settings.onboarded,
    settings.remindTonight,
    settings.remindWeekend,
    activeCount(items, 'tonight'),
    activeCount(items, 'weekend'),
  ].join('|');

  useEffect(() => {
    if (Platform.OS === 'web' || !settingsStore.get().onboarded) return;
    const timer = setTimeout(() => {
      syncReminders(readingListStore.get().items, settingsStore.get()).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [reminderKey]);

  // Only what the backend needs to know.
  const deviceKey = JSON.stringify([
    settings.onboarded,
    settings.wakeTime,
    settings.topics,
    settings.disabledOutlets,
    settings.morningPush,
    settings.breakingPush,
  ]);

  useEffect(() => {
    if (!settingsStore.get().onboarded) return;
    const timer = setTimeout(async () => {
      try {
        const current = settingsStore.get();
        if (current.morningPush && (await notificationsAllowed())) {
          const reg = await registerForPush();
          if (reg.token) await rememberPushToken(reg.token);
        }
        await syncDevice(current);
      } catch {
        // Offline or backend not set up yet: try again on the next change or launch.
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [deviceKey]);

  // Tapping a notification: reminders open the Reading List, the morning one opens Today
  // ("Listen now" also starts the audio), breaking news opens Today where it sits on top.
  useEffect(() => {
    if (!Notifications || Platform.OS === 'web') return;
    const open = (response: NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as NotificationData | undefined;
      if (data?.kind === 'reminder') {
        router.navigate('/reading-list');
      } else if (data?.kind === 'alert') {
        router.navigate('/');
      } else if (data?.kind === 'breaking') {
        setSelectedEdition(null);
        router.navigate('/');
      } else if (data) {
        const date = 'date' in data ? data.date : undefined;
        setSelectedEdition(date && date !== todayKey() ? date : null);
        router.navigate('/');
        if (response.actionIdentifier === LISTEN_ACTION) listenToDate(date ?? todayKey());
      }
    };
    // The app was opened from a notification while it was closed.
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        open(r);
        if (r) Notifications?.clearLastNotificationResponseAsync().catch(() => {});
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
