import * as Haptics from 'expo-haptics';
import { CalendarDays, Settings as SettingsIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listenToEdition, prefetchEditionAudio } from '@/audio/listen';
import { AlsoHappening } from '@/components/AlsoHappening';
import { BrewsyMark } from '@/components/BrewsyMark';
import { DaySwitcher } from '@/components/DaySwitcher';
import { Cover } from '@/components/Cover';
import { EditionHeader } from '@/components/EditionHeader';
import { EndOfEdition, MarketsTable, RadarList, TopicHeading } from '@/components/EditionSections';
import { EditionTiles } from '@/components/EditionTiles';
import { GlassIconButton } from '@/components/GlassIconButton';
import { coverageLine } from '@/components/HowMadeSheet';
import { Pill } from '@/components/Pill';
import { ReadingProgress } from '@/components/ReadingProgress';
import { useSheets } from '@/components/SheetHost';
import { EditionSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { StatusShade } from '@/components/StatusShade';
import { StoryView, storyLayout } from '@/components/StoryView';
import { SummaryCard } from '@/components/SummaryCard';
import { useTabBarClearance } from '@/components/TabBar';
import { toast } from '@/components/Toast';
import { Txt } from '@/components/Txt';
import { shiftDate, todayKey } from '@/data/editions';
import { TOPICS, type Briefing, type Story } from '@/data/types';
import { cyclePreviewState, usePreviewState } from '@/dev/previewState';
import { useEdition } from '@/hooks/useEdition';
import { showTabBar, useScrollChrome } from '@/hooks/useScrollChrome';
import { formatShortDate, formatWakeTime } from '@/lib/format';
import { exportEditionPdf } from '@/lib/pdf';
import { setSelectedEdition, useSelectedEdition } from '@/state/editionNav';
import { isNew } from '@/state/seen';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { TOPIC_LABEL } from '@/theme/themes';
import { GUTTER, TAP } from '@/theme/tokens';

/** Max comfortable reading width on big screens. */
const MAX_WIDTH = 680;

export default function TodayScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const clearance = useTabBarClearance();
  const { openSettings, openPastEditions } = useSheets();
  const preview = usePreviewState();
  const today = todayKey();
  const date = useSelectedEdition() ?? today;
  const { state, refreshing, refresh, retry } = useEdition(date);
  const center = theme.layout.heroAlign === 'center';
  const { onScroll, progress, scrollY } = useScrollChrome();
  const coverHeight = Math.max(440, Math.round(height * 0.6));
  const scrollRef = useRef<Animated.ScrollView>(null);
  const settings = useSettings();
  // Where the edition starts inside the scroll content (for scroll-to-story).
  const editionOffset = useRef(0);

  // A different day starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    showTabBar();
  }, [date]);

  const goTo = (d: string) => {
    if (d > today || d === date) return;
    setSelectedEdition(d === today ? null : d);
  };

  // Swipe right for the previous day, left to come back toward today.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-30, 30])
    .failOffsetY([-14, 14])
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
            <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
              {center && <TopButton kind="calendar" onPress={openPastEditions} />}
              <Pressable
                onLongPress={cyclePreviewState}
                delayLongPress={600}
                style={styles.brand}
                accessibilityRole="header"
                accessibilityLabel="Brewsy">
                <BrewsyMark size={22} color={theme.colors.onCover} />
                <Txt variant="spaced" color={theme.colors.onCover}>
                  Brewsy
                </Txt>
              </Pressable>
              {center ? (
                <TopButton kind="settings" onPress={openSettings} />
              ) : (
                <View style={styles.topActions}>
                  <TopButton kind="calendar" onPress={openPastEditions} />
                  <TopButton kind="settings" onPress={openSettings} />
                </View>
              )}
            </View>

            <View style={[styles.pad, center && styles.center]}>
              <DaySwitcher date={date} onChange={goTo} />
            </View>

            {__DEV__ && preview !== 'live' && (
              <View style={[styles.pad, styles.previewPill]}>
                <Pill label={`Previewing: ${preview} state`} variant="soft" color={theme.colors.accent} />
              </View>
            )}

            <View style={styles.coverFoot}>
              <EditionHeader date={date} />
            </View>
          </Cover>

          <Animated.View
            key={date}
            entering={FadeIn.duration(260)}
            onLayout={(e) => (editionOffset.current = e.nativeEvent.layout.y)}>
            {state.status === 'ready' ? (
              <Edition
                briefing={state.briefing}
                offline={state.offline}
                isToday={date === today}
                scrollRef={scrollRef}
                offsetRef={editionOffset}
                onPrevious={() => goTo(shiftDate(date, -1))}
                onBackToToday={date !== today ? () => goTo(today) : undefined}
              />
            ) : (
              <View style={styles.stateWrap}>
                <View style={styles.stateBody}>
                  {state.status === 'loading' && <EditionSkeleton />}
                  {state.status === 'empty' && (
                    <EmptyState
                      wakeTime={formatWakeTime(settings.wakeTime)}
                      isToday={date === today}
                      dateLabel={formatShortDate(date)}
                    />
                  )}
                  {state.status === 'error' && <ErrorState message={state.message} onRetry={retry} />}
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.ScrollView>
      </GestureDetector>
      <StatusShade scrollY={scrollY} solidAt={coverHeight - insets.top - 60} />
      <ReadingProgress progress={progress} />
    </View>
  );
}

type EditionProps = {
  briefing: Briefing;
  offline: boolean;
  isToday: boolean;
  scrollRef: RefObject<Animated.ScrollView | null>;
  offsetRef: RefObject<number>;
  onPrevious: () => void;
  onBackToToday?: () => void;
};

/** The whole edition as one column: header, 60-second card, stories by topic, markets, the end. */
function Edition({ briefing, offline, isToday, scrollRef, offsetRef, onPrevious, onBackToToday }: EditionProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const settings = useSettings();
  const { openHowMade } = useSheets();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // Where the first topic section sits inside the edition (for the Stories tile).
  const firstSectionY = useRef(0);

  // Which story to scroll to once it has opened.
  const pendingScroll = useRef<string | null>(null);

  const groups = TOPICS.filter((t) => settings.topics.includes(t))
    .map((topic) => ({ topic, stories: briefing.stories.filter((s) => s.topic === topic) }))
    .filter((g) => g.stories.length > 0);
  const visible = groups.flatMap((g) => g.stories);
  const leadIds = new Set(briefing.stories.slice(0, 2).map((s) => s.id));
  const minutes = readingMinutes(briefing.summary, visible);
  const updates = (briefing.sinceThisMorning ?? []).filter((s) => settings.topics.includes(s.topic));
  const also = (briefing.alsoHappening ?? []).filter((a) => settings.topics.includes(a.topic));
  const audioUrl = isToday ? briefing.audio?.[settings.listenMode]?.url : null;

  // Today's audio downloads in the background, so it plays instantly and offline.
  useEffect(() => {
    if (audioUrl) prefetchEditionAudio(briefing);
  }, [audioUrl, briefing]);

  const toggle = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      pendingScroll.current = id;
      setExpandedId(id); // opening one closes the previous
    }
  };

  // After a story opens, bring its headline to the top of the screen.
  const onStoryLayout = (id: string) => (e: LayoutChangeEvent) => {
    if (pendingScroll.current !== id) return;
    pendingScroll.current = null;
    const y = offsetRef.current + e.nativeEvent.layout.y - insets.top - 18;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: !reduceMotion });
  };

  const readFirst = () => {
    const y = offsetRef.current + firstSectionY.current - insets.top - 24;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: !reduceMotion });
  };

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

  return (
    <View style={styles.edition}>
      <Animated.View layout={storyLayout} style={styles.headerBlock}>
        <EditionTiles briefing={briefing} storyCount={visible.length} readMinutes={minutes} onRead={readFirst} />
        {(briefing.isSample || offline) && (
          <View style={[styles.pad, styles.badges]}>
            {briefing.isSample && <Pill label="Sample edition" variant="outline" />}
            {offline && <Pill label="Offline · saved copy" variant="outline" />}
          </View>
        )}
      </Animated.View>

      {updates.length > 0 && [
        <Animated.View key="h-updates" layout={storyLayout} style={styles.updatesHeading}>
          <TopicHeading label="Since this morning" count={updates.length} />
        </Animated.View>,
        ...updates.map((story, i) => (
          <StoryView
            key={`u-${story.id}`}
            story={story}
            editionDate={briefing.date}
            isNew={isNew(story.addedAt)}
            expanded={expandedId === story.id}
            onToggle={() => toggle(story.id)}
            onLayout={onStoryLayout(story.id)}
            onPlay={() => listenToEdition(briefing, { storyId: story.id })}
            style={[styles.pad, i > 0 && styles.storyGap]}
          />
        )),
        <View key="updates-gap" style={styles.updatesGap} />,
      ]}

      <Animated.View layout={storyLayout} style={styles.pad}>
        <SummaryCard takeaways={briefing.summary} />
      </Animated.View>

      {groups.map(({ topic, stories }, gi) => [
        <Animated.View
          key={`h-${topic}`}
          layout={storyLayout}
          style={styles.topicHeading}
          onLayout={gi === 0 ? (e) => (firstSectionY.current = e.nativeEvent.layout.y) : undefined}>
          <TopicHeading
            label={TOPIC_LABEL[topic]}
            count={stories.length}
            cover
            imageUrl={stories.find((st) => st.imageUrl)?.imageUrl}
          />
        </Animated.View>,
        ...stories.map((story: Story, i) => (
          <StoryView
            key={story.id}
            story={story}
            editionDate={briefing.date}
            showImage={leadIds.has(story.id)}
            showTopic={false}
            expanded={expandedId === story.id}
            onToggle={() => toggle(story.id)}
            onLayout={onStoryLayout(story.id)}
            onPlay={() => listenToEdition(briefing, { storyId: story.id })}
            style={[styles.pad, i > 0 && styles.storyGap]}
          />
        )),
      ])}

      {also.length > 0 && (
        <Animated.View layout={storyLayout} style={styles.section}>
          <TopicHeading label="Also happening" count={also.length} />
          <AlsoHappening items={also} editionDate={briefing.date} />
        </Animated.View>
      )}

      {visible.length === 0 && (
        <Txt variant="body" tone="secondary" align="center" style={styles.pad}>
          No stories in your chosen topics today. You can change topics in Settings.
        </Txt>
      )}

      {briefing.calendar.length > 0 && (
        <Animated.View layout={storyLayout} style={styles.section}>
          <TopicHeading label="On the radar" />
          <RadarList events={briefing.calendar} />
        </Animated.View>
      )}

      {briefing.markets.length > 0 && (
        <Animated.View layout={storyLayout} style={styles.section}>
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
          onPrevious={onPrevious}
          onBackToToday={onBackToToday}
        />
        <Pressable
          onPress={() => openHowMade(briefing)}
          accessibilityRole="link"
          accessibilityLabel="How this briefing was made"
          style={styles.howMade}>
          <Txt variant="caption" tone="secondary" align="center">
            {briefing.coverage ? coverageLine(briefing.coverage) : 'How this briefing was made'}
          </Txt>
          <Txt variant="caption" align="center" style={styles.howMadeLink}>
            How this briefing was made →
          </Txt>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Calendar / settings button on the cover. */
function TopButton({ kind, onPress }: { kind: 'calendar' | 'settings'; onPress: () => void }) {
  const { theme } = useTheme();
  const Icon = kind === 'calendar' ? CalendarDays : SettingsIcon;
  return (
    <GlassIconButton
      variant="overlay"
      icon={<Icon size={18} color={theme.colors.onCover} strokeWidth={1.7} />}
      onPress={onPress}
      accessibilityLabel={kind === 'calendar' ? 'Older editions' : 'Settings'}
    />
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingBottom: 14,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TAP },
  topActions: { flexDirection: 'row', gap: 10 },
  previewPill: { marginTop: 10, flexDirection: 'row' },
  coverFoot: { position: 'absolute', left: 0, right: 0, bottom: 18 },
  stateWrap: { paddingTop: 8 },
  stateBody: {},
  edition: { paddingTop: 8 },
  headerBlock: { gap: 14, marginBottom: 14 },
  badges: { flexDirection: 'row', gap: 8 },
  pad: { paddingHorizontal: GUTTER },
  topicHeading: { marginTop: 40, marginBottom: 16 },
  storyGap: { marginTop: 14 },
  section: { marginTop: 40, gap: 16 },
  endBlock: { marginTop: 64 },
  updatesHeading: { marginBottom: 16 },
  updatesGap: { height: 40 },
  howMade: { marginTop: 28, gap: 6, paddingHorizontal: GUTTER + 12, paddingVertical: 10, minHeight: TAP },
  howMadeLink: { textDecorationLine: 'underline' },
});
