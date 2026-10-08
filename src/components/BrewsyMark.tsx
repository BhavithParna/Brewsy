import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  size?: number;
  /** Defaults to the theme's text color. */
  color?: string;
  /** Low-contrast version for image placeholders. */
  muted?: boolean;
};

/** Brewsy logo: a thin-line coffee bean. */
export function BrewsyMark({ size = 28, color, muted = false }: Props) {
  const { theme } = useTheme();
  const ink = color ?? theme.colors.text;
  return (
    <View style={{ width: size, height: size, opacity: muted ? 0.28 : 1 }} accessible={false}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Circle cx="16" cy="16" r="14.5" stroke={ink} strokeWidth={1.6} fill="none" />
        <Path
          d="M19 4.6 C 12.2 10.6, 20.6 20.8, 13 27.4"
          stroke={ink}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
