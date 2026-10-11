import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * A thin accent line that fills as you read down the page. It sits on the bottom edge of the
 * pinned bar, over its hairline, so the bar's edge doubles as the track.
 */
export function ReadingProgress({ progress, style }: { progress: SharedValue<number>; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  return (
    <View pointerEvents="none" style={[styles.track, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: theme.colors.accent }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 2, overflow: 'hidden' },
  fill: { height: 2, width: '100%', transformOrigin: 'left' },
});
