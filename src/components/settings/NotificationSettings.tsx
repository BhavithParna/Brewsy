import { Platform, View } from 'react-native';

import { Pill } from '../Pill';
import { toast } from '../Toast';
import { Divider, Group, LinkRow, ToggleRow, settingsStyles as styles } from './SettingsParts';
import { rememberPushToken } from '@/lib/device';
import {
  isExpoGoAndroid,
  registerForPush,
  requestNotificationPermission,
  sendTestReminder,
} from '@/lib/notifications';
import { useReadingList } from '@/state/readingList';
import { updateSettings, useSettings, type Settings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

/** Settings → Notifications: the morning one, breaking news and Reading List reminders. */
export function NotificationSettings() {
  const { theme } = useTheme();
  const settings = useSettings();
  const items = useReadingList();

  const toggleMorningPush = async (on: boolean) => {
    updateSettings({ morningPush: on });
    if (!on) return;
    if (!(await requestNotificationPermission())) {
      toast.show('Notifications are off for Brewsy in system settings');
      return;
    }
    const reg = await registerForPush();
    if (reg.token) await rememberPushToken(reg.token);
  };

  // Breaking news needs the push token too.
  const chooseBreaking = async (id: Settings['breakingPush']) => {
    updateSettings({ breakingPush: id });
    if (id === 'off' || !(await requestNotificationPermission())) return;
    const reg = await registerForPush();
    if (reg.token) await rememberPushToken(reg.token);
  };

  const toggleReminder = async (patch: { remindTonight?: boolean; remindWeekend?: boolean }) => {
    updateSettings(patch);
    if (Object.values(patch).some(Boolean)) await requestNotificationPermission();
  };

  return (
    <>
      <Group title="Morning edition">
        <ToggleRow
          title="Morning notification"
          subtitle={
            isExpoGoAndroid
              ? 'Needs the Brewsy app build on Android (Expo Go can’t show notifications).'
              : '“Your Brewsy edition is ready” at your wake-up time.'
          }
          value={settings.morningPush}
          onChange={toggleMorningPush}
        />
      </Group>

      <Group
        title="Breaking news"
        footer="Only for genuinely major news (very wide coverage or a wire-service “breaking” flag), at most 2 a day. It also appears under “Since this morning” on Today.">
        <View style={[styles.pills, styles.padded]}>
          {(
            [
              { id: 'off', label: 'Off' },
              { id: 'major', label: 'Major news only' },
            ] as const
          ).map((o) => (
            <Pill
              key={o.id}
              label={o.label}
              size="md"
              variant={settings.breakingPush === o.id ? 'solid' : 'glass'}
              color={theme.colors.inverseBg}
              selected={settings.breakingPush === o.id}
              onPress={() => {
                chooseBreaking(o.id).catch(() => {});
              }}
            />
          ))}
        </View>
      </Group>

      <Group title="Reading reminders" footer="Never more than one reminder a day.">
        <ToggleRow
          title="Tonight at 8pm"
          subtitle="When something is saved for tonight."
          value={settings.remindTonight}
          onChange={(v) => toggleReminder({ remindTonight: v })}
        />
        <Divider />
        <ToggleRow
          title="Saturday at 10am"
          subtitle="When something is saved for the weekend."
          value={settings.remindWeekend}
          onChange={(v) => toggleReminder({ remindWeekend: v })}
        />
        {Platform.OS !== 'web' && (
          <>
            <Divider />
            <LinkRow
              title="Send a test reminder"
              subtitle="Arrives in 5 seconds."
              onPress={async () => {
                const ok = await sendTestReminder(items);
                toast.show(ok ? 'Test reminder coming in 5 seconds' : 'Allow notifications to test reminders');
              }}
            />
          </>
        )}
      </Group>
    </>
  );
}

/** One line for the Settings list: what's on. */
export function notificationSummary(s: Settings): string {
  const parts = [
    s.morningPush ? 'Morning on' : 'Morning off',
    s.breakingPush === 'off' ? 'no breaking news' : 'major breaking news',
    s.remindTonight || s.remindWeekend ? 'reminders on' : 'no reminders',
  ];
  return parts.join(' · ');
}
