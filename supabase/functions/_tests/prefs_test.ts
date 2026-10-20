import { assertEquals } from 'jsr:@std/assert@1';

import {
  type BriefingRow, DEFAULT_PREFS, editionMinutes, editionPrefs, localParts, normalizePrefs, type PlanInput, planTick, type Prefs, readerRegion,
  regionForTimezone, type RegionalRow, topicOrder,
} from '../_shared/prefs.ts';
import { TOPICS, type Topic } from '../_shared/types.ts';

const IST: Prefs = { ...DEFAULT_PREFS, timezone: 'Asia/Kolkata', wakeTime: '05:30' };
// 2026-10-07 05:30 IST == 2026-10-07T00:00Z. Toronto is UTC-4 then (05:00 there = 14:30 IST).
const at = (istHHMM: string, date = '2026-10-07') => {
  const [h, m] = istHHMM.split(':').map(Number);
  return new Date(Date.parse(`${date}T00:00:00Z`) + ((h * 60 + m) - 330) * 60_000);
};
const row = (over: Partial<BriefingRow>): BriefingRow => ({
  date: '2026-10-07', status: 'ready', started_at: null, generated_at: null, pushed_at: null, audio_status: 'ready', ...over,
});
const minsAgo = (now: Date, m: number) => new Date(now.getTime() - m * 60_000).toISOString();

/** One tick for the owner in India, with nothing else going on unless `over` says so. */
const plan = (now: Date, world: BriefingRow | null, over: Partial<PlanInput> = {}) =>
  planTick({ now, owner: IST, world, latest: null, regions: [], taken: new Set(), ...over });

Deno.test('localParts converts to the reader timezone', () => {
  assertEquals(localParts(new Date('2026-10-07T00:00:00Z'), 'Asia/Kolkata'), { date: '2026-10-07', minutes: 330 });
  // 23:00 UTC on the 6th is already the 7th in India.
  assertEquals(localParts(new Date('2026-10-06T23:00:00Z'), 'Asia/Kolkata').date, '2026-10-07');
  assertEquals(localParts(new Date('2026-10-07T03:00:00Z'), 'America/New_York'), { date: '2026-10-06', minutes: 23 * 60 });
});

// ─── The world edition, timed by the owner ───

Deno.test('world edition: before the window → wait; 30 min before the owner wakes → generate, dated the owner\'s day', () => {
  assertEquals(plan(at('04:50'), null).action, 'wait');
  const d = plan(at('05:00'), null);
  assertEquals(d.action, 'generate');
  assertEquals(d.date, '2026-10-07');
});

Deno.test('world edition: fresh generating row → wait; stale → generate; a recent error waits 30 min', () => {
  const now = at('05:10');
  assertEquals(plan(now, row({ status: 'generating', started_at: minsAgo(now, 3) })).action, 'wait');
  assertEquals(plan(now, row({ status: 'generating', started_at: minsAgo(now, 11) })).action, 'generate');
  const later = at('05:20');
  assertEquals(plan(later, row({ status: 'error', started_at: minsAgo(later, 10) })).action, 'wait');
  assertEquals(plan(later, row({ status: 'error', started_at: minsAgo(later, 31) })).action, 'generate');
});

Deno.test('wake time just after midnight opens the window from midnight', () => {
  assertEquals(planTick({ now: at('00:00'), owner: { ...IST, wakeTime: '00:10' }, world: null, latest: null, regions: [], taken: new Set() }).action, 'generate');
});

Deno.test('audio scripts right after the edition; stale or failed runs are retried, max 3 tries', () => {
  const now = at('05:10');
  assertEquals(plan(now, row({ audio_status: null })).action, 'audio');
  assertEquals(plan(now, row({ audio_status: 'generating', audio_started_at: minsAgo(now, 3) })).action, 'wait');
  assertEquals(plan(now, row({ audio_status: 'generating', audio_started_at: minsAgo(now, 11) })).action, 'audio');
  assertEquals(plan(now, row({ audio_status: 'error', audio_started_at: minsAgo(now, 10), audio_attempts: 1 })).action, 'done');
  assertEquals(plan(now, row({ audio_status: 'error', audio_started_at: minsAgo(now, 31), audio_attempts: 2 })).action, 'audio');
  assertEquals(plan(now, row({ audio_status: 'error', audio_started_at: minsAgo(now, 31), audio_attempts: 3 })).action, 'done');
});

Deno.test('morning pushes are not planned here: a ready edition with its audio is done', () => {
  assertEquals(plan(at('05:40'), row({})).action, 'done');
});

Deno.test('late alert: the world edition is not ready at the owner\'s wake time', () => {
  assertEquals(plan(at('05:20'), null).alert, undefined);
  assertEquals(plan(at('05:30'), null).alert, 'late');
  const now = at('05:40');
  assertEquals(plan(now, row({ status: 'generating', started_at: minsAgo(now, 3) })).alert, 'late');
  assertEquals(plan(now, row({})).alert, undefined);
});

// ─── Regional sections, at 05:00 in each region ───

const region = (r: 'CA' | 'IN' | 'UK' | 'AU' | 'US', over: Partial<RegionalRow> | null = null, date = '2026-10-07') =>
  ({ region: r, row: over ? { date, region: r, status: 'ready' as const, started_at: null, attempts: 1, ...over } : null });

Deno.test('regions: a section at 05:00 in the region, dated there; not before', () => {
  const ready = row({});
  assertEquals(plan(at('14:20'), ready, { regions: [region('CA')] }).action, 'done', '04:50 in Toronto');
  const d = plan(at('14:30'), ready, { regions: [region('CA')] });
  assertEquals([d.action, d.region, d.date], ['region', 'CA', '2026-10-07']);
  // Sydney is ahead: at 23:30 IST on the 6th it's 05:00 on the 7th there.
  const au = plan(at('23:30', '2026-10-06'), row({ date: '2026-10-06' }), { regions: [region('AU')] });
  assertEquals([au.action, au.date], ['region', '2026-10-07']);
});

Deno.test('regions: the world edition and its audio go first; a section in progress blocks other heavy work', () => {
  const now = at('05:00');
  assertEquals(plan(now, null, { regions: [region('IN')] }).action, 'generate');
  assertEquals(plan(now, row({ audio_status: null }), { regions: [region('IN')] }).action, 'audio');
  assertEquals(plan(now, row({}), { regions: [region('IN')] }).action, 'region');
  const busy = plan(now, row({}), { regions: [region('IN', { status: 'generating', started_at: minsAgo(now, 2) })] });
  assertEquals([busy.action, busy.region], ['wait', 'IN']);
});

Deno.test('regions: ready → skip; stale or failed (30 min, 3 tries) → again; yesterday\'s row doesn\'t count', () => {
  const now = at('15:00');
  const ready = row({});
  assertEquals(plan(now, ready, { regions: [region('CA', {})] }).action, 'done');
  assertEquals(plan(now, ready, { regions: [region('CA', { status: 'generating', started_at: minsAgo(now, 12) })] }).action, 'region');
  assertEquals(plan(now, ready, { regions: [region('CA', { status: 'error', started_at: minsAgo(now, 31), attempts: 2 })] }).action, 'region');
  assertEquals(plan(now, ready, { regions: [region('CA', { status: 'error', started_at: minsAgo(now, 10), attempts: 1 })] }).action, 'done');
  assertEquals(plan(now, ready, { regions: [region('CA', { status: 'error', started_at: minsAgo(now, 31), attempts: 3 })] }).action, 'done');
  assertEquals(plan(now, ready, { regions: [region('CA', {}, '2026-10-06')] }).action, 'region');
});

Deno.test('regions: a failed world edition waiting to retry doesn\'t hold the sections up', () => {
  const now = at('14:30');
  const d = plan(now, row({ status: 'error', started_at: minsAgo(now, 10) }), { regions: [region('CA')] });
  assertEquals([d.action, d.alert], ['region', 'late']);
});

// ─── "Since this morning" checks ───

const latest = (generatedMinsAgo: number, now: Date, date = '2026-10-07') => ({ date, generated_at: minsAgo(now, generatedMinsAgo), updates_checked_at: null });

Deno.test('refresh: once in the 40 minutes before a region\'s 05:00, added to the latest edition', () => {
  const now = at('14:00'); // 04:30 in Toronto
  const d = plan(now, row({}), { regions: [region('CA')], latest: latest(9 * 60, now) });
  assertEquals([d.action, d.slot, d.date, d.editionDate], ['refresh', 'refresh:pre-CA', '2026-10-07', '2026-10-07']);
  assertEquals(plan(now, row({}), { regions: [region('CA')], latest: latest(9 * 60, now), taken: new Set(['2026-10-07|refresh:pre-CA']) }).action, 'done');
  // Nothing new to find right after an edition or another check.
  assertEquals(plan(now, row({}), { regions: [region('CA')], latest: latest(30, now) }).action, 'done');
  assertEquals(plan(at('13:30'), row({}), { regions: [region('CA')], latest: latest(9 * 60, now) }).action, 'done', '04:00 is too early');
});

Deno.test('refresh: skipped right before a new world edition (it covers the night anyway)', () => {
  const now = at('04:30'); // the IN section at 05:00, the owner's edition at 05:00 too
  const d = plan(now, null, { regions: [region('IN')], latest: { date: '2026-10-06', generated_at: minsAgo(now, 23 * 60), updates_checked_at: minsAgo(now, 10 * 60) } });
  assertEquals(d.action, 'wait');
});

Deno.test('refresh: twice in the owner\'s day, 6 and 12 hours after they wake, each slot once', () => {
  const ready = row({});
  assertEquals(plan(at('11:20'), ready, { latest: latest(6 * 60, at('11:20')) }).action, 'done');
  const d1 = plan(at('11:30'), ready, { latest: latest(6 * 60, at('11:30')) });
  assertEquals([d1.action, d1.slot, d1.date], ['refresh', 'refresh:day-1', '2026-10-07']);
  assertEquals(plan(at('11:40'), ready, { latest: latest(6 * 60, at('11:40')), taken: new Set(['2026-10-07|refresh:day-1']) }).action, 'done');
  assertEquals(plan(at('13:40'), ready, { latest: latest(8 * 60, at('13:40')) }).action, 'done', 'the window has passed');
  assertEquals(plan(at('17:30'), ready, { latest: latest(12 * 60, at('17:30')) }).slot, 'refresh:day-2');
  // Waking at 11:00: the second check would be at 23:00, past 10pm, so there's only one.
  const late = { ...IST, wakeTime: '11:00' };
  const tick = (t: string) => planTick({ now: at(t), owner: late, world: ready, latest: latest(12 * 60, at(t)), regions: [], taken: new Set() });
  assertEquals(tick('17:00').slot, 'refresh:day-1');
  assertEquals(tick('23:10').action, 'done');
});

// ─── Readers ───

const device = (over: Record<string, unknown>) => normalizePrefs({
  device_id: 'x', push_token: null, platform: null, timezone: 'Asia/Kolkata', wake_time: '05:30', topics: null, disabled_sources: null,
  morning_push: true, updated_at: '', ...over,
});

Deno.test('editionPrefs: the owner\'s timing, everyone\'s topics, stars topped up to 4 by what others star most; no muted outlets', () => {
  const owner = device({ timezone: 'Europe/London', wake_time: '06:15', topics: ['ai', 'tech', 'movies'], focus_topics: ['movies'], disabled_sources: ['Wired'] });
  const friends = [
    device({ topics: ['sports', 'ai', 'crypto'], focus_topics: ['sports', 'crypto'] }),
    device({ topics: ['sports', 'health'], focus_topics: ['sports', 'health'] }),
    device({ topics: ['crypto', 'climate'], focus_topics: ['crypto', 'climate'] }),
  ];
  const p = editionPrefs(owner, friends);
  assertEquals([p.timezone, p.wakeTime], ['Europe/London', '06:15']);
  assertEquals(p.topics, ['ai', 'tech', 'health', 'climate', 'sports', 'movies', 'crypto']);
  // sports and crypto (2 votes each) beat health and climate (1 each); topic order breaks the tie. Kept in topic order.
  assertEquals(p.focusTopics, ['health', 'sports', 'movies', 'crypto'] as Topic[]);
  assertEquals(p.focusTopics.length, 4);
  assertEquals(p.disabledSources, []);
  assertEquals(editionPrefs(owner).focusTopics, ['movies']);
});

Deno.test('regionForTimezone: India, Canada, the US, the UK, Australia, else world', () => {
  assertEquals(regionForTimezone('Asia/Kolkata'), 'IN');
  assertEquals(regionForTimezone('Asia/Calcutta'), 'IN');
  for (const tz of ['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax', 'America/St_Johns']) {
    assertEquals(regionForTimezone(tz), 'CA', tz);
  }
  for (const tz of ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Indiana/Indianapolis', 'Pacific/Honolulu']) {
    assertEquals(regionForTimezone(tz), 'US', tz);
  }
  assertEquals(regionForTimezone('America/Mexico_City'), 'WORLD', 'other American zones are not the US');
  assertEquals(regionForTimezone('America/Sao_Paulo'), 'WORLD');
  assertEquals(regionForTimezone('Europe/London'), 'UK');
  assertEquals(regionForTimezone('Australia/Perth'), 'AU');
  assertEquals(regionForTimezone('Europe/Berlin'), 'WORLD');
  assertEquals(regionForTimezone(null), 'WORLD');
});

Deno.test('readerRegion: the app\'s choice wins; WORLD and unknown values fall back sensibly', () => {
  assertEquals(readerRegion({ region: 'UK', timezone: 'Asia/Kolkata' }), 'UK');
  assertEquals(readerRegion({ region: null, timezone: 'Asia/Kolkata' }), 'IN');
  assertEquals(readerRegion({ region: 'WORLD', timezone: 'Asia/Kolkata' }), null, 'world news only');
  assertEquals(readerRegion({ region: 'XX', timezone: 'America/Toronto' }), 'CA');
  assertEquals(readerRegion({ timezone: 'Europe/Paris' }), null);
});

Deno.test('normalizePrefs fills gaps and rejects junk', () => {
  const p = normalizePrefs({
    device_id: 'x', push_token: null, platform: 'android', timezone: 'Not/AZone', wake_time: '25:99',
    topics: ['ai', 'sports', 'horoscopes'], disabled_sources: ['Wired'], morning_push: null, updated_at: '',
  });
  assertEquals(p.timezone, 'Asia/Kolkata');
  assertEquals(p.wakeTime, '05:30');
  assertEquals(p.topics, ['ai', 'sports']);
  assertEquals(p.disabledSources, ['Wired']);
  assertEquals(p.morningPush, true);
  assertEquals(normalizePrefs(null).topics, TOPICS);
});

Deno.test('focus topics: only followed ones count, in topic order, at most 4; old rows have none', () => {
  const base = { device_id: 'x', push_token: null, platform: null, timezone: 'Asia/Kolkata', wake_time: '05:30', disabled_sources: null, morning_push: true, updated_at: '' };
  const p = normalizePrefs({ ...base, topics: ['ai', 'movies', 'sports', 'tech', 'crypto', 'world'], focus_topics: ['movies', 'horoscopes', 'climate', 'ai', 'movies', 'sports', 'tech', 'crypto'] });
  assertEquals(p.topics, ['ai', 'movies', 'sports', 'tech', 'crypto', 'world']);
  assertEquals(p.focusTopics, ['ai', 'tech', 'sports', 'movies'], 'climate is not followed; horoscopes is not a topic; the fifth is dropped');
  assertEquals(normalizePrefs({ ...base, topics: ['ai'] }).focusTopics, [], 'rows from before the focus_topics column');
  assertEquals(normalizePrefs({ ...base, topics: ['ai'], focus_topics: null }).focusTopics, []);
  assertEquals(normalizePrefs(null).focusTopics, []);
});

Deno.test('topicOrder: "more of this" first, then the other followed topics, then the rest', () => {
  const order = topicOrder({ topics: ['ai', 'business', 'movies'], focusTopics: ['movies'] });
  assertEquals(order.slice(0, 4), ['movies', 'ai', 'business', 'tech']);
  assertEquals(order.length, TOPICS.length);
  assertEquals(topicOrder(DEFAULT_PREFS), TOPICS);
});

Deno.test('editionMinutes matches the app formula', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'w').join(' ');
  assertEquals(editionMinutes({ summary: [words(100)], stories: [{ headline: words(10), whatHappened: words(250), whyItMatters: words(40) }] }), 2);
  assertEquals(editionMinutes({ summary: [], stories: [] }), 1);
});

Deno.test('breaking pushes default to major; only "off" turns them off', () => {
  const base = { device_id: 'x', push_token: null, platform: null, timezone: 'Asia/Kolkata', wake_time: '05:30', topics: null, disabled_sources: null, morning_push: true, updated_at: '' };
  assertEquals(normalizePrefs(base).breakingPush, 'major');
  assertEquals(normalizePrefs({ ...base, breaking_push: 'off' }).breakingPush, 'off');
  assertEquals(normalizePrefs({ ...base, breaking_push: 'junk' }).breakingPush, 'major');
});
