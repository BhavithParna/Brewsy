import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

/** Thin bar at the top that fills as you read down the edition. */
export function ReadingProgress({ progress }: { progress: SharedValue<number> }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  return (
    <View style={[styles.track, { top: insets.top, backgroundColor: theme.colors.hairline }]}>
      <Animated.View
        style={[styles.fill, { backgroundColor: theme.colors.accent }, fill]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, height: 2, zIndex: 10, pointerEvents: 'none' },
  fill: { height: 2, width: '100%', transformOrigin: 'left' },
});
