// daily-briefing: called every 10 minutes by pg_cron (see migrations).
//
//   POST {}  → "tick". First the cheap things, every time: the morning pushes now due
//              (per reader, at their own wake time) and the owner's alert when an AI
//              provider nears its free daily limit. Then at most one heavy job
//              (prefs.ts planTick): the world edition → its audio scripts → a region's
//              local section → a "Since this morning" check.
//   POST {"force": true}                          → write today's world edition right now (replaces it)
//   POST {"stage": "audio", "force"?: true}       → make the world edition's audio now (force: even if made)
//   POST {"stage": "update", "force"?: true}      → a "Since this morning" check on the latest edition
//                                                    (force: even if no check is due)
//   POST {"stage": "region", "region": "CA", "force"?: true} → make a region's local section now
//   POST {"dryRun": true, "region"?: "CA"}         → feeds + grouping + scoring only; no AI, no database writes
//
// Every request must carry the header `x-brewsy-secret: <CRON_SECRET>`.
// Each heavy job runs in its own request, so each gets the full time limit.

import { buildAudio, KEEP_AUDIO_DAYS } from '../_shared/audio.ts';
import { ttsProvider } from '../_shared/audio-config.ts';
import { feedHealth } from '../_shared/feeds.ts';
import { json, preflight, readJsonBody } from '../_shared/http.ts';
import { activeModel, budgetWarnings, generateJson, loadUsage, usageDay } from '../_shared/llm.ts';
import { fetchMarkets } from '../_shared/markets.ts';
import { buildEdition, collectCandidates, defaultDeps } from '../_shared/pipeline.ts';
import {
  type BriefingRow, editionPrefs, localParts, normalizePrefs, planTick, type Prefs, readerRegion, regionDue, regionTimeZone, type TickPlan,
  topicOrder,
} from '../_shared/prefs.ts';
import { alertPush, breakingPush, editionPush, MAX_BREAKING_PUSHES, sendAlertEmail, sendExpoPush } from '../_shared/push.ts';
import { buildRegionalEdition, collectRegionCandidates } from '../_shared/region.ts';
import { type LocalRegion, REGIONS } from '../_shared/sources.ts';
import { cleanupOldAudio, uploadPublic } from '../_shared/storage.ts';
import {
  appendUpdates, claimAlert, claimAudio, claimBreakingPush, claimGeneration, claimMorningPushes, claimRegional, claimSlot, claimUpdateCheck,
  clearPushToken, finishSlot, getBriefingRow, getRegionalRows, loadBriefing, loadDay, loadLatestReady, loadPreviousBriefing, loadReaders,
  logRun, markAudioError, markError, markRegionalError, pushTokens, saveAudio, saveEdition, saveRegional, takenSlots,
} from '../_shared/store.ts';
import { synthesize } from '../_shared/tts.ts';
import { checkForUpdates } from '../_shared/updates.ts';

/** Free plan wall-clock limit is 150 s; leave headroom for saving. */
const BUDGET_MS = 135_000;
/** Alert the owner when more than this share of the feeds failed in the morning run. */
const FEED_ALERT_RATE = 0.2;
/** …and when an AI model has used this share of its free daily allowance. */
const BUDGET_ALERT_SHARE = 0.8;

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
async function raiseAlert(date: string, kind: string, subject: string, detail: string): Promise<Record<string, unknown>> {
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

// ─── Every tick: cheap things first ────────────────────────────────────────

/** Morning pushes now due, per reader: each gets the edition they'll see. Never throws. */
async function sendMorningPushes(): Promise<Record<string, unknown>> {
  try {
    const due = await claimMorningPushes();
    if (!due.length) return { morningPushes: 0 };
    const byDate = new Map<string, string[]>();
    for (const d of due) byDate.set(d.edition_date, [...(byDate.get(d.edition_date) ?? []), d.push_token]);
    let sent = 0;
    let failed = 0;
    for (const [date, tokens] of byDate) {
      const briefing = await loadBriefing(date);
      if (!briefing?.stories.length) continue;
      const result = await sendExpoPush([...new Set(tokens)], editionPush(briefing));
      await Promise.all(result.invalidTokens.map(clearPushToken));
      sent += result.sent;
      failed += result.failed;
      await logRun({ date, stage: 'push', ok: result.failed === 0, ms: 0, stats: { kind: 'edition', ...result } });
    }
    return { morningPushes: due.length, sent, failed };
  } catch (e) {
    return { morningPushes: 'failed', error: errorMessage(e).slice(0, 300) };
  }
}

/** The owner hears about it when a model nears its free daily allowance. Never throws. */
async function checkBudgets(): Promise<Record<string, unknown> | null> {
  try {
    const day = usageDay();
    const warnings = budgetWarnings(await loadUsage(day), BUDGET_ALERT_SHARE);
    if (!warnings.length) return null;
    const results = [];
    for (const w of warnings) {
      const pct = Math.round(w.share * 100);
      results.push(await raiseAlert(
        day,
        `budget:${w.provider}:${w.model}`,
        `${w.provider} is at ${pct}% of today's free AI allowance`,
        `${w.provider} (${w.model}) has used ${pct}% of its free daily limit (resets at midnight UTC). Brewsy moves on to the next provider; check the ai_usage table.`,
      ));
    }
    return { budget: results };
  } catch (e) {
    return { budget: 'failed', error: errorMessage(e).slice(0, 300) };
  }
}

// ─── Who reads, and when ───────────────────────────────────────────────────

type Schedule = {
  /** The world edition's settings: the owner's timing, everyone's topics and stars. */
  prefs: Prefs;
  /** The owner's local date. */
  date: string;
  world: BriefingRow | null;
  latest: Awaited<ReturnType<typeof loadLatestReady>>;
  regions: { region: LocalRegion; date: string; row: Awaited<ReturnType<typeof getRegionalRows>>[number] | null }[];
  taken: Set<string>;
  readers: number;
};

async function loadSchedule(now: Date): Promise<Schedule> {
  const { owner, active } = await loadReaders(now);
  const others = active.filter((r) => !r.is_owner && r.device_id !== owner?.device_id).map(normalizePrefs);
  const prefs = editionPrefs(normalizePrefs(owner), others);
  const { date } = localParts(now, prefs.timezone);
  const wanted = new Set(active.map(readerRegion).filter((r): r is LocalRegion => r !== null));
  const regionDates = REGIONS.filter((r) => wanted.has(r.id as LocalRegion))
    .map((r) => ({ region: r.id as LocalRegion, date: localParts(now, regionTimeZone(r.id as LocalRegion)).date }));
  const [world, latest, rows, taken] = await Promise.all([
    getBriefingRow(date),
    loadLatestReady(),
    getRegionalRows(regionDates),
    takenSlots([date, ...regionDates.map((r) => r.date)]),
  ]);
  return {
    prefs, date, world, latest, taken, readers: active.length,
    regions: regionDates.map((r) => ({ ...r, row: rows.find((x) => x.region === r.region && x.date === r.date) ?? null })),
  };
}

// ─── Stages ────────────────────────────────────────────────────────────────

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
    // Anyone already past their wake time (the owner, if it ran late) gets their push now.
    const push = await sendMorningPushes();
    return { ok: true, stories: briefing.stories.length, alsoHappening: briefing.alsoHappening?.length ?? 0, audioKicked, push, ...(alert ? { alert } : {}) };
  } catch (e) {
    const message = errorMessage(e);
    console.error(JSON.stringify({ event: 'edition_failed', date, message }));
    await markError(date, message).catch(() => {});
    await logRun({ date, stage: 'edition', ok: false, ms: Date.now() - started, error: message });
    return { ok: false, error: message };
  }
}

async function makeAudio(date: string, claimedAt: string, prefs: Prefs): Promise<Record<string, unknown>> {
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
    }, { order: topicOrder(prefs) });
    const problem = stats.ttsErrors.length ? `Text-to-speech failed for ${stats.ttsErrors.length} chapter(s): ${stats.ttsErrors.slice(0, 3).join(' | ')}` : null;
    const saved = await saveAudio(date, claimedAt, audio, problem);
    await logRun({ date, stage: 'audio', ok: !problem && saved, ms: stats.ms, stats: { ...stats, provider, saved, model: activeModel('script') }, error: problem });
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

async function checkUpdates(date: string, prefs: Prefs, started: number, slot?: { date: string; slot: string }): Promise<Record<string, unknown>> {
  try {
    const day = await loadDay(date);
    if (!day) throw new Error('No ready edition for this date.');
    const result = await checkForUpdates({
      prefs, now: new Date(), date, briefing: day.briefing, updates: day.updates, deadlineMs: started + BUDGET_MS,
    });
    const stories = result.added.map((a) => a.story);
    const saved = stories.length ? await appendUpdates(date, day.briefing.generatedAt, stories, result.contexts) : false;

    // At most one breaking push per check, MAX_BREAKING_PUSHES per edition, only for the genuinely
    // major, and only to readers for whom it's 07:00–22:00.
    let push: Record<string, unknown> = { pushed: false, reason: 'nothing push-worthy' };
    const top = saved ? result.added.find((a) => a.pushWorthy) : undefined;
    if (top) {
      const tokens = await pushTokens('breaking');
      if (!tokens.length) push = { pushed: false, reason: 'no readers with breaking news on and awake' };
      else if (!(await claimBreakingPush(date, MAX_BREAKING_PUSHES))) push = { pushed: false, reason: `already sent ${MAX_BREAKING_PUSHES} for this edition` };
      else {
        const sent = await sendExpoPush(tokens, breakingPush(date, top.story));
        await Promise.all(sent.invalidTokens.map(clearPushToken));
        push = { pushed: true, storyId: top.story.id, ...sent };
      }
    }

    const out = {
      added: stories.map((s) => ({ id: s.id, headline: s.headline })),
      saved,
      push,
      ...(slot ? { slot: slot.slot } : {}),
      ...result.stats,
    };
    await logRun({ date, stage: 'update', ok: true, ms: result.stats.ms, feeds_failed: result.stats.feedsFailed, stats: out });
    if (slot) await finishSlot(slot.date, slot.slot, true);
    return { ok: true, ...out };
  } catch (e) {
    const message = errorMessage(e);
    console.error(JSON.stringify({ event: 'update_failed', date, message }));
    await logRun({ date, stage: 'update', ok: false, ms: Date.now() - started, error: message });
    if (slot) await finishSlot(slot.date, slot.slot, false, message);
    return { ok: false, error: message };
  }
}

async function makeRegion(region: LocalRegion, date: string, started: number): Promise<Record<string, unknown>> {
  try {
    const latest = await loadLatestReady();
    const world = latest ? await loadDay(latest.date) : null;
    const { edition, contexts, stats } = await buildRegionalEdition({
      region, date, now: new Date(), deadlineMs: started + BUDGET_MS,
      world: world ? { briefing: world.briefing, updates: world.updates } : null,
    });
    await saveRegional(edition, contexts);
    console.log(JSON.stringify({ event: 'region_ready', date, ...stats }));
    await logRun({ date, stage: 'region', ok: true, ms: stats.ms, feeds_failed: stats.feedsFailed, stats });
    return { ok: true, region, stories: edition.stories.length, also: edition.also.length };
  } catch (e) {
    const message = errorMessage(e);
    console.error(JSON.stringify({ event: 'region_failed', date, region, message }));
    await markRegionalError(date, region, message).catch(() => {});
    await logRun({ date, stage: 'region', ok: false, ms: Date.now() - started, error: message, stats: { region } });
    return { ok: false, region, error: message };
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async function dryRun(date: string, prefs: Prefs, started: number, region: LocalRegion | null): Promise<Response> {
  const previous = await loadPreviousBriefing(date).catch(() => null);
  const latest = region ? await loadLatestReady().catch(() => null) : null;
  const world = latest ? await loadDay(latest.date).catch(() => null) : null;
  const [cand, markets] = await Promise.all([
    region
      ? collectRegionCandidates(region, new Date(), defaultDeps, world ? { briefing: world.briefing, updates: world.updates } : null)
        .then((c) => ({ ...c, clusters: c.ranked, totalClusters: c.clusters.length }))
      : collectCandidates(prefs, new Date(), defaultDeps, previous),
    region ? Promise.resolve([]) : fetchMarkets(),
  ]);
  const health = feedHealth(cand.statuses);
  return json({
    date,
    ...(region ? { region } : { prefs }),
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
    model: activeModel(region ? 'region' : 'edition'),
    tts: ttsProvider(),
    ms: Date.now() - started,
  });
}

/** Runs a claimed job: in the background on Supabase (answers 202), inline locally. */
async function respond(job: Promise<Record<string, unknown>>, extra: Record<string, unknown>): Promise<Response> {
  const pending = runInBackground(job);
  return pending ? json({ ...extra, result: await pending }) : json({ ...extra, status: 'started' }, 202);
}

async function runAudioStage(date: string, prefs: Prefs, row: BriefingRow | null, force: boolean): Promise<Response> {
  if (!row || row.status !== 'ready') return json({ stage: 'audio', date, status: 'no edition yet' }, 409);
  if (!force && row.audio_status === 'ready') return json({ stage: 'audio', date, status: 'already made (send "force": true to redo)' });
  const claimedAt = await claimAudio(date, row, force);
  if (!claimedAt) return json({ stage: 'audio', date, status: 'busy' }, 409);
  return respond(makeAudio(date, claimedAt, prefs), { stage: 'audio', date });
}

/** A "Since this morning" check on an edition; `slot` = the schedule slot it was claimed for. */
async function runUpdateStage(editionDate: string, prefs: Prefs, started: number, slot?: { date: string; slot: string }): Promise<Response> {
  const row = await getBriefingRow(editionDate);
  if (!row || row.status !== 'ready' || !(await claimUpdateCheck(editionDate, row))) {
    if (slot) await finishSlot(slot.date, slot.slot, false, 'edition busy or missing');
    return json({ stage: 'update', date: editionDate, status: row?.status === 'ready' ? 'busy' : 'no edition yet' }, 409);
  }
  return respond(checkUpdates(editionDate, prefs, started, slot), { stage: 'update', date: editionDate, ...(slot ? { slot: slot.slot } : {}) });
}

async function runRegionStage(region: LocalRegion, date: string, row: Schedule['regions'][number]['row'], started: number, force: boolean, extra: Record<string, unknown> = {}): Promise<Response> {
  if (!(await claimRegional(date, region, row, force))) return json({ ...extra, stage: 'region', region, date, status: 'busy' }, 409);
  return respond(makeRegion(region, date, started), { ...extra, stage: 'region', region, date });
}

const isLocalRegion = (r: unknown): r is LocalRegion => typeof r === 'string' && REGIONS.some((x) => x.id === r && x.id !== 'WORLD');

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-brewsy-secret') !== secret) return json({ error: 'Unauthorized.' }, 401);

  const started = Date.now();
  const body = await readJsonBody<{ force: boolean; dryRun: boolean; stage: string; region: string }>(req);

  try {
    const now = new Date();
    if (body.region !== undefined && !isLocalRegion(body.region)) return json({ error: 'region must be one of IN, CA, US, UK, AU.' }, 400);
    const region = isLocalRegion(body.region) ? body.region : null;

    // Cheap and per reader: never wait behind the heavy job below.
    const pushes = body.stage || body.force || body.dryRun ? null : await sendMorningPushes();
    const budget = body.stage || body.force || body.dryRun ? null : await checkBudgets();

    const schedule = await loadSchedule(now);
    const { prefs, date, world } = schedule;

    if (body.dryRun) return await dryRun(date, prefs, started, region);

    if (body.stage === 'audio') return await runAudioStage(date, prefs, world, body.force === true);
    if (body.stage === 'update') {
      // Without force, only when a check is actually due (so a stray call can't spend AI time).
      const plan = planTick({ now, owner: prefs, world, latest: schedule.latest, regions: schedule.regions, taken: schedule.taken });
      if (!schedule.latest) return json({ stage: 'update', status: 'no edition yet' }, 409);
      if (!body.force && plan.action !== 'refresh') return json({ stage: 'update', status: 'not due (send "force": true to run anyway)' });
      return await runUpdateStage(schedule.latest.date, prefs, started);
    }
    if (body.stage === 'region') {
      if (!region) return json({ error: 'Say which region: {"stage":"region","region":"CA"}.' }, 400);
      const regionDate = localParts(now, regionTimeZone(region)).date;
      const row = (await getRegionalRows([{ region, date: regionDate }]))[0] ?? null;
      const due = regionDue(row, now);
      if (!body.force && (!due || 'busy' in due)) {
        return json({ stage: 'region', region, date: regionDate, status: row?.status === 'ready' ? 'already made (send "force": true to redo)' : 'busy' });
      }
      return await runRegionStage(region, regionDate, row, started, body.force === true);
    }
    if (body.stage) return json({ error: 'stage must be "audio", "update" or "region".' }, 400);

    if (body.force) {
      if (!(await claimGeneration(date, world, true))) return json({ status: 'busy', date }, 409);
      return await respond(generate(date, prefs, started), { action: 'generate', date, forced: true });
    }

    const plan: TickPlan = planTick({ now, owner: prefs, world, latest: schedule.latest, regions: schedule.regions, taken: schedule.taken });
    const alert = plan.alert === 'late'
      ? await raiseAlert(date, 'late', `today's edition isn't ready`, `It wasn't ready by your wake time (${prefs.wakeTime}). Status: ${world?.status ?? 'not started'}. Check the pipeline_runs table and the function logs.`)
      : null;
    const extra = { ...plan, readers: schedule.readers, ...(pushes ? { pushes } : {}), ...(budget ? { budget } : {}), ...(alert ? { alertResult: alert } : {}) };

    switch (plan.action) {
      case 'generate':
        if (!(await claimGeneration(date, world))) return json({ ...extra, action: 'wait', reason: 'another run took it' });
        return await respond(generate(date, prefs, started), extra);
      case 'audio':
        return await runAudioStage(date, prefs, world, false);
      case 'region': {
        const entry = schedule.regions.find((r) => r.region === plan.region)!;
        return await runRegionStage(entry.region, plan.date, entry.row && entry.row.date === plan.date ? entry.row : null, started, false, extra);
      }
      case 'refresh': {
        if (!(await claimSlot(plan.date, plan.slot!))) return json({ ...extra, action: 'wait', reason: 'another run took this check' });
        return await runUpdateStage(plan.editionDate!, prefs, started, { date: plan.date, slot: plan.slot! });
      }
      default:
        return json(extra);
    }
  } catch (e) {
    const message = errorMessage(e);
    console.error(JSON.stringify({ event: 'tick_failed', message }));
    return json({ error: message }, 500);
  }
});
