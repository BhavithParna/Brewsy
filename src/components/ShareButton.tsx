import { Share, Share2 } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';
import { toast } from './Toast';
import type { Story } from '@/data/types';
import { shareStory } from '@/lib/share';
import { markRead } from '@/state/reads';
import { noteStoryOpened } from '@/state/usage';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, radii } from '@/theme/tokens';

const SIZE = 40;

/** Shares the story through the phone's share sheet: headline, one line and the main source. */
export async function shareAndConfirm(story: Story, editionDate: string) {
  const result = await shareStory(story);
  if (result === 'shared' || result === 'copied') noteStoryOpened(story, editionDate, 'share');
  if (result === 'shared') markRead(editionDate, story.id);
  else if (result === 'copied') toast.show('Copied, ready to paste');
  else if (result === 'failed') toast.show("Couldn't open sharing. Try again.");
}

/** Round share button for a story's top row, next to Save. */
export function ShareButton({ story, editionDate }: { story: Story; editionDate: string }) {
  const { theme } = useTheme();
  // Each platform's own share glyph.
  const Icon = Platform.OS === 'ios' ? Share : Share2;
  return (
    <PressableScale
      onPress={() => shareAndConfirm(story, editionDate)}
      scaleTo={0.88}
      hitSlop={(TAP - SIZE) / 2}
      accessibilityRole="button"
      accessibilityLabel="Share this story">
      <GlassCard radius={radii.pill} variant="plain" style={styles.button}>
        <View>
          <Icon size={17} strokeWidth={2} color={theme.colors.textSecondary} />
        </View>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
