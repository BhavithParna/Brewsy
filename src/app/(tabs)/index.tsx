import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Tap } from '@/components/Tap';
import { listenToEdition, prefetchEditionAudio } from '@/audio/listen';
import { AlsoHappening } from '@/components/AlsoHappening';
import { CoverBar } from '@/components/CoverBar';
import { DaySwitcher } from '@/components/DaySwitcher';
import { Cover } from '@/components/Cover';
import { EditionHeader } from '@/components/EditionHeader';
import { EndOfEdition, MarketsTable, RadarList, TopicHeading } from '@/components/EditionSections';
import { EditionTiles } from '@/components/EditionTiles';
import { coverageLine } from '@/components/HowMadeSheet';
import { BAR_HEIGHT, JumpBar, SectionsSheet } from '@/components/JumpBar';
import { navTargets } from '@/components/navTargets';
import { Pill } from '@/components/Pill';
import { useSheets } from '@/components/SheetHost';
import { EditionSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { StatusShade } from '@/components/StatusShade';
import { StoryView, storyLayout } from '@/components/StoryView';
import { SummaryCard } from '@/components/SummaryCard';
import { useTabBarClearance } from '@/components/TabBar';
import { toast } from '@/components/Toast';
import { TopicRail, type NavSection } from '@/components/TopicRail';
import { tourTargets } from '@/components/tour/targets';
import { TodayTour, WhatsNewTour } from '@/components/tour/Tour';
import { Txt } from '@/components/Txt';
import { shiftDate, todayKey } from '@/data/editions';
import type { Briefing, Story, Topic } from '@/data/types';
import { cyclePreviewState, usePreviewState } from '@/dev/previewState';
import { useEdition } from '@/hooks/useEdition';
import {
  showTabBar,
  usePinned,
  useScrollChrome,
  useSectionSpy,
  type SectionSpy,
} from '@/hooks/useScrollChrome';
import { curateEdition, type CuratedEdition, type LocalGroup } from '@/lib/curation';
import { formatDayParts, formatShortDate, formatWakeTime } from '@/lib/format';
import { exportEditionPdf } from '@/lib/pdf';
import { setSelectedEdition, useSelectedEdition } from '@/state/editionNav';
import { isNew } from '@/state/seen';
import { useSettings } from '@/state/settings';
import { clearStoryFocus, useStoryFocus } from '@/state/storyFocus';
import { noteSection } from '@/state/usage';
import { useTheme } from '@/theme/ThemeProvider';
import { TOPIC_LABEL } from '@/theme/themes';
import { GUTTER, TAP } from '@/theme/tokens';

/** Max comfortable reading width on big screens. */
const MAX_WIDTH = 680;

// Coach marks measure these (see navTargets).
const { days: daysTarget, rail: railTarget } = navTargets;

export default function TodayScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const clearance = useTabBarClearance();
  const reduceMotion = useReducedMotion();
  const { openSettings, openPastEditions } = useSheets();
  const preview = usePreviewState();
  const today = todayKey();
  const date = useSelectedEdition() ?? today;
  const { state, refreshing, refresh, retry } = useEdition(date);
  const center = theme.layout.heroAlign === 'center';
  const chrome = useScrollChrome();
  const { onScroll, progress, scrollY } = chrome;
  const coverHeight = Math.max(440, Math.round(height * 0.6));
  const scrollRef = useRef<Animated.ScrollView>(null);
  const { wakeTime, topics, focusTopics, mutedWords, disabledOutlets, region } = useSettings();
  const [sectionsOpen, setSectionsOpen] = useState(false);

  const briefing = state.status === 'ready' ? state.briefing : null;
  const curated = useMemo(
    () => (briefing ? curateEdition(briefing, { topics, focusTopics, mutedWords, disabledOutlets, region }) : null),
    [briefing, topics, focusTopics, mutedWords, disabledOutlets, region],
  );
  const sections = useMemo(() => (briefing && curated ? navSections(briefing, curated) : []), [briefing, curated]);
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);

  // Where a section or story lands when we scroll to it: just under the pinned bar.
  const topClear = insets.top + BAR_HEIGHT + 12;
  const spy = useSectionSpy(chrome, { ids: sectionIds, lineTop: topClear + 12, lineBottom: clearance });
  // Which sections people scroll to, for the owner's usage view (counts only, kept per day).
  useEffect(
    () =>
      spy.store.subscribe(() => {
        const { active } = spy.store.get();
        if (active) noteSection(active);
      }),
    [spy],
  );

  // Where the edition starts inside the scroll content, and where the rail sits inside the edition.
  const editionOffset = useRef(0);
  const railY = useRef(0);
  // The jump bar pins once the rail in the page reaches the status bar, so it seems to stick there.
  const pinAt = useSharedValue(0);
  const pinned = usePinned(scrollY, pinAt);
  const placePin = () => {
    pinAt.set(railY.current > 0 ? editionOffset.current + railY.current - insets.top : 0);
  };
  const setPinned = (on: boolean) => spy.store.set({ pinned: on });
  useAnimatedReaction(
    () => pinned.get() > 0.5,
    (on, prev) => {
      if (on !== prev) scheduleOnRN(setPinned, on);
    },
  );

  // A different day starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    showTabBar();
    spy.reset();
    railY.current = 0;
    pinAt.set(0);
  }, [date, spy, pinAt]);

  const goTo = (d: string) => {
    if (d > today || d === date) return;
    setSelectedEdition(d === today ? null : d);
  };

  const scrollToY = (y: number) =>
    scrollRef.current?.scrollTo({ y: Math.max(0, y - topClear), animated: !reduceMotion });

  const jumpTo = (id: string) => {
    const top = spy.topOf(id);
    if (top == null) return;
    spy.hold(id);
    scrollToY(top);
  };

  const openSearch = () => router.push('/search');

  // The day swipe waits while the jump rail scrolls sideways.
  const railGesture = useMemo(() => Gesture.Native(), []);

  // Swipe right for the previous day, left to come back toward today.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-30, 30])
    .failOffsetY([-14, 14])
    .requireExternalGestureToFail(railGesture)
    .onEnd((e) => {
      const older = e.translationX > 70 || e.velocityX > 800;
      const newer = e.translationX < -70 || e.velocityX < -800;
      if (!older && !newer) return;
      if (newer && date >= today) return;
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      goTo(shiftDate(date, older ? -1 : 1));
    });

  return (
    <View style={styles.flex}>
      <GestureDetector gesture={swipe}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={theme.colors.text}
              colors={[theme.colors.inverseText]}
              progressBackgroundColor={theme.colors.sheet}
            />
          }>
          <Cover height={coverHeight}>
            <CoverBar
              onSearch={openSearch}
              onSettings={openSettings}
              onBrandLongPress={cyclePreviewState}
              settingsRef={navTargets.settings}
              searchRef={navTargets.search}
            />

            <View style={[styles.pad, center && styles.center]}>
              <View ref={daysTarget} style={styles.days}>
                <DaySwitcher date={date} onChange={goTo} onOlder={openPastEditions} />
              </View>
            </View>

            {__DEV__ && preview !== 'live' && (
              <View style={[styles.pad, styles.previewPill]}>
                <Pill label={`Previewing: ${preview} state`} variant="soft" color={theme.colors.accent} />
              </View>
            )}

            <View style={styles.coverFoot}>
              {/* Today's edition not out yet: the earlier one shows its own date. */}
              <EditionHeader date={briefing?.date ?? date} />
            </View>
          </Cover>

          <Animated.View
            key={date}
            entering={FadeIn.duration(260)}
            onLayout={(e) => {
              editionOffset.current = e.nativeEvent.layout.y;
              spy.setBase(e.nativeEvent.layout.y);
              placePin();
            }}>
            {briefing && curated ? (
              <Edition
                briefing={briefing}
                curated={curated}
                sections={sections}
                offline={state.status === 'ready' && state.offline}
                refreshing={refreshing}
                onRefresh={refresh}
                isToday={date === today}
                earlier={briefing.date < date}
                scrollRef={scrollRef}
                offsetRef={editionOffset}
                topClear={topClear}
                spy={spy}
                railGesture={railGesture}
                onRailLayout={(y) => {
                  railY.current = y;
                  placePin();
                }}
                onJump={jumpTo}
                onOpenSections={() => setSectionsOpen(true)}
                onPrevious={() => goTo(shiftDate(briefing.date, -1))}
                onBackToToday={date !== today ? () => goTo(today) : undefined}
              />
            ) : (
              <View style={styles.stateWrap}>
                {state.status === 'loading' && <EditionSkeleton />}
                {state.status === 'empty' && (
                  <EmptyState
                    wakeTime={formatWakeTime(wakeTime)}
                    isToday={date === today}
                    dateLabel={formatShortDate(date)}
                  />
                )}
                {state.status === 'error' && <ErrorState message={state.message} onRetry={retry} />}
              </View>
            )}
          </Animated.View>
        </Animated.ScrollView>
      </GestureDetector>
      <StatusShade scrollY={scrollY} solidAt={coverHeight - insets.top - 60} handOff={pinned} />
      {sections.length > 0 && (
        <JumpBar
          shown={pinned}
          progress={progress}
          sections={sections}
          store={spy.store}
          onSelect={jumpTo}
          onOpenAll={() => setSectionsOpen(true)}
          onSearch={openSearch}
          onSettings={openSettings}
          barRef={navTargets.pinnedBar}
          settingsRef={navTargets.pinnedSettings}
        />
      )}
      <SectionsSheet
        visible={sectionsOpen}
        onClose={() => setSectionsOpen(false)}
        sections={sections}
        store={spy.store}
        onSelect={jumpTo}
        onOlder={openPastEditions}
      />
      {/* First run: a short tour of Today, once there's an edition to show it on. */}
      <TodayTour
        ready={!!curated && sections.length > 0 && preview === 'live'}
        hasStory={!!curated && (curated.updates.length > 0 || curated.groups.some((g) => g.stories.length > 0))}
        scrollRef={scrollRef}
        scrollY={scrollY}
        isPinned={() => spy.store.get().pinned}
      />
      {/* After an update: a note about what's new, for readers who've had the tour. */}
      <WhatsNewTour
        ready={!!curated && sections.length > 0 && preview === 'live'}
        scrollRef={scrollRef}
        scrollY={scrollY}
        isPinned={() => spy.store.get().pinned}
      />
    </View>
  );
}

/** The stops on the jump bar, in page order. */
function navSections(briefing: Briefing, curated: CuratedEdition): NavSection[] {
  const out: NavSection[] = [];
  if (curated.updates.length) {
    out.push({ id: 'updates', label: 'Since this morning', short: 'Latest', detail: `${curated.updates.length} new` });
  }
  if (curated.summary.length) out.push({ id: 'summary', label: 'Summary', detail: 'The 60-second version' });
  for (const g of curated.groups) {
    const parts = [
      g.stories.length ? storiesLabel(g.stories.length) : null,
      g.quick.length ? `${g.quick.length} in brief` : null,
    ];
    out.push({
      id: topicSection(g.topic),
      label: TOPIC_LABEL[g.topic],
      detail: parts.filter(Boolean).join(' · '),
      focus: g.focus,
    });
  }
  if (curated.local) {
    const { label, region, stories, quick } = curated.local;
    out.push({
      id: LOCAL_SECTION,
      label,
      // "United Kingdom" and "United States" are long for a chip.
      short: label.startsWith('United ') ? region : undefined,
      detail: [stories.length ? storiesLabel(stories.length) : null, quick.length ? `${quick.length} in brief` : null]
        .filter(Boolean)
        .join(' · '),
    });
  }
  if (briefing.calendar.length) {
    const n = briefing.calendar.length;
    out.push({ id: 'radar', label: 'On the radar', detail: `${n} ${n === 1 ? 'event' : 'events'}` });
  }
  if (briefing.markets.length) out.push({ id: 'markets', label: 'Markets' });
  return out;
}

const topicSection = (topic: Topic) => `topic:${topic}`;
/** The reader's local section ("Canada"). */
const LOCAL_SECTION = 'local';
const storiesLabel = (n: number) => `${n} ${n === 1 ? 'story' : 'stories'}`;

type EditionProps = {
  briefing: Briefing;
  curated: CuratedEdition;
  sections: NavSection[];
  offline: boolean;
  /** Pull-to-refresh is running (a requested story may be on its way). */
  refreshing: boolean;
  onRefresh: () => void;
  isToday: boolean;
  /** Today's edition isn't out yet: this is the latest one before it. */
  earlier: boolean;
  scrollRef: RefObject<Animated.ScrollView | null>;
  offsetRef: RefObject<number>;
  /** Screen space covered at the top (status bar + pinned bar) when scrolling something into view. */
  topClear: number;
  spy: SectionSpy;
  railGesture: NativeGesture;
  /** Where the jump rail sits inside the edition. */
  onRailLayout: (y: number) => void;
  onJump: (id: string) => void;
  onOpenSections: () => void;
  onPrevious: () => void;
  onBackToToday?: () => void;
};

/**
 * The whole edition as one column: the jump rail, the tiles, Since this morning, the 60-second
 * card, then the reader's topics (focus topics first), each with its stories and quick hits,
 * then the local section, On the radar, Markets and the end.
 */
function Edition({
  briefing,
  curated,
  sections,
  offline,
  refreshing,
  onRefresh,
  isToday,
  earlier,
  scrollRef,
  offsetRef,
  topClear,
  spy,
  railGesture,
  onRailLayout,
  onJump,
  onOpenSections,
  onPrevious,
  onBackToToday,
}: EditionProps) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const settings = useSettings();
  const { openHowMade, openSettings } = useSheets();
  const focus = useStoryFocus();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quickOpenId, setQuickOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Which story (or quick hit) to scroll to once it has opened.
  const pendingScroll = useRef<string | null>(null);
  const pendingQuick = useRef<string | null>(null);
  // Where stories and quick-hit cards sit inside the edition.
  const storyY = useRef(new Map<string, number>());
  // By section: a topic, or the local section.
  const quickY = useRef(new Map<string, number>());

  const { groups, updates, local, hidden } = curated;
  const visible = groups.flatMap((g) => g.stories);
  const localStories = local?.stories ?? [];
  // Every story on the page once (a story can show both under Since this morning and in its topic).
  // Local stories are kept under their own section's date, so they count when that's this edition's.
  const storyIds = [
    ...new Set([...updates, ...visible, ...(local?.date === briefing.date ? localStories : [])].map((s) => s.id)),
  ];
  const leadIds = new Set(briefing.stories.slice(0, 2).map((s) => s.id));
  // The tour points at the first story on the page (a story can show both under Since this morning and in its topic).
  const tourStory = updates[0] ?? visible[0];
  const isTourStory = (story: Story, update = false) => story === tourStory && update === updates.length > 0;
  const minutes = readingMinutes(curated.summary, [...visible, ...localStories]);
  const audioUrl = isToday ? briefing.audio?.[settings.listenMode]?.url : null;
  // The studio MP3 has no local section in it, so its stories can't be started from there.
  const localPlayable = !briefing.audio?.[settings.listenMode]?.url;
  const centerKicker = theme.layout.heroAlign === 'center' || theme.layout.sections === 'rule';

  // Today's audio downloads in the background, so it plays instantly and offline.
  useEffect(() => {
    if (audioUrl) prefetchEditionAudio(briefing);
  }, [audioUrl, briefing]);

  const scrollTo = (y: number) =>
    scrollRef.current?.scrollTo({ y: Math.max(0, offsetRef.current + y - topClear), animated: !reduceMotion });

  // Search and notification taps ask for a story: open it here and bring it into view.
  // A story that broke after this copy was loaded isn't here yet, so look once more after a refresh.
  const refetchedFor = useRef<number | null>(null);
  const openFocused = (id: string, seq: number) => {
    const isStory =
      updates.some((s) => s.id === id) ||
      groups.some((g) => g.stories.some((s) => s.id === id)) ||
      localStories.some((s) => s.id === id);
    const isQuick = groups.some((g) => g.quick.some((q) => q.id === id)) || !!local?.quick.some((q) => q.id === id);
    const inEdition =
      briefing.stories.some((s) => s.id === id) ||
      !!briefing.sinceThisMorning?.some((s) => s.id === id) ||
      !!briefing.alsoHappening?.some((a) => a.id === id) ||
      !!briefing.regional?.stories.some((s) => s.id === id) ||
      !!briefing.regional?.also.some((a) => a.id === id);
    if (!isStory && !isQuick && !inEdition && refetchedFor.current !== seq) {
      // Keep the request: the effect below runs again once the refresh is done.
      refetchedFor.current = seq;
      onRefresh();
      return;
    }
    clearStoryFocus();
    if (isStory) {
      const y = storyY.current.get(id);
      if (expandedId === id && y != null) {
        scrollTo(y);
      } else {
        pendingScroll.current = id;
        setExpandedId(id);
      }
    } else if (isQuick) {
      pendingQuick.current = id;
      setQuickOpenId(id);
    } else if (inEdition) {
      toast.show('That story is in a topic you’ve turned off, or it mentions a word you’ve hidden.');
    } else {
      toast.show('Couldn’t find that story in this edition.');
    }
  };
  useEffect(() => {
    if (!focus || focus.date !== briefing.date || refreshing) return;
    // A frame later, so a freshly loaded edition has laid out first.
    const frame = requestAnimationFrame(() => openFocused(focus.storyId, focus.seq));
    return () => cancelAnimationFrame(frame);
    // Once per request (and once more after a refresh); everything else is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, briefing.date, refreshing]);

  const toggle = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      pendingScroll.current = id;
      setExpandedId(id); // opening one closes the previous
    }
  };

  // After a story opens, bring its headline up under the bar.
  const onStoryLayout = (id: string) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    storyY.current.set(id, y);
    if (pendingScroll.current !== id) return;
    pendingScroll.current = null;
    scrollTo(y);
  };

  const onQuickRowLayout = (section: string, id: string, y: number) => {
    if (pendingQuick.current !== id) return;
    pendingQuick.current = null;
    scrollTo((quickY.current.get(section) ?? 0) + y);
  };
  const toggleQuick = (id: string) => setQuickOpenId((cur) => (cur === id ? null : id));

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportEditionPdf(briefing, settings.topics);
    } catch {
      toast.show("Couldn't make the PDF. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const renderStory = (story: Story, i: number, opts: { update?: boolean; local?: LocalGroup } = {}) => (
    <StoryView
      key={opts.update ? `u-${story.id}` : story.id}
      story={story}
      // Local stories are saved, marked read and explained under their own section's date.
      editionDate={opts.local?.date ?? briefing.date}
      isNew={opts.update ? isNew(story.addedAt) : undefined}
      showImage={opts.local ? i === 0 : !opts.update && leadIds.has(story.id)}
      // Since this morning and the local section mix topics, so each story says its own.
      showTopic={opts.update || !!opts.local}
      expanded={expandedId === story.id}
      onToggle={() => toggle(story.id)}
      onLayout={onStoryLayout(story.id)}
      onPlay={
        opts.local && !localPlayable ? undefined : () => listenToEdition(briefing, { storyId: story.id })
      }
      actionsRef={isTourStory(story, opts.update) ? tourTargets.storyActions : undefined}
      moreRef={isTourStory(story, opts.update) ? tourTargets.storyMore : undefined}
      style={[styles.pad, i > 0 && styles.storyGap]}
    />
  );

  return (
    <View style={styles.edition}>
      <View ref={railTarget} onLayout={(e) => onRailLayout(e.nativeEvent.layout.y)}>
        <TopicRail
          place="inline"
          sections={sections}
          store={spy.store}
          onSelect={onJump}
          onOpenAll={onOpenSections}
          gesture={railGesture}
        />
      </View>

      <Animated.View layout={storyLayout} style={styles.headerBlock}>
        <EditionTiles
          briefing={briefing}
          storyCount={visible.length + localStories.length}
          readMinutes={minutes}
          onRead={() => (groups[0] ? onJump(topicSection(groups[0].topic)) : local && onJump(LOCAL_SECTION))}
          listenRef={tourTargets.listen}
        />
        {earlier && (
          <Txt variant="bodySm" tone="secondary" align={centerKicker ? 'center' : 'left'} style={styles.earlierNote}>
            {`Today’s edition isn’t out yet. This is ${formatDayParts(briefing.date).weekday}’s.`}
          </Txt>
        )}
        {(briefing.isSample || offline) && (
          <View style={[styles.pad, styles.badges]}>
            {briefing.isSample && <Pill label="Sample edition" variant="outline" />}
            {offline && <Pill label="Offline · saved copy" variant="outline" />}
          </View>
        )}
      </Animated.View>

      {updates.length > 0 && [
        <Animated.View key="h-updates" layout={storyLayout} style={styles.updatesHeading} onLayout={spy.track('updates')}>
          <TopicHeading label="Since this morning" count={updates.length} />
        </Animated.View>,
        ...updates.map((story, i) => renderStory(story, i, { update: true })),
        <View key="updates-gap" style={styles.updatesGap} />,
      ]}

      {curated.summary.length > 0 && (
        <Animated.View layout={storyLayout} style={styles.pad} onLayout={spy.track('summary')}>
          <SummaryCard takeaways={curated.summary} />
        </Animated.View>
      )}

      {groups.map((g, gi) => {
        const label = TOPIC_LABEL[g.topic];
        return [
          <Animated.View
            key={`h-${g.topic}`}
            layout={storyLayout}
            style={styles.topicHeading}
            onLayout={spy.track(topicSection(g.topic))}>
            {g.focus && (
              <Txt
                variant="kicker"
                color={theme.colors.accent}
                align={centerKicker ? 'center' : 'left'}
                style={styles.focusKicker}
                accessibilityLabel={`${label} is one of your focus topics`}>
                Your focus
              </Txt>
            )}
            <TopicHeading
              label={label}
              count={g.stories.length + g.quick.length}
              cover
              imageUrl={g.stories.find((st) => st.imageUrl)?.imageUrl}
              index={gi + 1}
            />
          </Animated.View>,
          ...g.stories.map((story, i) => renderStory(story, i)),
          g.quick.length > 0 && (
            <Animated.View
              key={`q-${g.topic}`}
              layout={storyLayout}
              style={g.stories.length > 0 && styles.quickGap}
              onLayout={(e) => quickY.current.set(g.topic, e.nativeEvent.layout.y)}>
              <AlsoHappening
                items={g.quick}
                editionDate={briefing.date}
                title={g.stories.length > 0 ? `More in ${label}` : 'In brief'}
                showTopic={false}
                openId={quickOpenId}
                onToggle={toggleQuick}
                onRowLayout={(id, y) => onQuickRowLayout(g.topic, id, y)}
              />
            </Animated.View>
          ),
        ];
      })}

      {local && [
        <Animated.View
          key="h-local"
          layout={storyLayout}
          style={styles.topicHeading}
          onLayout={spy.track(LOCAL_SECTION)}>
          <TopicHeading label={local.label} count={local.stories.length + local.quick.length} />
        </Animated.View>,
        ...local.stories.map((story, i) => renderStory(story, i, { local })),
        local.quick.length > 0 && (
          <Animated.View
            key="q-local"
            layout={storyLayout}
            style={local.stories.length > 0 && styles.quickGap}
            onLayout={(e) => quickY.current.set(LOCAL_SECTION, e.nativeEvent.layout.y)}>
            <AlsoHappening
              items={local.quick}
              editionDate={local.date}
              title={local.stories.length > 0 ? 'More local news' : 'In brief'}
              openId={quickOpenId}
              onToggle={toggleQuick}
              onRowLayout={(id, y) => onQuickRowLayout(LOCAL_SECTION, id, y)}
            />
          </Animated.View>
        ),
      ]}

      {groups.length === 0 && !local && (
        <Txt variant="body" tone="secondary" align="center" style={[styles.pad, styles.noStories]}>
          No stories in your chosen topics today. You can change topics in Settings.
        </Txt>
      )}

      {hidden > 0 && (
        <Animated.View layout={storyLayout}>
          <Tap
            onPress={() => openSettings()}
            accessibilityRole="button"
            accessibilityLabel={`${storiesLabel(hidden)} left out because of your hidden words. Edit hidden words`}
            style={styles.hiddenLine}>
            <Txt variant="caption" tone="tertiary" align="center">
              {storiesLabel(hidden)} left out by your hidden words ·{' '}
              <Txt variant="caption" tone="secondary" style={styles.underline}>
                Edit
              </Txt>
            </Txt>
          </Tap>
        </Animated.View>
      )}

      {briefing.calendar.length > 0 && (
        <Animated.View layout={storyLayout} style={styles.section} onLayout={spy.track('radar')}>
          <TopicHeading label="On the radar" />
          <RadarList events={briefing.calendar} />
        </Animated.View>
      )}

      {briefing.markets.length > 0 && (
        <Animated.View layout={storyLayout} style={styles.section} onLayout={spy.track('markets')}>
          <TopicHeading label="Markets" />
          <MarketsTable quotes={briefing.markets} isSample={briefing.isSample} />
        </Animated.View>
      )}

      <Animated.View layout={storyLayout} style={styles.endBlock}>
        <EndOfEdition
          wakeLabel={formatWakeTime(settings.wakeTime)}
          isToday={isToday}
          dateLabel={formatShortDate(briefing.date)}
          onExport={exportPdf}
          exporting={exporting}
          earlier={earlier}
          onPrevious={onPrevious}
          onBackToToday={onBackToToday}
          editionDate={briefing.date}
          storyIds={storyIds}
        />
        <Tap
          onPress={() => openHowMade(briefing)}
          accessibilityRole="link"
          accessibilityLabel="How this briefing was made"
          style={styles.howMade}>
          <Txt variant="caption" tone="secondary" align="center">
            {briefing.coverage ? coverageLine(briefing.coverage) : 'How this briefing was made'}
          </Txt>
          <Txt variant="caption" align="center" style={styles.underline}>
            How this briefing was made →
          </Txt>
        </Tap>
      </Animated.View>
    </View>
  );
}

/** About how long the Layer 1 read takes at a relaxed pace. */
function readingMinutes(summary: string[], stories: Story[]): number {
  const words = stories.reduce(
    (n, s) => n + `${s.headline} ${s.whatHappened} ${s.whyItMatters}`.split(/\s+/).length,
    summary.join(' ').split(/\s+/).length,
  );
  return Math.max(1, Math.round(words / 200));
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  center: { alignItems: 'center' },
  days: { alignSelf: 'flex-start' },
  previewPill: { marginTop: 10, flexDirection: 'row' },
  coverFoot: { position: 'absolute', left: 0, right: 0, bottom: 18 },
  stateWrap: { paddingTop: 8 },
  edition: { paddingTop: 2 },
  headerBlock: { gap: 14, marginTop: 6, marginBottom: 14 },
  badges: { flexDirection: 'row', gap: 8 },
  earlierNote: { paddingHorizontal: GUTTER + 2 },
  pad: { paddingHorizontal: GUTTER },
  topicHeading: { marginTop: 40, marginBottom: 16 },
  focusKicker: { paddingHorizontal: GUTTER + 2, marginBottom: 10 },
  storyGap: { marginTop: 14 },
  quickGap: { marginTop: 14 },
  section: { marginTop: 40, gap: 16 },
  endBlock: { marginTop: 64 },
  updatesHeading: { marginBottom: 16 },
  updatesGap: { height: 40 },
  noStories: { marginTop: 32 },
  hiddenLine: { marginTop: 28, minHeight: TAP, justifyContent: 'center', paddingHorizontal: GUTTER + 12 },
  howMade: { marginTop: 28, gap: 6, paddingHorizontal: GUTTER + 12, paddingVertical: 10, minHeight: TAP },
  underline: { textDecorationLine: 'underline' },
});
