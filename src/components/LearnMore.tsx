import { router } from 'expo-router';
import { ArrowUpRight, ChevronUp, Search } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Coverage } from './Coverage';
import { GoDeeper } from './GoDeeper';
import { StoryFeedback } from './StoryFeedback';
import { Txt } from './Txt';
import { Tap } from '@/components/Tap';
import { editionsAtHand } from '@/data/editions';
import type { KeyPlayer, Story } from '@/data/types';
import { formatShortDate, paragraphs } from '@/lib/format';
import { isProperName, plainName, relatedStories, type RelatedStory } from '@/lib/search';
import { markRead } from '@/state/reads';
import { noteStoryOpened } from '@/state/usage';
import { focusStory } from '@/state/storyFocus';
import { useRadius, useTheme } from '@/theme/ThemeProvider';
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
  const radius = useRadius();

  // Opening a story counts as reading it (for the read mark and the end-of-edition tally).
  useEffect(() => {
    markRead(editionDate, story.id);
    noteStoryOpened(story, editionDate, 'more');
  }, [editionDate, story]);

  return (
    <View style={[styles.wrap, { borderTopColor: theme.colors.hairline }]}>
      {story.explainSimply ? (
        <View style={[styles.simple, { backgroundColor: theme.colors.hairline, borderRadius: radius(radii.md) }]}>
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
            <Player key={i} player={p} />
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

      <EarlierInBrewsy story={story} editionDate={editionDate} />

      <Coverage sources={story.allSources} />

      <GoDeeper story={story} editionDate={editionDate} />

      <StoryFeedback story={story} />

      <Tap
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
      </Tap>
    </View>
  );
}

/** A key player. Named people and organizations open a search of recent editions. */
function Player({ player }: { player: KeyPlayer }) {
  const { theme } = useTheme();
  const name = plainName(player.name);
  const searchable = isProperName(player.name);
  const body = (
    <>
      <View style={[styles.dot, { backgroundColor: theme.colors.textTertiary }]} />
      <View style={styles.flex}>
        <Txt variant="label">{player.name}</Txt>
        <Txt variant="body" tone="secondary">
          {player.role}
        </Txt>
      </View>
    </>
  );
  if (!searchable) return <View style={styles.player}>{body}</View>;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/search', params: { q: name } })}
      accessibilityRole="button"
      accessibilityLabel={`${player.name}, ${player.role}`}
      accessibilityHint={`Searches recent editions for ${name}`}
      style={({ pressed }) => [styles.player, pressed && styles.pressed]}>
      {body}
      <View style={styles.playerIcon}>
        <Search size={16} strokeWidth={1.8} color={theme.colors.textTertiary} />
      </View>
    </Pressable>
  );
}

/**
 * The same people and companies in earlier editions this phone has, as a short timeline.
 * Tapping one opens it in its edition on Today.
 */
function EarlierInBrewsy({ story, editionDate }: { story: Story; editionDate: string }) {
  const { theme } = useTheme();
  const [related, setRelated] = useState<RelatedStory[]>([]);

  useEffect(() => {
    let live = true;
    editionsAtHand()
      .then((editions) => live && setRelated(relatedStories(story, editionDate, editions)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [story, editionDate]);

  if (!related.length) return null;

  const open = (r: RelatedStory) => {
    focusStory(r.date, r.story.id);
    router.navigate('/');
  };

  return (
    <Block title="Earlier in Brewsy">
      <View style={[styles.timeline, { borderLeftColor: theme.colors.hairline }]}>
        {related.map((r) => (
          <Pressable
            key={`${r.date}-${r.story.id}`}
            onPress={() => open(r)}
            accessibilityRole="button"
            accessibilityLabel={`${formatShortDate(r.date)}: ${r.story.headline}`}
            accessibilityHint="Opens it in that day's edition"
            style={({ pressed }) => [styles.earlier, pressed && styles.pressed]}>
            <View style={[styles.node, { backgroundColor: theme.colors.textTertiary }]} />
            <View style={styles.flex}>
              <Txt variant="caption" tone="tertiary">
                {formatShortDate(r.date)}
              </Txt>
              <Txt variant="body">{r.story.headline}</Txt>
            </View>
            <View style={styles.playerIcon}>
              <ArrowUpRight size={16} strokeWidth={1.8} color={theme.colors.textTertiary} />
            </View>
          </Pressable>
        ))}
      </View>
    </Block>
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
  wrap: { gap: 28, paddingTop: 24, borderTopWidth: 1 },
  simple: { padding: 18, gap: 10 },
  block: { gap: 12 },
  player: { flexDirection: 'row', gap: 12 },
  playerIcon: { paddingTop: 2 },
  pressed: { opacity: 0.6 },
  timeline: { borderLeftWidth: 1, gap: 18, marginLeft: 1.5 },
  earlier: { flexDirection: 'row', gap: 12, paddingLeft: 16, minHeight: TAP },
  node: { position: 'absolute', left: -3.5, top: 5, width: 6, height: 6, borderRadius: 3 },
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
