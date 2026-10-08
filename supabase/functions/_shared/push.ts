// Sends Expo push notifications (https://docs.expo.dev/push-notifications/sending-notifications/)
// and, optionally, alert emails to the owner.
//
// What the app expects in `data` (src/lib/notifications.ts):
//   morning edition  { kind: 'edition', date }  + categoryId 'edition' ("Listen now" button)
//   breaking news    { kind: 'breaking', date, storyId }
//   problem alert    { kind: 'alert' }

import { editionMinutes } from './prefs.ts';
import type { Briefing, Story } from './types.ts';

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** iOS/Android notification category (action buttons), registered by the app. */
  categoryId?: string;
  /** Android channel; leave unset to use the app's 'default' channel. */
  channelId?: string;
};

/** Breaking-news pushes per day, at most. */
export const MAX_BREAKING_PUSHES = 2;
export const EDITION_CATEGORY = 'edition';

export function editionPush(b: Briefing): PushMessage {
  return {
    title: `Your Brewsy edition is ready ☀️ — ${b.stories.length} stories, ${editionMinutes(b)} min`,
    body: b.stories[0]?.headline ?? 'Tap to read, or Listen now.',
    data: { kind: 'edition', date: b.date },
    categoryId: EDITION_CATEGORY,
  };
}

export function breakingPush(date: string, story: Story): PushMessage {
  return {
    title: `Breaking: ${story.headline}`,
    body: story.dek || story.whatHappened,
    data: { kind: 'breaking', date, storyId: story.id },
  };
}

export function alertPush(subject: string, detail: string): PushMessage {
  return { title: `Brewsy: ${subject}`, body: detail.slice(0, 180), data: { kind: 'alert' } };
}

export type PushResult = { sent: number; failed: number; invalidTokens: string[] };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendExpoPush(tokens: string[], msg: PushMessage, fetchImpl: typeof fetch = fetch): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, invalidTokens: [] };
  const valid = tokens.filter((t) => /^Expo(nent)?PushToken\[.+\]$/.test(t));
  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    // Only needed if "Enhanced push security" is turned on for the Expo project.
    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk.map((to) => ({ to, sound: 'default', priority: 'high', ...msg }))),
    });
    if (!res.ok) {
      result.failed += chunk.length;
      continue;
    }
    const payload = await res.json();
    const tickets: { status: string; details?: { error?: string } }[] = payload?.data ?? [];
    tickets.forEach((t, k) => {
      if (t.status === 'ok') result.sent++;
      else {
        result.failed++;
        if (t.details?.error === 'DeviceNotRegistered') result.invalidTokens.push(chunk[k]);
      }
    });
  }
  return result;
}

/**
 * Emails the owner via Resend (https://resend.com/docs/api-reference/emails/send-email)
 * when RESEND_API_KEY and ALERT_EMAIL are set. Returns whether it was sent.
 * Without a verified domain, Resend only delivers from onboarding@resend.dev
 * to the email address the Resend account was created with.
 */
export async function sendAlertEmail(subject: string, text: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ALERT_EMAIL');
  if (!key || !to) return false;
  const from = Deno.env.get('ALERT_FROM') || 'Brewsy <onboarding@resend.dev>';
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `Brewsy: ${subject}`, text }),
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}
