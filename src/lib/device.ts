import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { Platform } from 'react-native';

import { ApiError, backendConfigured, upsertDevice, type DevicePayload } from '@/data/api';
import type { Settings } from '@/state/settings';

const ID_KEY = 'brewsy:device-id';
const TOKEN_KEY = 'brewsy:push-token';

/** This phone's random id: the server knows a device by it (no accounts). */
export async function deviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(ID_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(ID_KEY, id);
  return id;
}

export function timeZone(): string {
  try {
    return getCalendars()[0]?.timeZone ?? 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export async function rememberPushToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** "05:30" */
export function wakeTimeString(s: Settings): string {
  return `${String(s.wakeTime.hour).padStart(2, '0')}:${String(s.wakeTime.minute).padStart(2, '0')}`;
}

/** Columns an older backend may not have yet: left out (one at a time) if the server rejects them. */
const OPTIONAL_COLUMNS = ['region', 'focus_topics'] as const;

/**
 * Sends this device's preferences to the backend, which uses them to decide which local section
 * to make, which topics get more stories, and when and where to push.
 */
export async function syncDevice(settings: Settings): Promise<void> {
  if (!backendConfigured) return;
  const payload: DevicePayload = {
    device_id: await deviceId(),
    push_token: await AsyncStorage.getItem(TOKEN_KEY),
    platform: Platform.OS,
    timezone: timeZone(),
    wake_time: wakeTimeString(settings),
    topics: settings.topics,
    focus_topics: settings.focusTopics.filter((t) => settings.topics.includes(t)),
    disabled_sources: settings.disabledOutlets,
    region: settings.region,
    morning_push: settings.morningPush,
    breaking_push: settings.breakingPush,
  };
  let body = payload;
  for (;;) {
    try {
      await upsertDevice(body);
      return;
    } catch (e) {
      // A backend from before the region or focus_topics column: save everything else rather than nothing.
      const missing =
        e instanceof ApiError &&
        OPTIONAL_COLUMNS.find((c) => body[c] !== undefined && new RegExp(`\\b${c}\\b`).test(e.message));
      if (!missing) throw e;
      body = { ...body, [missing]: undefined };
    }
  }
}
