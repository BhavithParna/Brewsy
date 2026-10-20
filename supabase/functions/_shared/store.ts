// Database operations used by the functions.

import { alsoToStory, findStory } from './briefing.ts';
import { count, eq, insert, insertIgnore, insertReturning, rpc, select, update, upsert } from './db.ts';
import { ACTIVE_READER_DAYS, type BriefingRow, type DeviceRow, normalizePrefs, type Prefs, type RegionalRow } from './prefs.ts';
import type { StoryContext } from './pipeline.ts';
import type { LocalRegion } from './sources.ts';
import type { Briefing, BriefingAudio, DeepDive, RegionalEdition, Story } from './types.ts';

const DEVICE_COLUMNS =
  'device_id,push_token,platform,timezone,wake_time,topics,focus_topics,disabled_sources,morning_push,breaking_push,region,is_owner,updated_at';

export type Readers = {
  /** The owner's device (the most recently saved one marked is_owner), else the latest-saved device. */
  owner: DeviceRow | null;
  /** Devices the app saved in the last ACTIVE_READER_DAYS days (the owner's included). */
  active: DeviceRow[];
};

export async function loadReaders(now = new Date()): Promise<Readers> {
  const since = new Date(now.getTime() - ACTIVE_READER_DAYS * 86_400_000).toISOString();
  const rows = await select<DeviceRow>(
    'devices',
    `select=${DEVICE_COLUMNS}&or=(is_owner.eq.true,updated_at.gte.${encodeURIComponent(since)})&order=updated_at.desc`,
  );
  const active = rows.filter((r) => Date.parse(r.updated_at) >= Date.parse(since));
  // Nobody marked as the owner: the latest-saved device leads, as before there were friends.
  const owner = rows.find((r) => r.is_owner) ?? rows[0] ??
    (await select<DeviceRow>('devices', `select=${DEVICE_COLUMNS}&order=updated_at.desc&limit=1`))[0] ?? null;
  return { owner, active };
}

/** The owner's prefs (the world edition's timing). */
export async function loadPrefs(): Promise<{ prefs: Prefs; device: DeviceRow | null }> {
  const { owner } = await loadReaders();
  return { prefs: normalizePrefs(owner), device: owner };
}

/**
 * Devices to notify: 'breaking' = breaking news on and 07:00–22:00 where the reader is,
 * 'alert' = the owner's devices (problems with the runs and the AI budget).
 */
export async function pushTokens(kind: 'breaking' | 'alert'): Promise<string[]> {
  if (kind === 'breaking') {
    const rows = await rpc<{ push_token: string }[]>('breaking_push_tokens');
    return [...new Set((rows ?? []).map((r) => r.push_token).filter(Boolean))];
  }
  const owners = await select<{ push_token: string }>('devices', 'select=push_token&push_token=not.is.null&is_owner=eq.true');
  const rows = owners.length
    ? owners
    : await select<{ push_token: string }>('devices', 'select=push_token&push_token=not.is.null&order=updated_at.desc&limit=1');
  return [...new Set(rows.map((r) => r.push_token).filter(Boolean))];
}

export type DueMorningPush = { device_id: string; push_token: string; edition_date: string; is_owner: boolean };

/** Devices whose morning push is due now, already stamped as sent for their local date. */
export async function claimMorningPushes(): Promise<DueMorningPush[]> {
  return (await rpc<DueMorningPush[]>('claim_due_morning_pushes')) ?? [];
}

export async function clearPushToken(token: string): Promise<void> {
  await update('devices', `push_token=${eq(token)}`, { push_token: null });
}

export async function getBriefingRow(date: string): Promise<BriefingRow | null> {
  const rows = await select<BriefingRow>(
    'briefings',
    `select=date,status,started_at,generated_at,pushed_at,audio_status,audio_started_at,audio_attempts,updates_checked_at,breaking_pushes&date=${eq(date)}`,
  );
  return rows[0] ?? null;
}

/**
 * Takes the generation "lock" for a date. Returns false if another run holds it.
 * Uses compare-and-set on (status, started_at), so two ticks can't both win.
 */
export async function claimGeneration(date: string, current: BriefingRow | null, force = false): Promise<boolean> {
  const now = new Date().toISOString();
  if (!current) {
    const rows = await insertIgnore<BriefingRow>('briefings', [{ date, status: 'generating', started_at: now }]);
    return rows.length > 0;
  }
  if (current.status === 'generating' && !force) {
    // Caller already decided it's stale; only replace the exact row we saw.
    const filter = `date=${eq(date)}&status=eq.generating&started_at=${current.started_at ? eq(current.started_at) : 'is.null'}`;
    return (await update('briefings', filter, { status: 'generating', started_at: now, error: null })).length > 0;
  }
  const filter = `date=${eq(date)}&status=${eq(current.status)}`;
  return (await update('briefings', filter, { status: 'generating', started_at: now, error: null })).length > 0;
}

export async function saveEdition(briefing: Briefing, contexts: StoryContext[]): Promise<void> {
  // Context first, so "Go deeper" works the moment the edition becomes visible.
  if (contexts.length) {
    await upsert(
      'story_context',
      contexts.map((c) => ({ date: briefing.date, story_id: c.story_id, sources: c.sources })),
      'date,story_id',
    );
  }
  // A new edition starts the day's extras over: its audio is made next, and
  // daytime updates are checked against this edition.
  await update('briefings', `date=${eq(briefing.date)}`, {
    status: 'ready',
    data: briefing,
    generated_at: briefing.generatedAt,
    error: null,
    audio: null,
    audio_status: null,
    audio_started_at: null,
    audio_error: null,
    audio_attempts: 0,
    updates: [],
    updates_checked_at: null,
  });
}

/**
 * Records a failed run. If the day already had an edition (a forced re-run
 * failed), that edition goes back to 'ready' so the app keeps showing it.
 */
export async function markError(date: string, message: string): Promise<void> {
  const error = message.slice(0, 1000);
  await update('briefings', `date=${eq(date)}&data=not.is.null`, { status: 'ready', error });
  await update('briefings', `date=${eq(date)}&data=is.null`, { status: 'error', error });
}

export async function loadBriefing(date: string): Promise<Briefing | null> {
  const rows = await select<{ data: Briefing }>('briefings', `select=data&date=${eq(date)}&status=eq.ready`);
  return rows[0]?.data ?? null;
}

export type Day = { briefing: Briefing; audio: BriefingAudio | null; updates: Story[] };

/** A ready edition with its audio and daytime updates (separate columns). */
export async function loadDay(date: string): Promise<Day | null> {
  const rows = await select<{ data: Briefing; audio: BriefingAudio | null; updates: Story[] | null }>(
    'briefings',
    `select=data,audio,updates&date=${eq(date)}&status=eq.ready`,
  );
  const row = rows[0];
  return row?.data ? { briefing: row.data, audio: row.audio ?? null, updates: row.updates ?? [] } : null;
}

/** The most recent ready edition before `date` (follow-ups to it rank lower). */
export async function loadPreviousBriefing(date: string): Promise<Briefing | null> {
  const rows = await select<{ data: Briefing }>('briefings', `select=data&status=eq.ready&date=lt.${encodeURIComponent(date)}&order=date.desc&limit=1`);
  return rows[0]?.data ?? null;
}

/** The latest ready world edition (daytime checks add to it; phones show it until the next one). */
export async function loadLatestReady(): Promise<Pick<BriefingRow, 'date' | 'generated_at' | 'updates_checked_at'> | null> {
  const rows = await select<Pick<BriefingRow, 'date' | 'generated_at' | 'updates_checked_at'>>(
    'briefings',
    'select=date,generated_at,updates_checked_at&status=eq.ready&order=date.desc&limit=1',
  );
  return rows[0] ?? null;
}

/**
 * Any story of a date: the world edition's main stories, daytime updates and "Also
 * happening" first, then the regional sections made for that date (ids like "ca-…").
 */
export async function loadStory(date: string, storyId: string): Promise<Story | null> {
  const day = await loadDay(date);
  const world = day ? findStory(day.briefing, day.updates, storyId) : null;
  return world ?? await loadRegionalStory(date, storyId);
}

export async function loadRegionalStory(date: string, storyId: string): Promise<Story | null> {
  const prefix = storyId.match(/^(in|ca|us|uk|au)-/)?.[1]?.toUpperCase();
  const rows = await select<{ region: string; data: RegionalEdition }>(
    'regional_editions',
    `select=region,data&date=${eq(date)}&status=eq.ready`,
  );
  // The region the id names first; any other after (ids are only unique within a section).
  const ordered = [...rows.filter((r) => r.region === prefix), ...rows.filter((r) => r.region !== prefix)];
  for (const r of ordered) {
    const main = r.data?.stories?.find((s) => s.id === storyId);
    if (main) return main;
    const also = r.data?.also?.find((a) => a.id === storyId);
    if (also) return alsoToStory(also);
  }
  return null;
}

// ─── Audio stage ───────────────────────────────────────────────────────────

/**
 * Takes the audio "lock" for a date (compare-and-set on what the caller saw).
 * Returns the claim time, which saveAudio must match: if a new edition replaced
 * this one meanwhile (it resets the audio columns), the old audio isn't saved.
 */
export async function claimAudio(date: string, current: BriefingRow, force = false): Promise<string | null> {
  const now = new Date().toISOString();
  let filter = `date=${eq(date)}&status=eq.ready`;
  if (!force) {
    filter += current.audio_status ? `&audio_status=${eq(current.audio_status)}` : '&audio_status=is.null';
    filter += current.audio_started_at ? `&audio_started_at=${eq(current.audio_started_at)}` : '&audio_started_at=is.null';
  }
  const rows = await update('briefings', filter, {
    audio_status: 'generating',
    audio_started_at: now,
    audio_attempts: (current.audio_attempts ?? 0) + 1,
    audio_error: null,
  });
  return rows.length ? now : null;
}

/**
 * Saves the audio. With `problem` set (some chapters failed text-to-speech) the
 * text-only version is still saved, so the app can read it aloud, and the row
 * is marked 'error' so a later tick tries the voice again.
 */
export async function saveAudio(date: string, claimedAt: string, audio: BriefingAudio, problem: string | null = null): Promise<boolean> {
  const rows = await update('briefings', `date=${eq(date)}&audio_started_at=${eq(claimedAt)}`, {
    audio,
    audio_status: problem ? 'error' : 'ready',
    audio_error: problem?.slice(0, 1000) ?? null,
  });
  return rows.length > 0;
}

export async function markAudioError(date: string, claimedAt: string, message: string): Promise<void> {
  await update('briefings', `date=${eq(date)}&audio_started_at=${eq(claimedAt)}`, { audio_status: 'error', audio_error: message.slice(0, 1000) });
}

// ─── Daytime updates ───────────────────────────────────────────────────────

/** Marks a daytime check of an edition as started. True for exactly one caller at a time. */
export async function claimUpdateCheck(date: string, current: BriefingRow): Promise<boolean> {
  const seen = current.updates_checked_at ? `updates_checked_at=${eq(current.updates_checked_at)}` : 'updates_checked_at=is.null';
  const rows = await update('briefings', `date=${eq(date)}&status=eq.ready&${seen}`, { updates_checked_at: new Date().toISOString() });
  return rows.length > 0;
}

/**
 * Puts new stories on top of the day's updates. Only if the edition is still
 * the one they were checked against (a forced re-run starts the list over).
 */
export async function appendUpdates(date: string, generatedAt: string, stories: Story[], contexts: StoryContext[]): Promise<boolean> {
  if (contexts.length) {
    await upsert('story_context', contexts.map((c) => ({ date, story_id: c.story_id, sources: c.sources })), 'date,story_id');
  }
  const rows = await select<{ updates: Story[] | null }>('briefings', `select=updates&date=${eq(date)}&generated_at=${eq(generatedAt)}`);
  if (!rows.length) return false;
  const updates = [...stories, ...(rows[0].updates ?? [])];
  return (await update('briefings', `date=${eq(date)}&generated_at=${eq(generatedAt)}`, { updates })).length > 0;
}

/** One of the day's breaking pushes. False once `max` were sent (or another run took this one). */
export async function claimBreakingPush(date: string, max: number): Promise<boolean> {
  const rows = await select<{ breaking_pushes: number | null }>('briefings', `select=breaking_pushes&date=${eq(date)}`);
  const n = rows[0]?.breaking_pushes ?? 0;
  if (!rows.length || n >= max) return false;
  return (await update('briefings', `date=${eq(date)}&breaking_pushes=eq.${n}`, { breaking_pushes: n + 1 })).length > 0;
}

// ─── Run log + alerts ──────────────────────────────────────────────────────

export type RunLog = {
  date: string;
  stage: 'edition' | 'audio' | 'update' | 'push' | 'region';
  ok: boolean;
  ms: number;
  feeds_ok?: number | null;
  feeds_total?: number | null;
  feeds_failed?: string[] | null;
  stats?: Record<string, unknown>;
  error?: string | null;
};

/** One row in pipeline_runs. Never throws: logging must not break a run. */
export async function logRun(run: RunLog): Promise<void> {
  try {
    await insert('pipeline_runs', [{ ...run, error: run.error?.slice(0, 2000) ?? null }]);
  } catch (e) {
    console.error(JSON.stringify({ event: 'log_run_failed', message: String(e) }));
  }
}

/** True once per (date, kind): so the owner gets each alert at most once a day. */
export async function claimAlert(date: string, kind: string, detail: string): Promise<boolean> {
  const rows = await insertIgnore('alerts', [{ date, kind, detail: detail.slice(0, 2000) }]);
  return rows.length > 0;
}

export async function loadStoryContext(date: string, storyId: string): Promise<StoryContext['sources']> {
  const rows = await select<{ sources: StoryContext['sources'] }>('story_context', `select=sources&date=${eq(date)}&story_id=${eq(storyId)}`);
  return rows[0]?.sources ?? [];
}

export async function getDeepDive(key: string): Promise<DeepDive | null> {
  const rows = await select<{ content: DeepDive }>('deep_dives', `select=content&story_key=${eq(key)}`);
  return rows[0]?.content ?? null;
}

export async function saveDeepDive(key: string, date: string, storyId: string, content: DeepDive): Promise<void> {
  await upsert('deep_dives', [{ story_key: key, date, story_id: storyId, content }]);
}

export async function logAsk(date: string, storyId: string, question: string, answered: boolean): Promise<void> {
  await insert('ask_log', [{ date, story_id: storyId, question, answered }]);
}

// ─── Regional sections ─────────────────────────────────────────────────────

/** Rows for each region's local date (one query). */
export async function getRegionalRows(wanted: { region: LocalRegion; date: string }[]): Promise<RegionalRow[]> {
  if (!wanted.length) return [];
  const dates = [...new Set(wanted.map((w) => w.date))].join(',');
  const rows = await select<RegionalRow>('regional_editions', `select=date,region,status,started_at,attempts&date=in.(${dates})`);
  return rows.filter((r) => wanted.some((w) => w.region === r.region && w.date === r.date));
}

/** Takes the lock for a region's section (compare-and-set on what the caller saw). */
export async function claimRegional(date: string, region: LocalRegion, current: RegionalRow | null, force = false): Promise<boolean> {
  const now = new Date().toISOString();
  if (!current) {
    const rows = await insertIgnore<RegionalRow>('regional_editions', [{ date, region, status: 'generating', started_at: now, attempts: 1 }]);
    return rows.length > 0;
  }
  let filter = `date=${eq(date)}&region=${eq(region)}`;
  if (!force) {
    filter += `&status=${eq(current.status)}`;
    filter += current.started_at ? `&started_at=${eq(current.started_at)}` : '&started_at=is.null';
  }
  const rows = await update('regional_editions', filter, { status: 'generating', started_at: now, error: null, attempts: (current.attempts ?? 0) + 1 });
  return rows.length > 0;
}

export async function saveRegional(edition: RegionalEdition, contexts: StoryContext[]): Promise<void> {
  // Context first, so Go deeper works the moment the section becomes visible.
  if (contexts.length) {
    await upsert('story_context', contexts.map((c) => ({ date: edition.date, story_id: c.story_id, sources: c.sources })), 'date,story_id');
  }
  await update('regional_editions', `date=${eq(edition.date)}&region=${eq(edition.region)}`, {
    status: 'ready',
    data: edition,
    generated_at: edition.generatedAt,
    error: null,
  });
}

/** A failed run. A section that was already made stays up (a forced re-run failed). */
export async function markRegionalError(date: string, region: LocalRegion, message: string): Promise<void> {
  const error = message.slice(0, 1000);
  await update('regional_editions', `date=${eq(date)}&region=${eq(region)}&data=not.is.null`, { status: 'ready', error });
  await update('regional_editions', `date=${eq(date)}&region=${eq(region)}&data=is.null`, { status: 'error', error });
}

// ─── Scheduled slots ───────────────────────────────────────────────────────

/** Slots already taken on these dates, as "date|slot". */
export async function takenSlots(dates: string[]): Promise<Set<string>> {
  const list = [...new Set(dates)];
  if (!list.length) return new Set();
  const rows = await select<{ date: string; slot: string }>('schedule_runs', `select=date,slot&date=in.(${list.join(',')})`);
  return new Set(rows.map((r) => `${r.date}|${r.slot}`));
}

/** True for exactly one caller per (date, slot). */
export async function claimSlot(date: string, slot: string): Promise<boolean> {
  const rows = await insertIgnore('schedule_runs', [{ date, slot, status: 'running' }]);
  return rows.length > 0;
}

export async function finishSlot(date: string, slot: string, ok: boolean, error?: string): Promise<void> {
  await update('schedule_runs', `date=${eq(date)}&slot=${eq(slot)}`, {
    status: ok ? 'done' : 'error',
    finished_at: new Date().toISOString(),
    error: error?.slice(0, 1000) ?? null,
  }).catch(() => {});
}

// ─── Ask and Go deeper caps ────────────────────────────────────────────────

export type AiRequestKind = 'ask' | 'deeper';

/** The device id from the request, if it's a device we know (older apps don't send one). */
export async function knownDevice(id: string | null): Promise<string | null> {
  if (!id || !/^[A-Za-z0-9-]{8,128}$/.test(id)) return null;
  const rows = await select<{ device_id: string }>('devices', `select=device_id&device_id=${eq(id)}&limit=1`);
  return rows.length ? id : null;
}

/** Requests in the last 24 hours: this device's (or the shared no-device bucket's) and everyone's. */
export async function countRequests(kind: AiRequestKind, deviceId: string | null): Promise<{ mine: number; total: number }> {
  const since = `created_at=gte.${encodeURIComponent(new Date(Date.now() - 24 * 3_600_000).toISOString())}`;
  const who = deviceId ? `device_id=${eq(deviceId)}` : 'device_id=is.null';
  const [mine, total] = await Promise.all([
    count('ai_requests', `kind=eq.${kind}&${who}&${since}`),
    count('ai_requests', `kind=eq.${kind}&${since}`),
  ]);
  return { mine, total };
}

/** Logged before the AI call, so failed calls count too. Returns the row id. */
export async function logRequest(kind: AiRequestKind, deviceId: string | null, date: string, storyId: string): Promise<number | null> {
  const rows = await insertReturning<{ id: number }>('ai_requests', [{ kind, device_id: deviceId, date, story_id: storyId }]);
  return rows[0]?.id ?? null;
}

export async function finishRequest(id: number | null, ok: boolean, provider: string | null): Promise<void> {
  if (id == null) return;
  await update('ai_requests', `id=eq.${id}`, { ok, provider }).catch(() => {});
}
