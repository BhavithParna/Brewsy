import { Check, ChevronDown, ChevronUp, FileDown, History, Volume2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { OUTLET_REGION, REGIONS, SOURCE_GROUPS } from '../../supabase/functions/_shared/sources';
import { Pill } from './Pill';
import { HelpSettings } from './settings/HelpSettings';
import { ReadingSettings } from './settings/ReadingSettings';
import { Divider, Group, LinkRow, ToggleRow, settingsStyles } from './settings/SettingsParts';
import { TopicSettings } from './settings/TopicSettings';
import { Sheet } from './Sheet';
import { toast } from './Toast';
import { ThemePicker } from './ThemePicker';
import { Txt } from './Txt';
import { WakeTimePicker } from './WakeTimePicker';
import { pause } from '@/audio/engine';
import { playerStore } from '@/audio/store';
import { deviceVoices, previewVoice, type DeviceVoice } from '@/audio/voice';
import { backendConfigured } from '@/data/api';
import { fetchAndCacheEdition, readCachedEdition, todayKey } from '@/data/editions';
import { rememberPushToken } from '@/lib/device';
import { formatWakeTime } from '@/lib/format';
import {
  isExpoGoAndroid,
  registerForPush,
  requestNotificationPermission,
  sendTestReminder,
} from '@/lib/notifications';
import { exportEditionPdf } from '@/lib/pdf';
import { useReadingList } from '@/state/readingList';
import { updateSettings, useSettings, type Settings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER } from '@/theme/tokens';

type Props = { visible: boolean; onClose: () => void; onOpenPastEditions: () => void };

export function SettingsSheet({ visible, onClose, onOpenPastEditions }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Settings" tall>
      <SettingsBody onOpenPastEditions={onOpenPastEditions} />
    </Sheet>
  );
}

function SettingsBody({ onOpenPastEditions }: { onOpenPastEditions: () => void }) {
  const { theme } = useTheme();
  const settings = useSettings();
  const items = useReadingList();
  const [exporting, setExporting] = useState(false);

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

  const [openSources, setOpenSources] = useState<string | null>(null);
  // World outlets, plus the ones that only feed the reader's own local section.
  const sourceGroups = SOURCE_GROUPS.map((g) => ({
    ...g,
    outlets: g.outlets.filter((o) => !OUTLET_REGION[o] || OUTLET_REGION[o] === settings.region),
  })).filter((g) => g.outlets.length > 0);
  const toggleOutlet = (outlet: string, on: boolean) => {
    updateSettings({
      disabledOutlets: on
        ? settings.disabledOutlets.filter((o) => o !== outlet)
        : [...settings.disabledOutlets, outlet],
    });
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const date = todayKey();
      const edition = (await readCachedEdition(date)) ?? (await fetchAndCacheEdition(date));
      if (!edition) toast.show("Today's edition isn't here yet");
      else await exportEditionPdf(edition, settings.topics);
    } catch {
      toast.show("Couldn't make the PDF. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Group title="Theme">
        <ThemePicker />
      </Group>

      <TopicSettings />

      <ReadingSettings />

      <Group title="Morning edition">
        <View style={styles.rowStack}>
          <View style={styles.rowTop}>
            <View style={styles.flex}>
              <Txt variant="label">Wake-up time</Txt>
              <Txt variant="bodySm" tone="tertiary">
                Your edition is ready by then.
              </Txt>
            </View>
            <Txt variant="displayS">
              {formatWakeTime(settings.wakeTime)}
            </Txt>
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
        <Divider />
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

      <Group
        title="Listening"
        footer={
          Platform.OS === 'ios'
            ? 'Siri: in the Shortcuts app, add “Open URLs” with brewsy://listen and name it “Play my Brewsy briefing”.'
            : Platform.OS === 'android'
              ? 'Long-press the Brewsy icon for “Listen to briefing”, or drag it to your home screen.'
              : 'The Listen button on Today plays the edition.'
        }>
        <View style={styles.rowStack}>
          <Txt variant="label">“Listen” starts with</Txt>
          <View style={styles.pills}>
            {(
              [
                { id: 'quick', label: 'Quick listen · about 3 min' },
                { id: 'full', label: 'Full briefing · about 10 min' },
              ] as const
            ).map((o) => (
              <Pill
                key={o.id}
                label={o.label}
                size="md"
                variant={settings.listenMode === o.id ? 'solid' : 'glass'}
                color={theme.colors.inverseBg}
                selected={settings.listenMode === o.id}
                onPress={() => updateSettings({ listenMode: o.id })}
              />
            ))}
          </View>
        </View>
      </Group>

      <Group title="Phone voice" footer={VOICE_TIP}>
        <PhoneVoiceRows />
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

      <Group
        title="Sources"
        footer="Brewsy reads all of these every morning. Turn one off to drop its links, and any story only it reported. The full list, with each source's trust level, is in supabase/functions/_shared/sources.ts.">
        {sourceGroups.map((group, gi) => {
          const on = group.outlets.filter((o) => !settings.disabledOutlets.includes(o)).length;
          const open = openSources === group.category;
          return (
            <View key={group.category}>
              {gi > 0 && <Divider />}
              <Pressable
                onPress={() => setOpenSources(open ? null : group.category)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={styles.row}>
                <View style={styles.flex}>
                  <Txt variant="label">{group.label}</Txt>
                  <Txt variant="bodySm" tone="tertiary">
                    {on === group.outlets.length ? `All ${on} on` : `${on} of ${group.outlets.length} on`}
                  </Txt>
                </View>
                <View>
                  {open ? (
                    <ChevronUp size={18} color={theme.colors.textTertiary} />
                  ) : (
                    <ChevronDown size={18} color={theme.colors.textTertiary} />
                  )}
                </View>
              </Pressable>
              {open &&
                group.outlets.map((outlet) => (
                  <View key={outlet}>
                    <Divider />
                    <ToggleRow
                      title={outlet}
                      value={!settings.disabledOutlets.includes(outlet)}
                      onChange={(value) => toggleOutlet(outlet, value)}
                    />
                  </View>
                ))}
            </View>
          );
        })}
      </Group>

      <Group title="Editions">
        <LinkRow
          title={exporting ? 'Making PDF…' : "Export today's edition as PDF"}
          icon={<FileDown size={18} color={theme.colors.text} strokeWidth={1.9} />}
          onPress={exporting ? undefined : exportPdf}
        />
        <Divider />
        <LinkRow
          title="Past editions"
          icon={<History size={18} color={theme.colors.text} strokeWidth={1.9} />}
          onPress={onOpenPastEditions}
        />
      </Group>

      <HelpSettings />

      <Txt variant="caption" tone="tertiary" align="center" style={styles.about}>
        {backendConfigured
          ? 'Connected to your Brewsy backend'
          : 'Showing the sample edition · set up the backend with docs/BACKEND_SETUP.md'}
      </Txt>
    </ScrollView>
  );
}

const VOICE_TIP =
  Platform.OS === 'ios'
    ? 'Brewsy reads editions aloud with your phone’s voice. For a much more natural one: iPhone Settings → Accessibility → Spoken Content → Voices → English, download a “Premium” voice (Ava or Zoe, for example), then pick it here.'
    : Platform.OS === 'android'
      ? 'Brewsy reads editions aloud with your phone’s voice. For more voices: Android Settings → search “Text-to-speech” → Speech Services by Google → ⚙️ → Install voice data → English.'
      : 'Brewsy reads editions aloud with your phone’s voice. These voices come from your browser.';

/** Picks the phone voice for editions without studio audio. Tapping one plays a short sample. */
function PhoneVoiceRows() {
  const { theme } = useTheme();
  const picked = useSettings().listenVoice;
  const [voices, setVoices] = useState<DeviceVoice[] | null>(null);

  useEffect(() => {
    let alive = true;
    deviceVoices()
      .then((v) => alive && setVoices(v))
      .catch(() => alive && setVoices([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!voices || !voices.length) {
    return (
      <Txt variant="bodySm" tone="tertiary" style={styles.voiceNote}>
        {voices ? 'No English voices found on this device.' : 'Looking for voices…'}
      </Txt>
    );
  }

  const choose = (id: string | null) => {
    const player = playerStore.get();
    if (player.playing && player.engine === 'speech') pause();
    updateSettings({ listenVoice: id });
    previewVoice(id ?? voices[0].id);
  };
  // The six best, plus the one you picked if it isn't among them.
  const shown = voices.filter((v, i) => i < 6 || v.id === picked);
  const rows: { id: string | null; label: string; detail: string }[] = [
    { id: null, label: 'Automatic', detail: `The best one here: ${voices[0].label}` },
    ...shown,
  ];

  return rows.map((v, i) => {
    const selected = picked === v.id;
    return (
      <View key={v.id ?? 'auto'}>
        {i > 0 && <Divider />}
        <Pressable
          onPress={() => choose(v.id)}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected }}
          accessibilityHint="Plays a short sample"
          style={styles.row}>
          <View style={styles.flex}>
            <Txt variant="label">{v.label}</Txt>
            <Txt variant="bodySm" tone="tertiary">
              {v.detail}
            </Txt>
          </View>
          <View>
            {selected ? (
              <Check size={18} color={theme.colors.accent} strokeWidth={2.4} />
            ) : (
              <Volume2 size={16} color={theme.colors.textTertiary} strokeWidth={1.9} />
            )}
          </View>
        </Pressable>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  ...settingsStyles,
  scroll: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 24, gap: 26 },
  voiceNote: { paddingVertical: 18 },
  about: { marginTop: 4, letterSpacing: 0.6 },
});
