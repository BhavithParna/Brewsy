import {
  makeMutable,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** 0 = tab bar visible, 1 = hidden. Shared by every scrolling screen and the tab bar. */
export const tabBarHidden = makeMutable(0);

export function showTabBar() {
  tabBarHidden.set(withTiming(0, { duration: 220 }));
}

/**
 * Scroll handler that tracks the scroll position, reading progress (0–1), and hides the tab bar
 * while scrolling down, bringing it back when scrolling up or at the end.
 * With "Reduce motion" on, the tab bar simply stays put.
 */
export function useScrollChrome() {
  const progress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const lastY = useSharedValue(0);
  const target = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      scrollY.set(y);
      const max = Math.max(1, e.contentSize.height - e.layoutMeasurement.height);
      progress.set(Math.min(1, Math.max(0, y / max)));

      const dy = y - lastY.get();
      lastY.set(y);
      if (reduceMotion) return;

      const nearTop = y < 80;
      const nearEnd = y > max - 60;
      const next = nearTop || nearEnd || dy < -6 ? 0 : dy > 6 ? 1 : target.get();
      if (next !== target.get()) {
        target.set(next);
        tabBarHidden.set(withTiming(next, { duration: 240 }));
      }
    },
  });

  return { onScroll, progress, scrollY };
}
