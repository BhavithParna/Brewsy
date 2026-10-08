import { ArrowUp, Layers } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from './PressableScale';
import { SkeletonBlock } from './Skeleton';
import { Txt } from './Txt';
import { askAboutStory, backendConfigured, fetchDeepDive } from '@/data/api';
import type { AskAnswer, DeepDive, Story } from '@/data/types';
import { paragraphs } from '@/lib/format';
import { useStore } from '@/lib/persisted';
import { cacheDeepDive, deepDiveStore } from '@/state/deepDives';
import { attachDeepDive, storyKey, useReadingList } from '@/state/readingList';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, fonts, radii, withAlpha } from '@/theme/tokens';

const NOT_CONNECTED =
  'Go deeper needs the Brewsy backend. Follow docs/BACKEND_SETUP.md to switch it on.';

/** Layer 3: an on-demand explainer written from the story's sources, plus "Ask a question about this". */
export function GoDeeper({ story, editionDate }: { story: Story; editionDate: string }) {
  const { theme } = useTheme();
  const key = storyKey(editionDate, story.id);
  const saved = useReadingList().find((i) => i.key === key);
  const cached = useStore(deepDiveStore)[key];
  const deepDive = saved?.deepDive ?? cached;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!backendConfigured) {
      setError(NOT_CONNECTED);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dd = await fetchDeepDive(editionDate, story.id);
      cacheDeepDive(key, dd);
      if (saved) attachDeepDive(key, dd);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {deepDive ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <DeepDiveView deepDive={deepDive} />
        </Animated.View>
      ) : loading ? (
        <View style={styles.loading} accessible accessibilityLabel="Writing a deeper explainer">
          <Txt variant="kicker" tone="tertiary">
            Reading the sources…
          </Txt>
          <SkeletonBlock height={14} radius={7} />
          <SkeletonBlock height={14} radius={7} width="92%" />
          <SkeletonBlock height={14} radius={7} width="96%" />
          <SkeletonBlock height={14} radius={7} width="70%" />
        </View>
      ) : (
        <View style={styles.cta}>
          <PressableScale
            onPress={run}
            accessibilityRole="button"
            accessibilityLabel="Go deeper"
            accessibilityHint="Writes a longer explainer from this story's sources">
            <View style={[styles.ctaButton, { borderColor: theme.colors.glassBorder }]}>
              <Layers size={17} color={theme.colors.text} strokeWidth={1.7} />
              <Txt variant="label">Go deeper</Txt>
            </View>
          </PressableScale>
          <Txt variant="caption" tone="tertiary" align="center">
            A longer explainer built only from this story&apos;s sources.
          </Txt>
          {error && (
            <Txt variant="bodySm" color={theme.colors.down} align="center">
              {error}
            </Txt>
          )}
        </View>
      )}

      <AskBox story={story} editionDate={editionDate} />
    </View>
  );
}

function DeepDiveView({ deepDive }: { deepDive: DeepDive }) {
  const { theme } = useTheme();
  return (
    <View style={styles.dive}>
      <View style={styles.diveHeader}>
        <Layers size={15} color={theme.colors.textSecondary} strokeWidth={1.7} />
        <Txt variant="kicker" tone="secondary">
          Deeper context
        </Txt>
      </View>

      {paragraphs(deepDive.context).map((p, i) => (
        <Txt key={i} variant="reading">
          {p}
        </Txt>
      ))}

      {deepDive.perspectives.length > 0 && (
        <View style={styles.group}>
          <Txt variant="kicker" tone="tertiary">
            Different perspectives
          </Txt>
          {deepDive.perspectives.map((p, i) => (
            <View key={i} style={[styles.perspective, { borderLeftColor: withAlpha(theme.colors.accent, 0.55) }]}>
              <Txt variant="label">{p.label}</Txt>
              <Txt variant="reading" tone="secondary">
                {p.text}
              </Txt>
            </View>
          ))}
        </View>
      )}

      {deepDive.numbers.length > 0 && (
        <View style={styles.group}>
          <Txt variant="kicker" tone="tertiary">
            Numbers that matter
          </Txt>
          {deepDive.numbers.map((n, i) => (
            <View key={i} style={styles.numberRow}>
              <Txt variant="displayS" style={styles.figure}>
                {n.figure}
              </Txt>
              <Txt variant="body" tone="secondary" style={styles.flex}>
                {n.meaning}
              </Txt>
            </View>
          ))}
        </View>
      )}

      {deepDive.openQuestions.length > 0 && (
        <View style={styles.group}>
          <Txt variant="kicker" tone="tertiary">
            Open questions
          </Txt>
          {deepDive.openQuestions.map((q, i) => (
            <View key={i} style={styles.bullet}>
              <Txt variant="reading" tone="tertiary">
                ?
              </Txt>
              <Txt variant="reading" style={styles.flex}>
                {q}
              </Txt>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type QA = { question: string; answer?: AskAnswer; error?: string };

function AskBox({ story, editionDate }: { story: Story; editionDate: string }) {
  const { theme } = useTheme();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<QA[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion('');
    if (!backendConfigured) {
      setHistory((h) => [...h, { question: q, error: NOT_CONNECTED }]);
      return;
    }
    setBusy(true);
    try {
      const answer = await askAboutStory(editionDate, story.id, q);
      setHistory((h) => [...h, { question: q, answer }]);
    } catch (e) {
      setHistory((h) => [...h, { question: q, error: e instanceof Error ? e.message : 'Something went wrong.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.ask}>
      {history.map((qa, i) => (
        <Animated.View key={i} entering={FadeIn.duration(250)} style={styles.qa}>
          <Txt variant="label" tone="secondary">
            {qa.question}
          </Txt>
          {qa.answer && (
            <>
              <Txt variant="reading">{qa.answer.answer}</Txt>
              {!qa.answer.answeredFromSources && (
                <Txt variant="caption" tone="tertiary">
                  The sources for this story don&apos;t cover that.
                </Txt>
              )}
            </>
          )}
          {qa.error && (
            <Txt variant="bodySm" color={theme.colors.down}>
              {qa.error}
            </Txt>
          )}
        </Animated.View>
      ))}

      <View style={[styles.askBar, { borderColor: theme.colors.glassBorder, backgroundColor: theme.colors.hairline }]}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask a question about this"
          placeholderTextColor={theme.colors.textTertiary}
          maxLength={300}
          returnKeyType="send"
          onSubmitEditing={submit}
          editable={!busy}
          accessibilityLabel="Ask a question about this story"
          style={[styles.askInput, { color: theme.colors.text }]}
        />
        <Pressable
          onPress={submit}
          disabled={busy || !question.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send question"
          hitSlop={6}
          style={[
            styles.send,
            { backgroundColor: question.trim() ? theme.colors.inverseBg : 'transparent' },
          ]}>
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          ) : (
            <ArrowUp size={18} strokeWidth={2.4} color={question.trim() ? theme.colors.inverseText : theme.colors.textTertiary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 22 },
  loading: { gap: 12, paddingVertical: 4 },
  cta: { gap: 10, alignItems: 'stretch' },
  ctaButton: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  dive: { gap: 16 },
  diveHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  group: { gap: 12, marginTop: 4 },
  perspective: { borderLeftWidth: 2, paddingLeft: 14, gap: 4 },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  figure: { minWidth: 72 },
  bullet: { flexDirection: 'row', gap: 12 },
  ask: { gap: 16 },
  qa: { gap: 6 },
  askBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 5,
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  // position: relative keeps the field above the glass layers on web.
  askInput: { position: 'relative', flex: 1, fontFamily: fonts.regular, fontSize: 15, minHeight: TAP },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
