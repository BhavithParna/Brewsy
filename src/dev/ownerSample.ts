import type { FeedbackEntry, OwnerStats } from '@/data/api';

/**
 * Development helper: on the web preview, `?owner=sample` shows Settings as the owner sees it,
 * with made-up feedback and usage (nothing is fetched or sent). Off in production builds.
 */
export function ownerSampleOn(): boolean {
  if (!__DEV__ || typeof window === 'undefined' || !window.location?.search) return false;
  return new URLSearchParams(window.location.search).get('owner') === 'sample';
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const dayKey = (back: number) => {
  const d = new Date(Date.now() - back * 86400 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const SAMPLE_FEEDBACK: FeedbackEntry[] = [
  {
    id: 3,
    created_at: hoursAgo(2),
    kind: 'idea',
    message: 'Could the morning notification say what the top story is? I’d open it more.',
    name: 'Priya',
    theme: 'whales',
    platform: 'android',
    app_version: '01a15d07',
    seen: false,
  },
  {
    id: 2,
    created_at: hoursAgo(20),
    kind: 'problem',
    message: 'Listening stopped when my screen locked, around the Business section.',
    name: null,
    theme: 'matrix',
    platform: 'android',
    app_version: '01a15cbf',
    seen: false,
  },
  {
    id: 1,
    created_at: hoursAgo(70),
    kind: 'praise',
    message: 'The La La Land theme is gorgeous. The 60-second summary is my favourite part.',
    name: 'Arjun',
    theme: 'lalaland',
    platform: 'android',
    app_version: '01a15cbf',
    seen: true,
  },
];

export const SAMPLE_STATS: OwnerStats = {
  generated_at: new Date().toISOString(),
  installs: 4,
  push_ok: 3,
  seen_7d: 4,
  active_today: 3,
  active_7d: 4,
  active_30d: 4,
  totals_30d: { opens: 61, listens: 9, saves: 14, shares: 5, stories_opened: 48 },
  daily: Array.from({ length: 14 }, (_, i) => ({
    day: dayKey(13 - i),
    phones: [1, 1, 2, 1, 2, 2, 1, 3, 2, 3, 3, 2, 4, 3][i],
    opens: [2, 1, 3, 2, 4, 3, 1, 5, 4, 6, 5, 3, 8, 6][i],
  })),
  themes: [
    { name: 'whales', n: 2 },
    { name: 'matrix', n: 1 },
    { name: 'lalaland', n: 1 },
  ],
  topics_seen: [
    { name: 'summary', n: 22 },
    { name: 'ai', n: 18 },
    { name: 'world', n: 15 },
    { name: 'tech', n: 12 },
    { name: 'oceans', n: 6 },
    { name: 'markets', n: 4 },
  ],
  topics_opened: [
    { name: 'ai', n: 17 },
    { name: 'world', n: 11 },
    { name: 'tech', n: 9 },
    { name: 'business', n: 6 },
    { name: 'oceans', n: 5 },
  ],
  topics_followed: [
    { name: 'ai', n: 4 },
    { name: 'tech', n: 4 },
    { name: 'world', n: 3 },
    { name: 'business', n: 2 },
    { name: 'oceans', n: 1 },
  ],
  regions: [
    { name: 'IN', n: 3 },
    { name: 'CA', n: 1 },
  ],
  versions: [
    { name: '01a15d07', n: 3 },
    { name: '01a15cbf', n: 1 },
  ],
  platforms: [{ name: 'android', n: 4 }],
  feedback_new: 2,
  feedback_total: 3,
};
