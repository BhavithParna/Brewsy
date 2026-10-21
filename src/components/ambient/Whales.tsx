import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { backgroundAt } from '@/theme/themes';

/**
 * One whale crossing the screen. Positions are fractions of the screen; times are in seconds.
 * Farther whales are smaller, slower and fade into the water around them.
 */
type Swimmer = {
  /** Body length in points. */
  size: number;
  /** Height on the screen, 0 = top. */
  y: number;
  /** Seconds to cross the screen once. */
  period: number;
  /** How far along its crossing it is when the app opens (0–1), so the pod doesn't move in step. */
  phase: number;
  /** Swims left to right. */
  right: boolean;
  /** 0 = near, 1 = far: how much it takes on the water's color. */
  depth: number;
  /** Seconds for one slow rise and fall, and how far it moves (points). */
  bob: number;
  lift: number;
  /** A calf keeps beside its mother: it swims with her, this far behind and below (points). */
  with?: { mother: number; behind: number; below: number };
};

// A mother and calf high in the open water above the date; the rest further down, seen between cards.
const POD: Swimmer[] = [
  { size: 168, y: 0.13, period: 84, phase: 0.42, right: true, depth: 0, bob: 7, lift: 7 },
  { size: 74, y: 0.13, period: 84, phase: 0.42, right: true, depth: 0.1, bob: 5.5, lift: 6, with: { mother: 0, behind: -10, below: 92 } },
  { size: 104, y: 0.37, period: 112, phase: 0.08, right: false, depth: 0.35, bob: 8, lift: 5 },
  { size: 70, y: 0.63, period: 140, phase: 0.66, right: true, depth: 0.6, bob: 9, lift: 4 },
  { size: 88, y: 0.84, period: 126, phase: 0.27, right: false, depth: 0.5, bob: 8.5, lift: 4 },
];

/** When the app opened (the pod's time 0). */
const OPENED = Date.now();

/** The drawing's own size (viewBox units); the whale faces right. */
const VB_W = 240;
const VB_H = 140;
const BODY =
  'M34 54 C50 60 70 42 112 38 C172 32 228 56 230 86 C232 110 202 124 156 124 C108 124 70 106 52 84 C46 76 42 68 40 64 Z';
const FLUKE =
  'M44 62 C36 54 30 44 26 30 C24 22 18 16 8 14 C10 24 16 34 24 42 C16 42 8 46 2 54 C14 60 28 62 42 66 Z';
/** The tail is drawn in its own box so it can flick about the point where it meets the body (38, 58). */
const TAIL_BOX = { x: 0, y: 8, w: 50, h: 64 };
const TAIL_ORIGIN = `${((38 - TAIL_BOX.x) / TAIL_BOX.w) * 100}% ${((58 - TAIL_BOX.y) / TAIL_BOX.h) * 100}%`;

/** A whale's colors before the water tints it: dusty blue, a pale pleated belly, coral cheeks. */
const INK = {
  body: '#5E8FB4',
  fin: '#4F7FA4',
  belly: '#E8F3F7',
  pleat: '#C6DCE7',
  eye: '#16324A',
  blush: '#F49A8C',
};

/**
 * Whales: a small pod drifting across the sea behind every screen, each at its own depth and pace,
 * rising and falling a little as it goes and flicking its tail. Drawn over the wallpaper and under
 * the page, so the cards always sit on top. Still when the phone asks for less motion.
 *
 * Every copy (Today, Search, onboarding) counts from when the app opened, so the pod is in the same
 * place on every screen, and the mother and calf are always in view at first.
 */
export function WhalesLayer() {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [start] = useState(() => (Date.now() - OPENED) / 1000);
  const clock = useSharedValue(start);

  const frames = useFrameCallback((frame) => {
    clock.value = start + frame.timeSinceFirstFrame / 1000;
  }, false);
  useEffect(() => {
    frames.setActive(!reduced);
  }, [frames, reduced]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {POD.map((w, i) => (
        <Whale
          key={i}
          w={w}
          index={i}
          clock={clock}
          width={width}
          height={height}
          water={backgroundAt(theme, w.y) ?? theme.colors.bg}
        />
      ))}
    </View>
  );
}

/** How far across the screen a whale is at time t: its left edge, in points (worklet). */
function across(w: Swimmer, t: number, width: number): number {
  'worklet';
  const p = (((t / w.period + w.phase) % 1) + 1) % 1;
  // From fully off one edge to fully off the other.
  const x = -w.size * 1.2 + p * (width + w.size * 2.4);
  return w.right ? x : width - x - w.size;
}

function Whale({
  w,
  index,
  clock,
  width,
  height,
  water,
}: {
  w: Swimmer;
  index: number;
  clock: SharedValue<number>;
  width: number;
  height: number;
  water: string;
}) {
  const h = (w.size * VB_H) / VB_W;
  const mother = w.with ? POD[w.with.mother] : null;
  const ink = tinted(water, w.depth);

  const body = useAnimatedStyle(() => {
    const t = clock.value;
    const x = mother && w.with ? across(mother, t, width) - (mother.right ? w.with.behind : -w.with.behind) : across(w, t, width);
    const turn = ((t / w.bob + w.phase) % 1) * 2 * Math.PI;
    // Nose down while sinking, up while rising (mirrored for whales swimming left).
    const pitch = Math.cos(turn) * 2.5 * (w.right ? 1 : -1);
    return {
      transform: [
        { translateX: x },
        { translateY: Math.sin(turn) * w.lift },
        { rotate: `${pitch}deg` },
        { scaleX: w.right ? 1 : -1 },
      ],
    };
  });
  const tail = useAnimatedStyle(() => {
    // Smaller whales beat their tails a little faster.
    const beat = 2 + w.size / 120;
    return { transform: [{ rotate: `${Math.sin((clock.value / beat + w.phase * 7) * 2 * Math.PI) * 10}deg` }] };
  });

  return (
    <Animated.View style={[styles.whale, { top: w.y * height + (w.with?.below ?? 0), width: w.size, height: h }, body]}>
      <Animated.View
        style={[
          styles.tail,
          {
            left: (TAIL_BOX.x / VB_W) * w.size,
            top: (TAIL_BOX.y / VB_H) * h,
            width: (TAIL_BOX.w / VB_W) * w.size,
            height: (TAIL_BOX.h / VB_H) * h,
            transformOrigin: TAIL_ORIGIN,
          },
          tail,
        ]}>
        <Svg width="100%" height="100%" viewBox={`${TAIL_BOX.x} ${TAIL_BOX.y} ${TAIL_BOX.w} ${TAIL_BOX.h}`}>
          <Path d={FLUKE} fill={ink.body} />
        </Svg>
      </Animated.View>
      <Svg width={w.size} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id={`whale-body-${index}`}>
            <Path d={BODY} />
          </ClipPath>
        </Defs>
        <Path d={BODY} fill={ink.body} />
        <G clipPath={`url(#whale-body-${index})`}>
          <Path d="M62 100 C110 116 186 114 236 70 L236 140 L60 140 Z" fill={ink.belly} />
          <Path d="M118 118 C160 122 206 112 232 94" stroke={ink.pleat} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <Path d="M136 126 C176 128 214 118 236 102" stroke={ink.pleat} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </G>
        <Path d="M128 104 C124 116 114 128 98 134 C96 124 102 110 114 100 Z" fill={ink.fin} />
        <Circle cx={186} cy={78} r={5.2} fill={ink.eye} />
        <Circle cx={187.8} cy={76.2} r={1.7} fill="#FFFFFF" opacity={1 - w.depth * 0.5} />
        <Ellipse cx={190} cy={92} rx={7.5} ry={4.2} fill={ink.blush} opacity={0.6} />
        <Path d="M202 92 C208 96 216 95 222 89" stroke={ink.eye} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/**
 * How light the body and fin must stay (relative luminance), so that a title or label passing in front
 * of a whale still reads: the theme's text is at least 4.5:1 against them, as it is against the water.
 */
const MIN_LUMINANCE: Partial<Record<keyof typeof INK, number>> = { body: 0.33, fin: 0.3 };

/** The whale's colors seen through `depth` of water: mixed toward the water around it. */
function tinted(water: string, depth: number): typeof INK {
  return Object.fromEntries(
    Object.entries(INK).map(([key, hex]) => {
      const min = MIN_LUMINANCE[key as keyof typeof INK] ?? 0;
      let k = depth * 0.6;
      while (k < 1 && luminance(mix(hex, water, k)) < min) k += 0.02;
      return [key, mix(hex, water, k)];
    }),
  ) as typeof INK;
}

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

/** Two '#RRGGBB' colors mixed, k of the way from a to b. */
function mix(a: string, b: string, k: number): string {
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) * (1 - k) + channel(b, i) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance of a '#RRGGBB' color. */
function luminance(hex: string): number {
  const [r, g, b] = [0, 1, 2].map((i) => {
    const c = channel(hex, i) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const styles = StyleSheet.create({
  whale: { position: 'absolute', left: 0 },
  tail: { position: 'absolute' },
});
