import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';

type Props = {
  /** Scroll position of the screen. */
  scrollY: SharedValue<number>;
  /** Fully solid once the page has scrolled this far (usually just past the cover). */
  solidAt: number;
  /** A pinned bar's visibility (0–1): while it shows, it covers the status bar itself. */
  handOff?: SharedValue<number>;
};

/**
 * A strip of background color behind the phone's status bar (clock, battery), so text
 * never scrolls underneath them. Invisible over the cover photo, solid once you scroll past it,
 * and out of the way while a pinned bar has taken over.
 */
export function StatusShade({ scrollY, solidAt, handOff }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const base = theme.background[0];
  const fade = useAnimatedStyle(() => ({
    opacity:
      interpolate(scrollY.get(), [solidAt * 0.55, solidAt], [0, 1], 'clamp') * (1 - (handOff ? handOff.get() : 0)),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, fade]}>
      <View style={{ height: insets.top, backgroundColor: base }} />
      <LinearGradient colors={[base, withAlpha(base, 0)]} style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  tail: { height: 18 },
});
