// Database operations used by the functions.

import { findStory } from './briefing.ts';
import { eq, insert, insertIgnore, select, update, upsert } from './db.ts';
import { type BriefingRow, type DeviceRow, normalizePrefs, type Prefs } from './prefs.ts';
import type { StoryContext } from './pipeline.ts';
import type { Briefing, BriefingAudio, DeepDive, Story } from './types.ts';

export async function loadPrefs(): Promise<{ prefs: Prefs; device: DeviceRow | null }> {
  const rows = await select<DeviceRow>('devices', 'select=*&order=updated_at.desc&limit=1');
  return { prefs: normalizePrefs(rows[0]), device: rows[0] ?? null };
}

/**
 * Devices to notify: 'edition' = morning push on, 'breaking' = breaking-news
 * pushes on, 'alert' = every device (problems with the morning run).
 */
export async function pushTokens(kind: 'edition' | 'breaking' | 'alert' = 'edition'): Promise<string[]> {
  const filter = kind === 'breaking' ? '&breaking_push=eq.major' : kind === 'edition' ? '&morning_push=eq.true' : '';
  const rows = await select<{ push_token: string }>('devices', `select=push_token&push_token=not.is.null${filter}`);
  return [...new Set(rows.map((r) => r.push_token).filter(Boolean))];
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

/** Sets pushed_at only if it's still empty. Returns true for exactly one caller per date. */
export async function claimPush(date: string): Promise<boolean> {
  const rows = await update('briefings', `date=${eq(date)}&status=eq.ready&pushed_at=is.null`, { pushed_at: new Date().toISOString() });
  return rows.length > 0;
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

/** Any story of the day: main, daytime update or "Also happening". */
export async function loadStory(date: string, storyId: string): Promise<Story | null> {
  const day = await loadDay(date);
  return day ? findStory(day.briefing, day.updates, storyId) : null;
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

/** Marks a daytime check as started. True for exactly one caller per slot. */
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
  stage: 'edition' | 'audio' | 'update' | 'push';
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
