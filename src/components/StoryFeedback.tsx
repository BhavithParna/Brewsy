import * as Haptics from 'expo-haptics';
import { Check, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Pill } from './Pill';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { toast } from './Toast';
import { Txt } from './Txt';
import { TOPIC_LABEL } from '@/data/topics';
import type { Story } from '@/data/types';
import { isProperName, plainName } from '@/lib/search';
import { noFocusRing } from '@/lib/webStyles';
import { useSettings } from '@/state/settings';
import {
  MAX_FOCUS,
  focusTopic,
  hideWords,
  turnOffTopic,
  turnOnTopic,
  unfocusTopic,
  unhideWords,
} from '@/state/storyPrefs';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, TAP, capsLabel, fonts } from '@/theme/tokens';

function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync();
}

/** "Stories like this: More · Less", at the foot of an opened story. */
export function StoryFeedback({ story }: { story: Story }) {
  const { theme } = useTheme();
  const { focusTopics } = useSettings();
  const [lessOpen, setLessOpen] = useState(false);
  const [lessKey, setLessKey] = useState(0);
  const topic = TOPIC_LABEL[story.topic];
  const focused = focusTopics.includes(story.topic);

  const more = () => {
    tap();
    if (focused) {
      unfocusTopic(story.topic);
      toast.show(`Back to the usual amount of ${topic}`, { label: 'Undo', onPress: () => focusTopic(story.topic) });
      return;
    }
    const result = focusTopic(story.topic);
    if (result === 'added') {
      toast.show(`More ${topic}, shown first`, { label: 'Undo', onPress: () => unfocusTopic(story.topic) });
    } else if (result === 'followed') {
      toast.show(`${topic} is back in your edition`, { label: 'Undo', onPress: () => turnOffTopic(story.topic) });
    } else if (result === 'full') {
      toast.show(`You already get more of ${MAX_FOCUS} topics. Change them in Settings.`);
    }
  };

  const openLess = () => {
    tap();
    setLessKey((k) => k + 1);
    setLessOpen(true);
  };

  return (
    <View style={[styles.row, { borderTopColor: theme.colors.hairline }]}>
      <Txt variant="label" tone="secondary" style={styles.flex}>
        Stories like this
      </Txt>
      <FeedbackButton
        label="More"
        icon={focused ? Check : Plus}
        selected={focused}
        onPress={more}
        accessibilityLabel={
          focused ? `Getting more ${topic}. Tap to go back to the usual amount` : `More ${topic} stories`
        }
      />
      <FeedbackButton label="Less" icon={Minus} onPress={openLess} accessibilityLabel="Less like this" />
      <Sheet visible={lessOpen} onClose={() => setLessOpen(false)} title="Less like this">
        <LessLikeThis key={lessKey} story={story} onDone={() => setLessOpen(false)} />
      </Sheet>
    </View>
  );
}

function FeedbackButton({
  label,
  icon: Icon,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon: typeof Plus;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected != null ? { selected } : undefined}
      style={[
        styles.button,
        {
          borderColor: selected ? theme.colors.text : theme.colors.glassBorder,
          borderRadius: theme.shape.control,
        },
      ]}>
      <Icon size={15} strokeWidth={2} color={theme.colors.text} />
      <Txt variant="label" style={theme.layout.capsButtons && capsLabel}>
        {label}
      </Txt>
    </PressableScale>
  );
}

/** Words and names from the story a reader might want to hide: its key players, then its key terms. */
function candidates(story: Story): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (w: string) => {
    const k = w.toLowerCase();
    if (w.length < 2 || seen.has(k)) return;
    seen.add(k);
    out.push(w);
  };
  story.keyPlayers.map((p) => plainName(p.name)).filter(isProperName).forEach(add);
  story.keyTerms.map((t) => plainName(t.term)).filter((t) => t.length <= 28).forEach(add);
  return out.slice(0, 8);
}

function LessLikeThis({ story, onDone }: { story: Story; onDone: () => void }) {
  const { theme } = useTheme();
  const { mutedWords, topics, focusTopics } = useSettings();
  const muted = new Set(mutedWords.map((w) => w.toLowerCase()));
  const [extra, setExtra] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const topic = TOPIC_LABEL[story.topic];
  const focused = focusTopics.includes(story.topic);
  const base = candidates(story);
  const options = [...base, ...extra.filter((w) => !base.includes(w))];

  // The sheet closes first; then the change lands (which can take this very story off Today).
  const finish = (apply: () => void) => {
    onDone();
    setTimeout(apply, 280);
  };

  const toggle = (w: string) => {
    tap();
    setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]));
  };

  const addDraft = () => {
    const w = draft.trim().replace(/\s+/g, ' ');
    setDraft('');
    if (w.length < 2) return;
    if (!options.some((o) => o.toLowerCase() === w.toLowerCase())) setExtra((e) => [...e, w]);
    setPicked((p) => (p.some((x) => x.toLowerCase() === w.toLowerCase()) ? p : [...p, w]));
  };

  const hide = () =>
    finish(() => {
      const added = hideWords(picked);
      if (!added.length) return;
      const what = added.length === 1 ? `“${added[0]}”` : `${added.length} things`;
      toast.show(`Hiding stories about ${what}`, { label: 'Undo', onPress: () => unhideWords(added) });
    });

  const fewer = () =>
    finish(() => {
      unfocusTopic(story.topic);
      toast.show(`Back to the usual amount of ${topic}`, { label: 'Undo', onPress: () => focusTopic(story.topic) });
    });

  const turnOff = () => {
    if (topics.length <= 1) {
      toast.show('Keep at least one topic');
      return;
    }
    finish(() => {
      turnOffTopic(story.topic);
      toast.show(`${topic} is off`, { label: 'Undo', onPress: () => turnOnTopic(story.topic, focused) });
    });
  };

  const n = picked.length;
  const hideLabel = n === 0 ? 'Choose what to hide' : n === 1 ? `Hide “${picked[0]}”` : `Hide these ${n}`;

  return (
    <ScrollView
      contentContainerStyle={styles.sheet}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <Txt variant="body" tone="secondary" align="center">
        Stories that mention what you choose are left out of Today. You can undo this in Settings.
      </Txt>

      {options.length > 0 && (
        <View style={styles.group}>
          <Txt variant="kicker" tone="tertiary">
            Hide stories about
          </Txt>
          <View style={styles.pills}>
            {options.map((w) => {
              const already = muted.has(w.toLowerCase());
              const on = already || picked.includes(w);
              return (
                <Pill
                  key={w}
                  label={already ? `${w} · hidden` : w}
                  size="md"
                  variant={on ? 'solid' : 'outline'}
                  color={theme.colors.inverseBg}
                  selected={on}
                  onPress={already ? undefined : () => toggle(w)}
                  accessibilityLabel={already ? `${w} is already hidden` : `Hide stories about ${w}`}
                />
              );
            })}
          </View>
        </View>
      )}

      <View style={[styles.field, { borderColor: theme.colors.glassBorder, borderRadius: theme.shape.control }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Another word or name"
          placeholderTextColor={theme.colors.textTertiary}
          returnKeyType="done"
          // Stay in the field, so several words can go in one after another
          // (blurOnSubmit for the web preview, which doesn't read submitBehavior yet).
          submitBehavior="submit"
          blurOnSubmit={false}
          onSubmitEditing={addDraft}
          maxLength={40}
          autoCorrect={false}
          accessibilityLabel="Another word or name to hide"
          style={[
            styles.input,
            noFocusRing,
            { color: theme.colors.text, fontFamily: theme.type.body?.fontFamily ?? fonts.regular },
          ]}
        />
        <PressableScale
          onPress={addDraft}
          disabled={!draft.trim()}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Add"
          style={styles.addButton}>
          <Plus size={18} strokeWidth={2} color={draft.trim() ? theme.colors.text : theme.colors.textTertiary} />
        </PressableScale>
      </View>

      {(topics.length > 1 || focused) && (
        <View style={styles.group}>
          <Txt variant="kicker" tone="tertiary">
            Or the whole topic
          </Txt>
          <View style={styles.pills}>
            {focused && <Pill label={`Fewer ${topic} stories`} size="md" variant="outline" onPress={fewer} />}
            {topics.length > 1 && <Pill label={`Turn off ${topic}`} size="md" variant="outline" onPress={turnOff} />}
          </View>
        </View>
      )}

      <PressableScale
        onPress={n ? hide : undefined}
        disabled={!n}
        accessibilityRole="button"
        accessibilityLabel={hideLabel}
        accessibilityState={{ disabled: !n }}
        style={[
          styles.primary,
          {
            backgroundColor: n ? theme.colors.inverseBg : 'transparent',
            borderColor: n ? theme.colors.inverseBg : theme.colors.glassBorder,
            borderRadius: theme.shape.control,
          },
        ]}>
        <Txt
          variant="label"
          tone={n ? 'inverse' : 'tertiary'}
          numberOfLines={1}
          style={theme.layout.capsButtons && capsLabel}>
          {hideLabel}
        </Txt>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 18, borderTopWidth: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TAP,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  sheet: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 8, gap: 22 },
  group: { gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 4,
    minHeight: 48,
  },
  // position: relative keeps the field above the sheet's layers on web.
  input: { position: 'relative', flex: 1, minWidth: 0, fontSize: 16, minHeight: TAP },
  addButton: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  primary: { height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 18 },
});
