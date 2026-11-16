import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useEffect, type Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { BookmarkButton } from './BookmarkButton';
import { GlassCard } from './GlassCard';
import { LearnMore } from './LearnMore';
import { NowPlayingBars } from './listen/NowPlayingBars';
import { StoryPlayButton } from './listen/StoryPlayButton';
import { Pill } from './Pill';
import { ShareButton } from './ShareButton';
import { SourceLinks } from './SourceLinks';
import { StoryImage } from './StoryImage';
import { Txt } from './Txt';
import { WhyItMatters } from './WhyItMatters';
import { Tap } from '@/components/Tap';
import { usePlayer, usePlayingKey } from '@/audio/store';
import type { Story } from '@/data/types';
import { storyKey } from '@/state/readingList';
import { markRead, useIsRead } from '@/state/reads';
import { noteStoryOpened } from '@/state/usage';
import { useRadius, useTheme } from '@/theme/ThemeProvider';
import { TOPIC_LABEL } from '@/theme/themes';
import { TAP, capsLabel, radii, withAlpha } from '@/theme/tokens';

type Props = {
  story: Story;
  editionDate: string;
  /** Show the photo (only the top story or two). */
  showImage?: boolean;
  /** Show the topic label (off inside a topic section, which already says it). */
  showTopic?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Starts the audio briefing at this story. */
  onPlay?: () => void;
  /** Added since your last visit. */
  isNew?: boolean;
  /** For the first-run tour: play, share and save, and the Learn more button. */
  actionsRef?: Ref<View>;
  moreRef?: Ref<View>;
  style?: StyleProp<ViewStyle>;
};

/** "2:14 PM" */
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Smoothly pushes the content below down when a story opens or closes.
export const storyLayout = LinearTransition.springify().damping(22).stiffness(170);

/** One story on a frosted panel, readable in place. Layer 1 always; Layer 2 + 3 when expanded. */
export function StoryView({
  story,
  editionDate,
  showImage,
  showTopic = true,
  expanded,
  onToggle,
  onLayout,
  onPlay,
  isNew,
  actionsRef,
  moreRef,
  style,
}: Props) {
  const { theme } = useTheme();
  const radius = useRadius();
  const key = storyKey(editionDate, story.id);
  const nowPlaying = usePlayingKey() === key;
  const playing = usePlayer((s) => s.playing);
  const read = useIsRead(editionDate, story.id);

  // Hearing a story read aloud counts as reading it.
  useEffect(() => {
    if (!nowPlaying || !playing) return;
    markRead(editionDate, story.id);
    noteStoryOpened(story, editionDate, 'listen');
  }, [nowPlaying, playing, editionDate, story]);

  return (
    <Animated.View layout={storyLayout} onLayout={onLayout} style={style}>
      <GlassCard
        radius={radii.xl}
        // While this story is being read aloud, its edge picks up the accent.
        style={[styles.story, nowPlaying && { borderColor: withAlpha(theme.colors.accent, 0.6) }]}>
        <View style={styles.meta}>
          <View style={styles.metaLeft}>
            {showTopic && (
              <Txt variant="kicker" tone="secondary">
                {TOPIC_LABEL[story.topic]}
              </Txt>
            )}
            {nowPlaying ? (
              <View style={styles.nowPlaying}>
                <NowPlayingBars color={theme.colors.accent} playing={playing} size={12} />
                <Txt variant="caption" color={theme.colors.accent}>
                  {playing ? 'Now playing' : 'Paused'}
                </Txt>
              </View>
            ) : read && !expanded ? (
              // Opened before: a quiet mark in place of the reading time.
              <View
                style={styles.readMark}
                accessible
                accessibilityLabel={story.addedAt ? `${timeLabel(story.addedAt)}, read` : 'Read'}>
                <Check size={12} strokeWidth={2.4} color={theme.colors.textTertiary} />
                <Txt variant="caption" tone="tertiary">
                  {story.addedAt ? timeLabel(story.addedAt) : 'Read'}
                </Txt>
              </View>
            ) : (
              <Txt variant="caption" tone="tertiary">
                {story.addedAt ? timeLabel(story.addedAt) : `${story.readTimeMinutes} min read`}
              </Txt>
            )}
          </View>
          <View ref={actionsRef} style={styles.metaRight}>
            {onPlay && <StoryPlayButton playKey={key} label={story.headline} onPlay={onPlay} />}
            <ShareButton story={story} editionDate={editionDate} />
            <BookmarkButton story={story} editionDate={editionDate} />
          </View>
        </View>

        {(isNew || story.developing) && (
          <View style={styles.badges}>
            {isNew && <Pill label="New" variant="solid" color={theme.colors.accent} />}
            {story.developing && <Pill label="Developing" variant="outline" />}
          </View>
        )}

        <Txt variant="headline" accessibilityRole="header">
          {story.headline}
        </Txt>

        {showImage && story.imageUrl && (
          <View style={[styles.image, { borderRadius: radius(radii.md) }]}>
            <StoryImage uri={story.imageUrl} />
          </View>
        )}

        <StoryBody story={story} />

        <Tap
          ref={moreRef}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Show less' : 'Learn more about this story'}
          style={[styles.toggle, { borderColor: theme.colors.glassBorder, borderRadius: theme.shape.control }]}>
          <Txt variant="label" style={theme.layout.capsButtons && capsLabel}>
            {expanded ? 'Show less' : 'Learn more'}
          </Txt>
          <View>
            {expanded ? (
              <ChevronUp size={16} color={theme.colors.text} />
            ) : (
              <ChevronDown size={16} color={theme.colors.text} />
            )}
          </View>
        </Tap>

        {expanded && (
          <Animated.View entering={FadeIn.duration(280).delay(80)} exiting={FadeOut.duration(140)}>
            <LearnMore story={story} editionDate={editionDate} onCollapse={onToggle} />
          </Animated.View>
        )}
      </GlassCard>
    </Animated.View>
  );
}

/** Layer 1 text: What happened, Why it matters, and the source links. */
export function StoryBody({ story }: { story: Story }) {
  return (
    <>
      <View style={styles.section}>
        <Txt variant="kicker" tone="secondary">
          What happened
        </Txt>
        <Txt variant="reading">{story.whatHappened}</Txt>
      </View>

      <WhyItMatters>{story.whyItMatters}</WhyItMatters>

      <SourceLinks sources={story.sources} />
    </>
  );
}

const styles = StyleSheet.create({
  story: { gap: 16, padding: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  // The buttons are bare icons in 40pt boxes: pulled right so the last icon lines up with the text edge.
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: -10 },
  nowPlaying: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readMark: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', gap: 8, marginTop: -4 },
  image: { height: 188, overflow: 'hidden', marginHorizontal: -6 },
  section: { gap: 8 },
  toggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TAP,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
});
