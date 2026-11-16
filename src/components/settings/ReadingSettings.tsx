import * as Haptics from 'expo-haptics';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Pill } from '../Pill';
import { PressableScale } from '../PressableScale';
import { toast } from '../Toast';
import { Txt } from '../Txt';
import { Divider, Group, settingsStyles } from './SettingsParts';
import { Tap } from '@/components/Tap';
import { noFocusRing } from '@/lib/webStyles';
import { updateSettings, useSettings } from '@/state/settings';
import { hideWords, unhideWords } from '@/state/storyPrefs';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, fonts } from '@/theme/tokens';

/** Text size steps, as multiples of each theme's designed sizes. */
export const TEXT_SIZES = [
  { scale: 0.9, label: 'Small' },
  { scale: 1, label: 'Default' },
  { scale: 1.12, label: 'Large' },
  { scale: 1.25, label: 'Larger' },
  { scale: 1.4, label: 'Largest' },
] as const;

/** The step closest to a saved scale. */
function stepOf(scale: number): number {
  let best = 0;
  TEXT_SIZES.forEach((s, i) => {
    if (Math.abs(s.scale - scale) < Math.abs(TEXT_SIZES[best].scale - scale)) best = i;
  });
  return best;
}

/** Settings → Reading: text size and hidden words. */
export function ReadingSettings() {
  return (
    <>
      <Group>
        <TextSizeControl />
      </Group>
      <HiddenWords />
    </>
  );
}

function TextSizeControl() {
  const { theme } = useTheme();
  const { textScale } = useSettings();
  const step = stepOf(textScale);
  const set = (i: number) => {
    const next = Math.max(0, Math.min(TEXT_SIZES.length - 1, i));
    if (next === step) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    updateSettings({ textScale: TEXT_SIZES[next].scale });
  };
  const round = theme.shape.control >= 999;
  const markRadius = (size: number) => (round ? size / 2 : Math.min(theme.shape.control, 3));

  return (
    <View style={styles.sizeWrap}>
      <View style={styles.sizeHead}>
        <Txt variant="label">Text size</Txt>
        <Txt variant="caption" tone="tertiary">
          {TEXT_SIZES[step].label}
        </Txt>
      </View>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Text size"
        accessibilityValue={{ text: TEXT_SIZES[step].label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => set(step + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
        style={styles.scaleRow}>
        <Tap onPress={() => set(step - 1)} hitSlop={6} style={styles.glyph} importantForAccessibility="no">
          <Txt variant="displayS" style={styles.glyphSmall}>
            A
          </Txt>
        </Tap>
        <View style={styles.track}>
          <View style={[styles.rail, { backgroundColor: theme.colors.glassBorder }]} />
          {TEXT_SIZES.map((s, i) => {
            const on = i === step;
            const size = on ? 18 : 8;
            return (
              <Tap key={s.label} onPress={() => set(i)} style={styles.stop} importantForAccessibility="no">
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: markRadius(size),
                    backgroundColor: on ? theme.colors.inverseBg : theme.colors.sheet,
                    borderWidth: on ? 0 : 1.5,
                    borderColor: theme.colors.textTertiary,
                  }}
                />
              </Tap>
            );
          })}
        </View>
        <Tap onPress={() => set(step + 1)} hitSlop={6} style={styles.glyph} importantForAccessibility="no">
          <Txt variant="displayS" style={styles.glyphLarge}>
            A
          </Txt>
        </Tap>
      </View>

      <View style={[styles.preview, { borderLeftColor: theme.colors.hairline }]}>
        <Txt variant="headline">A calm look at the day</Txt>
        <Txt variant="reading" tone="secondary">
          Stories, explainers and Go deeper all use this size.
        </Txt>
      </View>
    </View>
  );
}

function HiddenWords() {
  const { theme } = useTheme();
  const { mutedWords } = useSettings();
  const [draft, setDraft] = useState('');

  const add = () => {
    const w = draft.trim();
    if (!w) return;
    const added = hideWords([w]);
    setDraft('');
    if (!added.length) toast.show(`“${w}” is already hidden`);
  };

  const remove = (w: string) => {
    unhideWords([w]);
    toast.show(`Showing stories about “${w}” again`, { label: 'Undo', onPress: () => hideWords([w]) });
  };

  return (
    <Group
      title="Hidden words"
      footer="Stories and lines that mention these words or names are left out of Today. Search still finds them.">
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a word or name"
          placeholderTextColor={theme.colors.textTertiary}
          returnKeyType="done"
          // Stay in the field, so several words can go in one after another
          // (blurOnSubmit for the web preview, which doesn't read submitBehavior yet).
          submitBehavior="submit"
          blurOnSubmit={false}
          onSubmitEditing={add}
          maxLength={40}
          autoCorrect={false}
          accessibilityLabel="Word or name to hide"
          style={[
            styles.input,
            noFocusRing,
            { color: theme.colors.text, fontFamily: theme.type.body?.fontFamily ?? fonts.regular },
          ]}
        />
        <Pill
          label="Hide"
          size="md"
          variant={draft.trim() ? 'solid' : 'outline'}
          color={theme.colors.inverseBg}
          icon={
            <Plus
              size={15}
              strokeWidth={2.2}
              color={draft.trim() ? theme.colors.inverseText : theme.colors.textTertiary}
            />
          }
          onPress={add}
          accessibilityLabel="Hide stories that mention this"
        />
      </View>
      <Divider />
      {mutedWords.length ? (
        <View style={[settingsStyles.pills, styles.chips]}>
          {mutedWords.map((w) => (
            <PressableScale
              key={w}
              onPress={() => remove(w)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Stop hiding ${w}`}>
              <View
                style={[
                  styles.chip,
                  { borderColor: theme.colors.glassBorder, borderRadius: theme.shape.control },
                ]}>
                <Txt variant="label" numberOfLines={1} style={styles.chipText}>
                  {w}
                </Txt>
                <X size={14} strokeWidth={2} color={theme.colors.textTertiary} />
              </View>
            </PressableScale>
          ))}
        </View>
      ) : (
        <Txt variant="bodySm" tone="tertiary" style={styles.empty}>
          Nothing hidden. Add a name, a team or a show you’d rather skip, or use “Less like this” under any story.
        </Txt>
      )}
    </Group>
  );
}

const styles = StyleSheet.create({
  sizeWrap: { paddingVertical: 16, gap: 14 },
  sizeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  glyph: { width: 32, height: TAP, alignItems: 'center', justifyContent: 'center' },
  glyphSmall: { fontSize: 14, lineHeight: 18, letterSpacing: 0, paddingLeft: 0 },
  glyphLarge: { fontSize: 24, lineHeight: 30, letterSpacing: 0, paddingLeft: 0 },
  track: { flex: 1, height: TAP, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rail: { position: 'absolute', left: 22, right: 22, height: 1.5 },
  stop: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  preview: { gap: 6, borderLeftWidth: 2, paddingLeft: 14 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  // position: relative keeps the field above the card's layers on web.
  input: { position: 'relative', flex: 1, minWidth: 0, fontSize: 16, minHeight: TAP },
  chips: { paddingVertical: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 14,
    paddingRight: 11,
    borderWidth: 1,
  },
  chipText: { maxWidth: 220 },
  empty: { paddingVertical: 16 },
});
