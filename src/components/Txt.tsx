import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

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
// Line heights stay >= 1.15x the size so Android never clips accents or descenders.
const variants: Record<TxtVariant, TextStyle> = {
  displayXL: { fontFamily: fonts.light, fontSize: 56, lineHeight: 64, letterSpacing: -1.8 },
  displayL: { fontFamily: fonts.light, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  headline: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  displayM: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  displayS: { fontFamily: fonts.light, fontSize: 24, lineHeight: 28, letterSpacing: -0.6 },
  stat: { fontFamily: fonts.light, fontSize: 48, lineHeight: 54, letterSpacing: -2 },
  mega: { fontFamily: fonts.bold, fontSize: 84, lineHeight: 84, letterSpacing: -3 },
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

export function Txt({ variant = 'body', tone = 'primary', color, align, style, ...rest }: Props) {
  const { theme } = useTheme();
  const toneColor = {
    primary: theme.colors.text,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    inverse: theme.colors.inverseText,
  }[tone];

  const isDisplay = displayVariants.has(variant);
  const uppercase = variant === 'spaced' || variant === 'kicker';

  return (
    <Text
      maxFontSizeMultiplier={isDisplay ? 1.15 : 1.5}
      {...rest}
      style={[
        styles.base,
        variants[variant],
        uppercase && styles.upper,
        theme.type[variant],
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
