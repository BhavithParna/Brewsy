// User preferences (from the `devices` table) and the "should we act now?" logic.

import { TOPICS, type Topic } from './types.ts';

export type Prefs = {
  timezone: string;
  /** 'HH:MM', 24-hour, local time. */
  wakeTime: string;
  topics: Topic[];
  /** Outlet names (see sources.ts) to skip. */
  disabledSources: string[];
  morningPush: boolean;
  /** Breaking-news pushes during the day: 'off' or 'major' (genuinely major only, max 2 a day). */
  breakingPush: 'off' | 'major';
};

export const DEFAULT_PREFS: Prefs = {
  timezone: 'Asia/Kolkata',
  wakeTime: '05:30',
  topics: [...TOPICS],
  disabledSources: [],
  morningPush: true,
  breakingPush: 'major',
};

export type DeviceRow = {
  device_id: string;
  push_token: string | null;
  platform: string | null;
  timezone: string | null;
  wake_time: string | null;
  topics: string[] | null;
  disabled_sources: string[] | null;
  morning_push: boolean | null;
  breaking_push?: string | null;
  updated_at: string;
};

function validTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Turns the most recently updated device row into safe prefs (defaults fill gaps). */
export function normalizePrefs(row: DeviceRow | null | undefined): Prefs {
  if (!row) return { ...DEFAULT_PREFS, topics: [...DEFAULT_PREFS.topics] };
  const topics = (row.topics ?? []).filter((t): t is Topic => (TOPICS as string[]).includes(t));
  return {
    timezone: validTimezone(row.timezone) ? row.timezone : DEFAULT_PREFS.timezone,
    wakeTime: row.wake_time && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.wake_time) ? row.wake_time : DEFAULT_PREFS.wakeTime,
    topics: topics.length ? topics : [...TOPICS],
    disabledSources: row.disabled_sources ?? [],
    morningPush: row.morning_push ?? true,
    breakingPush: row.breaking_push === 'off' ? 'off' : 'major',
  };
}

/** Local calendar date (YYYY-MM-DD) and minutes since local midnight. */
export function localParts(now: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function wakeMinutes(wakeTime: string): number {
  const [h, m] = wakeTime.split(':').map(Number);
  return h * 60 + m;
}

export type BriefingRow = {
  date: string;
  status: 'generating' | 'ready' | 'error';
  started_at: string | null;
  generated_at: string | null;
  pushed_at: string | null;
  // Audio stage (made a few minutes after the edition).
  audio_status?: 'generating' | 'ready' | 'error' | null;
  audio_started_at?: string | null;
  audio_attempts?: number | null;
  // Daytime "Since this morning" checks.
  updates_checked_at?: string | null;
  breaking_pushes?: number | null;
};

/** Start generating this many minutes before wake time. */
export const GENERATE_LEAD_MIN = 30;
/** A 'generating' row older than this is assumed dead (function timed out). */
export const STALE_GENERATING_MIN = 10;
/** Wait this long before retrying after an error (avoids hammering the AI). */
export const ERROR_RETRY_MIN = 30;
/** Audio: give up after this many failed runs in a day (each run costs AI + TTS). */
export const MAX_AUDIO_ATTEMPTS = 3;
/** Daytime checks: from 7am to 10pm local time, every 2 hours. */
export const UPDATES_FROM_MIN = 7 * 60;
export const UPDATES_UNTIL_MIN = 22 * 60;
export const UPDATES_EVERY_MIN = 120;
/** Ticks run every 10 min; this slack keeps "every 2 hours" from drifting to 2h10. */
const TICK_SLACK_MIN = 6;

export type TickDecision = {
  action: 'generate' | 'push' | 'audio' | 'update' | 'wait' | 'done';
  date: string;
  reason: string;
  /** Set when the morning edition isn't ready at wake time (the owner gets an alert). */
  alert?: 'late';
};

function minutesSince(iso: string | null | undefined, now: Date): number {
  return iso ? (now.getTime() - Date.parse(iso)) / 60_000 : Infinity;
}

export function audioDue(row: BriefingRow, now: Date): string | null {
  const status = row.audio_status ?? null;
  if (status === null) return 'edition ready, no audio yet';
  if (status === 'generating') return minutesSince(row.audio_started_at, now) >= STALE_GENERATING_MIN ? 'audio run went stale' : null;
  if (status === 'error' && (row.audio_attempts ?? 0) < MAX_AUDIO_ATTEMPTS && minutesSince(row.audio_started_at, now) >= ERROR_RETRY_MIN) {
    return 'retrying audio after an error';
  }
  return null;
}

export function updateDue(row: BriefingRow, now: Date, minutes: number): string | null {
  if (minutes < UPDATES_FROM_MIN || minutes > UPDATES_UNTIL_MIN) return null;
  return minutesSince(row.updates_checked_at, now) >= UPDATES_EVERY_MIN - TICK_SLACK_MIN ? 'time for a daytime check' : null;
}

/**
 * Pure decision for one cron tick. At most one heavy action per tick, in this
 * order: write the edition → morning push → audio → daytime check.
 */
export function decideTick(now: Date, prefs: Prefs, row: BriefingRow | null): TickDecision {
  const { date, minutes } = localParts(now, prefs.timezone);
  const wake = wakeMinutes(prefs.wakeTime);

  if (!row || row.status !== 'ready') {
    const alert = minutes >= wake ? { alert: 'late' as const } : {};
    if (minutes < wake - GENERATE_LEAD_MIN) return { action: 'wait', date, reason: 'before the generation window' };
    if (!row) return { action: 'generate', date, reason: 'no edition yet today', ...alert };
    if (row.status === 'generating') {
      return minutesSince(row.started_at, now) >= STALE_GENERATING_MIN
        ? { action: 'generate', date, reason: 'previous run went stale', ...alert }
        : { action: 'wait', date, reason: 'generation in progress', ...alert };
    }
    return minutesSince(row.started_at, now) >= ERROR_RETRY_MIN
      ? { action: 'generate', date, reason: 'retrying after an error', ...alert }
      : { action: 'wait', date, reason: 'recent error, waiting before retry', ...alert };
  }

  if (!row.pushed_at && prefs.morningPush && minutes >= wake) return { action: 'push', date, reason: 'ready and past wake time' };
  const audio = audioDue(row, now);
  if (audio) return { action: 'audio', date, reason: audio };
  const update = updateDue(row, now, minutes);
  if (update) return { action: 'update', date, reason: update };
  if (!row.pushed_at && prefs.morningPush) return { action: 'wait', date, reason: 'ready, waiting for wake time' };
  return { action: 'done', date, reason: row.pushed_at ? 'already pushed' : 'morning push is off' };
}

/** Words → minutes, the same formula the app uses for "about N min". */
export function editionMinutes(edition: { summary: string[]; stories: { headline: string; whatHappened: string; whyItMatters: string }[] }): number {
  const words = (s: string) => (s.trim().match(/\S+/g) ?? []).length;
  const total = edition.stories.reduce(
    (n, s) => n + words(`${s.headline} ${s.whatHappened} ${s.whyItMatters}`),
    words(edition.summary.join(' ')),
  );
  return Math.max(1, Math.round(total / 200));
}
