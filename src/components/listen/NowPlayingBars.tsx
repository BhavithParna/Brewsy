import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = { color: string; playing: boolean; size?: number };

/** Three little bars that bounce while audio plays (still when paused or with Reduce Motion). */
export function NowPlayingBars({ color, playing, size = 14 }: Props) {
  return (
    <View style={[styles.row, { height: size, gap: size / 7 }]} accessibilityElementsHidden importantForAccessibility="no">
      {[0, 1, 2].map((i) => (
        <Bar key={i} index={i} color={color} playing={playing} size={size} />
      ))}
    </View>
  );
}

function Bar({ index, color, playing, size }: { index: number; color: string; playing: boolean; size: number }) {
  const reduceMotion = useReducedMotion();
  const level = useSharedValue(0.45);

  useEffect(() => {
    if (!playing || reduceMotion) {
      cancelAnimation(level);
      level.set(withTiming(0.4 + index * 0.15, { duration: 200 }));
      return;
    }
    level.set(
      withDelay(
        index * 140,
        withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.3, { duration: 380 })), -1, true),
      ),
    );
    return () => cancelAnimation(level);
  }, [playing, reduceMotion, index, level]);

  const style = useAnimatedStyle(() => ({ height: Math.max(2, level.get() * size) }));
  return <Animated.View style={[{ width: size / 5, borderRadius: size / 10, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
