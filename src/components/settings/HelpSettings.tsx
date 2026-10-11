import { router } from 'expo-router';
import { Compass } from 'lucide-react-native';

import { useSheets } from '../SheetHost';
import { Group, LinkRow } from './SettingsParts';
import { updateSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

const WHATS_NEW =
  'New in Brewsy: film and horror themes, Glass in light and dark, a Movies topic, stars for the topics you want more of, search, and a topic bar that stays with you as you read.';

/** Help: the tour of Today again, and a line on what's new. */
export function HelpSettings() {
  const { theme } = useTheme();
  const { closeSettings } = useSheets();

  const replayTour = () => {
    // Today starts the tour from the top once Settings has closed.
    updateSettings({ tourDone: false });
    closeSettings();
    router.navigate('/');
  };

  return (
    <Group title="Help" footer={WHATS_NEW}>
      <LinkRow
        title="Take the tour again"
        subtitle="A one-minute look around Today."
        icon={<Compass size={18} color={theme.colors.text} strokeWidth={1.9} />}
        onPress={replayTour}
      />
    </Group>
  );
}
