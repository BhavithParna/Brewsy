import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AMBIENT } from './ambient';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The theme's calm base behind every screen: one color, or a slow vertical gradient (Atlantis).
 * Themes with a backdrop (Glass, Whales) add their wallpaper on top, fixed while the page scrolls over
 * it, and a few themes add something alive over that (the Whales pod, see components/ambient).
 */
export function ThemeBackground() {
  const { theme } = useTheme();
  const Ambient = AMBIENT[theme.name];
  const [first, ...rest] = theme.background;
  const base = !rest.length ? (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: first }]} />
  ) : (
    <LinearGradient
      pointerEvents="none"
      colors={theme.background as [string, string, ...string[]]}
      style={StyleSheet.absoluteFill}
    />
  );
  if (!theme.backdrop && !Ambient) return base;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {base}
      {theme.backdrop && (
        <Image
          source={theme.backdrop}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          // Cross-fades when Glass turns from light to dark (or back).
          transition={500}
          accessible={false}
        />
      )}
      {Ambient && <Ambient />}
    </View>
  );
}
