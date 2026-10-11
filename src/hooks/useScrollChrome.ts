import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';
import {
  makeMutable,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** 0 = tab bar visible, 1 = hidden. Shared by every scrolling screen and the tab bar. */
export const tabBarHidden = makeMutable(0);

export function showTabBar() {
  tabBarHidden.set(withTiming(0, { duration: 220 }));
}

/**
 * Scroll handler that tracks the scroll position, reading progress (0–1), and hides the tab bar
 * while scrolling down, bringing it back when scrolling up or at the end.
 * With "Reduce motion" on, the tab bar simply stays put.
 */
export function useScrollChrome() {
  const progress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  /** Height of the visible part of the scroll view. */
  const viewportH = useSharedValue(0);
  /** Furthest the page can scroll. */
  const maxY = useSharedValue(0);
  /** Goes up by one each time the reader starts dragging the page. */
  const drags = useSharedValue(0);
  const lastY = useSharedValue(0);
  const target = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      drags.set(drags.get() + 1);
    },
    onScroll: (e) => {
      const y = e.contentOffset.y;
      scrollY.set(y);
      const max = Math.max(1, e.contentSize.height - e.layoutMeasurement.height);
      viewportH.set(e.layoutMeasurement.height);
      maxY.set(max);
      progress.set(Math.min(1, Math.max(0, y / max)));

      const dy = y - lastY.get();
      lastY.set(y);
      if (reduceMotion) return;

      const nearTop = y < 80;
      const nearEnd = y > max - 60;
      const next = nearTop || nearEnd || dy < -6 ? 0 : dy > 6 ? 1 : target.get();
      if (next !== target.get()) {
        target.set(next);
        tabBarHidden.set(withTiming(next, { duration: 240 }));
      }
    },
  });

  return { onScroll, progress, scrollY, viewportH, maxY, drags };
}

export type ScrollChrome = ReturnType<typeof useScrollChrome>;

/**
 * 0 → 1 once the page has scrolled to `at` (a shared value, so it can follow layout): drives a
 * bar pinned to the top of the screen. Fades quickly; with Reduce motion it simply appears.
 */
export function usePinned(scrollY: SharedValue<number>, at: SharedValue<number> | number) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  useAnimatedReaction(
    () => {
      const from = typeof at === 'number' ? at : at.get();
      return from > 0 && scrollY.get() >= from;
    },
    (on, prev) => {
      if (on === prev) return;
      const to = on ? 1 : 0;
      shown.set(reduceMotion ? to : withTiming(to, { duration: on ? 160 : 120 }));
    },
    [reduceMotion, at],
  );
  return shown;
}

// ─── Section scroll-spy ──────────────────────────────────────────────────────

/** Which section of the page the reader is in, and whether the jump bar is pinned. */
export type RailState = { active: string | null; pinned: boolean };

/**
 * A tiny store for the jump bar, so the chips can follow the scroll position without
 * re-rendering the page: only the rails subscribe to it.
 */
export type RailStore = {
  get: () => RailState;
  set: (patch: Partial<RailState>) => void;
  subscribe: (listener: () => void) => () => void;
  /** Last horizontal offset of the visible rail, so the other one can pick up where it left off. */
  getX: () => number;
  setX: (x: number) => void;
};

function createRailStore(): RailStore {
  let state: RailState = { active: null, pinned: false };
  let x = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      const next = { ...state, ...patch };
      if (next.active === state.active && next.pinned === state.pinned) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    getX: () => x,
    setX: (next) => {
      x = next;
    },
  };
}

export function useRailState<T>(store: RailStore, select: (s: RailState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}

type SpyOptions = {
  /** Section ids in page order. */
  ids: string[];
  /** Screen distance from the top that counts as "reading here" (just under the pinned bar). */
  lineTop: number;
  /** Space covered at the bottom (tab bar), ignored near the end of the page. */
  lineBottom: number;
};

/**
 * Tracks where each section starts and which one the reader is in. The position check runs on
 * the UI thread; React only hears about it when the active section changes.
 *
 * Near the end of the page the reading line slides down the screen, so the last short sections
 * (which can never reach the top) still light up in turn.
 */
export function useSectionSpy(chrome: ScrollChrome, { ids, lineTop, lineBottom }: SpyOptions) {
  const { scrollY, viewportH, maxY, drags } = chrome;
  const tops = useSharedValue<number[]>([]);
  /** A tapped section stays lit until the reader scrolls by hand (index, or -1). */
  const held = useSharedValue(-1);
  const heldAt = useSharedValue(0);
  // Everything below is stable for the life of the screen.
  const [spy] = useState(() => createSpy({ tops, held, heldAt, drags }));

  const idsKey = ids.join('|');
  useLayoutEffect(() => {
    spy.setIds(idsKey ? idsKey.split('|') : []);
  }, [spy, idsKey]);

  const setActive = spy.activate;
  useAnimatedReaction(
    () => {
      if (held.get() >= 0) {
        if (heldAt.get() === drags.get()) return held.get();
        held.set(-1);
      }
      const list = tops.get();
      if (!list.length) return -1;
      const y = scrollY.get();
      const h = viewportH.get();
      const span = h * 0.6;
      const end = span > 0 ? Math.min(1, Math.max(0, (y - (maxY.get() - span)) / span)) : 0;
      const line = y + lineTop + end * Math.max(0, h - lineTop - lineBottom);
      let idx = -1;
      for (let i = 0; i < list.length; i++) if (list[i] <= line) idx = i;
      return idx;
    },
    (idx, prev) => {
      if (idx !== prev) scheduleOnRN(setActive, idx);
    },
    [lineTop, lineBottom],
  );

  return spy;
}

function createSpy({
  tops,
  held,
  heldAt,
  drags,
}: {
  tops: SharedValue<number[]>;
  held: SharedValue<number>;
  heldAt: SharedValue<number>;
  drags: SharedValue<number>;
}) {
  const store = createRailStore();
  /** Section tops inside the edition, by id. */
  const positions = new Map<string, number>();
  let ids: string[] = [];
  /** Where the edition starts inside the scroll content. */
  let base = 0;
  let frame: ReturnType<typeof requestAnimationFrame> | null = null;

  const flush = () => {
    frame = null;
    tops.set(ids.map((id) => base + (positions.get(id) ?? 1e9)));
  };
  const schedule = () => {
    if (frame == null) frame = requestAnimationFrame(flush);
  };

  return {
    store,
    setIds: (next: string[]) => {
      ids = next;
      schedule();
    },
    /** Called from the UI thread when the reader moves into another section. */
    activate: (i: number) => store.set({ active: ids[i] ?? null }),
    /** Where the edition starts inside the scroll content. */
    setBase: (y: number) => {
      if (base === y) return;
      base = y;
      schedule();
    },
    /** onLayout for the first view of a section (y relative to the edition). */
    track: (id: string) => (e: LayoutChangeEvent) => {
      const y = e.nativeEvent.layout.y;
      if (positions.get(id) === y) return;
      positions.set(id, y);
      schedule();
    },
    /** Scroll position of a section's top, or null before it has been laid out. */
    topOf: (id: string): number | null => {
      const y = positions.get(id);
      return y == null ? null : base + y;
    },
    /** Lights a section right away (its chip was tapped) and keeps it lit until the reader scrolls by hand. */
    hold: (id: string) => {
      const i = ids.indexOf(id);
      if (i < 0) return;
      heldAt.set(drags.get());
      held.set(i);
      store.set({ active: id });
      // The web preview scrolls with a mouse wheel, which never starts a drag.
      if (Platform.OS === 'web') setTimeout(() => held.set(-1), 2000);
    },
    /** Forget the old edition's layout (a different day is showing). */
    reset: () => {
      positions.clear();
      held.set(-1);
      store.set({ active: null });
      schedule();
    },
  };
}

export type SectionSpy = ReturnType<typeof useSectionSpy>;
