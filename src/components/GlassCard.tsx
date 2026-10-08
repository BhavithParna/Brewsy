import { BlurView } from 'expo-blur';
import type { RefObject } from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { themeRadius } from '@/theme/themes';
import { radii, shadows, withAlpha } from '@/theme/tokens';

type Props = ViewProps & {
  /** A default radius from tokens.radii; the theme turns it into its own shape. */
  radius?: number;
  intensity?: number;
  /**
   * surface: reading surfaces (story cards, panels), drawn in the theme's card style ·
   * control: frosted chips and buttons · overlay: frosted controls on top of photos ·
   * plain: outlined, no fill (small buttons inside cards) ·
   * chrome: the tab bar and mini player, solid enough that text under them never competes.
   */
  variant?: 'surface' | 'control' | 'overlay' | 'plain' | 'chrome';
  /**
   * Android only: the BlurTargetView whose pixels this glass should blur.
   * Without one, Android gets a translucent fill instead of real blur.
   */
  blurTarget?: RefObject<View | null>;
};

/** A panel in the current theme's style: opaque card, outlined card, double-bordered card, or frosted glass. */
export function GlassCard({
  radius = radii.md,
  intensity,
  variant = 'surface',
  blurTarget,
  style,
  children,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const r = themeRadius(theme, radius);
  const canBlur = Platform.OS !== 'android' || blurTarget != null;

  let fill: string;
  let border = colors.glassBorder;
  let blur = false;
  if (variant === 'surface') {
    fill = colors.card;
    border = colors.cardBorder;
    // Only the glass theme frosts its cards (its background is a smooth gradient, so text stays crisp).
    blur = theme.surface === 'glass' && canBlur;
  } else if (variant === 'plain') {
    fill = 'transparent';
  } else if (variant === 'chrome') {
    fill = withAlpha(colors.sheet.slice(0, 7), canBlur ? 0.8 : 0.96);
    blur = canBlur;
  } else {
    const overlay = variant === 'overlay';
    fill = canBlur
      ? overlay
        ? colors.glassOverlay
        : colors.glassFill
      : overlay
        ? colors.glassOverlayFallback
        : colors.glassFillFallback;
    blur = canBlur;
  }

  const lift = variant === 'surface' && theme.surface === 'solid' && !theme.isDark ? shadows.paper : null;
  const framed = variant === 'surface' && theme.surface === 'framed';

  return (
    <View {...rest} style={[styles.base, { borderRadius: r, borderColor: border }, lift, style]}>
      {blur && (
        <BlurView
          tint={theme.blurTint}
          intensity={intensity ?? theme.blurIntensity}
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          // Rounded here too: on web the parent's overflow clip doesn't round the blur.
          style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        />
      )}
      <View style={[StyleSheet.absoluteFill, styles.noTouch, { backgroundColor: fill, borderRadius: r }]} />
      {framed && <View style={[styles.frame, { borderColor: border, borderRadius: Math.max(0, r - FRAME_INSET) }]} />}
      {children}
    </View>
  );
}

/** Gap between a framed card's outer and inner border. */
const FRAME_INSET = 4;

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: FRAME_INSET,
    left: FRAME_INSET,
    right: FRAME_INSET,
    bottom: FRAME_INSET,
    borderWidth: 1,
    pointerEvents: 'none',
  },
  base: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  noTouch: { pointerEvents: 'none' },
});
