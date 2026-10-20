// User preferences (from the `devices` table), whose settings shape the shared world
// edition, and the "what should this tick do?" planner.

import { type LocalRegion, REGIONS, type Region } from './sources.ts';
import { TOPICS, type Topic } from './types.ts';

export type Prefs = {
  timezone: string;
  /** 'HH:MM', 24-hour, local time. */
  wakeTime: string;
  topics: Topic[];
  /**
   * Followed topics the reader wants more of ("More of this" in the app): more stories and
   * "Also happening" lines on them, and they come first. Always a subset of `topics`.
   */
  focusTopics: Topic[];
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
  focusTopics: [],
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
  /** Added in migration 20261011000000; missing on rows read before it. */
  focus_topics?: string[] | null;
  disabled_sources: string[] | null;
  morning_push: boolean | null;
  breaking_push?: string | null;
  /** Added in migration 20261020000000 (the reader's region, ownership, last morning push). */
  region?: string | null;
  is_owner?: boolean | null;
  morning_pushed_on?: string | null;
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

/** At most this many "more of this" topics count (the app allows 4; the database 6). */
export const MAX_FOCUS_TOPICS = 4;

const isTopic = (t: string): t is Topic => (TOPICS as string[]).includes(t);

/** Turns a device row into safe prefs (defaults fill gaps). */
export function normalizePrefs(row: DeviceRow | null | undefined): Prefs {
  if (!row) return { ...DEFAULT_PREFS, topics: [...DEFAULT_PREFS.topics], focusTopics: [] };
  const followed = (row.topics ?? []).filter(isTopic);
  const topics = followed.length ? followed : [...TOPICS];
  // Only topics the reader also follows, in the usual topic order, no repeats.
  const focusTopics = TOPICS.filter((t) => (row.focus_topics ?? []).includes(t) && topics.includes(t)).slice(0, MAX_FOCUS_TOPICS);
  return {
    timezone: validTimezone(row.timezone) ? row.timezone : DEFAULT_PREFS.timezone,
    wakeTime: row.wake_time && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.wake_time) ? row.wake_time : DEFAULT_PREFS.wakeTime,
    topics,
    focusTopics,
    disabledSources: row.disabled_sources ?? [],
    morningPush: row.morning_push ?? true,
    breakingPush: row.breaking_push === 'off' ? 'off' : 'major',
  };
}

/**
 * Every topic, most wanted first: the "more of this" topics, then the other followed ones,
 * then the rest. Today shows the reader's topics in this order too (the app's curation.ts).
 */
export function topicOrder(prefs: Pick<Prefs, 'topics' | 'focusTopics'>): Topic[] {
  const focus = TOPICS.filter((t) => prefs.focusTopics.includes(t));
  const followed = TOPICS.filter((t) => prefs.topics.includes(t) && !focus.includes(t));
  return [...focus, ...followed, ...TOPICS.filter((t) => !focus.includes(t) && !followed.includes(t))];
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

/**
 * The world edition is shared, so its settings are everyone's: the owner's timezone and
 * wake time (they time it), every active reader's followed topics, and the owner's starred
 * topics topped up to MAX_FOCUS_TOPICS with the ones other readers star most. Muted
 * outlets are no longer applied on the server (each phone hides its own).
 */
export function editionPrefs(owner: Prefs, others: Prefs[] = []): Prefs {
  const topics = TOPICS.filter((t) => owner.topics.includes(t) || others.some((o) => o.topics.includes(t)));
  const votes = new Map<Topic, number>();
  for (const o of others) for (const t of o.focusTopics) votes.set(t, (votes.get(t) ?? 0) + 1);
  const extra = TOPICS
    .filter((t) => !owner.focusTopics.includes(t) && (votes.get(t) ?? 0) > 0)
    .sort((a, b) => (votes.get(b) ?? 0) - (votes.get(a) ?? 0) || TOPICS.indexOf(a) - TOPICS.indexOf(b));
  const starred = [...owner.focusTopics, ...extra].slice(0, MAX_FOCUS_TOPICS);
  return { ...owner, topics, focusTopics: TOPICS.filter((t) => starred.includes(t)), disabledSources: [] };
}

// ─── Regions ───────────────────────────────────────────────────────────────

const CANADA_ZONES = new Set([
  'America/Toronto', 'America/Montreal', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax',
  'America/St_Johns', 'America/Regina', 'America/Swift_Current', 'America/Moncton', 'America/Glace_Bay', 'America/Goose_Bay',
  'America/Whitehorse', 'America/Dawson', 'America/Dawson_Creek', 'America/Creston', 'America/Fort_Nelson', 'America/Yellowknife',
  'America/Inuvik', 'America/Cambridge_Bay', 'America/Iqaluit', 'America/Pangnirtung', 'America/Rankin_Inlet', 'America/Resolute',
  'America/Atikokan', 'America/Blanc-Sablon', 'America/Nipigon', 'America/Thunder_Bay', 'America/Rainy_River',
]);
const US_ZONES = new Set([
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage',
  'America/Juneau', 'America/Sitka', 'America/Metlakatla', 'America/Yakutat', 'America/Nome', 'America/Adak', 'America/Boise',
  'America/Detroit', 'America/Menominee', 'America/Indianapolis', 'America/Louisville', 'America/Shiprock', 'Pacific/Honolulu',
]);

/** A reader's region from their timezone, for devices that haven't said (older apps). */
export function regionForTimezone(tz: string | null | undefined): Region {
  if (!tz) return 'WORLD';
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
  if (CANADA_ZONES.has(tz) || tz.startsWith('Canada/')) return 'CA';
  if (US_ZONES.has(tz) || /^America\/(Indiana|Kentucky|North_Dakota)\//.test(tz) || tz.startsWith('US/')) return 'US';
  if (tz === 'Europe/London' || tz === 'Europe/Belfast' || tz === 'GB') return 'UK';
  if (tz.startsWith('Australia/')) return 'AU';
  return 'WORLD';
}

const REGION_IDS = REGIONS.map((r) => r.id as string);

/** The local section a device reads: its chosen region, else its timezone's; null for world-only. */
export function readerRegion(row: Pick<DeviceRow, 'region' | 'timezone'>): LocalRegion | null {
  const region = row.region && REGION_IDS.includes(row.region) ? (row.region as Region) : regionForTimezone(row.timezone);
  return region === 'WORLD' ? null : region;
}

export function regionTimeZone(region: LocalRegion): string {
  return REGIONS.find((r) => r.id === region)?.timeZone ?? 'UTC';
}

/** A reader counts as active (gets a local section made) if their app saved its row this recently. */
export const ACTIVE_READER_DAYS = 14;

// ─── The tick planner ──────────────────────────────────────────────────────

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

export type RegionalRow = {
  date: string;
  region: string;
  status: 'generating' | 'ready' | 'error';
  started_at: string | null;
  attempts?: number | null;
};

/** Start generating this many minutes before wake time. */
export const GENERATE_LEAD_MIN = 30;
/** A 'generating' row older than this is assumed dead (function timed out). */
export const STALE_GENERATING_MIN = 10;
/** Wait this long before retrying after an error (avoids hammering the AI). */
export const ERROR_RETRY_MIN = 30;
/** Audio: give up after this many failed runs in a day (each run costs AI calls). */
export const MAX_AUDIO_ATTEMPTS = 3;
/** Regional sections: made from 05:00 local time; not started after 23:00; at most 3 tries. */
export const REGION_FROM_MIN = 5 * 60;
export const REGION_UNTIL_MIN = 23 * 60;
export const MAX_REGION_ATTEMPTS = 3;
/** A "Since this morning" check runs in the last 40 minutes before each region's 05:00… */
export const PRE_REGION_REFRESH_MIN = 40;
/** …and twice in the owner's day: 6 and 12 hours after they wake, if that's before 10pm. */
export const DAY_REFRESH_AFTER_WAKE_MIN = [6 * 60, 12 * 60];
export const DAY_REFRESH_WINDOW_MIN = 120;
export const UPDATES_UNTIL_MIN = 22 * 60;
/** No check right before a new world edition, or right after the last edition or check. */
const REFRESH_QUIET_BEFORE_EDITION_MIN = 90;
const REFRESH_QUIET_AFTER_MIN = 60;

export type PlanInput = {
  now: Date;
  /** The owner's settings: their timezone and wake time time the world edition. */
  owner: Prefs;
  /** The world edition row for the owner's local date. */
  world: BriefingRow | null;
  /** The latest ready world edition (daytime checks add to it). */
  latest: Pick<BriefingRow, 'date' | 'generated_at' | 'updates_checked_at'> | null;
  /** Regions with an active reader, each with its row for the region's local date (if any). */
  regions: { region: LocalRegion; row: RegionalRow | null }[];
  /** Scheduled slots already taken, as "date|slot". */
  taken: Set<string>;
};

export type TickPlan = {
  action: 'generate' | 'audio' | 'region' | 'refresh' | 'wait' | 'done';
  /** The owner's date for the world edition and its audio, the region's for its section, the slot's for a check. */
  date: string;
  reason: string;
  region?: LocalRegion;
  /** For a check: its slot ("refresh:pre-CA", "refresh:day-1") and the edition it adds to. */
  slot?: string;
  editionDate?: string;
  /** Set when the world edition isn't ready at the owner's wake time (the owner gets an alert). */
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

/** Why a regional section should be made now, or null. `busy` = one is being made right now. */
export function regionDue(row: RegionalRow | null, now: Date): { reason: string } | { busy: true } | null {
  if (!row) return { reason: 'no local section yet today' };
  if (row.status === 'ready') return null;
  if (row.status === 'generating') {
    return minutesSince(row.started_at, now) >= STALE_GENERATING_MIN ? { reason: 'previous run went stale' } : { busy: true };
  }
  if ((row.attempts ?? 0) < MAX_REGION_ATTEMPTS && minutesSince(row.started_at, now) >= ERROR_RETRY_MIN) return { reason: 'retrying after an error' };
  return null;
}

/**
 * Pure plan for one cron tick: at most one heavy AI job, the most urgent first:
 *   the world edition (from 30 min before the owner wakes) → its audio scripts
 *   → each active region's local section (from 05:00 there)
 *   → a "Since this morning" check (before each region's 05:00, and twice in the owner's day).
 * While one of these is being made, nothing else heavy starts. Morning pushes aren't
 * planned here: every tick sends the due ones first (cheap SQL, per reader).
 */
export function planTick(input: PlanInput): TickPlan {
  const { now, owner, world, latest, taken } = input;
  const { date, minutes } = localParts(now, owner.timezone);
  const wake = wakeMinutes(owner.wakeTime);
  const worldReady = world?.status === 'ready';
  const late = !worldReady && minutes >= wake ? { alert: 'late' as const } : {};

  // 1. The world edition.
  if (!worldReady && minutes >= wake - GENERATE_LEAD_MIN) {
    if (!world) return { action: 'generate', date, reason: 'no edition yet today', ...late };
    if (world.status === 'generating') {
      return minutesSince(world.started_at, now) >= STALE_GENERATING_MIN
        ? { action: 'generate', date, reason: 'previous run went stale', ...late }
        : { action: 'wait', date, reason: 'generation in progress', ...late };
    }
    if (minutesSince(world.started_at, now) >= ERROR_RETRY_MIN) return { action: 'generate', date, reason: 'retrying after an error', ...late };
    // A recent error: other work may run while the retry waits.
  }

  // 2. Its audio scripts.
  if (world && worldReady) {
    const audio = audioDue(world, now);
    if (audio) return { action: 'audio', date, reason: audio };
    if (world.audio_status === 'generating') return { action: 'wait', date, reason: 'audio in progress' };
  }

  // 3. Local sections, from 05:00 in each region.
  for (const { region, row } of input.regions) {
    const local = localParts(now, regionTimeZone(region));
    if (local.minutes < REGION_FROM_MIN || local.minutes >= REGION_UNTIL_MIN) continue;
    const due = regionDue(row && row.date === local.date ? row : null, now);
    if (!due) continue;
    if ('busy' in due) return { action: 'wait', date: local.date, region, reason: `${region} section in progress`, ...late };
    return { action: 'region', date: local.date, region, reason: due.reason, ...late };
  }

  // 4. "Since this morning" checks, added to the latest ready world edition.
  if (latest) {
    const lastActivity = Math.min(minutesSince(latest.generated_at, now), minutesSince(latest.updates_checked_at, now));
    const editionSoon = !worldReady && wake - GENERATE_LEAD_MIN - minutes <= REFRESH_QUIET_BEFORE_EDITION_MIN;
    if (lastActivity >= REFRESH_QUIET_AFTER_MIN && !editionSoon) {
      for (const { region } of input.regions) {
        const local = localParts(now, regionTimeZone(region));
        const slot = `refresh:pre-${region}`;
        if (local.minutes < REGION_FROM_MIN - PRE_REGION_REFRESH_MIN || local.minutes >= REGION_FROM_MIN) continue;
        if (taken.has(`${local.date}|${slot}`)) continue;
        return { action: 'refresh', date: local.date, slot, editionDate: latest.date, reason: `before the ${region} section`, ...late };
      }
    }
    if (worldReady && lastActivity >= REFRESH_QUIET_AFTER_MIN / 2) {
      for (const [i, after] of DAY_REFRESH_AFTER_WAKE_MIN.entries()) {
        const at = wake + after;
        const slot = `refresh:day-${i + 1}`;
        if (at >= UPDATES_UNTIL_MIN || minutes < at || minutes >= at + DAY_REFRESH_WINDOW_MIN) continue;
        if (taken.has(`${date}|${slot}`)) continue;
        return { action: 'refresh', date, slot, editionDate: latest.date, reason: 'daytime check' };
      }
    }
  }

  if (!worldReady) {
    return { action: 'wait', date, reason: minutes < wake - GENERATE_LEAD_MIN ? 'before the generation window' : 'recent error, waiting before retry', ...late };
  }
  return { action: 'done', date, reason: 'nothing due' };
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
