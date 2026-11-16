import { Check, Volume2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Pill } from '../Pill';
import { Txt } from '../Txt';
import { Divider, Group, settingsStyles } from './SettingsParts';
import { Tap } from '@/components/Tap';
import { pause } from '@/audio/engine';
import { playerStore } from '@/audio/store';
import { deviceVoices, previewVoice, type DeviceVoice } from '@/audio/voice';
import { updateSettings, useSettings, type Settings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

const MODES = [
  { id: 'quick', label: 'Quick listen · about 3 min' },
  { id: 'full', label: 'Full briefing · about 10 min' },
] as const;

/** Settings → Listening: which version "Listen" plays, and the phone voice. */
export function ListeningSettings() {
  const { theme } = useTheme();
  const { listenMode } = useSettings();
  return (
    <>
      <Group
        title="Listen"
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
            {MODES.map((o) => (
              <Pill
                key={o.id}
                label={o.label}
                size="md"
                variant={listenMode === o.id ? 'solid' : 'glass'}
                color={theme.colors.inverseBg}
                selected={listenMode === o.id}
                onPress={() => updateSettings({ listenMode: o.id })}
              />
            ))}
          </View>
        </View>
      </Group>

      <Group title="Phone voice" footer={VOICE_TIP}>
        <PhoneVoiceRows />
      </Group>
    </>
  );
}

/** One line for the Settings list. */
export function listeningSummary(s: Settings): string {
  return `${s.listenMode === 'quick' ? 'Quick listen' : 'Full briefing'} · ${s.listenVoice ? 'your chosen voice' : 'automatic voice'}`;
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
        <Tap
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
        </Tap>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  ...settingsStyles,
  voiceNote: { paddingVertical: 18 },
});
