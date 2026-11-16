import * as Haptics from 'expo-haptics';
import { Check, Star } from 'lucide-react-native';
import { Fragment } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { GlassCard } from '../GlassCard';
import { toast } from '../Toast';
import { Txt } from '../Txt';
import { Divider, Group } from './SettingsParts';
import { TOPIC_BLURB, TOPIC_LABEL } from '@/data/topics';
import { TOPICS, type Topic } from '@/data/types';
import { updateSettings, useSettings } from '@/state/settings';
import { MAX_FOCUS } from '@/state/storyPrefs';
import { useRadius, useTheme } from '@/theme/ThemeProvider';
import { TAP, radii } from '@/theme/tokens';

/** "More of this" topics a reader can star: the same cap as "More like this" on a story. */
export const MAX_FOCUS_TOPICS = MAX_FOCUS;

function tick() {
  if (Platform.OS !== 'web') Haptics.selectionAsync();
}

/**
 * Following topics and starring the ones the reader wants more of. Shared by Settings and
 * onboarding. Unfollowing a topic also un-stars it.
 */
export function useTopicChoices() {
  const { topics, focusTopics } = useSettings();

  const toggleFollow = (t: Topic) => {
    const on = topics.includes(t);
    if (on && topics.length === 1) {
      toast.show('Keep at least one topic');
      return;
    }
    tick();
    updateSettings({
      topics: on ? topics.filter((x) => x !== t) : TOPICS.filter((x) => x === t || topics.includes(x)),
      focusTopics: on ? focusTopics.filter((x) => x !== t) : focusTopics,
    });
  };

  const toggleFocus = (t: Topic) => {
    const on = focusTopics.includes(t);
    if (!on && focusTopics.length >= MAX_FOCUS_TOPICS) {
      toast.show(`You can star up to ${MAX_FOCUS_TOPICS} topics`);
      return;
    }
    tick();
    updateSettings({
      focusTopics: on ? focusTopics.filter((x) => x !== t) : TOPICS.filter((x) => x === t || focusTopics.includes(x)),
    });
  };

  return { topics, focusTopics, toggleFollow, toggleFocus };
}

/**
 * One topic: a follow checkbox with the topic's name and blurb, and, once it's followed,
 * a star for "more of this". `card` draws it as its own panel (onboarding); `row` sits in a
 * Settings group.
 */
export function TopicChoice({
  topic,
  followed,
  starred,
  onFollow,
  onStar,
  layout = 'row',
}: {
  topic: Topic;
  followed: boolean;
  starred: boolean;
  onFollow: () => void;
  onStar: () => void;
  layout?: 'row' | 'card';
}) {
  const { theme } = useTheme();
  const radius = useRadius();
  const card = layout === 'card';
  const label = TOPIC_LABEL[topic];

  const row = (
    <View style={styles.row}>
      <Pressable
        onPress={onFollow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: followed }}
        accessibilityLabel={`${label}. ${TOPIC_BLURB[topic]}`}
        style={({ pressed }) => [styles.follow, card ? styles.followCard : styles.followRow, pressed && styles.pressed]}>
        <View
          style={[
            styles.check,
            {
              borderRadius: radius(12),
              borderColor: followed ? theme.colors.inverseBg : theme.colors.textTertiary,
              backgroundColor: followed ? theme.colors.inverseBg : 'transparent',
            },
          ]}>
          {followed && <Check size={14} color={theme.colors.inverseText} strokeWidth={3} />}
        </View>
        <View style={styles.text}>
          <Txt variant={card ? 'title' : 'label'}>{label}</Txt>
          <Txt variant="bodySm" tone="tertiary">
            {TOPIC_BLURB[topic]}
          </Txt>
        </View>
      </Pressable>
      {/* The slot is always there, so following a topic never re-wraps its blurb. */}
      <View style={styles.starSlot}>
        {followed && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <Pressable
              onPress={onStar}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityState={{ selected: starred }}
              accessibilityLabel={`More ${label} stories`}
              accessibilityHint={starred ? 'Starred: more stories, shown first' : 'Star for more stories, shown first'}
              style={({ pressed }) => [styles.star, pressed && styles.pressed]}>
              <Star
                size={20}
                strokeWidth={starred ? 1.6 : 1.5}
                color={starred ? theme.colors.accent : theme.colors.textTertiary}
                fill={starred ? theme.colors.accent : 'transparent'}
              />
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );

  if (!card) return row;
  return (
    <GlassCard
      radius={radii.lg}
      style={[styles.card, followed && { borderColor: starred ? theme.colors.accent : theme.colors.textSecondary }]}>
      {row}
    </GlassCard>
  );
}

/** Which topics are in the edition, and which of them get more. */
export function TopicSettings() {
  const { topics, focusTopics, toggleFollow, toggleFocus } = useTopicChoices();

  return (
    <Group footer={`Star up to ${MAX_FOCUS_TOPICS} topics to get more stories on them, shown first on Today.`}>
      {TOPICS.map((t, i) => (
        <Fragment key={t}>
          {i > 0 && <Divider />}
          <TopicChoice
            topic={t}
            followed={topics.includes(t)}
            starred={focusTopics.includes(t)}
            onFollow={() => toggleFollow(t)}
            onStar={() => toggleFocus(t)}
          />
        </Fragment>
      ))}
    </Group>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  follow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: TAP },
  followRow: { paddingVertical: 12 },
  followCard: { paddingVertical: 14, paddingLeft: 18 },
  pressed: { opacity: 0.6 },
  check: { width: 24, height: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  starSlot: { width: TAP, height: TAP, marginLeft: 4, alignItems: 'center', justifyContent: 'center' },
  star: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  card: { paddingRight: 8 },
});
