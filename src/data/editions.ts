import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  backendConfigured,
  fetchEditionDates,
  fetchEditionRemote,
  fetchRegionalEdition,
  fetchRegionalEditionsSince,
} from './api';
import mockBriefing from './mock-briefing.json';
import type { Briefing, RegionalEdition } from './types';
import { sampleRegional } from '@/dev/devEditions';
import { settingsStore } from '@/state/settings';

const PREFIX = 'brewsy:edition:';
const INDEX_KEY = 'brewsy:edition-index';
/** How many editions to keep on the device. */
const KEEP = 10;
/**
 * When today's edition isn't made yet, Today shows the latest one from up to this many days
 * before (an Australian reader at 7 am sees yesterday's until the new one is made).
 */
const RECENT_DAYS = 2;

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
  const b: Briefing = { ...(mockBriefing as Briefing), date };
  const region = settingsStore.get().region;
  const local = __DEV__ && region !== 'WORLD' ? sampleRegional(date, region) : null;
  return local ? { ...b, regional: local } : b;
}

// ─── The local section ────────────────────────────────────────────────────────

/**
 * The reader's local section for a date: null when there's none (or they chose world news only),
 * undefined when it couldn't be checked (offline).
 */
export async function regionalFor(date: string): Promise<RegionalEdition | null | undefined> {
  const region = settingsStore.get().region;
  if (region === 'WORLD') return null;
  if (__DEV__) {
    const sample = sampleRegional(date, region);
    if (sample) return sample;
  }
  if (!backendConfigured) return null;
  try {
    return await fetchRegionalEdition(date, region);
  } catch {
    return undefined;
  }
}

/**
 * The world edition with the reader's local section for that date. When the section couldn't be
 * checked, the one in `saved` stays (if it's still the reader's region).
 */
function withRegional(b: Briefing, regional: RegionalEdition | null | undefined, saved?: Briefing | null): Briefing {
  const kept = saved?.regional?.region === settingsStore.get().region ? saved.regional : null;
  return { ...b, regional: regional === undefined ? kept : regional };
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
  const [remote, regional] = await Promise.all([fetchEditionRemote(date), regionalFor(date)]);
  if (!remote) return null;
  const b = withRegional(remote, regional, regional === undefined ? await readCachedEdition(date) : null);
  await writeCachedEdition(b);
  return b;
}

/**
 * The newest edition from the few days before `date` (see RECENT_DAYS), for when `date` has none
 * yet. From the server when it answers, else (or when `offline`) from the copies on this phone.
 */
export async function latestEditionBefore(
  date: string,
  { offline = false }: { offline?: boolean } = {},
): Promise<{ briefing: Briefing; offline: boolean } | null> {
  const oldest = shiftDate(date, -RECENT_DAYS);
  const recent = (d: string) => d < date && d >= oldest;
  if (backendConfigured && !offline) {
    try {
      const found = (await fetchEditionDates(RECENT_DAYS + 3)).find(recent);
      const b = found ? await fetchAndCacheEdition(found) : null;
      return b ? { briefing: b, offline: false } : null;
    } catch {
      // Offline: look on the phone.
    }
  }
  for (const d of (await cachedEditionDates()).filter(recent)) {
    const b = await readCachedEdition(d);
    if (b) return { briefing: b, offline: backendConfigured };
  }
  return null;
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

// ─── Search and "Earlier in Brewsy" ─────────────────────────────────────────

/**
 * Editions fetched for search this session. Kept in memory only, so searching never pushes the
 * editions saved for offline reading out of the device cache.
 */
const sessionEditions = new Map<string, Briefing>();

/** Every edition this phone has at hand: the offline copies plus what search fetched this session. */
export async function editionsAtHand(): Promise<Briefing[]> {
  const dates = await cachedEditionDates();
  const saved = await Promise.all(dates.map((d) => sessionEditions.get(d) ?? readCachedEdition(d)));
  const byDate = new Map<string, Briefing>();
  for (const b of saved) if (b) byDate.set(b.date, b);
  for (const [d, b] of sessionEditions) if (!byDate.has(d)) byDate.set(d, b);
  const sample = sampleFor(todayKey());
  if (sample && !byDate.has(sample.date)) byDate.set(sample.date, sample);
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Loads the editions from the last `days` days for search, calling `onEdition` as each arrives:
 * saved copies first (instant, and all there is offline), then the rest from the server.
 * Resolves with `offline: true` when the server couldn't be reached.
 */
export async function loadRecentEditions(
  days: number,
  onEdition: (b: Briefing) => void,
): Promise<{ offline: boolean }> {
  const today = todayKey();
  const oldest = shiftDate(today, -(days - 1));
  const have = new Set<string>();
  const emit = (b: Briefing) => {
    have.add(b.date);
    onEdition(b);
  };

  const saved = new Map<string, Briefing>();
  for (const b of await editionsAtHand()) {
    if (b.date < oldest || b.date > today) continue;
    saved.set(b.date, b);
    emit(b);
  }
  if (!backendConfigured) return { offline: false };

  let dates: string[];
  try {
    dates = (await fetchEditionDates(days + 2)).filter((d) => d >= oldest && d <= today);
  } catch {
    return { offline: true };
  }
  // Today's saved copy may predate the daytime updates, so it's fetched again.
  const missing = dates.filter((d) => !have.has(d) || (d === today && !sessionEditions.has(d)));
  let failed = false;
  // The reader's local sections for the whole range, in one request.
  const region = settingsStore.get().region;
  const local = new Map<string, RegionalEdition>();
  if (region !== 'WORLD' && missing.length) {
    for (const r of await fetchRegionalEditionsSince(region, oldest).catch(() => [])) local.set(r.date, r);
  }
  // A few at a time, newest first.
  for (let i = 0; i < missing.length; i += 4) {
    const batch = await Promise.all(
      missing.slice(i, i + 4).map((d) =>
        fetchEditionRemote(d).catch(() => {
          failed = true;
          return null;
        }),
      ),
    );
    for (const remote of batch) {
      if (!remote) continue;
      const b = { ...remote, regional: local.get(remote.date) ?? saved.get(remote.date)?.regional ?? null };
      sessionEditions.set(b.date, b);
      emit(b);
    }
  }
  return { offline: failed && have.size === 0 };
}
