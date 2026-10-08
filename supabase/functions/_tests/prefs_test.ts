import { assertEquals } from 'jsr:@std/assert@1';

import { type BriefingRow, decideTick, DEFAULT_PREFS, editionMinutes, localParts, normalizePrefs, type Prefs } from '../_shared/prefs.ts';
import { TOPICS } from '../_shared/types.ts';

const IST: Prefs = { ...DEFAULT_PREFS, timezone: 'Asia/Kolkata', wakeTime: '05:30' };
// 2026-10-07 05:30 IST == 2026-10-07T00:00Z
const at = (istHHMM: string, date = '2026-10-07') => {
  const [h, m] = istHHMM.split(':').map(Number);
  return new Date(Date.parse(`${date}T00:00:00Z`) + ((h * 60 + m) - 330) * 60_000);
};
const row = (over: Partial<BriefingRow>): BriefingRow => ({
  date: '2026-10-07', status: 'ready', started_at: null, generated_at: null, pushed_at: null, audio_status: 'ready', ...over,
});

Deno.test('localParts converts to the reader timezone', () => {
  assertEquals(localParts(new Date('2026-10-07T00:00:00Z'), 'Asia/Kolkata'), { date: '2026-10-07', minutes: 330 });
  // 23:00 UTC on the 6th is already the 7th in India.
  assertEquals(localParts(new Date('2026-10-06T23:00:00Z'), 'Asia/Kolkata').date, '2026-10-07');
  assertEquals(localParts(new Date('2026-10-07T03:00:00Z'), 'America/New_York'), { date: '2026-10-06', minutes: 23 * 60 });
});

Deno.test('before the generation window → wait', () => {
  assertEquals(decideTick(at('04:50'), IST, null).action, 'wait');
});

Deno.test('30 min before wake with no edition → generate, dated today', () => {
  const d = decideTick(at('05:00'), IST, null);
  assertEquals(d.action, 'generate');
  assertEquals(d.date, '2026-10-07');
});

Deno.test('fresh generating row → wait; stale → generate', () => {
  const now = at('05:10');
  const fresh = row({ status: 'generating', started_at: new Date(now.getTime() - 3 * 60_000).toISOString() });
  const stale = row({ status: 'generating', started_at: new Date(now.getTime() - 11 * 60_000).toISOString() });
  assertEquals(decideTick(now, IST, fresh).action, 'wait');
  assertEquals(decideTick(now, IST, stale).action, 'generate');
});

Deno.test('recent error waits 30 min before retrying', () => {
  const now = at('05:20');
  assertEquals(decideTick(now, IST, row({ status: 'error', started_at: new Date(now.getTime() - 10 * 60_000).toISOString() })).action, 'wait');
  assertEquals(decideTick(now, IST, row({ status: 'error', started_at: new Date(now.getTime() - 31 * 60_000).toISOString() })).action, 'generate');
});

Deno.test('ready before wake → wait; at/after wake → push', () => {
  assertEquals(decideTick(at('05:15'), IST, row({})).action, 'wait');
  assertEquals(decideTick(at('05:30'), IST, row({})).action, 'push');
  assertEquals(decideTick(at('09:00'), IST, row({})).action, 'push');
});

Deno.test('never push twice', () => {
  assertEquals(decideTick(at('05:40'), IST, row({ pushed_at: '2026-10-07T00:01:00Z' })).action, 'done');
  assertEquals(decideTick(at('23:50'), IST, row({ pushed_at: '2026-10-07T00:01:00Z' })).action, 'done');
});

Deno.test('morning push off → done after generating', () => {
  assertEquals(decideTick(at('06:00'), { ...IST, morningPush: false }, row({})).action, 'done');
});

Deno.test('wake time just after midnight opens the window from midnight', () => {
  const p = { ...IST, wakeTime: '00:10' };
  assertEquals(decideTick(at('00:00'), p, null).action, 'generate');
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

Deno.test('editionMinutes matches the app formula', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'w').join(' ');
  assertEquals(editionMinutes({ summary: [words(100)], stories: [{ headline: words(10), whatHappened: words(250), whyItMatters: words(40) }] }), 2);
  assertEquals(editionMinutes({ summary: [], stories: [] }), 1);
});

// ─── Audio + daytime checks + the late alert ───

const minsAgo = (now: Date, m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const pushed = { pushed_at: '2026-10-07T00:00:00Z' };

Deno.test('audio: made right after the edition (before the push); stale or failed runs are retried, max 3 tries', () => {
  const now = at('05:10');
  assertEquals(decideTick(now, IST, row({ audio_status: null })).action, 'audio');
  assertEquals(decideTick(now, IST, row({ audio_status: 'generating', audio_started_at: minsAgo(now, 3) })).action, 'wait');
  assertEquals(decideTick(now, IST, row({ audio_status: 'generating', audio_started_at: minsAgo(now, 11) })).action, 'audio');
  assertEquals(decideTick(now, IST, row({ audio_status: 'error', audio_started_at: minsAgo(now, 10), audio_attempts: 1 })).action, 'wait');
  assertEquals(decideTick(now, IST, row({ audio_status: 'error', audio_started_at: minsAgo(now, 31), audio_attempts: 2 })).action, 'audio');
  assertEquals(decideTick(now, IST, row({ audio_status: 'error', audio_started_at: minsAgo(now, 31), audio_attempts: 3 })).action, 'wait');
});

Deno.test('the morning push comes before audio once it is wake time', () => {
  assertEquals(decideTick(at('05:30'), IST, row({ audio_status: null })).action, 'push');
  assertEquals(decideTick(at('05:40'), IST, row({ audio_status: null, ...pushed })).action, 'audio');
});

Deno.test('daytime checks: every 2 hours from 7am to 10pm, after the edition and its audio', () => {
  assertEquals(decideTick(at('06:50'), IST, row(pushed)).action, 'done');
  assertEquals(decideTick(at('07:00'), IST, row(pushed)).action, 'update');
  const now = at('09:00');
  assertEquals(decideTick(now, IST, row({ ...pushed, updates_checked_at: minsAgo(now, 60) })).action, 'done');
  assertEquals(decideTick(now, IST, row({ ...pushed, updates_checked_at: minsAgo(now, 115) })).action, 'update');
  assertEquals(decideTick(at('22:10'), IST, row(pushed)).action, 'done');
  // Not while the edition isn't ready.
  assertEquals(decideTick(at('09:00'), IST, row({ status: 'generating', started_at: minsAgo(at('09:00'), 2) })).action, 'wait');
});

Deno.test('late alert: the edition is not ready at wake time', () => {
  assertEquals(decideTick(at('05:20'), IST, null).alert, undefined);
  assertEquals(decideTick(at('05:30'), IST, null).alert, 'late');
  const now = at('05:40');
  assertEquals(decideTick(now, IST, row({ status: 'generating', started_at: minsAgo(now, 3) })).alert, 'late');
  assertEquals(decideTick(now, IST, row({})).alert, undefined);
});

Deno.test('breaking pushes default to major; only "off" turns them off', () => {
  const base = { device_id: 'x', push_token: null, platform: null, timezone: 'Asia/Kolkata', wake_time: '05:30', topics: null, disabled_sources: null, morning_push: true, updated_at: '' };
  assertEquals(normalizePrefs(base).breakingPush, 'major');
  assertEquals(normalizePrefs({ ...base, breaking_push: 'off' }).breakingPush, 'off');
  assertEquals(normalizePrefs({ ...base, breaking_push: 'junk' }).breakingPush, 'major');
});
