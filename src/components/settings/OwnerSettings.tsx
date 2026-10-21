import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Pill } from '../Pill';
import { toast } from '../Toast';
import { Txt } from '../Txt';
import { Divider, Group, settingsStyles } from './SettingsParts';
import {
  ApiError,
  askOwnerPairing,
  backendConfigured,
  fetchIsOwner,
  fetchOwnerFeedback,
  fetchOwnerStats,
  markFeedbackSeen,
  type FeedbackEntry,
  type FeedbackKind,
  type OwnerStats,
} from '@/data/api';
import { TOPIC_LABEL, type TopicKey } from '@/data/topics';
import { SAMPLE_FEEDBACK, SAMPLE_STATS, ownerSampleOn } from '@/dev/ownerSample';
import { ownerAuth, ownerKeyForPairing } from '@/lib/device';
import { useTheme } from '@/theme/ThemeProvider';
import { themes, type ThemeName } from '@/theme/themes';
import { withAlpha } from '@/theme/tokens';

// The owner's pages in Settings: the feedback inbox and usage. Only a phone the owner paired in the
// Supabase dashboard (private.owner_keys) gets anything back from these calls; other phones don't
// even make them.

let ownerCache: boolean | null = null;
const ownerListeners = new Set<(yes: boolean) => void>();

function setOwnerCache(yes: boolean) {
  ownerCache = yes;
  ownerListeners.forEach((l) => l(yes));
}

/** Whether this phone is paired as the owner's. Asked once per launch; false until known. */
export function useIsOwner(): boolean {
  const [owner, setOwner] = useState(ownerCache ?? ownerSampleOn());
  useEffect(() => {
    ownerListeners.add(setOwner);
    const stop = () => {
      ownerListeners.delete(setOwner);
    };
    if (ownerCache !== null || ownerSampleOn() || !backendConfigured) return stop;
    ownerAuth()
      .then((auth) => (auth ? fetchIsOwner(auth) : false))
      .then(setOwnerCache)
      .catch(() => {});
    return stop;
  }, []);
  return owner;
}

/** Owner-only numbers, fetched when shown. null while loading or for anyone else. */
export function useOwnerStats(enabled: boolean): { stats: OwnerStats | null; error: boolean; reload: () => void } {
  const [stats, setStats] = useState<OwnerStats | null>(() => (ownerSampleOn() ? SAMPLE_STATS : null));
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || ownerSampleOn()) return;
    let alive = true;
    ownerAuth()
      .then((auth) => (auth ? fetchOwnerStats(auth) : null))
      .then((s) => alive && setStats(s))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [enabled, tick]);
  const reload = () => {
    setError(false);
    setTick((t) => t + 1);
  };
  return { stats, error, reload };
}

const KIND_LABEL: Record<FeedbackKind, string> = {
  idea: 'Idea',
  problem: 'Problem',
  praise: 'Something they like',
  other: 'Other',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "21 Oct, 2:05pm" in the phone's time. */
function when(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}`;
}

const themeLabel = (name: string | null) => (name && themes[name as ThemeName]?.label) || name || 'unknown theme';

const SECTION_LABEL: Record<string, string> = {
  summary: 'Summary',
  local: 'Local news',
  radar: 'On the radar',
  markets: 'Markets',
  updates: 'Since this morning',
  other: 'Other',
};
const sectionLabel = (id: string) => TOPIC_LABEL[id as TopicKey] ?? SECTION_LABEL[id] ?? id;

/** Settings → Feedback inbox: everything readers sent, newest first. Opening it marks it read. */
export function FeedbackInbox() {
  const { theme } = useTheme();
  const [items, setItems] = useState<FeedbackEntry[] | null>(() => (ownerSampleOn() ? SAMPLE_FEEDBACK : null));
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (ownerSampleOn()) return;
    let alive = true;
    (async () => {
      try {
        const auth = await ownerAuth();
        const rows = auth ? await fetchOwnerFeedback(auth) : [];
        if (!alive) return;
        setItems(rows);
        // They stay marked "new" on screen until the next visit.
        if (auth) await markFeedbackSeen(auth, rows.filter((r) => !r.seen).map((r) => r.id));
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  const retry = () => {
    setError(false);
    setTick((t) => t + 1);
  };
  if (error) return <Retry text="Couldn’t load feedback." onRetry={retry} />;
  if (!items) return <Note text="Loading feedback…" />;
  if (!items.length) {
    return (
      <Group>
        <Txt variant="body" tone="secondary" align="center" style={styles.note}>
          No feedback yet. When someone sends a note from Settings, it shows up here.
        </Txt>
      </Group>
    );
  }

  const fresh = items.filter((i) => !i.seen).length;
  return (
    <>
      <Txt variant="bodySm" tone="tertiary" style={styles.lead}>
        {items.length} {items.length === 1 ? 'note' : 'notes'}
        {fresh ? ` · ${fresh} new` : ''}
      </Txt>
      {items.map((f) => (
        <Group key={f.id}>
          <View style={styles.entry}>
            <View style={styles.entryHead}>
              {!f.seen && <View style={[styles.newDot, { backgroundColor: theme.colors.accent }]} accessibilityLabel="New" />}
              <Txt variant="label" style={styles.flex} numberOfLines={1}>
                {f.name || 'Anonymous'}
              </Txt>
              <Txt variant="caption" tone="tertiary">
                {when(f.created_at)}
              </Txt>
            </View>
            <Txt variant="kicker" tone="secondary">
              {KIND_LABEL[f.kind] ?? f.kind}
            </Txt>
            <Txt variant="body" selectable>
              {f.message}
            </Txt>
            <Txt variant="caption" tone="tertiary">
              {[themeLabel(f.theme), f.platform, f.app_version].filter(Boolean).join(' · ')}
            </Txt>
          </View>
        </Group>
      ))}
    </>
  );
}

/** Settings → Usage: how many phones use Brewsy, and what they use. */
export function UsageView() {
  const { stats, error, reload } = useOwnerStats(true);
  if (error) return <Retry text="Couldn’t load usage." onRetry={reload} />;
  if (!stats) return <Note text="Loading usage…" />;
  const t = stats.totals_30d;
  return (
    <>
      <Group footer={`Counts include your own phone. “Active” means Brewsy was opened that day. Updated ${when(stats.generated_at)}.`}>
        <View style={styles.tiles}>
          <Tile value={stats.active_today} label="Active today" />
          <Tile value={stats.active_7d} label="This week" />
          <Tile value={stats.active_30d} label="Last 30 days" />
          <Tile value={stats.installs} label="Installs" />
        </View>
      </Group>

      <Group title="Phones using Brewsy, last 14 days">
        <DailyBars daily={stats.daily} />
      </Group>

      <Group title="Last 30 days">
        <Totals
          rows={[
            ['App opens', t.opens],
            ['Stories opened', t.stories_opened],
            ['Editions played', t.listens],
            ['Stories saved', t.saves],
            ['Stories shared', t.shares],
          ]}
        />
      </Group>

      <Ranked title="Themes in use" rows={stats.themes} label={themeLabel} unit="phone" />
      <Ranked
        title="Sections people scroll to (30 days)"
        rows={stats.topics_seen}
        label={sectionLabel}
        unit="day"
        footer="How many reading days reached each section of Today."
      />
      <Ranked
        title="Stories opened, by topic (30 days)"
        rows={stats.topics_opened}
        label={sectionLabel}
        unit="story"
        footer="Learn more, read aloud, or shared."
      />
      <Ranked title="Topics followed" rows={stats.topics_followed} label={sectionLabel} unit="phone" />
      <Ranked
        title="App versions"
        rows={stats.versions}
        label={(v) => (v === 'build' ? 'The APK as installed' : v === 'older app' ? 'An older app' : `Update ${v}`)}
        unit="phone"
        footer="Update ids match the EAS dashboard. Phones still on an older version haven’t restarted Brewsy since."
      />
      <Ranked title="News from" rows={stats.regions} label={(r) => (r === 'unset' ? 'Not chosen' : r)} unit="phone" />
      <Ranked title="Phones" rows={stats.platforms} label={(p) => (p === 'android' ? 'Android' : p === 'ios' ? 'iPhone' : p)} unit="phone" />
      <Txt variant="caption" tone="tertiary" align="center">
        {stats.push_ok} of {stats.installs} can get notifications
      </Txt>
    </>
  );
}

/**
 * Settings → long-press "Connected to your Brewsy backend": pair this phone as the owner's. The phone
 * gets a code; the owner approves it in Supabase → SQL Editor. Anyone can get a code, but only the
 * dashboard can approve one.
 */
export function OwnerPairing({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const owner = useIsOwner();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const paired = () => {
    setOwnerCache(true);
    toast.show('This phone is now the owner’s');
    onDone();
  };

  const ask = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const auth = await ownerKeyForPairing();
      const answer = await askOwnerPairing(auth.deviceId, auth.keyHash);
      if (answer === 'paired') paired();
      else if (answer) setCode(answer);
      else setMessage('The server doesn’t know this phone yet. Close Settings, reopen Brewsy, then try again.');
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Couldn’t get a code. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const auth = await ownerAuth();
      if (auth && (await fetchIsOwner(auth))) paired();
      else setMessage('Not paired yet. Run the line in the SQL Editor, then check again.');
    } catch {
      setMessage('Couldn’t reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  if (owner) {
    return (
      <Group footer="To unpair every phone, run  delete from private.owner_keys;  in the SQL Editor.">
        <Txt variant="body" tone="secondary" style={styles.para}>
          This phone is paired as the owner’s, so it can open the feedback inbox and usage. No other phone can.
        </Txt>
      </Group>
    );
  }

  return (
    <>
      <Group footer="Only someone signed in to your Supabase dashboard can pair a phone. A code on its own opens nothing.">
        <Txt variant="body" tone="secondary" style={styles.para}>
          The feedback inbox and usage open only on a phone you pair. Get a code, then run the line it gives you in
          Supabase → SQL Editor. The code works for an hour.
        </Txt>
        {code && (
          <>
            <Divider />
            <View style={styles.code}>
              <Txt variant="displayS" selectable accessibilityLabel={`Code ${code.split('').join(' ')}`}>
                {`${code.slice(0, 4)} ${code.slice(4)}`}
              </Txt>
              <Txt variant="bodySm" tone="secondary" selectable style={styles.mono}>
                {`select private.brewsy_approve_owner('${code}');`}
              </Txt>
            </View>
          </>
        )}
      </Group>
      <View style={styles.retry}>
        {code ? (
          <View style={styles.buttons}>
            <Pill label={busy ? 'Checking…' : 'Check again'} size="md" variant="glass" color={theme.colors.inverseBg} onPress={busy ? undefined : check} />
            <Pill label="New code" size="md" variant="outline" onPress={busy ? undefined : ask} />
          </View>
        ) : (
          <Pill label={busy ? 'Asking…' : 'Get a code'} size="md" variant="glass" color={theme.colors.inverseBg} onPress={busy ? undefined : ask} />
        )}
        {message && (
          <Txt variant="bodySm" tone="secondary" align="center">
            {message}
          </Txt>
        )}
      </View>
    </>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt variant="displayS">{String(value)}</Txt>
      <Txt variant="caption" tone="tertiary">
        {label}
      </Txt>
    </View>
  );
}

const BAR_MAX = 72;

/** One bar per day; today's is solid, the rest a step lighter. Each day's value is in its label. */
function DailyBars({ daily }: { daily: OwnerStats['daily'] }) {
  const { theme } = useTheme();
  const max = Math.max(1, ...daily.map((d) => d.phones));
  const best = daily.reduce((a, b) => (b.phones > a.phones ? b : a), daily[0]);
  const short = (key: string) => {
    const [, m, d] = key.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]}`;
  };
  const summary = daily.map((d) => `${short(d.day)}: ${d.phones}`).join(', ');
  return (
    <View style={styles.chart} accessible accessibilityLabel={`Phones using Brewsy each day. ${summary}.`}>
      <Txt variant="caption" tone="tertiary">
        Busiest: {best.phones} {best.phones === 1 ? 'phone' : 'phones'} on {short(best.day)}
      </Txt>
      <View style={[styles.bars, { borderBottomColor: theme.colors.hairline }]}>
        {daily.map((d, i) => {
          const last = i === daily.length - 1;
          return (
            <View key={d.day} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  {
                    height: d.phones ? Math.max(4, Math.round((d.phones / max) * BAR_MAX)) : 0,
                    backgroundColor: last ? theme.colors.text : withAlpha(theme.colors.text, 0.42),
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Txt variant="caption" tone="tertiary">
          {short(daily[0].day)}
        </Txt>
        <Txt variant="caption" tone="tertiary">
          Today · {daily[daily.length - 1].phones}
        </Txt>
      </View>
    </View>
  );
}

function Totals({ rows }: { rows: [string, number][] }) {
  return rows.map(([label, n], i) => (
    <View key={label}>
      {i > 0 && <Divider />}
      <View style={styles.row}>
        <Txt variant="label" style={styles.flex}>
          {label}
        </Txt>
        <Txt variant="label">{String(n)}</Txt>
      </View>
    </View>
  ));
}

/** A ranked list: name and count, with a thin bar for the size of each. */
function Ranked({
  title,
  rows,
  label,
  unit,
  footer,
}: {
  title: string;
  rows: { name: string; n: number }[];
  label: (name: string) => string;
  unit: string;
  footer?: string;
}) {
  const { theme } = useTheme();
  if (!rows.length) {
    return (
      <Group title={title}>
        <Txt variant="bodySm" tone="tertiary" style={styles.note}>
          Nothing yet.
        </Txt>
      </Group>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.n));
  const shown = rows.slice(0, 8);
  return (
    <Group title={title} footer={footer}>
      {shown.map((r, i) => (
        <View key={r.name}>
          {i > 0 && <Divider />}
          <View style={styles.rankRow} accessible accessibilityLabel={`${label(r.name)}: ${r.n} ${unit}${r.n === 1 ? '' : 's'}`}>
            <View style={styles.rankHead}>
              <Txt variant="label" style={styles.flex} numberOfLines={1}>
                {label(r.name)}
              </Txt>
              <Txt variant="label" tone="secondary">
                {String(r.n)}
              </Txt>
            </View>
            <View style={[styles.track, { backgroundColor: withAlpha(theme.colors.text, 0.08) }]}>
              <View style={[styles.fill, { width: `${(r.n / max) * 100}%`, backgroundColor: withAlpha(theme.colors.text, 0.55) }]} />
            </View>
          </View>
        </View>
      ))}
      {rows.length > shown.length && (
        <Txt variant="caption" tone="tertiary" style={styles.more}>
          and {rows.length - shown.length} more
        </Txt>
      )}
    </Group>
  );
}

function Note({ text }: { text: string }) {
  return (
    <Txt variant="bodySm" tone="tertiary" align="center" style={styles.note}>
      {text}
    </Txt>
  );
}

function Retry({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={styles.retry}>
      <Txt variant="body" tone="secondary" align="center">
        {text} Check your connection.
      </Txt>
      <Pill label="Try again" size="md" variant="glass" color={theme.colors.inverseBg} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  ...settingsStyles,
  lead: { paddingHorizontal: 6 },
  note: { paddingVertical: 20 },
  retry: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  para: { paddingVertical: 14 },
  buttons: { flexDirection: 'row', gap: 10 },
  code: { paddingVertical: 16, gap: 8, alignItems: 'center' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), textAlign: 'center' },
  entry: { paddingVertical: 14, gap: 6 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newDot: { width: 8, height: 8, borderRadius: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 },
  tile: { width: '50%', paddingVertical: 10, gap: 2 },
  chart: { paddingVertical: 14, gap: 10 },
  bars: { height: BAR_MAX, flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1 },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  // Rounded at the data end only; the base sits on the baseline.
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  rankRow: { paddingVertical: 12, gap: 8 },
  rankHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  more: { paddingBottom: 12 },
});
