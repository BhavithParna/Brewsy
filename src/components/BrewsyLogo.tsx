import { StyleSheet, View, type ViewProps } from 'react-native';

import { BrewsyMark } from './BrewsyMark';
import { Txt } from './Txt';
import { useTheme } from '@/theme/ThemeProvider';

type Props = ViewProps & {
  /** Size of the mark. The wordmark always uses the theme's spaced type. */
  size?: number;
  /** Ink for the mark and the wordmark. Defaults to the theme's text color (use onCover on a cover photo). */
  color?: string;
  /** row: mark beside the name (top bars). stacked: mark above the name (welcome, empty states). */
  layout?: 'row' | 'stacked';
};

/**
 * The Brewsy lockup: the bean mark with the name in the theme's spaced capitals,
 * so it takes on each theme's typeface (Jost in Dune, Space Mono in Space, Orbitron in Tron...).
 */
export function BrewsyLogo({ size = 22, color, layout = 'row', style, ...rest }: Props) {
  const { theme } = useTheme();
  const ink = color ?? theme.colors.text;
  const stacked = layout === 'stacked';
  return (
    <View
      accessible
      accessibilityLabel="Brewsy"
      {...rest}
      style={[stacked ? styles.stacked : styles.row, { gap: stacked ? Math.round(size * 0.3) : 10 }, style]}>
      <BrewsyMark size={size} color={ink} />
      <Txt variant="spaced" color={ink} align={stacked ? 'center' : undefined}>
        Brewsy
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stacked: { alignItems: 'center' },
});
