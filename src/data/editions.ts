import AsyncStorage from '@react-native-async-storage/async-storage';

import { backendConfigured, fetchEditionDates, fetchEditionRemote } from './api';
import mockBriefing from './mock-briefing.json';
import type { Briefing } from './types';

const PREFIX = 'brewsy:edition:';
const INDEX_KEY = 'brewsy:edition-index';
/** How many editions to keep on the device. */
const KEEP = 10;

/** Local date as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

/** The date `days` before (negative) or after (positive) a YYYY-MM-DD date. */
export function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

export function yesterdayKey(): string {
  return shiftDate(todayKey(), -1);
}

/** The bundled sample stands in for "today" until the backend exists. */
function sampleFor(date: string): Briefing | null {
  if (backendConfigured || date !== todayKey()) return null;
  return { ...(mockBriefing as Briefing), date };
}

export async function readCachedEdition(date: string): Promise<Briefing | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + date);
    return raw ? (JSON.parse(raw) as Briefing) : null;
  } catch {
    return null;
  }
}

async function writeCachedEdition(b: Briefing) {
  try {
    await AsyncStorage.setItem(PREFIX + b.date, JSON.stringify(b));
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const dates: string[] = raw ? JSON.parse(raw) : [];
    const next = [b.date, ...dates.filter((d) => d !== b.date)].sort().reverse();
    const drop = next.slice(KEEP);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next.slice(0, KEEP)));
    if (drop.length) await AsyncStorage.multiRemove(drop.map((d) => PREFIX + d));
  } catch {
    // Storage full or unavailable: the app still works, just without offline copies.
  }
}

/** Dates of editions saved on this device, newest first. */
export async function cachedEditionDates(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Downloads an edition and stores it on the device.
 * Returns null when there's no edition for that date.
 */
export async function fetchAndCacheEdition(date: string): Promise<Briefing | null> {
  const sample = sampleFor(date);
  if (sample) return sample;
  if (!backendConfigured) return null;
  const remote = await fetchEditionRemote(date);
  if (remote) await writeCachedEdition(remote);
  return remote;
}

/** Past editions to offer in the calendar: from the server when possible, else this device. */
export async function availableEditionDates(): Promise<string[]> {
  const local = await cachedEditionDates();
  const sample = sampleFor(todayKey()) ? [todayKey()] : [];
  if (!backendConfigured) return [...new Set([...sample, ...local])];
  try {
    const remote = await fetchEditionDates();
    return [...new Set([...remote, ...local])].sort().reverse();
  } catch {
    return local;
  }
}
