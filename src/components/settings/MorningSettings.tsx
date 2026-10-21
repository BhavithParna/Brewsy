import { View } from 'react-native';

import { REGIONS } from '../../../supabase/functions/_shared/sources';
import { Pill } from '../Pill';
import { Txt } from '../Txt';
import { WakeTimePicker } from '../WakeTimePicker';
import { Divider, Group, settingsStyles as styles } from './SettingsParts';
import { formatWakeTime } from '@/lib/format';
import { updateSettings, useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

/** Settings → Morning edition: when it's ready, and where the local section comes from. */
export function MorningSettings() {
  const { theme } = useTheme();
  const settings = useSettings();
  return (
    <Group>
      <View style={styles.rowStack}>
        <View style={styles.rowTop}>
          <View style={styles.flex}>
            <Txt variant="label">Wake-up time</Txt>
            <Txt variant="bodySm" tone="tertiary">
              Your edition is ready by then.
            </Txt>
          </View>
          <Txt variant="displayS">{formatWakeTime(settings.wakeTime)}</Txt>
        </View>
        <WakeTimePicker value={settings.wakeTime} onChange={(wakeTime) => updateSettings({ wakeTime })} />
      </View>
      <Divider />
      <View style={styles.rowStack}>
        <View>
          <Txt variant="label">News from</Txt>
          <Txt variant="bodySm" tone="tertiary">
            Adds local news to Today. Changes apply from the next local section.
          </Txt>
        </View>
        <View style={styles.pills} accessibilityRole="radiogroup">
          {REGIONS.map((r) => (
            <Pill
              key={r.id}
              label={r.label}
              size="md"
              variant={settings.region === r.id ? 'solid' : 'glass'}
              color={theme.colors.inverseBg}
              selected={settings.region === r.id}
              onPress={() => updateSettings({ region: r.id })}
            />
          ))}
        </View>
      </View>
    </Group>
  );
}
