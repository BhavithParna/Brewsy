import type { AskAnswer, Briefing, DeepDive, RegionalEdition } from './types';
import { REGIONS, type LocalRegion } from '../../supabase/functions/_shared/sources';

// Set these in `.env` (see .env.example). Until they exist the app uses the
// bundled sample edition and "Go deeper" explains how to connect the backend.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SUPABASE_KEY ?? '',
    'Content-Type': 'application/json',
    ...extra,
  };
  // Legacy "anon" keys are JWTs and also go in Authorization. New publishable keys don't.
  if (SUPABASE_KEY?.startsWith('eyJ')) h.Authorization = `Bearer ${SUPABASE_KEY}`;
  return h;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  if (!backendConfigured) throw new ApiError('The backend is not set up yet.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: headers(init.headers as Record<string, string> | undefined),
      signal: controller.signal,
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON (a gateway error page): the status says enough.
    }
    if (!res.ok) {
      throw new ApiError(body?.error ?? body?.message ?? `Request failed (${res.status})`, res.status);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError('The server took too long to answer.');
    throw new ApiError("Couldn't reach the server. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

type BriefingRow = { data: Briefing; audio: Briefing['audio']; updates: Briefing['sinceThisMorning'] | null };

/**
 * The edition for one date, or null if none was made that day.
 * Audio and the daytime updates live in their own columns (they're added after the edition).
 */
export async function fetchEditionRemote(date: string): Promise<Briefing | null> {
  const rows = await request<BriefingRow[]>(
    `/rest/v1/briefings?select=data,audio,updates&date=eq.${date}&status=eq.ready`,
  );
  const row = rows[0];
  if (!row?.data) return null;
  return { ...row.data, audio: row.audio ?? null, sinceThisMorning: row.updates ?? [] };
}

/** Dates of the most recent editions, newest first. */
export async function fetchEditionDates(limit = 30): Promise<string[]> {
  const rows = await request<{ date: string }[]>(
    `/rest/v1/briefings?select=date&status=eq.ready&order=date.desc&limit=${limit}`,
  );
  return rows.map((r) => r.date);
}

/**
 * The reader's local section for one date, or null when there isn't one. A backend from before
 * local sections has no such table (404): that's "none" too, not an error.
 */
export async function fetchRegionalEdition(date: string, region: LocalRegion): Promise<RegionalEdition | null> {
  let rows: { data: RegionalEdition | null }[];
  try {
    rows = await request(
      `/rest/v1/regional_editions?date=eq.${date}&region=eq.${region}&status=eq.ready&select=data`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status != null && e.status < 500) return null;
    throw e;
  }
  return cleanRegional(rows[0]?.data, region, date);
}

/** The reader's local sections from `oldest` on (for search), oldest backends giving none. */
export async function fetchRegionalEditionsSince(region: LocalRegion, oldest: string): Promise<RegionalEdition[]> {
  let rows: { date: string; data: RegionalEdition | null }[];
  try {
    rows = await request(
      `/rest/v1/regional_editions?date=gte.${oldest}&region=eq.${region}&status=eq.ready&select=date,data`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status != null && e.status < 500) return [];
    throw e;
  }
  return rows.flatMap((r) => cleanRegional(r.data, region, r.date) ?? []);
}

/** Whatever the row holds, the screen gets lists it can map over. */
function cleanRegional(d: RegionalEdition | null | undefined, region: LocalRegion, date: string): RegionalEdition | null {
  if (!d || typeof d !== 'object') return null;
  return {
    ...d,
    region,
    // The row's date is what the server looks stories up by (Go deeper, Ask).
    date,
    label: d.label || (REGIONS.find((r) => r.id === region)?.label ?? region),
    stories: Array.isArray(d.stories) ? d.stories : [],
    also: Array.isArray(d.also) ? d.also : [],
  };
}

const deviceHeader = (id?: string): Record<string, string> => (id ? { 'x-device-id': id } : {});

/**
 * Go deeper and Ask send the device id: the server keeps a daily allowance per device. Over it,
 * the server answers 429 with a friendly `error`, which the screen shows as it is.
 * Local-section stories pass their own section's date (RegionalEdition.date).
 */
export async function fetchDeepDive(date: string, storyId: string, deviceId?: string): Promise<DeepDive> {
  const res = await request<{ deepDive: DeepDive; cached: boolean }>(
    '/functions/v1/go-deeper',
    { method: 'POST', headers: deviceHeader(deviceId), body: JSON.stringify({ date, storyId }) },
    90000,
  );
  return res.deepDive;
}

export async function askAboutStory(
  date: string,
  storyId: string,
  question: string,
  deviceId?: string,
): Promise<AskAnswer> {
  return request<AskAnswer>(
    '/functions/v1/ask',
    { method: 'POST', headers: deviceHeader(deviceId), body: JSON.stringify({ date, storyId, question }) },
    60000,
  );
}

export type DevicePayload = {
  device_id: string;
  push_token: string | null;
  platform: string;
  timezone: string;
  wake_time: string;
  topics: string[];
  /** Followed topics the reader wants more of (at most 4; a subset of `topics`). Left out for older backends. */
  focus_topics?: string[];
  disabled_sources: string[];
  /** Where the reader's local section comes from (a Region code). Left out for older backends. */
  region?: string;
  morning_push: boolean;
  /** 'off' | 'major': breaking-news pushes (at most 2 a day). */
  breaking_push: 'off' | 'major';
  /** The theme in use, for the owner's usage view. Left out for older backends. */
  theme?: string;
  /** appVersion(): which update the phone runs. Left out for older backends. */
  app_version?: string;
};

/** Tells the backend this device's preferences (and push token, if any). */
export async function upsertDevice(payload: DevicePayload): Promise<void> {
  await request<null>('/rest/v1/devices?on_conflict=device_id', {
    method: 'POST',
    // The database only lets a device write the row whose id matches this header.
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal', 'x-device-id': payload.device_id },
    body: JSON.stringify(payload),
  });
}

export type FeedbackKind = 'idea' | 'problem' | 'praise' | 'other';

export type FeedbackPayload = {
  device_id: string;
  kind: FeedbackKind;
  message: string;
  name: string | null;
  theme: string;
  platform: string;
  app_version: string;
};

/** Settings → Feedback. Readers can send it but never read it back; only the owner's paired phone can. */
export async function sendFeedback(payload: FeedbackPayload): Promise<void> {
  await request<null>('/rest/v1/feedback', {
    method: 'POST',
    headers: { Prefer: 'return=minimal', 'x-device-id': payload.device_id },
    body: JSON.stringify(payload),
  });
}

/** One local day of use, as totals so far that day (the server keeps the larger of each count). */
export type UsageDay = {
  p_day: string;
  p_opens: number;
  p_theme: string;
  p_topics: string[];
  /** Stories opened (Learn more, read aloud, shared), by topic. */
  p_opened: Record<string, number>;
  p_listens: number;
  p_saves: number;
  p_shares: number;
  p_app_version: string;
};

export async function logUsage(deviceId: string, day: UsageDay): Promise<void> {
  await request<null>('/rest/v1/rpc/brewsy_log_usage', {
    method: 'POST',
    headers: deviceHeader(deviceId),
    body: JSON.stringify(day),
  });
}

/** The owner's calls: this phone's id and its owner key, which the server checks against the paired keys. */
export type OwnerAuth = { deviceId: string; key: string };

const ownerHeaders = (auth: OwnerAuth): Record<string, string> => ({ 'x-device-id': auth.deviceId, 'x-owner-key': auth.key });

/**
 * Asks to pair this phone as the owner's. Returns the code to approve in the Supabase dashboard,
 * 'paired' once approved, or null if the server doesn't know this phone yet.
 */
export async function askOwnerPairing(deviceId: string, keyHash: string): Promise<string | null> {
  return request<string | null>('/rest/v1/rpc/brewsy_owner_ask', {
    method: 'POST',
    headers: deviceHeader(deviceId),
    body: JSON.stringify({ p_key_hash: keyHash }),
  });
}

/** Whether this phone is paired as the owner's (approved in the dashboard, never by the app). */
export async function fetchIsOwner(auth: OwnerAuth): Promise<boolean> {
  return (await request<boolean | null>('/rest/v1/rpc/brewsy_is_owner', { method: 'POST', headers: ownerHeaders(auth) })) === true;
}

export type FeedbackEntry = {
  id: number;
  created_at: string;
  kind: FeedbackKind;
  message: string;
  name: string | null;
  theme: string | null;
  platform: string | null;
  app_version: string | null;
  seen: boolean;
};

/** The owner's inbox, newest first (empty for anyone else). */
export async function fetchOwnerFeedback(auth: OwnerAuth): Promise<FeedbackEntry[]> {
  const rows = await request<FeedbackEntry[] | null>('/rest/v1/rpc/brewsy_owner_feedback', {
    method: 'POST',
    headers: ownerHeaders(auth),
    body: JSON.stringify({ p_limit: 300 }),
  });
  return Array.isArray(rows) ? rows : [];
}

export async function markFeedbackSeen(auth: OwnerAuth, ids: number[]): Promise<void> {
  if (!ids.length) return;
  await request<null>('/rest/v1/rpc/brewsy_owner_mark_feedback_seen', {
    method: 'POST',
    headers: ownerHeaders(auth),
    body: JSON.stringify({ p_ids: ids }),
  });
}

type Count = { name: string; n: number };

export type OwnerStats = {
  generated_at: string;
  installs: number;
  push_ok: number;
  seen_7d: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  totals_30d: { opens: number; listens: number; saves: number; shares: number; stories_opened: number };
  daily: { day: string; phones: number; opens: number }[];
  themes: Count[];
  topics_seen: Count[];
  topics_opened: Count[];
  topics_followed: Count[];
  regions: Count[];
  versions: Count[];
  platforms: Count[];
  feedback_new: number;
  feedback_total: number;
};

/** The owner's usage summary, or null for anyone else. */
export async function fetchOwnerStats(auth: OwnerAuth): Promise<OwnerStats | null> {
  return request<OwnerStats | null>('/rest/v1/rpc/brewsy_owner_stats', { method: 'POST', headers: ownerHeaders(auth) });
}
