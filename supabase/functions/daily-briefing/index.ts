// daily-briefing: called every 10 minutes by pg_cron (see migrations).
//
//   POST {}                                → "tick": does the next thing that's due (at most one heavy job):
//                                            write the edition → morning push → audio → daytime check
//   POST {"force": true}                   → write today's edition right now (replaces today's)
//   POST {"stage": "audio", "force"?: true}  → make today's audio now (force: even if it's already made)
//   POST {"stage": "update", "force"?: true} → run a "Since this morning" check now (force: any time of day)
//   POST {"dryRun": true}                  → feeds + grouping + scoring only; no AI, no database writes
//
// Every request must carry the header `x-brewsy-secret: <CRON_SECRET>`.
// Each heavy job runs in its own request, so each gets the full time limit.

import { buildAudio, KEEP_AUDIO_DAYS } from '../_shared/audio.ts';
import { ttsProvider } from '../_shared/audio-config.ts';
import { feedHealth } from '../_shared/feeds.ts';
import { json, preflight, readJsonBody } from '../_shared/http.ts';
import { activeModel, generateJson } from '../_shared/llm.ts';
import { fetchMarkets } from '../_shared/markets.ts';
import { buildEdition, collectCandidates, defaultDeps } from '../_shared/pipeline.ts';
import { type BriefingRow, decideTick, localParts, type Prefs, wakeMinutes } from '../_shared/prefs.ts';
import { alertPush, breakingPush, editionPush, MAX_BREAKING_PUSHES, sendAlertEmail, sendExpoPush } from '../_shared/push.ts';
import { cleanupOldAudio, uploadPublic } from '../_shared/storage.ts';
import {
  appendUpdates, claimAlert, claimAudio, claimBreakingPush, claimGeneration, claimPush, claimUpdateCheck, clearPushToken, getBriefingRow,
  loadBriefing, loadDay, loadPrefs, loadPreviousBriefing, logRun, markAudioError, markError, pushTokens, saveAudio, saveEdition,
} from '../_shared/store.ts';
import { synthesize } from '../_shared/tts.ts';
import { checkForUpdates } from '../_shared/updates.ts';

/** Free plan wall-clock limit is 150 s; leave headroom for saving. */
const BUDGET_MS = 135_000;
/** Alert the owner when more than this share of the feeds failed in the morning run. */
const FEED_ALERT_RATE = 0.2;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function runInBackground(task: Promise<unknown>): Promise<unknown> | null {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(task);
    return null;
  }
  return task; // local Deno: just await it
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Starts a stage in a fresh request (its own time limit). The next tick catches it if this fails. */
async function kickStage(stage: 'audio' | 'update'): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('CRON_SECRET');
  if (!url || !secret || typeof EdgeRuntime === 'undefined') return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/daily-briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-brewsy-secret': secret },
      body: JSON.stringify({ stage }),
      signal: AbortSignal.timeout(10_000),
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

/** Push + optional email to the owner, at most once per day per kind. Never throws. */
async function raiseAlert(date: string, kind: 'late' | 'feeds', subject: string, detail: string): Promise<Record<string, unknown>> {
  try {
    if (!(await claimAlert(date, kind, detail))) return { alert: kind, sent: false, reason: 'already sent today' };
    const tokens = await pushTokens('alert');
    const push = tokens.length ? await sendExpoPush(tokens, alertPush(subject, detail)) : null;
    const email = await sendAlertEmail(subject, detail);
    console.error(JSON.stringify({ event: 'alert', date, kind, subject, detail, pushed: push?.sent ?? 0, email }));
    return { alert: kind, pushed: push?.sent ?? 0, email };
  } catch (e) {
    return { alert: kind, sent: false, reason: errorMessage(e) };
  }
}

// ─── Stages ────────────────────────────────────────────────────────────────

async function pushEdition(date: string): Promise<Record<string, unknown>> {
  const briefing = await loadBriefing(date);
  if (!briefing?.stories.length) return { pushed: false, reason: 'no edition' };
  if (!(await claimPush(date))) return { pushed: false, reason: 'already pushed' };
  const tokens = await pushTokens('edition');
  if (!tokens.length) return { pushed: false, reason: 'no devices with a push token' };
  const result = await sendExpoPush(tokens, editionPush(briefing));
  await Promise.all(result.invalidTokens.map(clearPushToken));
  await logRun({ date, stage: 'push', ok: result.failed === 0, ms: 0, stats: { kind: 'edition', ...result } });
  return { pushed: true, ...result };
}

async function generate(date: string, prefs: Prefs, started: number): Promise<Record<string, unknown>> {
  try {
    const previous = await loadPreviousBriefing(date).catch(() => null);
    const { briefing, contexts, stats } = await buildEdition({ prefs, now: new Date(), date, deadlineMs: started + BUDGET_MS, previous });
    await saveEdition(briefing, contexts);
    const health = feedHealth(stats.feeds);
    const { feeds: _feeds, ...rest } = stats;
    console.log(JSON.stringify({ event: 'edition_ready', date, stories: briefing.stories.length, feedsOk: health.ok, feedsTotal: health.total, ...rest }));
    await logRun({
      date, stage: 'edition', ok: true, ms: stats.ms, feeds_ok: health.ok, feeds_total: health.total, feeds_failed: health.failed,
      stats: { stories: briefing.stories.length, ...rest },
    });
    const alert = health.failRate > FEED_ALERT_RATE
      ? await raiseAlert(date, 'feeds', `${health.failed.length} of ${health.total} news sources failed`, `Failed this morning: ${health.failed.join(', ')}`)
      : null;

    // Audio is its own run (its own time limit). If this kick fails, the next tick starts it.
    const audioKicked = await kickStage('audio');
    // If it's already past wake time, send the morning push right away.
    const { minutes } = localParts(new Date(), prefs.timezone);
    const push = prefs.morningPush && minutes >= wakeMinutes(prefs.wakeTime) ? await pushEdition(date) : { pushed: false, reason: 'before wake time' };
    return { ok: true, stories: briefing.stories.length, alsoHappening: briefing.alsoHappening?.length ?? 0, audioKicked, push, ...(alert ? { alert } : {}) };
  } catch (e) {
    const message = errorMessage(e);
    console.error(JSON.stringify({ event: 'edition_failed', date, message }));
    await markError(date, message).catch(() => {});
    await logRun({ date, stage: 'edition', ok: false, ms: Date.now() - started, error: message });
    return { ok: false, error: message };
  }
}

async function makeAudio(date: string, claimedAt: string): Promise<Record<string, unknown>> {
  const started = Date.now();
  try {
    const day = await loadDay(date);
    if (!day) throw new Error('No ready edition for this date.');
    const provider = ttsProvider();
    const { audio, stats } = await buildAudio(day.briefing, {
      generateJson,
      synthesize: (text) => synthesize(text, provider),
      upload: (path, bytes) => uploadPublic(path, bytes),
      provider,
    });
    const problem = stats.ttsErrors.length ? `Text-to-speech failed for ${stats.ttsErrors.length} chapter(s): ${stats.ttsErrors.slice(0, 3).join(' | ')}` : null;
    const saved = await saveAudio(date, claimedAt, audio, problem);
    await logRun({ date, stage: 'audio', ok: !problem && saved, ms: stats.ms, stats: { ...stats, provider, saved, model: activeModel() }, error: problem });
    const removed = await cleanupOldAudio(date, KEEP_AUDIO_DAYS);
    return { ok: !problem, saved, provider, ...stats, oldFilesRemoved: removed };
  } catch (e) {
    const message = errorMessage(e);
    console.error(JSON.stringify({ event: 'audio_failed', date, message }));
    await markAudioError(date, claimedAt, message).catch(() => {});
    await logRun({ date, stage: 'audio', ok: false, ms: Date.now() - started, error: message });
    return { ok: false, error: message };
  }
}

async function checkUpdates(date: string, prefs: Prefs, started: number): Promise<Record<string, unknown>> {
  try {
    const day = await loadDay(date);
    if (!day) throw new Error('No ready edition for this date.');
    const result = await checkForUpdates({
      prefs, now: new Date(), date, briefing: day.briefing, updates: day.updates, deadlineMs: started + BUDGET_MS,
    });
    const stories = result.added.map((a) => a.story);
    const saved = stories.length ? await appendUpdates(date, day.briefing.generatedAt, stories, result.contexts) : false;

    // At most one breaking push per check, MAX_BREAKING_PUSHES a day, only for the genuinely major.
    let push: Record<string, unknown> = { pushed: false, reason: 'nothing push-worthy' };
    const top = saved ? result.added.find((a) => a.pushWorthy) : undefined;
    if (top) {
      if (!(await claimBreakingPush(date, MAX_BREAKING_PUSHES))) push = { pushed: false, reason: `already sent ${MAX_BREAKING_PUSHES} today` };
      else {
        const tokens = await pushTokens('breaking');
        const sent = tokens.length ? await sendExpoPush(tokens, breakingPush(date, top.story)) : null;
        if (sent) await Promise.all(sent.invalidTokens.map(clearPushToken));
        push = sent ? { pushed: true, storyId: top.story.id, ...sent } : { pushed: false, reason: 'no devices with breaking pushes on' };
      }
    }

    const out = {
      added: stories.map((s) => ({ id: s.id, headline: s.headline })),
      saved,
      push,
      ...result.stats,
    };
    await logRun({ date, stage: 'update', ok: true, ms: result.stats.ms, feeds_failed: result.stats.feedsFailed, stats: out });
    return { ok: true, ...out };
  } catch (e) {
    const message = errorMessage(e);
    console.error(JSON.stringify({ event: 'update_failed', date, message }));
    await logRun({ date, stage: 'update', ok: false, ms: Date.now() - started, error: message });
    return { ok: false, error: message };
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async function dryRun(date: string, prefs: Prefs, started: number): Promise<Response> {
  const previous = await loadPreviousBriefing(date).catch(() => null);
  const [cand, markets] = await Promise.all([collectCandidates(prefs, new Date(), defaultDeps, previous), fetchMarkets()]);
  const health = feedHealth(cand.statuses);
  return json({
    date,
    prefs,
    feeds: {
      ok: health.ok,
      total: health.total,
      failRate: Math.round(health.failRate * 100) / 100,
      failed: cand.statuses.filter((s) => !s.ok && !s.skipped).map((s) => ({ id: s.sourceId, error: s.error })),
      skipped: cand.statuses.filter((s) => s.skipped).map((s) => s.sourceId),
    },
    items: cand.items.length,
    outlets: new Set(cand.items.map((it) => it.outlet)).size,
    storiesGrouped: cand.totalClusters,
    mustInclude: cand.clusters.filter((c) => cand.scores.get(c.id)?.mustInclude).length,
    top: cand.clusters.slice(0, 25).map((c) => {
      const s = cand.scores.get(c.id)!;
      return {
        id: c.id, title: c.title, score: Math.round(s.score * 10) / 10, breadth: s.breadth, majorOutlets: s.majorOutlets,
        mustInclude: s.mustInclude, isUpdate: s.isUpdate, why: s.why, outlets: c.outlets,
      };
    }),
    markets,
    model: activeModel(),
    tts: ttsProvider(),
    ms: Date.now() - started,
  });
}

/** Runs a claimed job: in the background on Supabase (answers 202), inline locally. */
async function respond(job: Promise<Record<string, unknown>>, extra: Record<string, unknown>): Promise<Response> {
  const pending = runInBackground(job);
  return pending ? json({ ...extra, result: await pending }) : json({ ...extra, status: 'started' }, 202);
}

async function runAudioStage(date: string, row: BriefingRow | null, force: boolean): Promise<Response> {
  if (!row || row.status !== 'ready') return json({ stage: 'audio', date, status: 'no edition yet' }, 409);
  if (!force && row.audio_status === 'ready') return json({ stage: 'audio', date, status: 'already made (send "force": true to redo)' });
  const claimedAt = await claimAudio(date, row, force);
  if (!claimedAt) return json({ stage: 'audio', date, status: 'busy' }, 409);
  return respond(makeAudio(date, claimedAt), { stage: 'audio', date });
}

async function runUpdateStage(date: string, prefs: Prefs, row: BriefingRow | null, started: number): Promise<Response> {
  if (!row || row.status !== 'ready') return json({ stage: 'update', date, status: 'no edition yet' }, 409);
  if (!(await claimUpdateCheck(date, row))) return json({ stage: 'update', date, status: 'busy' }, 409);
  return respond(checkUpdates(date, prefs, started), { stage: 'update', date });
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-brewsy-secret') !== secret) return json({ error: 'Unauthorized.' }, 401);

  const started = Date.now();
  const body = await readJsonBody<{ force: boolean; dryRun: boolean; stage: string }>(req);

  try {
    const { prefs } = await loadPrefs();
    const now = new Date();
    const { date } = localParts(now, prefs.timezone);

    if (body.dryRun) return await dryRun(date, prefs, started);

    const row = await getBriefingRow(date);

    if (body.stage === 'audio') return await runAudioStage(date, row, body.force === true);
    if (body.stage === 'update') {
      // Without force, only when a check is actually due (so a stray call can't spend AI time).
      const due = decideTick(now, prefs, row).action === 'update';
      if (!body.force && !due) return json({ stage: 'update', date, status: 'not due (send "force": true to run anyway)' });
      return await runUpdateStage(date, prefs, row, started);
    }
    if (body.stage) return json({ error: 'stage must be "audio" or "update".' }, 400);

    if (body.force) {
      if (!(await claimGeneration(date, row, true))) return json({ status: 'busy', date }, 409);
      return await respond(generate(date, prefs, started), { action: 'generate', date, forced: true });
    }

    const decision = decideTick(now, prefs, row);
    const alert = decision.alert === 'late'
      ? await raiseAlert(date, 'late', `today's edition isn't ready`, `It wasn't ready by your wake time (${prefs.wakeTime}). Status: ${row?.status ?? 'not started'}. Check the pipeline_runs table and the function logs.`)
      : null;
    const extra = { ...decision, ...(alert ? { alertResult: alert } : {}) };

    switch (decision.action) {
      case 'generate':
        if (!(await claimGeneration(date, row))) return json({ ...extra, action: 'wait', reason: 'another run took it' });
        return await respond(generate(date, prefs, started), extra);
      case 'push':
        return json({ ...extra, result: await pushEdition(date) });
      case 'audio':
        return await runAudioStage(date, row, false);
      case 'update':
        return await runUpdateStage(date, prefs, row, started);
      default:
        return json(extra);
    }
  } catch (e) {
    const message = errorMessage(e);
    console.error(JSON.stringify({ event: 'tick_failed', message }));
    return json({ error: message }, 500);
  }
});
