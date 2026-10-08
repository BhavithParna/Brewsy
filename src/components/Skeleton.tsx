import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GlassCard } from './GlassCard';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, radii } from '@/theme/tokens';

type BlockProps = {
  width?: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** A softly pulsing placeholder shape. Static when "Reduce motion" is on. */
export function SkeletonBlock({ width = '100%', height, radius = radii.md, style }: BlockProps) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * pulse.get() }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.colors.skeletonHighlight },
        animated,
        style,
      ]}
    />
  );
}

/** Loading layout that mirrors the edition: summary card, then text-first stories. */
export function EditionSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading your edition" style={styles.wrap}>
      <View style={styles.pad}>
        <GlassCard radius={radii.xl} style={styles.story}>
          <SkeletonBlock width={110} height={12} radius={6} />
          <SkeletonBlock width="80%" height={26} radius={8} />
          <SkeletonBlock height={15} radius={7} />
          <SkeletonBlock height={15} radius={7} width="90%" />
          <SkeletonBlock height={15} radius={7} width="84%" />
        </GlassCard>
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={styles.pad}>
          <GlassCard radius={radii.xl} style={styles.story}>
            <SkeletonBlock width={90} height={12} radius={6} />
            <SkeletonBlock height={26} radius={8} />
            <SkeletonBlock width="70%" height={26} radius={8} />
            {i === 0 && <SkeletonBlock height={188} radius={radii.md} />}
            <SkeletonBlock height={15} radius={7} />
            <SkeletonBlock height={15} radius={7} width="94%" />
            <SkeletonBlock height={15} radius={7} width="80%" />
          </GlassCard>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  pad: { paddingHorizontal: GUTTER },
  story: { gap: 14, padding: 20 },
});
