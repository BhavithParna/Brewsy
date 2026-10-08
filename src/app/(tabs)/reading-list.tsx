import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Bookmark,
  Play,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Moon,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listenToReadingList } from '@/audio/listen';
import { BrewsyMark } from '@/components/BrewsyMark';
import { Cover } from '@/components/Cover';
import { GlassCard } from '@/components/GlassCard';
import { LearnMore } from '@/components/LearnMore';
import { StoryPlayButton } from '@/components/listen/StoryPlayButton';
import { Pill } from '@/components/Pill';
import { useSheets } from '@/components/SheetHost';
import { StatusShade } from '@/components/StatusShade';
import { StoryBody } from '@/components/StoryView';
import { useTabBarClearance } from '@/components/TabBar';
import { toast } from '@/components/Toast';
import { Txt } from '@/components/Txt';
import { useScrollChrome } from '@/hooks/useScrollChrome';
import { formatShortDate } from '@/lib/format';
import {
  BUCKETS,
  removeSaved,
  restoreSaved,
  setDone,
  useReadingList,
  type Bucket,
  type SavedItem,
} from '@/state/readingList';
import { useTheme } from '@/theme/ThemeProvider';
import { TOPIC_LABEL } from '@/theme/themes';
import { GUTTER, TAP, radii, withAlpha } from '@/theme/tokens';

const MAX_WIDTH = 680;
const ACTION_WIDTH = 112;

const BUCKET_ICON: Record<Bucket, LucideIcon> = {
  tonight: Moon,
  weekend: Coffee,
  week: CalendarDays,
  norush: Wind,
};

const rowLayout = LinearTransition.springify().damping(22).stiffness(170);

export default function ReadingListScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const clearance = useTabBarClearance();
  const reduceMotion = useReducedMotion();
  const { onScroll, scrollY } = useScrollChrome();
  const coverHeight = Math.max(330, Math.round(height * 0.44));
  const items = useReadingList();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const listY = useRef(0);
  const pendingScroll = useRef<string | null>(null);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const active = items.filter((i) => !i.done);
  // Listening order follows the screen: Tonight first, then the weekend, and so on.
  const listenOrder = BUCKETS.flatMap((b) =>
    active.filter((i) => i.bucket === b.id).sort((x, y) => y.savedAt.localeCompare(x.savedAt)),
  );
  const done = items
    .filter((i) => i.done)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const groups = BUCKETS.map((b) => ({
    ...b,
    items: active.filter((i) => i.bucket === b.id).sort((x, y) => y.savedAt.localeCompare(x.savedAt)),
  })).filter((g) => g.items.length > 0);

  const toggle = (key: string) => {
    if (expandedKey === key) {
      setExpandedKey(null);
    } else {
      pendingScroll.current = key;
      setExpandedKey(key);
    }
  };

  // After an item opens, bring its headline near the top of the screen.
  const onItemLayout = (key: string) => (e: LayoutChangeEvent) => {
    if (pendingScroll.current !== key) return;
    pendingScroll.current = null;
    const y = listY.current + e.nativeEvent.layout.y - insets.top - 12;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: !reduceMotion });
  };

  const renderItem = (item: SavedItem) => (
    <Animated.View
      key={item.key}
      layout={rowLayout}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      onLayout={onItemLayout(item.key)}>
      <SavedRow
        item={item}
        expanded={expandedKey === item.key}
        onToggle={() => toggle(item.key)}
        onPlay={() => listenToReadingList(item.done ? [item] : listenOrder, item.key)}
      />
    </Animated.View>
  );

  return (
    <View style={styles.flex}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}>
        <Cover height={coverHeight}>
          <View
            style={[
              styles.topRow,
              { paddingTop: insets.top + 6 },
              theme.layout.heroAlign === 'center' && styles.topRowCenter,
            ]}>
            <View style={styles.brand}>
              <BrewsyMark size={22} color={theme.colors.onCover} />
              <Txt variant="spaced" color={theme.colors.onCover}>
                Brewsy
              </Txt>
            </View>
          </View>
          <View style={styles.coverFoot}>
            <CountHeader count={active.length} empty={items.length === 0} />
          </View>
        </Cover>

        {items.length === 0 ? (
          <EmptyList />
        ) : (
          <>
            <ListActions doneCount={done.length}>
              {active.length > 0 && (
                <Pill
                  label={active.length === 1 ? 'Listen to it' : 'Play my reading list'}
                  size="md"
                  variant="solid"
                  color={theme.colors.inverseBg}
                  icon={
                    <Play size={14} color={theme.colors.inverseText} fill={theme.colors.inverseText} strokeWidth={0} />
                  }
                  onPress={() => listenToReadingList(listenOrder)}
                  accessibilityLabel={`Play your reading list, ${active.length} ${active.length === 1 ? 'story' : 'stories'} back to back`}
                />
              )}
            </ListActions>

            <View style={styles.list} onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
              {groups.map((g) => [
                <Animated.View key={`h-${g.id}`} layout={rowLayout} style={styles.groupHeading}>
                  <GroupHeading bucket={g.id} label={g.label} count={g.items.length} />
                </Animated.View>,
                ...g.items.map(renderItem),
              ])}

              {active.length === 0 && (
                <Animated.View layout={rowLayout} style={styles.pad}>
                  <Txt variant="body" tone="secondary" align="center">
                    Nothing left to read. Nice work.
                  </Txt>
                </Animated.View>
              )}

              {done.length > 0 && (
                <Animated.View key="done-heading" layout={rowLayout} style={styles.groupHeading}>
                  <Pressable
                    onPress={() => setShowDone((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showDone }}
                    accessibilityLabel={`Done, ${done.length} ${done.length === 1 ? 'story' : 'stories'}`}
                    style={styles.doneHeading}>
                    <View>
                      <Check size={14} color={theme.colors.textSecondary} strokeWidth={2} />
                    </View>
                    <Txt variant="spaced" tone="secondary">
                      Done
                    </Txt>
                    <View style={[styles.rule, { backgroundColor: theme.colors.hairline }]} />
                    <Txt variant="caption" tone="secondary">
                      {done.length}
                    </Txt>
                    <View>
                      {showDone ? (
                        <ChevronUp size={16} color={theme.colors.textSecondary} />
                      ) : (
                        <ChevronDown size={16} color={theme.colors.textSecondary} />
                      )}
                    </View>
                  </Pressable>
                </Animated.View>
              )}
              {showDone && done.map(renderItem)}
              {showDone && done.length > 0 && (
                <Animated.View key="clear-done" layout={rowLayout} style={styles.clearRow}>
                  <Pill
                    label="Clear done"
                    variant="glass"
                    size="md"
                    onPress={() => {
                      const removed = done.map((d) => removeSaved(d.key)).filter((d): d is SavedItem => !!d);
                      toast.show(`Cleared ${removed.length}`, {
                        label: 'Undo',
                        onPress: () => removed.forEach(restoreSaved),
                      });
                    }}
                    accessibilityLabel="Remove all done stories"
                  />
                </Animated.View>
              )}
            </View>
          </>
        )}
      </Animated.ScrollView>
      <StatusShade scrollY={scrollY} solidAt={coverHeight - insets.top - 40} />
    </View>
  );
}

/** "READING LIST" and "6 to read" at the foot of the cover. */
function CountHeader({ count, empty }: { count: number; empty: boolean }) {
  const { theme } = useTheme();
  const center = theme.layout.heroAlign === 'center';
  const label = empty ? 'Nothing saved' : count === 0 ? 'All caught up' : `${count} to read`;
  const align = center ? 'center' : 'left';
  return (
    <View
      style={[styles.countHeader, center && styles.centerItems]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Reading list. ${label}`}>
      <Txt variant="spaced" tone="secondary" align={align}>
        Reading list
      </Txt>
      <Txt variant="displayXL" align={align} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Txt>
    </View>
  );
}

/** "Play my reading list" and how many are done, under the cover. */
function ListActions({ doneCount, children }: { doneCount: number; children?: ReactNode }) {
  const { theme } = useTheme();
  const center = theme.layout.heroAlign === 'center';
  return (
    <View style={[styles.actions, center && styles.centerRow]}>
      {children}
      {doneCount > 0 && (
        <Txt variant="caption" tone="tertiary">
          {doneCount} read this week
        </Txt>
      )}
    </View>
  );
}

function GroupHeading({ bucket, label, count }: { bucket: Bucket; label: string; count: number }) {
  const { theme } = useTheme();
  const Icon = BUCKET_ICON[bucket];
  return (
    <View style={styles.heading} accessible accessibilityRole="header" accessibilityLabel={`${label}, ${count}`}>
      <View>
        <Icon size={14} color={theme.colors.text} strokeWidth={1.8} />
      </View>
      <Txt variant="spaced">
        {label}
      </Txt>
      <View style={[styles.rule, { backgroundColor: theme.colors.hairline }]} />
      <Txt variant="caption" tone="secondary">
        {count}
      </Txt>
    </View>
  );
}

type RowProps = { item: SavedItem; expanded: boolean; onToggle: () => void; onPlay: () => void };

/** One saved story. Swipe right: done. Swipe left: remove. Tap: read it all. */
function SavedRow({ item, expanded, onToggle, onPlay }: RowProps) {
  const { theme } = useTheme();
  const { openSave } = useSheets();
  const swipeRef = useRef<SwipeableMethods>(null);
  const { story } = item;

  const onOpen = (direction: SwipeDirection.LEFT | SwipeDirection.RIGHT) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (direction === SwipeDirection.RIGHT) {
      // Row slid right: toggle done.
      setDone(item.key, !item.done);
      swipeRef.current?.close();
      toast.show(item.done ? 'Moved back to your list' : 'Marked as read', {
        label: 'Undo',
        onPress: () => setDone(item.key, item.done),
      });
    } else {
      const removed = removeSaved(item.key);
      if (removed) toast.show('Removed', { label: 'Undo', onPress: () => restoreSaved(removed) });
    }
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      enabled={!expanded}
      friction={1.6}
      leftThreshold={ACTION_WIDTH * 0.75}
      rightThreshold={ACTION_WIDTH * 0.75}
      overshootFriction={8}
      onSwipeableOpen={onOpen}
      renderLeftActions={(progress) => (
        <SwipeAction
          side="left"
          progress={progress}
          color={theme.colors.up}
          Icon={item.done ? RotateCcw : Check}
          label={item.done ? 'Unread' : 'Done'}
        />
      )}
      renderRightActions={(progress) => (
        <SwipeAction side="right" progress={progress} color={theme.colors.down} Icon={Trash2} label="Remove" />
      )}>
      <GlassCard radius={radii.xl} style={styles.row}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${story.headline}. ${TOPIC_LABEL[story.topic]}, from ${formatShortDate(item.editionDate)}${item.note ? `. Note: ${item.note}` : ''}`}
          accessibilityHint={expanded ? 'Collapses the story' : 'Opens the full story'}
          accessibilityActions={[
            { name: 'done', label: item.done ? 'Mark as unread' : 'Mark as read' },
            { name: 'remove', label: 'Remove' },
          ]}
          onAccessibilityAction={(e) => onOpen(e.nativeEvent.actionName === 'done' ? SwipeDirection.RIGHT : SwipeDirection.LEFT)}
          style={styles.rowPress}>
          <View style={styles.meta}>
            <View style={styles.metaLeft}>
              <Txt variant="kicker" tone="secondary">
                {TOPIC_LABEL[story.topic]}
              </Txt>
              <Txt variant="caption" tone="tertiary">
                from {formatShortDate(item.editionDate)}
              </Txt>
            </View>
          </View>

          <Txt variant="headline" style={item.done && styles.doneText}>
            {story.headline}
          </Txt>

          {item.note !== '' && (
            <View style={[styles.note, { borderLeftColor: withAlpha(theme.colors.accent, 0.55) }]}>
              <Txt variant="body" tone="secondary">
                {item.note}
              </Txt>
            </View>
          )}

          {!expanded && (
            <View style={styles.openHint}>
              <Txt variant="caption" tone="tertiary">
                {story.readTimeMinutes} min read · tap to open
              </Txt>
            </View>
          )}
        </Pressable>

        {/* Outside the row's tap area (a button can't sit inside another button). */}
        <View style={styles.play}>
          <StoryPlayButton playKey={item.key} label={story.headline} onPlay={onPlay} />
        </View>
        <Pressable
          onPress={() => openSave({ story, editionDate: item.editionDate })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Move, add a note, or remove"
          style={styles.more}>
          <View>
            <MoreHorizontal size={20} color={theme.colors.textSecondary} />
          </View>
        </Pressable>

        {expanded && (
          <Animated.View
            entering={FadeIn.duration(280).delay(60)}
            exiting={FadeOut.duration(140)}
            style={styles.expanded}>
            <StoryBody story={story} />
            <LearnMore story={story} editionDate={item.editionDate} onCollapse={onToggle} />
          </Animated.View>
        )}
      </GlassCard>
    </ReanimatedSwipeable>
  );
}

/** Revealed under a glass row as it slides; fades in so it never shows through the glass at rest. */
function SwipeAction({
  side,
  progress,
  color,
  Icon,
  label,
}: {
  side: 'left' | 'right';
  progress: SharedValue<number>;
  color: string;
  Icon: LucideIcon;
  label: string;
}) {
  const { theme } = useTheme();
  const fade = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.35, 1], [0, 0.4, 1], 'clamp') }));
  return (
    <Animated.View style={[styles.action, side === 'left' ? styles.actionLeft : styles.actionRight, fade]}>
      <View style={[styles.actionFill, { backgroundColor: color }]}>
        <View>
          <Icon size={20} color={theme.colors.inverseText} strokeWidth={2} />
        </View>
        <Txt variant="caption" color={theme.colors.inverseText}>
          {label}
        </Txt>
      </View>
    </Animated.View>
  );
}

function EmptyList() {
  const { theme } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.emptyWrap}>
      <GlassCard radius={radii.xl} style={styles.emptyCard}>
        <View style={[styles.emptyIcon, { borderColor: theme.colors.glassBorder }]}>
          <Bookmark size={24} color={theme.colors.text} strokeWidth={1.5} />
        </View>
        <Txt variant="displayM" align="center" accessibilityRole="header">
          Nothing saved yet
        </Txt>
        <Txt variant="body" tone="secondary" align="center" style={styles.emptyBody}>
          Tap the bookmark on any story to save it here.
        </Txt>
        <Txt variant="caption" tone="tertiary" align="center" style={styles.emptyBody}>
          Long-press the bookmark to save it for “no rush” in one go.
        </Txt>
        <Pill
          label="Go to today's edition"
          variant="solid"
          size="md"
          color={theme.colors.inverseBg}
          onPress={() => router.navigate('/')}
          style={styles.emptyAction}
        />
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: 14 },
  pad: { paddingHorizontal: GUTTER },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER },
  topRowCenter: { justifyContent: 'center' },
  coverFoot: { position: 'absolute', left: 0, right: 0, bottom: 14 },
  centerItems: { alignItems: 'center' },
  centerRow: { justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: GUTTER, marginTop: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TAP },
  countHeader: { paddingHorizontal: GUTTER, gap: 6 },
  list: { paddingBottom: 8, gap: 12 },
  groupHeading: { marginTop: 32, marginBottom: 4 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER + 4, minHeight: 28 },
  doneHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: GUTTER + 4,
    minHeight: TAP,
  },
  rule: { flex: 1, height: 1, marginHorizontal: 4 },
  row: { marginHorizontal: GUTTER, padding: 20 },
  rowPress: { gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', minHeight: 28, paddingRight: TAP * 2 },
  play: { position: 'absolute', top: 12, right: 12 + TAP },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  more: { position: 'absolute', top: 12, right: 14, width: TAP, height: TAP, alignItems: 'flex-end', justifyContent: 'center' },
  doneText: { opacity: 0.55 },
  note: { borderLeftWidth: 2, paddingLeft: 12, marginTop: 2 },
  openHint: { marginTop: 2 },
  expanded: { gap: 18, marginTop: 22 },
  action: { width: ACTION_WIDTH },
  actionLeft: { paddingLeft: GUTTER },
  actionRight: { paddingRight: GUTTER },
  actionFill: { flex: 1, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyWrap: { paddingHorizontal: GUTTER, paddingTop: 8 },
  emptyCard: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 40, gap: 14 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyBody: { maxWidth: 300 },
  emptyAction: { marginTop: 10 },
  clearRow: { alignItems: 'center', marginTop: 24 },
});
