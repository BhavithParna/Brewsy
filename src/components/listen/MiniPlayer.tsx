import { Pause, Play, SkipForward } from 'lucide-react-native';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '../GlassCard';
import { useSheets } from '../SheetHost';
import { TAB_BAR_HEIGHT } from '../TabBar';
import { Txt } from '../Txt';
import { NowPlayingBars } from './NowPlayingBars';
import { next, toggle } from '@/audio/engine';
import { usePlayer } from '@/audio/store';
import { tabBarHidden } from '@/hooks/useScrollChrome';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, TAP, radii, shadows } from '@/theme/tokens';

export const MINI_PLAYER_HEIGHT = 58;
const GAP = 10;

/** Slim floating player above the tab bar. Tap it to open the full player. */
export function MiniPlayer({ blurTarget }: { blurTarget: RefObject<View | null> }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { openPlayer } = useSheets();
  const session = usePlayer((s) => s.session);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const position = usePlayer((s) => s.position);
  const error = usePlayer((s) => s.error);
  const barBottom = Math.max(insets.bottom, 12) + 4;

  // When the tab bar slides away while reading, the mini player drops into its place.
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarHidden.get() * (TAB_BAR_HEIGHT + GAP) }],
  }));

  if (!session) return null;
  const chapter = session.chapters[index];
  if (!chapter) return null;
  const progress = chapter.duration > 0 ? Math.min(1, position / chapter.duration) : 0;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(180)}
      style={[styles.host, { bottom: barBottom + TAB_BAR_HEIGHT + GAP }, slide]}>
      <View style={styles.shadow}>
        <GlassCard radius={radii.lg} intensity={60} variant="chrome" blurTarget={blurTarget} style={styles.card}>
          <Pressable
            onPress={openPlayer}
            style={styles.main}
            accessibilityRole="button"
            accessibilityLabel={`Now playing: ${chapter.title}. Open the player`}>
            <View style={styles.icon}>
              <NowPlayingBars color={theme.colors.accent} playing={playing && !buffering} size={16} />
            </View>
            <View style={styles.text}>
              <Txt variant="label" numberOfLines={1}>
                {chapter.title}
              </Txt>
              <Txt variant="caption" tone="tertiary" numberOfLines={1}>
                {error ? 'Couldn’t play. Tap for details' : buffering ? 'Loading…' : `${session.title} · ${index + 1} of ${session.chapters.length}`}
              </Txt>
            </View>
          </Pressable>
          <Pressable
            onPress={toggle}
            hitSlop={6}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <View>
              {playing ? (
                <Pause size={20} color={theme.colors.text} fill={theme.colors.text} strokeWidth={0} />
              ) : (
                <Play size={20} color={theme.colors.text} fill={theme.colors.text} strokeWidth={0} />
              )}
            </View>
          </Pressable>
          <Pressable onPress={next} hitSlop={6} style={styles.button} accessibilityRole="button" accessibilityLabel="Next story">
            <View>
              <SkipForward size={20} color={theme.colors.text} fill={theme.colors.text} strokeWidth={2.4} />
            </View>
          </Pressable>
          <View style={[styles.track, { backgroundColor: theme.colors.hairline }]} pointerEvents="none">
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: theme.colors.accent }]} />
          </View>
        </GlassCard>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: GUTTER - 4, right: GUTTER - 4, alignItems: 'center', pointerEvents: 'box-none' },
  shadow: { width: '100%', maxWidth: 640, borderRadius: radii.lg, ...shadows.float },
  card: { flexDirection: 'row', alignItems: 'center', height: MINI_PLAYER_HEIGHT, paddingLeft: 14, paddingRight: 6 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, height: '100%' },
  icon: { width: 22, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  button: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', left: 14, right: 14, bottom: 0, height: 2, borderRadius: 1, overflow: 'hidden' },
  fill: { height: 2 },
});
