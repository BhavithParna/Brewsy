import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

import { activeCount, type SavedItem } from '@/state/readingList';
import type { Settings } from '@/state/settings';

// Morning pushes arrive without a channel id, so Android shows them on 'default'.
export const CHANNEL_EDITION = 'default';
export const CHANNEL_REMINDERS = 'reminders';

const ID_TONIGHT = 'brewsy-reminder-tonight';
const ID_WEEKEND = 'brewsy-reminder-weekend';
const ID_TEST = 'brewsy-reminder-test';

/**
 * What the backend (or a local reminder) puts in `data`:
 * - morning edition `{ kind: 'edition', date }` (category `edition`, with a "Listen now" button)
 * - breaking news `{ kind: 'breaking', date, storyId }`
 * - a problem with the morning run `{ kind: 'alert' }`
 * - reading reminders `{ kind: 'reminder' }`
 */
export type NotificationData =
  | { kind?: 'edition'; date?: string }
  | { kind: 'breaking'; date: string; storyId?: string }
  | { kind: 'alert' }
  | { kind: 'reminder' };

/** Category id the morning push uses, and its action button. */
export const EDITION_CATEGORY = 'edition';
export const LISTEN_ACTION = 'listen';

/** Expo Go on Android has no notifications at all: importing expo-notifications there throws. */
export const isExpoGoAndroid =
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** The expo-notifications module, or `null` in Expo Go on Android where it can't load. */
export const Notifications: typeof ExpoNotifications | null = isExpoGoAndroid
  ? null
  : // A static import would load (and throw) before this check can run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-notifications');

/** Show notifications as banners even while the app is open. */
export function configureNotifications() {
  if (!Notifications || Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  // The morning notification's "Listen now" button opens the app and starts playing.
  Notifications.setNotificationCategoryAsync(EDITION_CATEGORY, [
    { identifier: LISTEN_ACTION, buttonTitle: 'Listen now', options: { opensAppToForeground: true } },
  ]).catch(() => {});
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_EDITION, {
      name: 'Morning edition',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
    Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: 'Reading reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return false;
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Shows the system permission prompt (once). Returns whether it was granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export type PushRegistration =
  | { token: string }
  | { token: null; reason: 'web' | 'expo-go' | 'no-project' | 'denied' | 'error' };

/** Gets this device's Expo push token for the morning edition notification. */
export async function registerForPush(): Promise<PushRegistration> {
  if (Platform.OS === 'web') return { token: null, reason: 'web' };
  if (!Notifications) return { token: null, reason: 'expo-go' };
  if (!(await notificationsAllowed())) return { token: null, reason: 'denied' };
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
  if (!projectId) return { token: null, reason: 'no-project' };
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data };
  } catch {
    return { token: null, reason: 'error' };
  }
}

/** Next time at hh:mm, today if it's still ahead, else tomorrow. */
function nextAt(hour: number, minute: number, from = new Date()): Date {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  if (d <= from) d.setDate(d.getDate() + 1);
  return d;
}

/** Next Saturday at 10:00 (today if it's Saturday before 10). */
function nextSaturdayTen(from = new Date()): Date {
  const d = new Date(from);
  d.setHours(10, 0, 0, 0);
  const daysUntil = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntil);
  if (d <= from) d.setDate(d.getDate() + 7);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Re-plans the reading reminders from the current Reading List:
 * - Saturday 10am if anything is saved for "This weekend"
 * - 8pm if anything is saved for "Tonight"
 * Never more than one reminder on the same day.
 */
export async function syncReminders(items: SavedItem[], settings: Settings) {
  if (!Notifications || Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(ID_TONIGHT).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(ID_WEEKEND).catch(() => {});
  if (!(await notificationsAllowed())) return;

  const weekend = activeCount(items, 'weekend');
  const tonight = activeCount(items, 'tonight');
  const data: NotificationData = { kind: 'reminder' };

  let weekendAt: Date | null = null;
  if (settings.remindWeekend && weekend > 0) {
    weekendAt = nextSaturdayTen();
    await Notifications.scheduleNotificationAsync({
      identifier: ID_WEEKEND,
      content: {
        title: `You saved ${plural(weekend, 'story')} to read this weekend 📚`,
        body: 'Open your Reading List whenever you have a quiet moment.',
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: weekendAt,
        channelId: CHANNEL_REMINDERS,
      },
    });
  }

  if (settings.remindTonight && tonight > 0) {
    let at = nextAt(20, 0);
    // One reminder per day: if Saturday's weekend reminder is that day, use the next evening.
    if (weekendAt && sameDay(at, weekendAt)) at = nextAt(20, 0, new Date(at.getTime() + 60_000));
    await Notifications.scheduleNotificationAsync({
      identifier: ID_TONIGHT,
      content: {
        title: `${plural(tonight, 'story')} saved for tonight 🌙`,
        body: 'Your Reading List is ready when you are.',
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL_REMINDERS,
      },
    });
  }
}

/** For testing: a reminder in 5 seconds with the current counts. */
export async function sendTestReminder(items: SavedItem[]): Promise<boolean> {
  if (!Notifications || !(await requestNotificationPermission())) return false;
  const n = activeCount(items);
  await Notifications.scheduleNotificationAsync({
    identifier: ID_TEST,
    content: {
      title: n > 0 ? `You saved ${plural(n, 'story')} to read 📚` : 'Reminders are working 📚',
      body: 'This is a test reminder from Settings.',
      data: { kind: 'reminder' } satisfies NotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: CHANNEL_REMINDERS,
    },
  });
  return true;
}
