import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';

type Props = {
  height: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The theme's photo across the top of a screen. It scrolls with the page and
 * dissolves into the background color before any text, so nothing is read on top of a busy photo.
 */
export function Cover({ height, children, style }: Props) {
  const { theme } = useTheme();
  const base = theme.background[0];
  return (
    <View style={[{ height }, style]}>
      <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
        <Image source={theme.cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} accessible={false} />
        {/* Keeps the status bar and the top buttons legible. */}
        <LinearGradient colors={[withAlpha(base, 0.5), withAlpha(base, 0)]} style={styles.top} />
        <LinearGradient
          colors={[withAlpha(base, 0), withAlpha(base, 0.82), base]}
          locations={[0, 0.55, 1]}
          style={styles.bottom}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, height: 150 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
});
