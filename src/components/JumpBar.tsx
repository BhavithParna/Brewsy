import { BlurView } from 'expo-blur';
import { CalendarDays, Search, Settings as SettingsIcon, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode, type Ref } from 'react';
import { Platform, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { PressableScale } from './PressableScale';
import { ReadingProgress } from './ReadingProgress';
import { Sheet } from './Sheet';
import { RAIL_HEIGHT, TopicRail, type NavSection } from './TopicRail';
import { Txt } from './Txt';
import { useRailState, type RailStore } from '@/hooks/useScrollChrome';
import { useTheme } from '@/theme/ThemeProvider';
import type { Theme } from '@/theme/themes';
import { GUTTER, TAP, withAlpha } from '@/theme/tokens';

/** Height of the pinned bar under the status bar. */
export const BAR_HEIGHT = RAIL_HEIGHT;

/** '#RRGGBB' at an alpha; other color strings pass through as they are. */
function tint(color: string, alpha: number): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? withAlpha(color, alpha) : color;
}

/**
 * The pinned bar's fill. Frosted themes let the page show through softly (where the platform can
 * blur); the rest are solid, like a printed running head. Android can't blur here, so it's solid.
 */
export function barFill(theme: Theme): { color: string; base: string | undefined; alpha: number; blur: boolean } {
  const base = theme.background[0];
  const hex = /^#[0-9a-f]{6}$/i.test(base) ? base : undefined;
  if (theme.surface === 'glass' && Platform.OS !== 'android') {
    return { color: tint(base, 0.74), base: hex, alpha: 0.74, blur: true };
  }
  return { color: base, base: hex, alpha: 1, blur: false };
}

type BarProps = {
  /** 0 → 1 as the bar appears (see usePinned). */
  shown: SharedValue<number>;
  /** Reading progress along the bottom edge. */
  progress?: SharedValue<number>;
  children: ReactNode;
  ref?: Ref<View>;
  onLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * A slim bar pinned under the status bar once the page scrolls past its own header: the theme's
 * background with a hairline edge, holding the jump rail, search and settings. It covers the
 * status bar strip itself while it shows.
 */
export function PinnedBar({ shown, progress, children, ref, onLayout }: BarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [live, setLive] = useState(false);
  const fill = barFill(theme);

  useAnimatedReaction(
    () => shown.get() > 0.5,
    (on, prev) => {
      if (on !== prev) scheduleOnRN(setLive, on);
    },
  );
  const fade = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (shown.get() - 1) * 6 }],
  }));

  return (
    <Animated.View
      pointerEvents={live ? 'box-none' : 'none'}
      importantForAccessibility={live ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!live}
      style={[styles.host, fade]}>
      <View
        ref={ref}
        onLayout={onLayout}
        style={[styles.bar, { paddingTop: insets.top, borderBottomColor: theme.colors.hairline }]}>
        {fill.blur && (
          <BlurView tint={theme.blurTint} intensity={theme.blurIntensity} style={StyleSheet.absoluteFill} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill.color }]} />
        <View style={styles.row}>{children}</View>
        {progress && <ReadingProgress progress={progress} style={styles.progress} />}
      </View>
    </Animated.View>
  );
}

type IconProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  ref?: Ref<View>;
  onLayout?: (e: LayoutChangeEvent) => void;
};

/** A bare 44pt icon button for the pinned bar. */
export function BarIcon({ icon: Icon, label, onPress, ref, onLayout }: IconProps) {
  const { theme } = useTheme();
  return (
    <View ref={ref} onLayout={onLayout}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.88}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.icon}>
        <View>
          <Icon size={20} color={theme.colors.text} strokeWidth={1.7} />
        </View>
      </PressableScale>
    </View>
  );
}

type JumpBarProps = {
  shown: SharedValue<number>;
  progress: SharedValue<number>;
  sections: NavSection[];
  store: RailStore;
  onSelect: (id: string) => void;
  onOpenAll: () => void;
  onSearch: () => void;
  onSettings: () => void;
  /** For coach marks. */
  barRef?: Ref<View>;
  railRef?: Ref<View>;
  settingsRef?: Ref<View>;
};

/** Today's pinned bar: every section a tap away, plus search and settings from anywhere in the edition. */
export function JumpBar({
  shown,
  progress,
  sections,
  store,
  onSelect,
  onOpenAll,
  onSearch,
  onSettings,
  barRef,
  railRef,
  settingsRef,
}: JumpBarProps) {
  const { theme } = useTheme();
  const fill = barFill(theme);
  return (
    <PinnedBar ref={barRef} shown={shown} progress={progress}>
      <TopicRail
        ref={railRef}
        place="pinned"
        sections={sections}
        store={store}
        onSelect={onSelect}
        onOpenAll={onOpenAll}
        fadeColor={fill.base}
        fadeAlpha={fill.alpha}
        style={styles.flex}
      />
      <View style={styles.actions}>
        <BarIcon icon={Search} label="Search" onPress={onSearch} />
        <BarIcon ref={settingsRef} icon={SettingsIcon} label="Settings" onPress={onSettings} />
      </View>
    </PinnedBar>
  );
}

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  sections: NavSection[];
  store: RailStore;
  onSelect: (id: string) => void;
  onOlder: () => void;
};

/** Every section of the edition in one list, with what's in each. Opened from the rail's first button. */
export function SectionsSheet({ visible, onClose, sections, store, onSelect, onOlder }: SheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="In this edition">
      <SectionsList
        sections={sections}
        store={store}
        onSelect={(id) => {
          onClose();
          onSelect(id);
        }}
        onOlder={() => {
          onClose();
          onOlder();
        }}
      />
    </Sheet>
  );
}

function SectionsList({
  sections,
  store,
  onSelect,
  onOlder,
}: {
  sections: NavSection[];
  store: RailStore;
  onSelect: (id: string) => void;
  onOlder: () => void;
}) {
  const { theme } = useTheme();
  const active = useRailState(store, (s) => s.active);
  let topicNo = 0;

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {sections.map((s) => {
        const isTopic = s.id.startsWith('topic:');
        if (isTopic) topicNo++;
        const on = s.id === active;
        const a11y = [s.label, s.focus ? 'your focus' : null, s.detail, on ? 'reading now' : null];
        return (
          <PressableScale
            key={s.id}
            onPress={() => onSelect(s.id)}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a11y.filter(Boolean).join(', ')}
            style={[styles.item, { borderBottomColor: theme.colors.hairline }]}>
            <View style={[styles.mark, on && { backgroundColor: theme.colors.accent }]} />
            <Txt variant="caption" tone="tertiary" style={styles.num}>
              {isTopic ? String(topicNo).padStart(2, '0') : ''}
            </Txt>
            <View style={styles.labelRow}>
              <Txt variant="label" color={on ? theme.colors.accent : theme.colors.text} numberOfLines={1} style={styles.shrink}>
                {s.label}
              </Txt>
              {s.focus && (
                <Txt variant="kicker" color={theme.colors.accent} numberOfLines={1}>
                  Your focus
                </Txt>
              )}
            </View>
            {!!s.detail && (
              <Txt variant="caption" tone="tertiary" numberOfLines={1} style={styles.detail}>
                {s.detail}
              </Txt>
            )}
          </PressableScale>
        );
      })}
      <PressableScale onPress={onOlder} scaleTo={0.98} accessibilityRole="button" style={styles.older}>
        <View>
          <CalendarDays size={16} color={theme.colors.textSecondary} strokeWidth={1.7} />
        </View>
        <Txt variant="label" tone="secondary">
          Older editions
        </Txt>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  host: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  bar: { borderBottomWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
  icon: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  list: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 12 },
  item: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mark: { width: 2, alignSelf: 'stretch', marginVertical: 14 },
  num: { width: 22, fontVariant: ['tabular-nums'] },
  labelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  shrink: { flexShrink: 1 },
  detail: { maxWidth: '50%', textAlign: 'right' },
  older: { minHeight: TAP + 8, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, marginTop: 6 },
});
