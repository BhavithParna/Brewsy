import * as Haptics from 'expo-haptics';
import { useTabTrigger } from 'expo-router/ui';
import { Bookmark, Newspaper, type LucideIcon } from 'lucide-react-native';
import type { RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from './GlassCard';
import { Txt } from './Txt';
import { usePlayer } from '@/audio/store';
import { showTabBar, tabBarHidden } from '@/hooks/useScrollChrome';
import { activeCount, useReadingList } from '@/state/readingList';
import { useTheme } from '@/theme/ThemeProvider';
import { capsLabel, radii, shadows } from '@/theme/tokens';

export const TAB_BAR_HEIGHT = 60;

const TABS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: 'index', label: 'Today', Icon: Newspaper },
  { name: 'reading-list', label: 'Reading List', Icon: Bookmark },
];

/** Space to leave at the bottom of scrolling screens so content clears the bar (and the mini player). */
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  const miniPlayer = usePlayer((s) => s.session != null);
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 40 + (miniPlayer ? 68 : 0);
}

/** Floating frosted pill with two tabs. Slides away while reading. */
export function TabBar({ blurTarget }: { blurTarget: RefObject<View | null> }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12) + 4;
  const hideBy = TAB_BAR_HEIGHT + bottom + 20;

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarHidden.get() * hideBy }],
    opacity: 1 - tabBarHidden.get() * 0.6,
  }));

  return (
    <Animated.View style={[styles.host, { bottom }, slide]}>
      <View style={[styles.shadow, { borderRadius: theme.shape.control }]}>
        <GlassCard
          radius={radii.pill}
          intensity={60}
          variant="chrome"
          blurTarget={blurTarget}
          style={styles.bar}
          accessibilityRole="tablist">
          {TABS.map((t) => (
            <TabItem key={t.name} {...t} />
          ))}
        </GlassCard>
      </View>
    </Animated.View>
  );
}

function TabItem({ name, label, Icon }: { name: string; label: string; Icon: LucideIcon }) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const { triggerProps } = useTabTrigger({ name });
  const focused = triggerProps.isFocused;
  const unread = useReadingList();
  const count = name === 'reading-list' ? activeCount(unread) : 0;
  const duration = reduceMotion ? 0 : 260;

  return (
    <Pressable
      onPress={(e) => {
        if (!focused && Platform.OS !== 'web') Haptics.selectionAsync();
        showTabBar();
        triggerProps.onPress?.(e);
      }}
      onLongPress={triggerProps.onLongPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityLabel={count > 0 ? `${label}, ${count} to read` : label}
      accessibilityState={{ selected: focused }}>
      {/* The selected tab is a solid pill, like a segmented control. */}
      <Animated.View
        style={[
          styles.activePill,
          {
            backgroundColor: theme.colors.inverseBg,
            borderRadius: Math.max(0, theme.shape.control - 4),
            opacity: focused ? 1 : 0,
            transform: [{ scale: focused ? 1 : 0.92 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: duration,
            transitionTimingFunction: 'ease-out',
          },
        ]}
      />
      <View style={styles.content}>
        <Icon
          size={18}
          color={focused ? theme.colors.inverseText : theme.colors.textSecondary}
          strokeWidth={focused ? 2 : 1.7}
        />
        <Txt variant="label" tone={focused ? 'inverse' : 'secondary'} style={theme.layout.capsButtons && capsLabel}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  shadow: { borderRadius: radii.pill, ...shadows.float },
  bar: { flexDirection: 'row', height: TAB_BAR_HEIGHT, padding: 5, gap: 2 },
  item: { minWidth: 136, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activePill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
});
