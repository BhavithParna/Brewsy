import { BlurTargetView } from 'expo-blur';
import { TabList, TabSlot, TabTrigger, Tabs, type TabsSlotRenderOptions } from 'expo-router/ui';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from 'react-native-screens';

import { MiniPlayer } from '@/components/listen/MiniPlayer';
import { TabBar } from '@/components/TabBar';
import { ThemeBackground } from '@/components/ThemeBackground';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { theme } = useTheme();
  // On Android, the tab bar can only blur what's inside this target view.
  const blurTarget = useRef<View>(null);

  return (
    <Tabs style={[styles.flex, { backgroundColor: theme.colors.bg }]}>
      <BlurTargetView ref={blurTarget} style={[styles.flex, { backgroundColor: theme.colors.bg }]}>
        {/* Inside the blur target so the tab bar and mini player frost it too. */}
        <ThemeBackground />
        <TabSlot style={styles.slot} renderFn={renderScreen} />
      </BlurTargetView>

      <MiniPlayer blurTarget={blurTarget} />
      <TabBar blurTarget={blurTarget} />

      {/* Declares the tab routes; the visible buttons live in <TabBar />. */}
      <TabList style={styles.hidden}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="reading-list" href="/reading-list" />
      </TabList>
    </Tabs>
  );
}

type Descriptor = Parameters<NonNullable<Parameters<typeof TabSlot>[0]['renderFn']>>[0];

// Same as expo-router's default, except screens may shrink to the window height.
// (The default lets them grow to their content height on web, so nothing scrolls.)
function renderScreen(descriptor: Descriptor, { isFocused, loaded, detachInactiveScreens }: TabsSlotRenderOptions) {
  const { lazy = true, unmountOnBlur, freezeOnBlur } = descriptor.options;
  if (unmountOnBlur && !isFocused) return null;
  if (lazy && !loaded && !isFocused) return null;
  return (
    <Screen
      key={descriptor.route.key}
      enabled={detachInactiveScreens}
      activityState={isFocused ? 2 : 0}
      freezeOnBlur={freezeOnBlur}
      style={[styles.screen, isFocused ? styles.focused : styles.unfocused]}>
      {descriptor.render()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  slot: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  screen: { flex: 1, position: 'relative', height: '100%', minHeight: 0 },
  focused: { zIndex: 1, display: 'flex', flexGrow: 1, flexShrink: 1 },
  unfocused: { zIndex: -1, display: 'none', flexGrow: 0, flexShrink: 1 },
  hidden: { display: 'none' },
});
