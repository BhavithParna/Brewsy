import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { BrewsyMark } from './BrewsyMark';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  uri: string | null;
};

/**
 * Full-bleed photo that always crops (never stretches), with a quiet placeholder
 * that shows while loading or when a story has no image.
 * Fills its parent; give the parent a size.
 */
export function StoryImage({ uri }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.base, { backgroundColor: theme.colors.skeleton }]}>
      <View style={styles.mark}>
        <BrewsyMark size={44} muted />
      </View>
      {uri && (
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={350}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

/** Fade from transparent to near-black so white headlines stay readable. */
export function ImageFade({ strength = 1 }: { strength?: number }) {
  return (
    <>
      <LinearGradient colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']} style={styles.top} />
      <LinearGradient
        colors={['rgba(11,11,13,0)', `rgba(11,11,13,${0.6 * strength})`, `rgba(11,11,13,${0.96 * strength})`]}
        locations={[0, 0.45, 1]}
        style={styles.bottom}
      />
    </>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  mark: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, height: '28%', pointerEvents: 'none' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '72%', pointerEvents: 'none' },
});
