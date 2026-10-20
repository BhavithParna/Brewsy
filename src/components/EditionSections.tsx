import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FileDown } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrewsyMark } from './BrewsyMark';
import { GlassCard } from './GlassCard';
import { CUSTOM_HEADINGS, type HeadingProps } from './headings';
import { Pill } from './Pill';
import { Txt } from './Txt';
import type { CalendarEvent, MarketQuote } from '@/data/types';
import { formatMarketChange, formatMarketValue, marketA11yLabel } from '@/lib/format';
import { noteReadingDay, streakDays, useReads } from '@/state/reads';
import { useRadius, useTheme } from '@/theme/ThemeProvider';
import { GUTTER, TAP, fonts, radii, withAlpha } from '@/theme/tokens';

/**
 * Opens each section, in the theme's style: a centered rule, a large title, a photo card with a
 * giant word, a terminal prompt or a circuit trace. Themes in packs can draw their own
 * (components/headings). Topic sections pass `cover` (they can open on a photo card) and `index`.
 */
export function TopicHeading(props: HeadingProps) {
  const { theme } = useTheme();
  const Custom = CUSTOM_HEADINGS[theme.name];
  if (Custom) return <Custom {...props} />;
  return <BuiltInHeading {...props} />;
}

function BuiltInHeading({ label, count, cover, imageUrl }: HeadingProps) {
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
    // Framed themes draw the rule double, like their cards.
    const line =
      theme.surface === 'framed'
        ? [styles.doubleLine, { borderColor: theme.colors.hairline }]
        : [styles.line, { backgroundColor: theme.colors.hairline }];
    return (
      <View style={styles.rule} accessible accessibilityRole="header" accessibilityLabel={a11y}>
        <View style={styles.ruleRow}>
          <View style={line} />
          <Txt variant="displayM">{label}</Txt>
          <View style={line} />
        </View>
        {countLabel && (
          <Txt variant="spaced" tone="tertiary" align="center">
            {countLabel}
          </Txt>
        )}
      </View>
    );
  }

  if (theme.layout.sections === 'prompt') {
    // A terminal line: > also_happening_
    const accent = theme.colors.accent;
    return (
      <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={a11y}>
        <Txt variant="displayL" style={styles.flexShrink} numberOfLines={1} adjustsFontSizeToFit>
          <Txt variant="displayL" color={accent}>
            {'> '}
          </Txt>
          {label.toLowerCase().replace(/ /g, '_')}
          <Txt variant="displayL" color={accent}>
            _
          </Txt>
        </Txt>
        {countLabel && (
          <Txt variant="caption" tone="tertiary" style={styles.noShrink}>
            {countLabel}
          </Txt>
        )}
      </View>
    );
  }

  if (theme.layout.sections === 'circuit') {
    // The title over a trace: a bright lead, a dim line, and a hollow node at the end.
    const accent = theme.colors.accent;
    return (
      <View style={styles.circuit} accessible accessibilityRole="header" accessibilityLabel={a11y}>
        <View style={styles.circuitRow}>
          <Txt variant="displayL" style={styles.flexShrink} numberOfLines={1} adjustsFontSizeToFit>
            {label}
          </Txt>
          {countLabel && (
            <Txt variant="kicker" color={accent} style={styles.noShrink}>
              {countLabel}
            </Txt>
          )}
        </View>
        <View style={styles.trace}>
          <View style={[styles.traceLead, { backgroundColor: accent }]} />
          <View style={[styles.traceLine, { backgroundColor: withAlpha(accent, 0.4) }]} />
          <View style={[styles.traceNode, { borderColor: accent }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={a11y}>
      <Txt variant="displayL" style={styles.flexShrink} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Txt>
      {countLabel && (
        <Txt
          variant="label"
          color={theme.name === 'alpine' ? theme.colors.accent : theme.colors.textTertiary}
          style={styles.noShrink}>
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
  /** Today's edition isn't out yet and this earlier one is standing in. */
  earlier?: boolean;
  onPrevious: () => void;
  onBackToToday?: () => void;
  /** The edition's date and the stories shown in it, for "3 of 12 stories opened". */
  editionDate?: string;
  storyIds?: string[];
};

/** The clear finish line of the edition. */
export function EndOfEdition({
  wakeLabel,
  isToday,
  dateLabel,
  onExport,
  exporting,
  earlier,
  onPrevious,
  onBackToToday,
  editionDate,
  storyIds,
}: EndProps) {
  const { theme } = useTheme();
  const caughtUp = isToday && !earlier;
  return (
    <View style={styles.end}>
      <BrewsyMark size={30} />
      <Txt variant="displayM" align="center" accessibilityRole="header">
        {caughtUp ? 'You’re all caught up' : 'That’s the whole edition'}
      </Txt>
      <Txt variant="body" tone="secondary" align="center">
        {caughtUp ? `See you tomorrow at ${wakeLabel}.` : `You've read the ${dateLabel} edition.`}
      </Txt>
      <ReadingTally isToday={isToday} editionDate={editionDate} storyIds={storyIds} />
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
          <Txt variant="label">{caughtUp ? 'Read yesterday’s →' : 'Read the day before →'}</Txt>
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

/**
 * A quiet tally under the sign-off: how many stories were opened, and how many days in a row the
 * edition has been read (from two days on). Nothing at all when there's nothing to say.
 */
function ReadingTally({
  isToday,
  editionDate,
  storyIds,
}: {
  isToday: boolean;
  editionDate?: string;
  storyIds?: string[];
}) {
  const { theme } = useTheme();
  const reads = useReads();

  useEffect(() => {
    if (isToday) noteReadingDay();
  }, [isToday]);

  const openedIds = editionDate ? (reads.byEdition[editionDate] ?? []) : [];
  const total = storyIds?.length ?? 0;
  const opened = storyIds ? storyIds.filter((id) => openedIds.includes(id)).length : 0;
  const streak = isToday ? streakDays(reads.days) : 0;
  const showOpened = opened > 0 && total > 0;
  const showStreak = streak >= 2;
  if (!showOpened && !showStreak) return null;

  return (
    <GlassCard radius={radii.lg} style={styles.tally}>
      {showOpened && (
        <View
          style={styles.tallyCell}
          accessible
          accessibilityLabel={`You opened ${opened} of ${total} stories`}>
          <Txt variant="displayS" align="center">
            {opened === total && total > 1 ? `All ${total}` : `${opened} of ${total}`}
          </Txt>
          <Txt variant="caption" tone="tertiary" align="center">
            {total === 1 ? 'story opened' : 'stories opened'}
          </Txt>
        </View>
      )}
      {showOpened && showStreak && <View style={[styles.tallyRule, { backgroundColor: theme.colors.hairline }]} />}
      {showStreak && (
        <View style={styles.tallyCell} accessible accessibilityLabel={`${streak} days in a row`}>
          <Txt variant="displayS" align="center">
            {`${streak} days`}
          </Txt>
          <Txt variant="caption" tone="tertiary" align="center">
            in a row
          </Txt>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: GUTTER },
  flexShrink: { flexShrink: 1 },
  noShrink: { flexShrink: 0 },
  coverCard: { height: 176, overflow: 'hidden', borderWidth: 1, justifyContent: 'flex-end' },
  coverChip: { position: 'absolute', top: 14, left: 14 },
  chip: { paddingHorizontal: 12, height: 28, justifyContent: 'center' },
  coverWord: { paddingHorizontal: 16, paddingBottom: 8 },
  rule: { gap: 10, paddingHorizontal: GUTTER },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  line: { flex: 1, height: 1 },
  doubleLine: { flex: 1, height: 4, borderTopWidth: 1, borderBottomWidth: 1 },
  circuit: { gap: 10, paddingHorizontal: GUTTER + 2 },
  circuitRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  trace: { flexDirection: 'row', alignItems: 'center', height: 7 },
  traceLead: { width: 44, height: 3 },
  traceLine: { flex: 1, height: 1 },
  traceNode: { width: 7, height: 7, borderWidth: 1.5 },
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
  tally: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 8, paddingVertical: 14 },
  tallyCell: { minWidth: 128, gap: 2, paddingHorizontal: 22 },
  tallyRule: { width: 1, alignSelf: 'stretch' },
  exportPill: { marginTop: 6 },
  links: { flexDirection: 'row', gap: 22, alignItems: 'center' },
  link: { minHeight: TAP, justifyContent: 'center' },
});
