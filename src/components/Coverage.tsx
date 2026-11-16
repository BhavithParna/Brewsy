import { ExternalLink } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useVisibleSources } from './SourceLinks';
import { Txt } from './Txt';
import { Tap } from '@/components/Tap';
import {
  OUTLETS_AS_OF,
  OWNERSHIP_LABEL,
  SIGNAL_LABEL,
  headlineSignals,
  outletProfile,
  type OutletProfile,
} from '@/data/outlets';
import type { SourceRef } from '@/data/types';
import { openLink } from '@/lib/links';
import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';

/** "3 Media group · 2 Public broadcaster", most common first. */
function tally(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${n} ${label}`)
    .join(' · ');
}

/**
 * How it was covered: each outlet's own headline for the story, side by side, with where the outlet
 * is based and who owns it, and a tag on headlines worded to be clicked. Above the list, the mix of
 * owners and countries the story was built from.
 */
export function Coverage({ sources: all }: { sources: SourceRef[] }) {
  const { theme } = useTheme();
  const sources = useVisibleSources(all);
  if (sources.length === 0) return null;

  const rows = sources.map((s) => ({ source: s, profile: outletProfile(s.name), signals: headlineSignals(s.title) }));
  // One outlet can appear twice (two articles): count it once in the mix.
  const outlets = new Map<string, OutletProfile | null>();
  for (const r of rows) outlets.set(r.source.name, r.profile);
  const known = [...outlets.values()].filter((v): v is OutletProfile => v !== null);
  const unlisted = outlets.size - known.length;
  const owners = tally(known.map((k) => OWNERSHIP_LABEL[k.ownership]));
  const countries = tally(known.map((k) => k.country));
  const anyTag = rows.some((r) => r.signals.length > 0);

  return (
    <View style={styles.wrap}>
      <Txt variant="kicker" tone="tertiary" accessibilityRole="header">
        {`How it was covered (${sources.length})`}
      </Txt>

      {known.length > 0 && (
        <View style={[styles.mix, { borderColor: theme.colors.hairline }]}>
          <MixLine label="Owners" value={unlisted > 0 ? `${owners} · ${unlisted} not listed` : owners} />
          <MixLine label="Based in" value={countries} />
        </View>
      )}

      <View>
        {rows.map(({ source, profile, signals }, i) => (
          <Tap
            key={`${source.url}-${i}`}
            onPress={() => openLink(source.url)}
            accessibilityRole="link"
            accessibilityLabel={[
              source.name,
              profile ? `${profile.country}, ${OWNERSHIP_LABEL[profile.ownership]}, ${profile.owner}` : null,
              source.title ?? 'read the original',
              ...signals.map((s) => SIGNAL_LABEL[s]),
            ]
              .filter(Boolean)
              .join('. ')}
            style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
            <View style={styles.flex}>
              <Txt variant="kicker" tone="secondary">
                {source.name}
              </Txt>
              <Txt variant="body" style={styles.title}>
                {source.title ?? 'Read the original'}
              </Txt>
              {profile && (
                <Txt variant="caption" tone="tertiary">
                  {`${profile.country} · ${OWNERSHIP_LABEL[profile.ownership]} · ${profile.owner}`}
                </Txt>
              )}
              {signals.length > 0 && (
                <View style={styles.tags}>
                  {signals.map((s) => (
                    <View
                      key={s}
                      style={[
                        styles.tag,
                        {
                          backgroundColor: withAlpha(theme.colors.accent, theme.isDark ? 0.16 : 0.1),
                          borderRadius: Math.min(theme.shape.control, 10),
                        },
                      ]}>
                      <Txt variant="caption" color={theme.colors.text}>
                        {SIGNAL_LABEL[s]}
                      </Txt>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.icon}>
              <ExternalLink size={16} color={theme.colors.textTertiary} />
            </View>
          </Tap>
        ))}
      </View>

      <Txt variant="caption" tone="tertiary">
        {`Ownership as of ${OUTLETS_AS_OF}.${
          anyTag ? ' Tags read the wording of a headline only; they don’t judge the reporting.' : ''
        }`}
      </Txt>
    </View>
  );
}

function MixLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mixLine} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt variant="caption" tone="tertiary" style={styles.mixLabel}>
        {label}
      </Txt>
      <Txt variant="caption" tone="secondary" style={styles.flex}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 12 },
  mix: { gap: 6, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  mixLine: { flexDirection: 'row', gap: 12 },
  mixLabel: { width: 64 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, minHeight: 56 },
  title: { marginTop: 2, marginBottom: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2 },
  icon: { paddingTop: 2 },
});
