import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from './GlassCard';
import { Txt } from './Txt';
import { usePlayer } from '@/audio/store';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, radii, shadows } from '@/theme/tokens';

type ToastMessage = {
  id: number;
  message: string;
  action?: { label: string; onPress: () => void };
};

let show: ((m: ToastMessage) => void) | null = null;
let nextId = 1;

/** Small, quiet confirmation near the bottom of the screen. */
export const toast = {
  show(message: string, action?: ToastMessage['action']) {
    show?.({ id: nextId++, message, action });
  },
};

/** Renders toasts. Mount once near the root. */
export function ToastHost() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  // Sit above the mini player when something is playing.
  const lift = usePlayer((s) => (s.session ? 68 : 0));

  useEffect(() => {
    show = setCurrent;
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), current.action ? 4500 : 2400);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <View style={[styles.host, { bottom: Math.max(insets.bottom, 12) + 96 + lift }]}>
      {current && (
        <Animated.View
          key={current.id}
          entering={FadeInDown.springify().damping(18)}
          exiting={FadeOutDown.duration(180)}
          style={styles.shadow}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert">
          <GlassCard radius={radii.pill} intensity={60} style={[styles.toast, { backgroundColor: theme.colors.sheet }]}>
            <Txt variant="label">{current.message}</Txt>
            {current.action && (
              <Pressable
                onPress={() => {
                  current.action?.onPress();
                  setCurrent(null);
                }}
                hitSlop={10}
                accessibilityRole="button"
                style={styles.action}>
                <Txt variant="label" color={theme.colors.accent}>
                  {current.action.label}
                </Txt>
              </Pressable>
            )}
          </GlassCard>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  shadow: { borderRadius: radii.pill, ...shadows.float },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: TAP,
    paddingHorizontal: 20,
  },
  action: { minHeight: TAP, justifyContent: 'center' },
});
