import { View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  size?: number;
  /** Defaults to the theme's text color. */
  color?: string;
  /** Low-contrast version for image placeholders. */
  muted?: boolean;
};

// The Brewsy mark is a pour-over: a paper filter with one line of type in it, over a cup.
// The news goes in at the top and comes out brewed. The filter is drawn in line and the cup is
// solid, so it reads at 22px. Source files and the app icon set are in assets/brand/.
// Geometry is in a 42 x 42 box, optically centered with the handle on the right.
const PAPER =
  'M25.29 17.51 L33.5 6.1 L31.69 4.5 L29.88 6.1 L28.06 4.5 L26.25 6.1 L24.44 4.5 L22.62 6.1 L20.81 4.5 ' +
  'L19 6.1 L17.19 4.5 L15.38 6.1 L13.56 4.5 L11.75 6.1 L9.94 4.5 L8.12 6.1 L6.31 4.5 L4.5 6.1 ' +
  'L12.71 17.51 Q14 19.3 16.2 19.3 L21.8 19.3 Q24 19.3 25.29 17.51 Z';
const RULE = 'M13.38 12.3 H24.62';
// From 40px up there is room for a headline and a shorter line of text, as on the app icon.
const HEADLINE = 'M12.6 10.9 H25.4';
const TEXT_LINE = 'M15.2 15.2 H22.8';
const CUP =
  'M6.7 23.7 H31.3 Q32.5 23.7 32.5 24.9 C33 30.9 31.3 38.7 26.5 38.7 H11.5 ' +
  'C6.7 38.7 5 30.9 5.5 24.9 Q5.5 23.7 6.7 23.7 Z';

/** Brewsy logo: a pour-over, drawn in one color (the theme's ink unless `color` is given). */
export function BrewsyMark({ size = 28, color, muted = false }: Props) {
  const { theme } = useTheme();
  const ink = color ?? theme.colors.text;
  return (
    <View style={{ width: size, height: size, opacity: muted ? 0.28 : 1 }} accessible={false}>
      <Svg width={size} height={size} viewBox="0 0 42 42">
        <Path d={PAPER} fill="none" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        {size >= 40 ? (
          <>
            <Path d={HEADLINE} stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
            <Path d={TEXT_LINE} stroke={ink} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : (
          <Path d={RULE} stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
        )}
        <Path d={CUP} fill={ink} />
        <Ellipse cx={33.9} cy={30.6} rx={5} ry={4.6} fill="none" stroke={ink} strokeWidth={3} />
      </Svg>
    </View>
  );
}
