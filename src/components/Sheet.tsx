import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from './Txt';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, radii, springs } from '@/theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Tall sheets (Settings) take up to 90% of the screen and scroll inside. */
  tall?: boolean;
  children: ReactNode;
};

const CLOSE_MS = 220;

/** Frosted bottom sheet that slides up, dims the page, and drags down to close. */
export function Sheet({ visible, onClose, title, tall = false, children }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Stay mounted while the closing animation plays.
  const [closing, setClosing] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setClosing(true);
  }

  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      drag.set(0);
      progress.set(reduceMotion ? withTiming(1, { duration: 1 }) : withSpring(1, springs.gentle));
      return;
    }
    progress.set(withTiming(0, { duration: reduceMotion ? 1 : CLOSE_MS }));
    const timer = setTimeout(() => setClosing(false), CLOSE_MS + 20);
    return () => clearTimeout(timer);
  }, [visible, reduceMotion, progress, drag]);

  const sheetHeightGuess = tall ? height * 0.9 : height * 0.6;

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * sheetHeightGuess + drag.get() }],
  }));

  // Drag the handle area down to dismiss.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => drag.set(Math.max(0, e.translationY)))
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) onClose();
      else drag.set(withSpring(0, springs.release));
    });

  return (
    <Modal
      visible={visible || closing}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        </Animated.View>

        {/* Edge-to-edge Android windows don't resize for the keyboard, so pad on both platforms. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
          style={styles.kav}
          pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.sheet,
                borderColor: theme.colors.glassBorder,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                maxHeight: tall ? height * 0.9 : height * 0.85,
              },
              tall && { height: height * 0.9 },
              sheetStyle,
            ]}
            accessibilityViewIsModal>
            <GestureDetector gesture={pan}>
              <View style={styles.grab}>
                <View style={[styles.handle, { backgroundColor: theme.colors.textTertiary }]} />
                {title && (
                  <Txt variant="displayM" align="center" accessibilityRole="header" style={styles.title}>
                    {title}
                  </Txt>
                )}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    boxShadow: '0px -12px 40px rgba(0, 0, 0, 0.45)',
  },
  grab: { paddingTop: 10, paddingBottom: 6, paddingHorizontal: GUTTER, alignItems: 'center' },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.6 },
  title: { marginTop: 14 },
});
