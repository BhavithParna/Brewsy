import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Pill } from '../Pill';
import { Txt } from '../Txt';
import { Divider, Group, settingsStyles } from './SettingsParts';
import { ApiError, sendFeedback, type FeedbackKind } from '@/data/api';
import { appVersion } from '@/lib/appVersion';
import { deviceId } from '@/lib/device';
import { noFocusRing } from '@/lib/webStyles';
import { settingsStore, updateSettings, useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, fonts } from '@/theme/tokens';

const KINDS: { id: FeedbackKind; label: string }[] = [
  { id: 'idea', label: 'An idea' },
  { id: 'problem', label: 'Something’s wrong' },
  { id: 'praise', label: 'Something I like' },
  { id: 'other', label: 'Other' },
];

const MAX = 2000;

/** What's been typed, kept while Settings is closed and reopened (until the app restarts). */
const draft: { kind: FeedbackKind; message: string } = { kind: 'idea', message: '' };

/**
 * Settings → Send feedback. Goes to the owner's inbox (Supabase `feedback`); the reader can't
 * read it back. Sent with the theme, phone type and app version, and a name only if they add one.
 */
export function FeedbackSettings({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const { feedbackName } = useSettings();
  const [kind, setKind] = useState<FeedbackKind>(draft.kind);
  const [message, setMessage] = useState(draft.message);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputFont = theme.type.body?.fontFamily ?? fonts.regular;

  const edit = (patch: Partial<typeof draft>) => {
    Object.assign(draft, patch);
    if (patch.kind) setKind(patch.kind);
    if (patch.message !== undefined) setMessage(patch.message);
    setError(null);
  };

  const send = async () => {
    const text = message.trim();
    if (!text || status === 'sending') return;
    setStatus('sending');
    setError(null);
    try {
      const s = settingsStore.get();
      await sendFeedback({
        device_id: await deviceId(),
        kind,
        message: text,
        name: s.feedbackName.trim() || null,
        theme: s.theme,
        platform: Platform.OS,
        app_version: appVersion(),
      });
      Object.assign(draft, { kind: 'idea', message: '' });
      setMessage('');
      setKind('idea');
      setStatus('sent');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setStatus('idle');
      setError(
        e instanceof ApiError && /too much feedback/i.test(e.message)
          ? 'That’s a lot of notes for one day. Thank you! Send the rest tomorrow.'
          : 'Couldn’t send it. Check your connection and try again; your note is still here.',
      );
    }
  };

  if (status === 'sent') {
    return (
      <Group>
        <View style={styles.thanks} accessibilityLiveRegion="polite">
          <Txt variant="displayS" align="center">
            Thank you!
          </Txt>
          <Txt variant="body" tone="secondary" align="center">
            Every note gets read, and it really helps make Brewsy better.
          </Txt>
          <View style={styles.thanksActions}>
            <Pill label="Send another" size="md" variant="glass" color={theme.colors.inverseBg} onPress={() => setStatus('idle')} />
            <Pill label="Done" size="md" variant="solid" color={theme.colors.inverseBg} onPress={onDone} />
          </View>
        </View>
      </Group>
    );
  }

  const left = MAX - message.length;
  const canSend = message.trim().length > 0 && status !== 'sending';
  return (
    <>
      <Group footer="Sent with your theme, phone type and app version, so problems are easier to track down. Nothing else about you.">
        <View style={styles.rowStack}>
          <Txt variant="label">What’s it about?</Txt>
          <View style={styles.pills} accessibilityRole="radiogroup">
            {KINDS.map((k) => (
              <Pill
                key={k.id}
                label={k.label}
                size="md"
                variant={kind === k.id ? 'solid' : 'glass'}
                color={theme.colors.inverseBg}
                selected={kind === k.id}
                onPress={() => edit({ kind: k.id })}
              />
            ))}
          </View>
        </View>
        <Divider />
        <TextInput
          value={message}
          onChangeText={(t) => edit({ message: t })}
          placeholder={PLACEHOLDER[kind]}
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          maxLength={MAX}
          textAlignVertical="top"
          accessibilityLabel="Your feedback"
          style={[styles.message, noFocusRing, { color: theme.colors.text, fontFamily: inputFont }]}
        />
        {left < 300 && (
          <Txt variant="caption" tone="tertiary" style={styles.count}>
            {left} characters left
          </Txt>
        )}
        <Divider />
        <TextInput
          value={feedbackName}
          onChangeText={(t) => updateSettings({ feedbackName: t.slice(0, 60) })}
          placeholder="Your name (optional)"
          placeholderTextColor={theme.colors.textTertiary}
          maxLength={60}
          autoComplete="name"
          returnKeyType="done"
          accessibilityLabel="Your name, optional"
          style={[styles.name, noFocusRing, { color: theme.colors.text, fontFamily: inputFont }]}
        />
      </Group>

      {error && (
        <Txt variant="bodySm" tone="secondary" align="center" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      )}

      <View style={styles.sendRow}>
        <Pill
          label={status === 'sending' ? 'Sending…' : 'Send feedback'}
          size="md"
          variant="solid"
          color={theme.colors.inverseBg}
          onPress={canSend ? send : undefined}
          accessibilityLabel={canSend ? 'Send feedback' : 'Send feedback. Write something first.'}
          style={!canSend && styles.dim}
        />
      </View>
    </>
  );
}

const PLACEHOLDER: Record<FeedbackKind, string> = {
  idea: 'What would make Brewsy better for you?',
  problem: 'What went wrong, and where? The more detail the better.',
  praise: 'What do you enjoy? It helps to know what to keep.',
  other: 'Anything at all.',
};

const styles = StyleSheet.create({
  ...settingsStyles,
  // position: relative keeps the fields above the card's layers on web.
  // Grows to a point, then scrolls inside, so what's being typed stays above the keyboard.
  message: { position: 'relative', minHeight: 130, maxHeight: 190, fontSize: 16, lineHeight: 23, paddingTop: 14, paddingBottom: 12 },
  count: { alignSelf: 'flex-end', paddingBottom: 8 },
  name: { position: 'relative', minHeight: TAP + 8, fontSize: 16 },
  sendRow: { alignItems: 'center' },
  dim: { opacity: 0.45 },
  thanks: { paddingVertical: 26, gap: 10 },
  thanksActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
});
