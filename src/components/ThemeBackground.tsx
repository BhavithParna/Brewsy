import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** The theme's calm base behind every screen: one color, or a slow vertical gradient (Atlantis). */
export function ThemeBackground() {
  const { theme } = useTheme();
  const [first, ...rest] = theme.background;
  if (!rest.length) return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: first }]} />;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={theme.background as [string, string, ...string[]]}
      style={StyleSheet.absoluteFill}
    />
  );
}
