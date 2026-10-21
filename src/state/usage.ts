import { todayKey } from '@/data/editions';
import { createPersistedStore } from '@/lib/persisted';

/**
 * How the app was used, per local day, for the owner's usage view (Settings → Usage, on the
 * owner's phone only). Counts only: no story ids, no text. Kept here until the server has the
 * day (hooks/useUsage.ts sends it), then older days are dropped.
 */
export type DayUsage = {
  /** Times the app was opened or came back after a while away. */
  opens: number;
  /** Sections of Today scrolled to: topic ids ('ai', 'oceans'), or 'summary', 'local', 'radar', … */
  topics: string[];
  /** Stories opened (Learn more, read aloud, shared), by topic. */
  opened: Record<string, number>;
  /** Editions played from the top ("Listen"). */
  listens: number;
  saves: number;
  shares: number;
};

export type UsageState = { days: Record<string, DayUsage> };

const EMPTY_DAY: DayUsage = { opens: 0, topics: [], opened: {}, listens: 0, saves: 0, shares: 0 };
/** Days kept while the server can't be reached (it only accepts the last few days). */
const KEEP_DAYS = 4;
const ID = /^[a-z_-]{1,24}$/;

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function clean(stored: unknown): UsageState {
  const days: Record<string, DayUsage> = {};
  const raw = (stored as Partial<UsageState> | null)?.days;
  if (raw && typeof raw === 'object') {
    for (const [day, u] of Object.entries(raw)) {
      if (!isDay(day) || !u || typeof u !== 'object') continue;
      const opened: Record<string, number> = {};
      for (const [k, n] of Object.entries(u.opened ?? {})) if (ID.test(k)) opened[k] = count(n);
      days[day] = {
        opens: count(u.opens),
        topics: Array.isArray(u.topics) ? u.topics.filter((t) => typeof t === 'string' && ID.test(t)) : [],
        opened,
        listens: count(u.listens),
        saves: count(u.saves),
        shares: count(u.shares),
      };
    }
  }
  return { days };
}

export const usageStore = createPersistedStore<UsageState>('brewsy:usage', { days: {} }, clean);

let hydration: Promise<void> | null = null;

/** Loads what was saved, once; every writer waits for it so nothing saved is overwritten. */
export function hydrateUsage(): Promise<void> {
  hydration ??= usageStore.hydrate();
  return hydration;
}

function bump(change: (day: DayUsage) => DayUsage) {
  void hydrateUsage().then(() =>
    usageStore.set((s) => {
      const today = todayKey();
      const days = { ...s.days, [today]: change(s.days[today] ?? EMPTY_DAY) };
      for (const old of Object.keys(days).sort().slice(0, -KEEP_DAYS)) delete days[old];
      return { days };
    }),
  );
}

export const noteOpen = () => bump((d) => ({ ...d, opens: d.opens + 1 }));
export const noteListen = () => bump((d) => ({ ...d, listens: d.listens + 1 }));
export const noteSave = () => bump((d) => ({ ...d, saves: d.saves + 1 }));

/** A section of Today came into view (section ids as Today uses them: 'topic:ai', 'summary', …). */
export function noteSection(sectionId: string) {
  const id = sectionId.replace(/^topic:/, '');
  if (!ID.test(id) || usageStore.get().days[todayKey()]?.topics.includes(id)) return;
  bump((d) => (d.topics.includes(id) ? d : { ...d, topics: [...d.topics, id] }));
}

/** Stories already counted since launch, so pausing and resuming or reopening doesn't count twice. */
const counted = new Set<string>();

/** A story was opened: its Learn more, read aloud, or shared. */
export function noteStoryOpened(
  story: { id: string; topic?: string },
  editionDate: string,
  how: 'more' | 'listen' | 'share',
) {
  const once = `${how}|${editionDate}|${story.id}`;
  if (how !== 'share' && counted.has(once)) return;
  counted.add(once);
  const key = story.topic && ID.test(story.topic) ? story.topic : 'other';
  bump((d) => ({
    ...d,
    opened: { ...d.opened, [key]: (d.opened[key] ?? 0) + 1 },
    shares: how === 'share' ? d.shares + 1 : d.shares,
  }));
}

/** Days the server already has in full: everything before today. Today keeps counting. */
export function forgetSentDays(sent: string[]) {
  const today = todayKey();
  usageStore.set((s) => {
    const days = { ...s.days };
    for (const day of sent) if (day < today) delete days[day];
    return { days };
  });
}
