import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { TableOfContents } from 'lucide-react-native';
import { useEffect, useRef, useState, type Ref } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { PressableScale } from './PressableScale';
import { Txt } from './Txt';
import { useRailState, type RailStore } from '@/hooks/useScrollChrome';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, capsLabel, withAlpha } from '@/theme/tokens';

/** One stop on the jump bar: Since this morning, Summary, a topic, On the radar, Markets. */
export type NavSection = {
  id: string;
  /** List label (and chip label, unless there's a short one). */
  label: string;
  /** A shorter chip label, e.g. "Latest" for "Since this morning". */
  short?: string;
  /** Second line in the list of sections, e.g. "3 stories · 2 in brief". */
  detail?: string;
  /** The reader asked for more of this topic. */
  focus?: boolean;
};

/** Height of the rail's row, in the page and in the pinned bar alike (so one hands over to the other in place). */
export const RAIL_HEIGHT = 52;
const CHIP_HEIGHT = 34;
/** Room kept beside the active chip when the rail scrolls to show it. */
const EDGE = 28;

type Props = {
  sections: NavSection[];
  store: RailStore;
  onSelect: (id: string) => void;
  /** Opens the list of every section. */
  onOpenAll: () => void;
  /** inline: in the page under the cover · pinned: inside the bar at the top of the screen. */
  place: 'inline' | 'pinned';
  /** The color behind the rail as '#RRGGBB', for the soft edge where chips run off (pinned bar only). */
  fadeColor?: string;
  /** How opaque that color is (frosted bars are see-through). */
  fadeAlpha?: number;
  /** Lets the page's day swipe wait while the rail scrolls sideways (inline rail). */
  gesture?: NativeGesture;
  /** For coach marks: measure the whole rail. */
  ref?: Ref<View>;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A row of chips, one per section, that scrolls the page to it. The active chip follows the
 * reader down the page and the row slides to keep it in view. The icon at the start opens the
 * full list (handy when there are a dozen topics).
 */
export function TopicRail({
  sections,
  store,
  onSelect,
  onOpenAll,
  place,
  fadeColor,
  fadeAlpha = 1,
  gesture,
  ref,
  onLayout,
  style,
}: Props) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const active = useRailState(store, (s) => s.active);
  const pinned = useRailState(store, (s) => s.pinned);
  const inView = place === 'pinned' ? pinned : !pinned;
  const scrollRef = useRef<ScrollView>(null);
  const chips = useRef(new Map<string, { x: number; w: number }>());
  const width = useRef(0);
  const x = useRef(0);
  /** Where the chips start inside the scroll content (after the list icon, in the page). */
  const rowX = useRef(0);
  // The left edge only fades once chips have slid under it.
  const [scrolled, setScrolled] = useState(false);
  const wasInView = useRef(inView);

  useEffect(() => {
    if (!inView) {
      wasInView.current = false;
      return;
    }
    let from = x.current;
    // Coming into view: carry on from where the other rail was.
    if (!wasInView.current) {
      wasInView.current = true;
      from = store.getX();
      scrollRef.current?.scrollTo({ x: from, animated: false });
    }
    const chip = active ? chips.current.get(active) : undefined;
    if (!chip || !width.current) return;
    const left = rowX.current + chip.x;
    let to = from;
    if (left - EDGE < from) to = left - EDGE;
    else if (left + chip.w + EDGE > from + width.current) to = left + chip.w + EDGE - width.current;
    if (to !== from) scrollRef.current?.scrollTo({ x: Math.max(0, to), animated: !reduceMotion });
  }, [active, inView, reduceMotion, store]);

  const select = (id: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onSelect(id);
  };

  const all = (
    <PressableScale
      onPress={onOpenAll}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel="All sections"
      accessibilityHint="Lists every section of this edition"
      style={styles.all}>
      <View>
        <TableOfContents size={20} color={theme.colors.text} strokeWidth={1.8} />
      </View>
    </PressableScale>
  );

  // In the page, the list icon scrolls away with the chips; in the pinned bar it stays put.
  // Either way the chips start at the same spot, so the two rails line up when one takes over.
  const list = (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={32}
      onScroll={(e) => {
        x.current = e.nativeEvent.contentOffset.x;
        if (inView) store.setX(x.current);
        if (x.current > 4 !== scrolled) setScrolled(x.current > 4);
      }}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
      style={styles.flex}
      contentContainerStyle={styles.chips}
      accessibilityLabel="Sections">
      {place === 'inline' && all}
      <View
        style={styles.chipRow}
        accessibilityRole="tablist"
        onLayout={(e) => (rowX.current = e.nativeEvent.layout.x)}>
        {sections.map((s) => (
          <Chip
            key={s.id}
            label={s.short ?? s.label}
            a11yLabel={s.label}
            active={s.id === active}
            onPress={() => select(s.id)}
            onLayout={(e) => chips.current.set(s.id, { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width })}
          />
        ))}
      </View>
    </ScrollView>
  );

  return (
    <View ref={ref} onLayout={onLayout} style={[styles.row, style]}>
      {place === 'pinned' && all}
      {gesture ? <GestureDetector gesture={gesture}>{list}</GestureDetector> : list}
      {fadeColor && (
        <>
          {scrolled && (
            <LinearGradient
              pointerEvents="none"
              colors={[withAlpha(fadeColor, fadeAlpha), withAlpha(fadeColor, 0)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fade, styles.fadeLeft]}
            />
          )}
          <LinearGradient
            pointerEvents="none"
            colors={[withAlpha(fadeColor, 0), withAlpha(fadeColor, fadeAlpha * 0.9), withAlpha(fadeColor, fadeAlpha)]}
            locations={[0, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fade, styles.fadeRight]}
          />
        </>
      )}
    </View>
  );
}

function Chip({
  label,
  a11yLabel,
  active,
  onPress,
  onLayout,
}: {
  label: string;
  a11yLabel: string;
  active: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const { theme } = useTheme();
  const { inverseBg, inverseText, textSecondary } = theme.colors;
  return (
    <PressableScale
      onPress={onPress}
      onLayout={onLayout}
      scaleTo={0.95}
      hitSlop={{ top: (TAP - CHIP_HEIGHT) / 2, bottom: (TAP - CHIP_HEIGHT) / 2 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={a11yLabel}
      accessibilityHint="Scrolls to this section"
      style={[
        styles.chip,
        {
          borderRadius: Math.min(theme.shape.control, CHIP_HEIGHT / 2),
          backgroundColor: active ? inverseBg : 'transparent',
        },
      ]}>
      <Txt
        variant="label"
        color={active ? inverseText : textSecondary}
        numberOfLines={1}
        style={theme.layout.capsButtons && capsLabel}>
        {label}
      </Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { height: RAIL_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  // The icon's left edge lines up with the page gutter.
  all: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center', marginLeft: 6, marginRight: 2 },
  chips: { alignItems: 'center', paddingRight: 24 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chip: {
    height: CHIP_HEIGHT,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fade: { position: 'absolute', top: 0, bottom: 0 },
  // Just past the fixed list icon.
  fadeLeft: { left: TAP + 8, width: 16 },
  fadeRight: { right: 0, width: 28 },
});
