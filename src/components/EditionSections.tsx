import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FileDown } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrewsyMark } from './BrewsyMark';
import { GlassCard } from './GlassCard';
import { Pill } from './Pill';
import { Txt } from './Txt';
import type { CalendarEvent, MarketQuote } from '@/data/types';
import { formatMarketChange, formatMarketValue, marketA11yLabel } from '@/lib/format';
import { useRadius, useTheme } from '@/theme/ThemeProvider';
import { GUTTER, TAP, fonts, radii } from '@/theme/tokens';

type HeadingProps = {
  label: string;
  count?: number;
  /** Topic sections can open on a photo card (Space); other sections never do. */
  cover?: boolean;
  /** Photo for the cover card: the lead story's image when it has one. */
  imageUrl?: string | null;
};

/** Opens each section, in the theme's style: a centered rule, a large title, or a photo card with a giant word. */
export function TopicHeading({ label, count, cover, imageUrl }: HeadingProps) {
  const { theme } = useTheme();
  const radius = useRadius();
  const countLabel = count != null ? `${count} ${count === 1 ? 'story' : 'stories'}` : null;
  const a11y = countLabel ? `${label}, ${countLabel}` : label;

  if (theme.layout.sections === 'cover' && cover) {
    return (
      <View style={styles.pad} accessible accessibilityRole="header" accessibilityLabel={a11y}>
        <View style={[styles.coverCard, { borderRadius: radius(radii.xl), borderColor: theme.colors.cardBorder }]}>
          <Image
            source={imageUrl ? { uri: imageUrl } : theme.cover}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            accessible={false}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          {countLabel && (
            <View style={styles.coverChip}>
              <GlassCard variant="overlay" radius={radii.pill} style={styles.chip}>
                <Txt variant="caption" color="#FFFFFF">
                  {countLabel}
                </Txt>
              </GlassCard>
            </View>
          )}
          {/* The word runs off the bottom edge, like a magazine section opener. */}
          <Txt
            variant="mega"
            color="rgba(255, 255, 255, 0.92)"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.coverWord}>
            {label}
          </Txt>
        </View>
      </View>
    );
  }

  if (theme.layout.sections === 'rule') {
    return (
      <View style={styles.rule} accessible accessibilityRole="header" accessibilityLabel={a11y}>
        <View style={styles.ruleRow}>
          <View style={[styles.line, { backgroundColor: theme.colors.hairline }]} />
          <Txt variant="displayM">{label}</Txt>
          <View style={[styles.line, { backgroundColor: theme.colors.hairline }]} />
        </View>
        {countLabel && (
          <Txt variant="spaced" tone="tertiary" align="center">
            {countLabel}
          </Txt>
        )}
      </View>
    );
  }

  return (
    <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={a11y}>
      <Txt variant="displayL" style={styles.flexShrink} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Txt>
      {countLabel && (
        <Txt variant="label" color={theme.name === 'alpine' ? theme.colors.accent : theme.colors.textTertiary}>
          {countLabel}
        </Txt>
      )}
    </View>
  );
}

/** Compact markets table: one line per quote. */
export function MarketsTable({ quotes, isSample }: { quotes: MarketQuote[]; isSample?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.pad}>
      <GlassCard radius={radii.lg} style={styles.table}>
        {quotes.map((q, i) => {
          const color = q.change >= 0 ? theme.colors.up : theme.colors.down;
          return (
            <View
              key={q.id}
              accessible
              accessibilityLabel={marketA11yLabel(q)}
              style={[styles.marketRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
              <Txt variant="label" style={styles.flex}>
                {q.label}
              </Txt>
              <Txt variant="label" style={styles.num}>
                {formatMarketValue(q)}
              </Txt>
              <Txt variant="caption" color={color} style={styles.change}>
                {formatMarketChange(q)}
              </Txt>
            </View>
          );
        })}
      </GlassCard>
      {isSample && (
        <Txt variant="caption" tone="tertiary" style={styles.note}>
          Sample values. Live numbers arrive with the backend.
        </Txt>
      )}
    </View>
  );
}

/** "On the radar": a short list of scheduled events. */
export function RadarList({ events }: { events: CalendarEvent[] }) {
  const { theme } = useTheme();
  return (
    <View style={styles.pad}>
      <GlassCard radius={radii.lg} style={styles.table}>
        {events.map((e, i) => (
          <View
            key={i}
            style={[styles.radarRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}
            accessible
            accessibilityLabel={`${e.time ?? ''} ${e.title}`}>
            <Txt variant="kicker" tone="secondary" style={styles.time}>
              {e.time ?? ''}
            </Txt>
            <Txt variant="body" style={styles.flex}>
              {e.title}
            </Txt>
          </View>
        ))}
      </GlassCard>
    </View>
  );
}

type EndProps = {
  wakeLabel: string;
  isToday: boolean;
  dateLabel: string;
  onExport: () => void;
  exporting: boolean;
  onPrevious: () => void;
  onBackToToday?: () => void;
};

/** The clear finish line of the edition. */
export function EndOfEdition({
  wakeLabel,
  isToday,
  dateLabel,
  onExport,
  exporting,
  onPrevious,
  onBackToToday,
}: EndProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.end}>
      <BrewsyMark size={30} />
      <Txt variant="displayM" align="center" accessibilityRole="header">
        {isToday ? 'You’re all caught up' : 'That’s the whole edition'}
      </Txt>
      <Txt variant="body" tone="secondary" align="center">
        {isToday ? `See you tomorrow at ${wakeLabel}.` : `You've read the ${dateLabel} edition.`}
      </Txt>
      <Pill
        label={exporting ? 'Making PDF…' : 'Export as PDF'}
        size="md"
        variant="glass"
        icon={<FileDown size={15} color={theme.colors.text} strokeWidth={2} />}
        onPress={exporting ? undefined : onExport}
        accessibilityLabel="Export this edition as a PDF"
        style={styles.exportPill}
      />
      <View style={styles.links}>
        <Pressable onPress={onPrevious} accessibilityRole="link" style={styles.link}>
          <Txt variant="label">
            {isToday ? 'Read yesterday’s →' : 'Read the day before →'}
          </Txt>
        </Pressable>
        {onBackToToday && (
          <Pressable onPress={onBackToToday} accessibilityRole="link" style={styles.link}>
            <Txt variant="label" tone="secondary">
              Back to today
            </Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: GUTTER },
  flexShrink: { flexShrink: 1 },
  coverCard: { height: 176, overflow: 'hidden', borderWidth: 1, justifyContent: 'flex-end' },
  coverChip: { position: 'absolute', top: 14, left: 14 },
  chip: { paddingHorizontal: 12, height: 28, justifyContent: 'center' },
  coverWord: { paddingHorizontal: 14, marginBottom: -14 },
  rule: { gap: 10, paddingHorizontal: GUTTER },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  line: { flex: 1, height: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: GUTTER + 2,
  },
  table: { paddingHorizontal: 18 },
  marketRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 12 },
  num: { fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] },
  change: { width: 66, textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { marginTop: 10, paddingLeft: 6 },
  radarRow: { flexDirection: 'row', gap: 14, alignItems: 'baseline', paddingVertical: 14 },
  time: { width: 72 },
  end: { alignItems: 'center', gap: 14, paddingHorizontal: GUTTER + 12, paddingTop: 12 },
  exportPill: { marginTop: 6 },
  links: { flexDirection: 'row', gap: 22, alignItems: 'center' },
  link: { minHeight: TAP, justifyContent: 'center' },
});
