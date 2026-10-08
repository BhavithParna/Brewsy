import { Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from '../GlassCard';
import { PressableScale } from '../PressableScale';
import { NowPlayingBars } from './NowPlayingBars';
import { pause } from '@/audio/engine';
import { usePlayer, usePlayingKey } from '@/audio/store';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, radii } from '@/theme/tokens';

const SIZE = 40;

/** Small round play button on a story. Shows moving bars while that story is being read. */
export function StoryPlayButton({ playKey, label, onPlay }: { playKey: string; label: string; onPlay: () => void }) {
  const { theme } = useTheme();
  const isCurrent = usePlayingKey() === playKey;
  const playing = usePlayer((s) => s.playing);
  const active = isCurrent && playing;

  return (
    <PressableScale
      onPress={active ? pause : onPlay}
      scaleTo={0.88}
      hitSlop={(TAP - SIZE) / 2}
      accessibilityRole="button"
      accessibilityLabel={active ? `Pause ${label}` : `Listen to ${label}`}>
      <GlassCard radius={radii.pill} variant="plain" style={styles.button}>
        <View>
          {isCurrent ? (
            <NowPlayingBars color={theme.colors.accent} playing={playing} size={14} />
          ) : (
            <Play size={15} color={theme.colors.textSecondary} fill={theme.colors.textSecondary} strokeWidth={0} />
          )}
        </View>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
