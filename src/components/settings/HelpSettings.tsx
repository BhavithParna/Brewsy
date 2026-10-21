import { router } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useSheets } from '../SheetHost';
import { Txt } from '../Txt';
import { Group, LinkRow, settingsStyles } from './SettingsParts';
import { updateSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

const WHATS_NEW =
  'A Feedback button (right here in Settings), a tidier Settings, stills from the films themselves on the film themes, a sunken city for Atlantis, an Oceans topic, a Whales theme under Custom, horror themes, Glass in light and dark, a Movies topic, stars for the topics you want more of, and search.';

/** What leaves the phone, in plain words. */
const SENT: [string, string][] = [
  ['Your settings', 'Wake-up time, topics, starred topics, sources you turned off, where your news comes from, notification choices and your theme, so your edition and notifications fit you.'],
  ['How the app is used', 'Counts per day: times opened, which sections of Today you reached, how many stories you opened by topic, plays, saves and shares. Never which stories, and nothing you type. Only Brewsy’s owner sees the totals.'],
  ['Feedback you send', 'Your note, and your name only if you add it. Only Brewsy’s owner can read it.'],
  ['Who you are', 'Nothing. There are no accounts: your phone is a random number to the server.'],
];

/** Settings → Help: the tour of Today again, what's new, and what Brewsy sends. */
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
    <>
      <Group>
        <LinkRow
          title="Take the tour again"
          subtitle="A one-minute look around Today."
          icon={<Compass size={18} color={theme.colors.text} strokeWidth={1.9} />}
          onPress={replayTour}
        />
      </Group>

      <Group title="What’s new">
        <Txt variant="body" tone="secondary" style={styles.para}>
          {WHATS_NEW}
        </Txt>
      </Group>

      <Group title="What Brewsy sends">
        {SENT.map(([title, body]) => (
          <View key={title} style={styles.sent}>
            <Txt variant="label">{title}</Txt>
            <Txt variant="bodySm" tone="secondary">
              {body}
            </Txt>
          </View>
        ))}
      </Group>
    </>
  );
}

const styles = StyleSheet.create({
  ...settingsStyles,
  para: { paddingVertical: 14 },
  sent: { paddingVertical: 12, gap: 3 },
});
