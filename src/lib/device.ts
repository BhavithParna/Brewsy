import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { Platform } from 'react-native';

import { backendConfigured, upsertDevice } from '@/data/api';
import type { Settings } from '@/state/settings';

const ID_KEY = 'brewsy:device-id';
const TOKEN_KEY = 'brewsy:push-token';

async function deviceId(): Promise<string> {
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

/**
 * Sends this device's preferences to the backend, which uses them to decide
 * when to make the edition, which topics and sources to use, and where to push.
 */
export async function syncDevice(settings: Settings): Promise<void> {
  if (!backendConfigured) return;
  await upsertDevice({
    device_id: await deviceId(),
    push_token: await AsyncStorage.getItem(TOKEN_KEY),
    platform: Platform.OS,
    timezone: timeZone(),
    wake_time: wakeTimeString(settings),
    topics: settings.topics,
    disabled_sources: settings.disabledOutlets,
    morning_push: settings.morningPush,
    breaking_push: settings.breakingPush,
  });
}
