import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Modal, StyleSheet, type View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { BAR_HEIGHT } from '../JumpBar';
import { TAB_BAR_HEIGHT } from '../TabBar';
import { Spotlight, type Hole, type Rect } from './Spotlight';
import { todaySteps, type TourStep, type TourTarget } from './steps';
import { TourCard } from './TourCard';
import { updateSettings, useSettings } from '@/state/settings';
import { useStoryFocus } from '@/state/storyFocus';
import { useTheme } from '@/theme/ThemeProvider';
import { themeRadius } from '@/theme/themes';
import { GUTTER, radii } from '@/theme/tokens';

/** A beat after the edition appears, so the page has settled before the tour dims it. */
const START_DELAY = 900;
/** Room between the spotlight and the note. */
const GAP = 14;
/** The note's height before it has measured itself. */
const CARD_GUESS = 236;
const MAX_CARD_WIDTH = 420;

type TodayTourProps = {
  /** An edition is on screen (with its jump rail). */
  ready: boolean;
  /** At least one story card is on the page. */
  hasStory: boolean;
  scrollRef: RefObject<Animated.ScrollView | null>;
  scrollY: SharedValue<number>;
  /** The jump bar is pinned to the top. */
  isPinned: () => boolean;
};

/**
 * The first-run tour of Today: shown once, the first time an edition is on screen after
 * onboarding (existing readers see it once too). Settings → Help → "Take the tour again" brings
 * it back. Finishing or skipping marks it done.
 */
export function TodayTour({ ready, hasStory, scrollRef, scrollY, isPinned }: TodayTourProps) {
  const { tourDone } = useSettings();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Opened to read a particular story (a notification or a search result): don't get in the way.
  // The tour waits until the next time the app starts.
  const opening = useStoryFocus() != null;
  const [deferred, setDeferred] = useState(false);
  if (opening && !deferred && !open) setDeferred(true);
  // "Take the tour again" in Settings always brings it back.
  const [wasDone, setWasDone] = useState(tourDone);
  if (wasDone !== tourDone) {
    setWasDone(tourDone);
    if (!tourDone && !opening) setDeferred(false);
  }

  useEffect(() => {
    if (!ready || tourDone || !focused || deferred || open) return;
    const timer = setTimeout(() => setOpen(true), START_DELAY);
    return () => clearTimeout(timer);
  }, [ready, tourDone, focused, deferred, open]);

  // Worked out once per run; steps whose element isn't there (no stories) drop out of the count.
  const steps = useMemo(
    () => (open ? todaySteps({ hasStory, isPinned, statusTop: insets.top }).filter((s) => s.target() != null) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  if (!open || !steps.length) return null;

  return (
    <Tour
      steps={steps}
      scrollTo={(y, animated) => scrollRef.current?.scrollTo({ y: Math.max(0, y), animated })}
      scrollY={() => scrollY.get()}
      onClose={() => {
        updateSettings({ tourDone: true });
        setOpen(false);
        // Back to the top of the edition, ready to read.
        scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
      }}
    />
  );
}

type TourProps = {
  steps: TourStep[];
  /** Scrolls the page to a content offset. */
  scrollTo: (y: number, animated: boolean) => void;
  /** The page's current scroll offset. */
  scrollY: () => number;
  /** Finished or skipped. */
  onClose: (finished: boolean) => void;
};

type Request = { index: number; dir: 1 | -1 };
type Shown = { index: number; hole: Hole };

/**
 * Coach marks over a screen: the page dims, a window opens around one real element at a time,
 * and a small note explains it. The page scrolls each element into view before it's measured.
 * Skip is always there, and Android's back button skips too.
 */
export function Tour({ steps, scrollTo, scrollY, onClose }: TourProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [request, setRequest] = useState<Request>({ index: 0, dir: 1 });
  const [shown, setShown] = useState<Shown | null>(null);
  const [moving, setMoving] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cardH, setCardH] = useState(CARD_GUESS);
  const run = useRef(0);
  const closing = useRef(false);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.set(reduceMotion ? 1 : withTiming(1, { duration: 260 }));
  }, [fade, reduceMotion]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const close = (finished: boolean) => {
    if (closing.current) return;
    closing.current = true;
    run.current++;
    if (reduceMotion) {
      onClose(finished);
      return;
    }
    fade.set(
      withTiming(0, { duration: 200 }, (done) => {
        if (done) scheduleOnRN(onClose, finished);
      }),
    );
  };

  // The visible band: under the pinned bar at the top, above the tab bar at the bottom.
  const topReserve = insets.top + BAR_HEIGHT;
  const bottomReserve = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 16;

  /** Brings a step's element into view and works out the window around it, or null to skip it. */
  const place = async (target: TourTarget, alive: () => boolean): Promise<Hole | null> => {
    const { ref } = target;
    if (target.scroll === 'top' && scrollY() > 1) {
      scrollTo(0, !reduceMotion);
      await settle(ref);
      if (!alive()) return null;
    }
    let rect = await measure(ref);
    if (!rect || !alive()) return null;
    if (target.scroll === 'reveal' && !comfortable(rect)) {
      // Lift it to about a third of the way down, leaving the rest of the screen for the note.
      const want = Math.max(topReserve + 20, Math.round(size.height * 0.3));
      scrollTo(scrollY() + rect.y - want, !reduceMotion);
      rect = await settle(ref);
      if (!rect || !alive()) return null;
    }
    if (target.trimTop) rect = { ...rect, y: rect.y + target.trimTop, height: rect.height - target.trimTop };
    return hole(rect, target.shape);
  };

  /** On screen, clear of the bars, with room for the note above or below it. */
  const comfortable = (r: Rect) => {
    const top = r.y >= topReserve + 8;
    const bottom = r.y + r.height <= size.height - bottomReserve;
    const room = Math.max(r.y - insets.top, size.height - insets.bottom - (r.y + r.height)) >= cardH + GAP * 2;
    return top && bottom && room;
  };

  const hole = (r: Rect, shape: TourTarget['shape']): Hole => {
    const pad = shape === 'bar' ? 3 : 6;
    let x = r.x - pad;
    let width = r.width + pad * 2;
    if (shape === 'bar') {
      // Full-width strips get a window inset a little from the screen edges.
      x = 8;
      width = size.width - 16;
    }
    x = Math.max(6, x);
    width = Math.min(width, size.width - 6 - x);
    const control = theme.shape.control >= 999 ? 999 : theme.shape.control + pad / 2;
    const radius =
      shape === 'control' ? control : shape === 'card' ? themeRadius(theme, radii.lg) + pad / 2 : themeRadius(theme, radii.sm);
    return { x, y: r.y - pad, width, height: r.height + pad * 2, radius };
  };

  // Each request: hide the note, bring the element into view, measure it, then show the note.
  // Steps whose element can't be found are passed over in the direction of travel.
  useEffect(() => {
    if (!size.height || closing.current) return;
    const token = ++run.current;
    const alive = () => run.current === token;
    setMoving(true);
    (async () => {
      let i = request.index;
      while (i >= 0 && i < steps.length) {
        const target = steps[i].target();
        const placed = target ? await place(target, alive) : null;
        if (!alive()) return;
        if (placed) {
          // The note then takes the screen reader's focus (TourCard).
          setShown({ index: i, hole: placed });
          setMoving(false);
          return;
        }
        i += request.dir;
      }
      if (i >= steps.length) close(true);
      else setRequest({ index: 0, dir: 1 });
    })();
    // place/close read the latest layout when they run; only a new request or size starts a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, size.height]);

  const go = (dir: 1 | -1) => {
    if (!shown || moving) return;
    const next = shown.index + dir;
    if (next >= steps.length) close(true);
    else if (next >= 0) setRequest({ index: next, dir });
  };

  // The note sits below the window when there's room, otherwise above it.
  let notePos: { top?: number; bottom?: number } = {};
  if (shown && size.height) {
    const { hole: h } = shown;
    const below = size.height - insets.bottom - 12 - (h.y + h.height + GAP);
    const above = h.y - GAP - (insets.top + 12);
    notePos = below >= cardH || below >= above ? { top: h.y + h.height + GAP } : { bottom: size.height - h.y + GAP };
  }
  const width = Math.min(size.width - GUTTER * 2, MAX_CARD_WIDTH);
  const step = shown ? steps[shown.index] : null;
  const scrim = theme.isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(12, 8, 4, 0.58)';
  const rim = theme.isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.85)';

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(false)}>
      <Animated.View
        style={[StyleSheet.absoluteFill, fadeStyle]}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (w !== size.width || h !== size.height) setSize({ width: w, height: h });
        }}
        accessibilityViewIsModal>
        <Spotlight hole={shown?.hole ?? null} scrim={scrim} rim={rim} reduceMotion={reduceMotion} />
        {step && shown && !moving && (
          <Animated.View
            key={shown.index}
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(120)}
            style={[styles.note, notePos, { width, left: (size.width - width) / 2 }]}>
            <TourCard
              title={step.title}
              body={step.body}
              index={shown.index}
              count={steps.length}
              onBack={shown.index > 0 ? () => go(-1) : undefined}
              onNext={() => go(1)}
              onSkip={() => close(false)}
              onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}
            />
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

function measure(ref: RefObject<View | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Measures until the element stops moving (the page has finished scrolling), up to 1.6 s. */
async function settle(ref: RefObject<View | null>): Promise<Rect | null> {
  let last: Rect | null = null;
  let still = 0;
  for (let t = 0; t < 1600; t += 70) {
    await wait(70);
    const r = await measure(ref);
    if (r && last && Math.abs(r.y - last.y) < 0.5 && Math.abs(r.x - last.x) < 0.5) {
      if (++still >= 2) return r;
    } else {
      still = 0;
    }
    last = r;
  }
  return last;
}

const styles = StyleSheet.create({
  note: { position: 'absolute' },
});
