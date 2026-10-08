import * as Haptics from 'expo-haptics';
import { Bookmark } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';
import { useSheets } from './SheetHost';
import { toast } from './Toast';
import type { Story } from '@/data/types';
import { cachedDeepDive } from '@/state/deepDives';
import { BUCKETS, saveStory, storyKey, useReadingList } from '@/state/readingList';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, radii } from '@/theme/tokens';

const SIZE = 40;

/**
 * Tap: choose when to read it (bottom sheet).
 * Long-press: save instantly as "No rush".
 */
export function BookmarkButton({ story, editionDate }: { story: Story; editionDate: string }) {
  const { theme } = useTheme();
  const { openSave } = useSheets();
  const items = useReadingList();
  const key = storyKey(editionDate, story.id);
  const saved = items.find((i) => i.key === key);

  const quickSave = () => {
    if (saved) {
      openSave({ story, editionDate });
      return;
    }
    saveStory({ story, editionDate, bucket: 'norush', deepDive: cachedDeepDive(key) });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show(BUCKETS.find((b) => b.id === 'norush')!.confirm);
  };

  return (
    <PressableScale
      onPress={() => openSave({ story, editionDate })}
      onLongPress={quickSave}
      delayLongPress={350}
      scaleTo={0.88}
      hitSlop={(TAP - SIZE) / 2}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Saved to Reading List. Change when to read it' : 'Save to Reading List'}
      accessibilityHint={saved ? undefined : 'Long press to save it for no rush'}>
      <GlassCard radius={radii.pill} variant="plain" style={styles.button}>
        <View>
          <Bookmark
            size={18}
            strokeWidth={2}
            color={saved ? theme.colors.accent : theme.colors.textSecondary}
            fill={saved ? theme.colors.accent : 'transparent'}
          />
        </View>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
