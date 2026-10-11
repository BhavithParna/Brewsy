import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronRight, ChevronUp, History, Search, X } from 'lucide-react-native';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TopicHeading } from '@/components/EditionSections';
import { GlassCard } from '@/components/GlassCard';
import { GlassIconButton } from '@/components/GlassIconButton';
import { Pill } from '@/components/Pill';
import { SourceLinks } from '@/components/SourceLinks';
import { ThemeBackground } from '@/components/ThemeBackground';
import { Txt } from '@/components/Txt';
import { loadRecentEditions, todayKey, yesterdayKey } from '@/data/editions';
import { TOPIC_LABEL } from '@/data/topics';
import type { Briefing } from '@/data/types';
import { formatShortDate } from '@/lib/format';
import {
  editionDocs,
  editionNames,
  hiddenReasons,
  highlight,
  queryWords,
  searchDocs,
  type SearchHit,
} from '@/lib/search';
import { noFocusRing } from '@/lib/webStyles';
import { clearRecentSearches, forgetSearch, rememberSearch, useRecentSearches } from '@/state/recentSearches';
import { useSettings } from '@/state/settings';
import { focusStory } from '@/state/storyFocus';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, TAP, capsLabel, fonts, radii, withAlpha } from '@/theme/tokens';

/** How far back search looks. */
const DAYS = 14;
/** Comfortable reading width on big screens. */
const MAX_WIDTH = 680;

function dayLabel(date: string): string {
  if (date === todayKey()) return 'Today';
  if (date === yesterdayKey()) return 'Yesterday';
  return formatShortDate(date);
}

/** What's being searched, under the suggestions. */
function scopeLine(count: number, loading: boolean, offline: boolean): string {
  const editions = `${count} ${count === 1 ? 'edition' : 'editions'}`;
  if (loading && count === 0) return 'Gathering the last two weeks…';
  if (offline) return `Offline. Searching the ${editions} saved on this phone.`;
  return `${editions} from the last two weeks, with Also happening and Since this morning.`;
}

/** Search across the last two weeks of editions: stories, Since this morning and Also happening. */
export default function SearchScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const initial = typeof params.q === 'string' ? params.q : '';
  const [query, setQuery] = useState(initial);
  const [settled, setSettled] = useState(initial);
  const [editions, setEditions] = useState<Map<string, Briefing>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const input = useRef<TextInput>(null);
  const center = theme.layout.heroAlign === 'center';
  const { topics, mutedWords } = useSettings();
  const hiddenReason = useMemo(() => hiddenReasons({ topics, mutedWords }), [topics, mutedWords]);

  useEffect(() => {
    let live = true;
    loadRecentEditions(DAYS, (b) => {
      if (live) setEditions((m) => new Map(m).set(b.date, b));
    })
      .then((r) => live && setOffline(r.offline))
      .catch(() => live && setOffline(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  // Search as you type, a beat after the last key.
  useEffect(() => {
    const t = setTimeout(() => setSettled(query), 140);
    return () => clearTimeout(t);
  }, [query]);

  const docs = useMemo(() => [...editions.values()].flatMap(editionDocs), [editions]);
  const words = useMemo(() => queryWords(settled), [settled]);
  const hits = useMemo(() => searchDocs(docs, settled), [docs, settled]);
  const groups = useMemo(() => {
    const byDate = new Map<string, SearchHit[]>();
    for (const h of hits) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h]);
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [hits]);
  const latest = useMemo(
    () => [...editions.values()].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
    [editions],
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const searchFor = (q: string) => {
    setQuery(q);
    setSettled(q);
    rememberSearch(q);
  };

  const open = (h: SearchHit) => {
    rememberSearch(settled);
    focusStory(h.date, h.id);
    router.dismissTo('/');
  };

  const searching = settled.trim().length > 0;

  return (
    <View style={styles.flex}>
      <ThemeBackground />
      <View style={[styles.column, styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.titleRow, center && styles.titleRowCenter]}>
          <Txt variant="displayL" accessibilityRole="header" style={center && styles.centerTitle}>
            Search
          </Txt>
          <View style={center ? styles.closeCentered : undefined}>
            <GlassIconButton
              icon={<X size={18} color={theme.colors.text} strokeWidth={1.8} />}
              onPress={close}
              accessibilityLabel="Close search"
            />
          </View>
        </View>

        <GlassCard radius={radii.pill} style={styles.field}>
          {/* Wrapped so the icon stacks above the card's layers on web. */}
          <View>
            <Search size={18} color={theme.colors.textTertiary} strokeWidth={1.8} />
          </View>
          <TextInput
            ref={input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => rememberSearch(query)}
            autoFocus={!initial}
            placeholder="Names, places, topics"
            placeholderTextColor={theme.colors.textTertiary}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            accessibilityLabel="Search recent editions"
            style={[
              styles.input,
              noFocusRing,
              { color: theme.colors.text, fontFamily: theme.type.body?.fontFamily ?? fonts.regular },
            ]}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery('');
                setSettled('');
                input.current?.focus();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.clear}>
              <View style={[styles.clearDot, { backgroundColor: theme.colors.textTertiary }]}>
                <X size={12} strokeWidth={2.6} color={theme.colors.sheet} />
              </View>
            </Pressable>
          )}
        </GlassCard>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 48 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        {searching ? (
          <>
            <Txt
              variant="caption"
              tone="tertiary"
              style={[styles.pad, styles.status]}
              accessibilityLiveRegion="polite">
              {hits.length === 0
                ? loading
                  ? 'Searching…'
                  : ''
                : `${hits.length} ${hits.length === 1 ? 'result' : 'results'}${loading ? ' so far' : ''}`}
            </Txt>

            {groups.map(([date, list]) => (
              <Animated.View key={date} entering={FadeIn.duration(200)} style={styles.group}>
                <TopicHeading label={dayLabel(date)} count={list.length} />
                <View style={styles.pad}>
                  <GlassCard radius={radii.lg} style={styles.card}>
                    {list.map((h, i) => (
                      <ResultRow
                        key={h.key}
                        hit={h}
                        words={words}
                        first={i === 0}
                        hidden={hiddenReason(h)}
                        onOpen={() => open(h)}
                      />
                    ))}
                  </GlassCard>
                </View>
              </Animated.View>
            ))}

            {!loading && hits.length === 0 && (
              <View style={[styles.pad, styles.none]}>
                <Txt variant="displayM" align="center">
                  No matches
                </Txt>
                <Txt variant="body" tone="secondary" align="center">
                  {`Nothing in the last two weeks mentions “${settled.trim()}”. Try one word, or a name.`}
                </Txt>
              </View>
            )}
          </>
        ) : (
          <StartPanel
            latest={latest}
            onSearch={searchFor}
            status={scopeLine(editions.size, loading, offline)}
          />
        )}
      </ScrollView>
    </View>
  );
}

/** Before typing: recent searches, names from the latest edition, and what's being searched. */
function StartPanel({
  latest,
  onSearch,
  status,
}: {
  latest: Briefing | null;
  onSearch: (q: string) => void;
  status: string;
}) {
  const { theme } = useTheme();
  const recent = useRecentSearches();
  const names = latest ? editionNames(latest) : [];

  return (
    <View style={[styles.pad, styles.start]}>
      {recent.length > 0 && (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Txt variant="kicker" tone="tertiary" accessibilityRole="header">
              Recent
            </Txt>
            <Pressable
              onPress={clearRecentSearches}
              hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Clear recent searches">
              <Txt variant="caption" tone="secondary" style={theme.layout.capsButtons && capsLabel}>
                Clear
              </Txt>
            </Pressable>
          </View>
          <GlassCard radius={radii.lg} style={styles.card}>
            {recent.map((q, i) => (
              <View
                key={q}
                style={[styles.recentRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
                <Pressable
                  onPress={() => onSearch(q)}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${q}`}
                  style={styles.recentPress}>
                  <History size={16} color={theme.colors.textTertiary} strokeWidth={1.8} />
                  <Txt variant="body" numberOfLines={1} style={styles.flexShrink}>
                    {q}
                  </Txt>
                </Pressable>
                <Pressable
                  onPress={() => forgetSearch(q)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${q} from recent searches`}
                  style={styles.remove}>
                  <X size={15} color={theme.colors.textTertiary} strokeWidth={1.8} />
                </Pressable>
              </View>
            ))}
          </GlassCard>
        </View>
      )}

      {names.length > 0 && latest && (
        <View style={styles.block}>
          <Txt variant="kicker" tone="tertiary" accessibilityRole="header">
            {latest.date === todayKey() ? 'In today’s edition' : 'In the latest edition'}
          </Txt>
          <View style={styles.pills}>
            {names.map((n) => (
              <Pill
                key={n}
                label={n}
                size="md"
                variant="glass"
                onPress={() => onSearch(n)}
                accessibilityLabel={`Search for ${n}`}
              />
            ))}
          </View>
        </View>
      )}

      <Txt variant="caption" tone="tertiary" style={styles.scope}>
        {status}
      </Txt>
    </View>
  );
}

/** Highlighted text: matching words get a soft marker in the theme's accent. */
function Marked({ text, words }: { text: string; words: string[] }) {
  const { theme } = useTheme();
  const accent = theme.colors.accent;
  const marker = /^#[0-9a-f]{6}$/i.test(accent) ? withAlpha(accent, theme.isDark ? 0.34 : 0.2) : theme.colors.hairline;
  return (
    <>
      {highlight(text, words).map((s, i) =>
        s.hit ? (
          // Plain Text, so the match keeps the surrounding font and size.
          <Text key={i} style={{ color: theme.colors.text, backgroundColor: marker }}>
            {s.text}
          </Text>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * One result. Tapping opens it in its edition on Today; a result Today wouldn't show (topic off,
 * or a hidden word) opens here instead, with a note saying why.
 */
function ResultRow({
  hit,
  words,
  first,
  hidden,
  onOpen,
}: {
  hit: SearchHit;
  words: string[];
  first: boolean;
  hidden: string | null;
  onOpen: () => void;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const where = hit.kind === 'also' ? 'Also happening' : hit.kind === 'update' ? 'Since this morning' : null;
  const inPlace = hidden != null;
  const Chevron = inPlace ? (open ? ChevronUp : ChevronDown) : ChevronRight;
  const whatHappened = hit.story?.whatHappened ?? hit.also?.whatHappened ?? '';
  const whyItMatters = hit.story?.whyItMatters ?? hit.also?.whyItMatters ?? '';
  const sources = (hit.story?.sources ?? hit.also?.sources ?? []).slice(0, 4);

  return (
    <View style={!first && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }}>
      <Pressable
        onPress={inPlace ? () => setOpen((o) => !o) : onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${TOPIC_LABEL[hit.topic]}${where ? `, ${where}` : ''}: ${hit.headline}`}
        accessibilityHint={inPlace ? (open ? 'Hides the details' : 'Shows it here') : 'Opens it in its edition'}
        accessibilityState={inPlace ? { expanded: open } : undefined}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.rowText}>
          <Txt variant="kicker" tone="tertiary">
            {where ? `${TOPIC_LABEL[hit.topic]} · ${where}` : TOPIC_LABEL[hit.topic]}
          </Txt>
          <Txt variant="title">
            <Marked text={hit.headline} words={words} />
          </Txt>
          {hit.snippet && !open && (
            <Txt variant="bodySm" tone="secondary" numberOfLines={3}>
              <Marked text={hit.snippet} words={words} />
            </Txt>
          )}
        </View>
        <View style={styles.chevron}>
          <Chevron size={17} color={theme.colors.textTertiary} strokeWidth={1.8} />
        </View>
      </Pressable>

      {inPlace && open && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.details}>
          <Txt variant="reading">
            <Marked text={whatHappened} words={words} />
          </Txt>
          {whyItMatters !== '' && (
            <View style={[styles.why, { borderLeftColor: withAlpha(theme.colors.accent, 0.55) }]}>
              <Txt variant="kicker" tone="tertiary">
                Why it matters
              </Txt>
              <Txt variant="reading">{whyItMatters}</Txt>
            </View>
          )}
          <SourceLinks sources={sources} />
          <Txt variant="caption" tone="tertiary">
            {hidden}
          </Txt>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: GUTTER },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: TAP + 8,
    marginBottom: 14,
  },
  titleRowCenter: { justifyContent: 'center' },
  centerTitle: { textAlign: 'center' },
  closeCentered: { position: 'absolute', right: 0 },
  header: { paddingBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingLeft: 18, paddingRight: 6 },
  // position: relative keeps the field above the card's layers on web.
  input: { position: 'relative', flex: 1, minWidth: 0, fontSize: 16, minHeight: TAP, paddingVertical: 0 },
  clear: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  clearDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  results: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingTop: 6 },
  pad: { paddingHorizontal: GUTTER },
  status: { minHeight: 16, marginTop: 10, marginLeft: 6 },
  group: { marginTop: 22, gap: 14 },
  card: { paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 56 },
  rowText: { flex: 1, gap: 5 },
  chevron: { alignSelf: 'center' },
  pressed: { opacity: 0.6 },
  details: { gap: 14, paddingBottom: 18 },
  why: { gap: 8, borderLeftWidth: 2, paddingLeft: 14 },
  none: { gap: 10, paddingTop: 48, paddingHorizontal: 16 },
  start: { gap: 28, paddingTop: 22 },
  block: { gap: 12 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recentPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  remove: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scope: { paddingHorizontal: 6 },
});
