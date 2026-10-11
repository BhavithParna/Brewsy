import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { settingsStore } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import type { TxtVariant } from '@/theme/themes';
import { fonts } from '@/theme/tokens';

export type { TxtVariant };

type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverse';

type Props = TextProps & {
  variant?: TxtVariant;
  tone?: Tone;
  /** Overrides tone. */
  color?: string;
  align?: TextStyle['textAlign'];
};

// The default type; each theme swaps typefaces, sizes and case on top (themes.ts → type).
// Line heights stay >= 1.15x the size so Android never clips accents, descenders or tall display faces.
const variants: Record<TxtVariant, TextStyle> = {
  displayXL: { fontFamily: fonts.light, fontSize: 56, lineHeight: 66, letterSpacing: -1.8 },
  displayL: { fontFamily: fonts.light, fontSize: 40, lineHeight: 48, letterSpacing: -1.2 },
  headline: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  displayM: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  displayS: { fontFamily: fonts.light, fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
  stat: { fontFamily: fonts.light, fontSize: 48, lineHeight: 58, letterSpacing: -2 },
  mega: { fontFamily: fonts.bold, fontSize: 80, lineHeight: 94, letterSpacing: -3 },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  reading: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 27, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, letterSpacing: 0 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  kicker: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
  spaced: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 4 },
};

const displayVariants = new Set<TxtVariant>(['displayXL', 'displayL', 'headline', 'displayM', 'displayS', 'stat', 'mega']);

/**
 * Settings → Reading → Text size. Reading text and headlines grow fully; labels and captions grow
 * half as much, so buttons, chips and tabs keep their shape. Display type (dates, covers, numbers)
 * stays as each theme designed it.
 */
const SCALES_FULLY = new Set<TxtVariant>(['reading', 'body', 'bodySm', 'headline', 'title']);
const SCALES_GENTLY = new Set<TxtVariant>(['label', 'caption']);

/** Reading text never grows past 1.5x its designed size, whatever the app and phone settings add up to. */
const MAX_GROWTH = 1.5;
const MAX_GROWTH_DISPLAY = 1.15;

function useTextScale(): number {
  return useSyncExternalStore(
    settingsStore.subscribe,
    () => settingsStore.get().textScale || 1,
    () => 1,
  );
}

function scaleFor(variant: TxtVariant, textScale: number): number {
  if (SCALES_FULLY.has(variant)) return textScale;
  if (SCALES_GENTLY.has(variant)) return 1 + (textScale - 1) / 2;
  return 1;
}

export function Txt({ variant = 'body', tone = 'primary', color, align, style, ...rest }: Props) {
  const { theme } = useTheme();
  const textScale = useTextScale();
  const toneColor = {
    primary: theme.colors.text,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    inverse: theme.colors.inverseText,
  }[tone];

  const isDisplay = displayVariants.has(variant);
  const uppercase = variant === 'spaced' || variant === 'kicker';

  const factor = scaleFor(variant, textScale);
  let sized: TextStyle | null = null;
  if (factor !== 1) {
    const designed = { ...variants[variant], ...theme.type[variant] };
    sized = {
      fontSize: (designed.fontSize ?? 15) * factor,
      lineHeight: designed.lineHeight != null ? Math.round(designed.lineHeight * factor) : undefined,
    };
  }
  // The phone's own font size still applies, up to the cap (less of it when Brewsy already enlarged the text).
  const maxGrowth = Math.max(1, (isDisplay ? MAX_GROWTH_DISPLAY : MAX_GROWTH) / Math.max(1, factor));

  return (
    <Text
      maxFontSizeMultiplier={maxGrowth}
      {...rest}
      style={[
        styles.base,
        variants[variant],
        uppercase && styles.upper,
        theme.type[variant],
        sized,
        { color: color ?? toneColor, textAlign: align },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
  upper: { textTransform: 'uppercase' },
});
