import { ChevronUp } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GoDeeper } from './GoDeeper';
import { SourceList } from './SourceLinks';
import { Txt } from './Txt';
import type { Story } from '@/data/types';
import { paragraphs } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, fonts, radii } from '@/theme/tokens';

/** Layer 2: everything that loads instantly with the edition, plus Layer 3 at the end. */
export function LearnMore({
  story,
  editionDate,
  onCollapse,
}: {
  story: Story;
  editionDate: string;
  onCollapse: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, { borderTopColor: theme.colors.hairline }]}>
      {story.explainSimply ? (
        <View style={[styles.simple, { backgroundColor: theme.colors.hairline }]}>
          <Txt variant="kicker" tone="secondary">
            Explain it simply
          </Txt>
          <Txt variant="reading">{story.explainSimply}</Txt>
        </View>
      ) : null}

      {story.background ? (
        <Block title="Background">
          {paragraphs(story.background).map((p, i) => (
            <Txt key={i} variant="reading">
              {p}
            </Txt>
          ))}
        </Block>
      ) : null}

      {story.keyPlayers.length > 0 && (
        <Block title="Key players">
          {story.keyPlayers.map((p, i) => (
            <View key={i} style={styles.player}>
              <View style={[styles.dot, { backgroundColor: theme.colors.textTertiary }]} />
              <View style={styles.flex}>
                <Txt variant="label">{p.name}</Txt>
                <Txt variant="body" tone="secondary">
                  {p.role}
                </Txt>
              </View>
            </View>
          ))}
        </Block>
      )}

      {story.keyTerms.length > 0 && (
        <Block title="Key terms">
          {story.keyTerms.map((t, i) => (
            <Txt key={i} variant="reading" tone="secondary">
              <Txt variant="reading" style={styles.term}>
                {t.term}
              </Txt>
              {`  ${t.definition}`}
            </Txt>
          ))}
        </Block>
      )}

      {story.whatToWatch.length > 0 && (
        <Block title="What to watch next">
          {story.whatToWatch.map((w, i) => (
            <View key={i} style={styles.bullet}>
              <View style={[styles.watchDot, { backgroundColor: theme.colors.textTertiary }]} />
              <Txt variant="reading" style={styles.flex}>
                {w}
              </Txt>
            </View>
          ))}
        </Block>
      )}

      {story.allSources.length > 0 && (
        <Block title={`All sources (${story.allSources.length})`}>
          <SourceList sources={story.allSources} />
        </Block>
      )}

      <GoDeeper story={story} editionDate={editionDate} />

      <Pressable
        onPress={onCollapse}
        accessibilityRole="button"
        accessibilityLabel="Show less"
        style={styles.showLess}>
        <Txt variant="label" tone="secondary">
          Show less
        </Txt>
        <View>
          <ChevronUp size={16} color={theme.colors.textSecondary} />
        </View>
      </Pressable>
    </View>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <Txt variant="kicker" tone="tertiary" accessibilityRole="header">
        {title}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 30, paddingTop: 26, borderTopWidth: 1 },
  simple: { padding: 18, gap: 10, borderRadius: radii.md },
  block: { gap: 12 },
  player: { flexDirection: 'row', gap: 12 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 8 },
  term: { fontFamily: fonts.semibold },
  bullet: { flexDirection: 'row', gap: 12 },
  watchDot: { width: 4, height: 4, borderRadius: 2, marginTop: 11 },
  showLess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TAP,
  },
});
