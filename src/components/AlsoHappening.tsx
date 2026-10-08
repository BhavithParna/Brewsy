import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BookmarkButton } from './BookmarkButton';
import { GlassCard } from './GlassCard';
import { GoDeeper } from './GoDeeper';
import { Pill } from './Pill';
import { SourceLinks } from './SourceLinks';
import { storyLayout } from './StoryView';
import { Txt } from './Txt';
import type { AlsoItem, Story } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';
import { TOPIC_LABEL } from '@/theme/themes';
import { GUTTER, TAP, radii, withAlpha } from '@/theme/tokens';

/** An "Also happening" line as a Story, so it can be saved, explained and asked about. */
export function alsoToStory(a: AlsoItem): Story {
  return {
    id: a.id,
    topic: a.topic,
    headline: a.headline,
    dek: '',
    whatHappened: a.whatHappened,
    whyItMatters: a.whyItMatters,
    explainSimply: '',
    background: '',
    keyPlayers: [],
    keyTerms: [],
    whatToWatch: [],
    readTimeMinutes: 1,
    sources: a.sources.slice(0, 4),
    allSources: a.sources,
    imageUrl: null,
    developing: a.developing,
  };
}

/** One line per item; tap a line for the short version, sources, save and Go deeper. */
export function AlsoHappening({ items, editionDate }: { items: AlsoItem[]; editionDate: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <View style={styles.list}>
      <GlassCard radius={radii.lg} style={styles.card}>
        {items.map((item, i) => (
          <AlsoRow
            key={item.id}
            item={item}
            editionDate={editionDate}
            first={i === 0}
            open={openId === item.id}
            onToggle={() => setOpenId((id) => (id === item.id ? null : item.id))}
          />
        ))}
      </GlassCard>
    </View>
  );
}

function AlsoRow({
  item,
  editionDate,
  first,
  open,
  onToggle,
}: {
  item: AlsoItem;
  editionDate: string;
  first: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const story = alsoToStory(item);

  return (
    <Animated.View
      layout={storyLayout}
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
      <View style={styles.lineRow}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${item.headline}${item.developing ? '. Developing' : ''}`}
          accessibilityHint={open ? 'Hides the details' : 'Shows what happened and the sources'}
          style={styles.linePress}>
          <View style={styles.flex}>
            <Txt variant="kicker" tone="tertiary" style={styles.topic}>
              {TOPIC_LABEL[item.topic]}
            </Txt>
            <Txt variant="body">{item.headline}</Txt>
            {item.developing && (
              <View style={styles.badge}>
                <Pill label="Developing" variant="outline" />
              </View>
            )}
          </View>
          <View style={styles.chevron}>
            {open ? (
              <ChevronUp size={16} color={theme.colors.textTertiary} />
            ) : (
              <ChevronDown size={16} color={theme.colors.textTertiary} />
            )}
          </View>
        </Pressable>
        <BookmarkButton story={story} editionDate={editionDate} />
      </View>

      {open && (
        <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(120)} style={styles.details}>
          <Txt variant="reading">{item.whatHappened}</Txt>
          {item.whyItMatters !== '' && (
            <View style={[styles.why, { borderLeftColor: withAlpha(theme.colors.accent, 0.55) }]}>
              <Txt variant="kicker" tone="tertiary">
                Why it matters
              </Txt>
              <Txt variant="reading">{item.whyItMatters}</Txt>
            </View>
          )}
          <SourceLinks sources={story.sources} />
          <GoDeeper story={story} editionDate={editionDate} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: GUTTER },
  card: { paddingHorizontal: 18, paddingVertical: 4 },
  row: { paddingVertical: 12 },
  topic: { marginBottom: 4 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  linePress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: TAP,
    paddingVertical: 4,
  },
  badge: { flexDirection: 'row', marginTop: 8 },
  chevron: { marginTop: 3 },
  details: { gap: 16, paddingTop: 12 },
  why: { gap: 8, borderLeftWidth: 2, paddingLeft: 14 },
});
