import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { RefObject } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { themeRadius, type GlassRim, type Theme } from '@/theme/themes';
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

/** iOS 26 and later: the system's own Liquid Glass, used for Glass-theme controls. */
const NATIVE_GLASS =
  Platform.OS === 'ios' &&
  (() => {
    try {
      return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
    } catch {
      return false;
    }
  })();

/**
 * Web preview only: `?blur=0` draws glass the way Android does without a blur target
 * (translucent fills, no blur), to check that cards read well on their own.
 */
const PREVIEW_NO_BLUR =
  __DEV__ &&
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location?.search ?? '').get('blur') === '0';

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
  const { colors, liquid } = theme;
  const r = themeRadius(theme, radius);
  const canBlur = (Platform.OS !== 'android' && !PREVIEW_NO_BLUR) || blurTarget != null;

  let fill: string;
  let border = colors.glassBorder;
  let blur = false;
  if (variant === 'surface') {
    fill = colors.card;
    border = colors.cardBorder;
    // Only the glass themes frost their cards (their backgrounds are smooth, so text stays crisp).
    blur = theme.surface === 'glass' && canBlur;
    // Over real blur the pane can be a little clearer; without it, the card fill alone carries the text.
    if (blur && liquid) fill = liquid.cardOverBlur;
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

  // The system draws its own glass (and its edges) for Glass-theme controls on iOS 26.
  const native = NATIVE_GLASS && liquid != null && variant !== 'surface' && variant !== 'plain';
  const lift = liquid
    ? liquidLift(liquid, variant)
    : variant === 'surface' && theme.surface === 'solid' && !theme.isDark
      ? shadows.paper
      : null;
  const framed = variant === 'surface' && theme.surface === 'framed';
  const edges = native
    ? NO_EDGES
    : liquid && variant !== 'plain'
      ? rimEdges(variant === 'surface' ? liquid.cardRim : liquid.controlRim, style)
      : null;

  return (
    <View {...rest} style={[styles.base, { borderRadius: r, borderColor: border }, edges, lift, style]}>
      {native ? (
        <GlassView
          glassEffectStyle="regular"
          colorScheme={theme.isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        />
      ) : (
        <>
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
        </>
      )}
      {framed && <View style={[styles.frame, { borderColor: border, borderRadius: Math.max(0, r - FRAME_INSET) }]} />}
      {children}
    </View>
  );
}

const NO_EDGES: ViewStyle = { borderColor: 'transparent' };

/**
 * Liquid-glass edges: brightest along the top, where light catches the pane.
 * A caller's own borderColor (a selected chip, the story being read aloud) wins over the rim.
 */
function rimEdges(rim: GlassRim, style: ViewProps['style']): ViewStyle | null {
  if (StyleSheet.flatten(style)?.borderColor != null) return null;
  return {
    borderTopColor: rim.top,
    borderLeftColor: rim.side,
    borderRightColor: rim.side,
    borderBottomColor: rim.bottom,
  };
}

/** Cards float a little; buttons and chips barely. The tab bar brings its own shadow. */
function liquidLift(liquid: NonNullable<Theme['liquid']>, variant: NonNullable<Props['variant']>): ViewStyle | null {
  if (variant === 'surface') return { boxShadow: liquid.cardShadow };
  if (variant === 'control' || variant === 'overlay') return { boxShadow: liquid.controlShadow };
  return null;
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
