import { ScrollView, StyleSheet, View } from 'react-native';

import { GlassCard } from './GlassCard';
import { Txt } from './Txt';
import type { Briefing, Coverage } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, fonts, radii } from '@/theme/tokens';

const n = (x: number) => x.toLocaleString('en-US');

/** One line for the bottom of Today, e.g. "Scanned 1,240 articles from 48 sources · …". */
export function coverageLine(c: Coverage): string {
  const also = c.alsoHappening ? ` + ${c.alsoHappening} also happening` : '';
  return `Scanned ${n(c.articlesScanned)} articles from ${n(c.outlets)} sources · ${n(c.storiesGrouped)} stories grouped · ${c.fullStories} full stories${also}`;
}

/** "How this briefing was made": the numbers from the morning run and the rules behind them. */
export function HowMadeBody({ briefing }: { briefing: Briefing }) {
  const { theme } = useTheme();
  const c = briefing.coverage;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {c ? (
        <GlassCard radius={radii.lg} style={styles.card}>
          <Stat value={n(c.articlesScanned)} label="articles scanned" />
          <Stat value={n(c.outlets)} label={`sources (${c.feedsOk} of ${c.feedsTotal} feeds answered)`} />
          <Stat value={n(c.storiesGrouped)} label="distinct stories after grouping" />
          <Stat value={String(c.fullStories)} label="full stories in this edition" />
          <Stat value={String(c.alsoHappening)} label="in “Also happening”" />
          {c.mustInclude > 0 && <Stat value={String(c.mustInclude)} label="must-include (5+ major outlets or a wire “breaking” flag)" />}
          {c.addedByEditor > 0 && <Stat value={String(c.addedByEditor)} label="added by the second editor check" />}
          {(briefing.sinceThisMorning?.length ?? 0) > 0 && (
            <Stat value={String(briefing.sinceThisMorning!.length)} label="added since this morning" />
          )}
        </GlassCard>
      ) : (
        <Txt variant="body" tone="secondary">
          This edition was made before Brewsy started keeping these numbers.
        </Txt>
      )}

      {c && c.feedsFailed.length > 0 && (
        <Txt variant="caption" tone="tertiary" style={styles.pad}>
          Didn’t answer this morning (tried twice): {c.feedsFailed.join(', ')}.
        </Txt>
      )}

      <View style={styles.steps}>
        <Step n={1} title="Cast a wide net">
          Wire services first (Reuters, Bloomberg, and AP and AFP through Yahoo News), then major newsrooms, tech and AI
          outlets, and official sources (company and AI-lab blogs, the Fed, the White House, SEC filings).
        </Step>
        <Step n={2} title="Group and rank">
          Articles about the same event become one story. Each is scored on how many outlets covered it, how
          trusted they are, its impact, and whether it’s new or an update.
        </Step>
        <Step n={3} title="Never drop the big ones">
          Anything covered by 5 or more major outlets, or flagged as breaking by a wire service, is always included.
          A second editor pass checks everything left out against a list: markets and the Fed, economic data, big
          earnings, AI launches and policy, deals and layoffs, elections, conflicts, disasters, major deaths, breaches
          and outages.
        </Step>
        <Step n={4} title="Facts only from the sources">
          The AI writes only what the articles say, every source link is kept, and anything still unfolding is marked
          “Developing”. During the day, Brewsy checks again every two hours.
        </Step>
      </View>

      {briefing.generatedAt && (
        <Txt variant="caption" tone="tertiary" align="center" style={{ color: theme.colors.textTertiary }}>
          Made {new Date(briefing.generatedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
        </Txt>
      )}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="displayS" style={styles.statValue}>
        {value}
      </Txt>
      <Txt variant="body" tone="secondary" style={styles.flex}>
        {label}
      </Txt>
    </View>
  );
}

function Step({ n: num, title, children }: { n: number; title: string; children: string }) {
  return (
    <View style={styles.step}>
      <Txt variant="label" tone="tertiary" style={styles.stepNum}>
        {num}
      </Txt>
      <View style={styles.flex}>
        <Txt variant="label">{title}</Txt>
        <Txt variant="bodySm" tone="secondary">
          {children}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 16, gap: 22 },
  pad: { paddingHorizontal: 6 },
  card: { paddingHorizontal: 18, paddingVertical: 10 },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 14, paddingVertical: 8 },
  statValue: { minWidth: 64, fontVariant: ['tabular-nums'] },
  steps: { gap: 16 },
  step: { flexDirection: 'row', gap: 12 },
  stepNum: { width: 16, fontFamily: fonts.bold },
});
