import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

export type Rect = { x: number; y: number; width: number; height: number };
export type Hole = Rect & { radius: number };

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Far past any screen edge, so the dim layer never needs the window size. */
const FAR = 10000;
const MOVE = { duration: 340, easing: Easing.out(Easing.cubic) };

/** A rounded rectangle as an SVG path. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  'worklet';
  if (w <= 0 || h <= 0) return '';
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}` +
    `V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}` +
    `H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}` +
    `V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`
  );
}

/**
 * The tour's dim layer with a clear window cut around the element being explained. The window
 * glides from one element to the next (or jumps, with Reduce motion). A thin rim marks its edge,
 * since dimming an already dark page alone barely shows.
 */
export function Spotlight({
  hole,
  scrim,
  rim,
  reduceMotion,
}: {
  hole: Hole | null;
  scrim: string;
  rim: string;
  reduceMotion: boolean;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const r = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!hole) return;
    // The first window simply appears where it belongs; later ones travel there.
    const jump = reduceMotion || !placed.current;
    placed.current = true;
    const go = (v: typeof x, to: number) => v.set(jump ? to : withTiming(to, MOVE));
    go(x, hole.x);
    go(y, hole.y);
    go(w, hole.width);
    go(h, hole.height);
    go(r, hole.radius);
  }, [hole, reduceMotion, x, y, w, h, r]);

  const dimProps = useAnimatedProps(() => ({
    d: `M${-FAR} ${-FAR}H${FAR}V${FAR}H${-FAR}Z` + roundedRect(x.get(), y.get(), w.get(), h.get(), r.get()),
  }));
  const rimProps = useAnimatedProps(() => ({
    d: roundedRect(x.get(), y.get(), w.get(), h.get(), r.get()),
  }));

  return (
    <View style={styles.fill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width="100%" height="100%">
        <AnimatedPath animatedProps={dimProps} fill={scrim} fillRule="evenodd" />
        <AnimatedPath animatedProps={rimProps} fill="none" stroke={rim} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
});
