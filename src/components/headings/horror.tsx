import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { Txt } from '../Txt';
import type { HeadingProps, HeadingRegistry } from './types';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, withAlpha } from '@/theme/tokens';

function storiesLabel(count?: number): string | null {
  return count != null ? `${count} ${count === 1 ? 'story' : 'stories'}` : null;
}

function a11yLabel(label: string, count?: number): string {
  const c = storiesLabel(count);
  return c ? `${label}, ${c}` : label;
}

/** A stable small number for sections that don't pass an index (so nothing reshuffles). */
function labelSeed(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 997;
  return h;
}

// ─── Nosferatu: a silent-film intertitle card ────────────────────────────────

const ROMAN: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function roman(n: number): string {
  let out = '';
  let rest = Math.max(1, Math.min(39, Math.round(n)));
  for (const [v, s] of ROMAN) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/** "Four stories", the way an intertitle would set it. */
function storiesInWords(count?: number): string | null {
  if (count == null) return null;
  const n = count < WORDS.length ? WORDS[count] : String(count);
  return `${n} ${count === 1 ? 'story' : 'stories'}`;
}

/** A small flourish for the inner corners of the intertitle frame (drawn for the top-left corner). */
function Flourish({ color, flipX, flipY }: { color: string; flipX?: boolean; flipY?: boolean }) {
  return (
    <View
      style={[
        styles.flourish,
        flipX ? styles.right : styles.left,
        flipY ? styles.bottom : styles.top,
        { transform: [{ scaleX: flipX ? -1 : 1 }, { scaleY: flipY ? -1 : 1 }] },
      ]}>
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Path d="M1 15 V7 Q1 1 7 1 H15" stroke={color} strokeWidth={0.9} fill="none" />
        <Path d="M5.5 3.2 L7.3 5 L5.5 6.8 L3.7 5 Z" fill={color} />
      </Svg>
    </View>
  );
}

function NosferatuHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const accent = theme.colors.accent;
  const frame = withAlpha(accent, 0.55);
  const inner = withAlpha(accent, 0.32);
  const words = storiesInWords(count);
  return (
    <View style={styles.pad} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={[styles.intertitle, { borderColor: frame }]}>
        <View style={[styles.intertitleInner, { borderColor: inner }]}>
          <Flourish color={inner} />
          <Flourish color={inner} flipX />
          <Flourish color={inner} flipY />
          <Flourish color={inner} flipX flipY />
          {index != null && (
            <Txt variant="kicker" color={accent} align="center">
              {`Act ${roman(index)}`}
            </Txt>
          )}
          <Txt variant="displayL" align="center" numberOfLines={2}>
            {label}
          </Txt>
          {words && (
            <Txt variant="caption" tone="tertiary" align="center">
              {words}
            </Txt>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── The Ring: the VCR's on-screen display ───────────────────────────────────

function PlayMark({ color }: { color: string }) {
  return (
    <Svg width={10} height={12} viewBox="0 0 10 12">
      <Path d="M0 0 L10 6 L0 12 Z" fill={color} />
    </Svg>
  );
}

/** A tape counter for the nth section: 0:04:23, 0:11:46, 0:18:09… */
function tapeCounter(n: number): string {
  const minutes = n * 7 - 3;
  const seconds = (n * 23) % 60;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function RingHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const accent = theme.colors.accent;
  const stories = storiesLabel(count);
  return (
    <View style={styles.ring} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.osd}>
        <View style={styles.osdPlay}>
          <PlayMark color={accent} />
          <Txt variant="kicker" color={accent}>
            Play
          </Txt>
        </View>
        <Txt variant="kicker" tone="secondary">
          SP
        </Txt>
        {index != null && (
          <Txt variant="kicker" tone="secondary" style={styles.tabular}>
            {tapeCounter(index)}
          </Txt>
        )}
        <View style={styles.flex} />
        {stories && (
          <Txt variant="caption" tone="tertiary">
            {stories}
          </Txt>
        )}
      </View>
      <Txt variant="displayL" numberOfLines={2}>
        {label}
      </Txt>
      {/* A faint tracking line: the hairline, with one short stretch slipped a pixel out of true. */}
      <View style={styles.tracking}>
        <View style={[styles.trackLine, { backgroundColor: theme.colors.hairline }]} />
        <View
          style={[
            styles.trackSlip,
            { backgroundColor: withAlpha(accent, 0.22), left: `${18 + (((index ?? labelSeed(label)) * 29) % 50)}%` },
          ]}
        />
      </View>
    </View>
  );
}

// ─── Midsommar: the title between two embroidered borders ────────────────────

const THREAD_BLUE = '#5B77B5';
const THREAD_YELLOW = '#D6AC3F';
const THREAD_ROSE = '#B4567A';

// An eight-petal folk rose, one cross-stitch per cell (B blue, Y yellow, R rose).
const ROSE_PATTERN = ['...B...', '.B.B.B.', '..BYB..', 'BBYRYBB', '..BYB..', '.B.B.B.', '...B...'];
const CELL = 3.4;

function CrossStitchRose() {
  const color = { B: THREAD_BLUE, Y: THREAD_YELLOW, R: THREAD_ROSE } as const;
  const size = ROSE_PATTERN.length * CELL;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {ROSE_PATTERN.flatMap((row, y) =>
        row.split('').flatMap((c, x) => {
          if (c === '.') return [];
          const stroke = color[c as keyof typeof color];
          const x0 = x * CELL + 0.5;
          const y0 = y * CELL + 0.5;
          const x1 = x0 + CELL - 1;
          const y1 = y0 + CELL - 1;
          return [
            <Line key={`${x}-${y}-a`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={stroke} strokeWidth={1} strokeLinecap="round" />,
            <Line key={`${x}-${y}-b`} x1={x1} y1={y0} x2={x0} y2={y1} stroke={stroke} strokeWidth={1} strokeLinecap="round" />,
          ];
        }),
      )}
    </Svg>
  );
}

/** A running stitch with a small knot at the outer end, and the rose beside the title. */
function StitchedBorder({ side, color }: { side: 'left' | 'right'; color: string }) {
  const run = (
    <View style={styles.flex}>
      <Svg width="100%" height={6}>
        <Line x1="0" y1="3" x2="100%" y2="3" stroke={color} strokeWidth={1.3} strokeDasharray="5 4" strokeLinecap="round" />
      </Svg>
    </View>
  );
  const knot = (
    <Svg width={6} height={6} viewBox="0 0 6 6">
      <Circle cx={3} cy={3} r={1.6} fill={color} />
    </Svg>
  );
  return (
    <View style={styles.stitchSide}>
      {side === 'left' ? (
        <>
          {knot}
          {run}
          <CrossStitchRose />
        </>
      ) : (
        <>
          <CrossStitchRose />
          {run}
          {knot}
        </>
      )}
    </View>
  );
}

function MidsommarHeading({ label, count }: HeadingProps) {
  const { theme } = useTheme();
  const thread = withAlpha(THREAD_BLUE, 0.55);
  const stories = storiesLabel(count);
  return (
    <View style={styles.midsommar} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.midsommarRow}>
        <StitchedBorder side="left" color={thread} />
        <Txt variant="displayM" align="center" style={styles.midsommarTitle} numberOfLines={2}>
          {label}
        </Txt>
        <StitchedBorder side="right" color={thread} />
      </View>
      {stories && (
        <Txt variant="spaced" color={theme.colors.textTertiary} align="center">
          {stories}
        </Txt>
      )}
    </View>
  );
}

// ─── Scream: one of Randy's rules, then the topic ────────────────────────────

/** Rule #3 is the one everyone remembers. */
const RULE_THREE = 'Never say “I’ll be right back.”';

/**
 * Each topic is one of the rules ("Rule #1", "Rule #2"…) over the title in poster capitals. Movies is
 * playing "Stab" instead, the film inside the film; rule #3 gets its words.
 */
function ScreamHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const red = theme.colors.accent;
  const stories = storiesLabel(count);
  const kicker = index == null ? null : label === 'Movies' ? 'Now showing: Stab' : `Rule #${index}`;
  return (
    <View style={styles.scream} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.screamTop}>
        {kicker ? (
          <Txt variant="kicker" color={red}>
            {kicker}
          </Txt>
        ) : (
          <View style={[styles.redRule, { backgroundColor: red }]} />
        )}
        <View style={[styles.flex, styles.screamLine, { backgroundColor: theme.colors.hairline }]} />
        {stories && (
          <Txt variant="kicker" tone="tertiary">
            {stories}
          </Txt>
        )}
      </View>
      <Txt variant="displayL" numberOfLines={2}>
        {label}
      </Txt>
      {index === 3 && label !== 'Movies' && (
        <Txt variant="caption" tone="tertiary">
          {RULE_THREE}
        </Txt>
      )}
    </View>
  );
}

// ─── Insidious: a red door, a little further open each time ──────────────────

const DOOR_RED = '#A3221F';
const DOOR_EDGE = '#6E1513';
const DOOR_BRASS = '#C9A066';
const DOOR_W = 20;
const DOOR_H = 34;
/** Drawn on a 20 × 34 grid, shown a little larger. */
const DOOR_SCALE = 1.2;

/**
 * A four-panel door seen straight on, swinging inward: as it opens, the leaf narrows toward its
 * hinge and its far edge gets shorter, and the dark beyond shows. `open` runs from 0 (shut) to 1.
 */
function RedDoor({ open, frame }: { open: number; frame: string }) {
  const leaf = DOOR_W * (1 - 0.7 * open);
  const sink = 2.2 * open; // the free edge recedes, so it looks a little shorter
  const p = (x: number) => (x / DOOR_W) * leaf; // panel positions follow the leaf
  const panel = (x0: number, y0: number, x1: number, y1: number) => {
    const t0 = sink * (p(x0) / leaf);
    const t1 = sink * (p(x1) / leaf);
    return `M${p(x0)} ${y0 + t0} L${p(x1)} ${y0 + t1} L${p(x1)} ${y1 - t1} L${p(x0)} ${y1 - t0} Z`;
  };
  return (
    <Svg
      width={(DOOR_W + 6) * DOOR_SCALE}
      height={(DOOR_H + 5) * DOOR_SCALE}
      viewBox={`-3 -3 ${DOOR_W + 6} ${DOOR_H + 5}`}>
      <Rect x={0} y={0} width={DOOR_W} height={DOOR_H} fill="#050607" />
      <Path d={`M0 0 L${leaf} ${sink} L${leaf} ${DOOR_H - sink} L0 ${DOOR_H} Z`} fill={DOOR_RED} stroke={DOOR_EDGE} strokeWidth={0.6} />
      <Path d={panel(3, 3, 9, 18)} fill="none" stroke={DOOR_EDGE} strokeWidth={0.8} />
      <Path d={panel(11, 3, 17, 18)} fill="none" stroke={DOOR_EDGE} strokeWidth={0.8} />
      <Path d={panel(3, 21, 9, 31)} fill="none" stroke={DOOR_EDGE} strokeWidth={0.8} />
      <Path d={panel(11, 21, 17, 31)} fill="none" stroke={DOOR_EDGE} strokeWidth={0.8} />
      <Circle cx={p(16.6)} cy={DOOR_H * 0.56} r={1.15} fill={DOOR_BRASS} />
      {/* The frame, and a threshold under it. */}
      <Path d={`M-1.4 ${DOOR_H + 0.6} V-1.4 H${DOOR_W + 1.4} V${DOOR_H + 0.6}`} fill="none" stroke={frame} strokeWidth={1.2} />
      <Line x1={-3} y1={DOOR_H + 1.2} x2={DOOR_W + 3} y2={DOOR_H + 1.2} stroke={frame} strokeWidth={1.2} />
    </Svg>
  );
}

/** How far the door stands open for the nth topic: shut for the first, then a little more each time. */
function doorOpening(index?: number): number {
  return index == null ? 0 : Math.min(0.8, (index - 1) * 0.16);
}

function InsidiousHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const stories = storiesLabel(count);
  const sill = withAlpha(theme.colors.text, 0.38);
  return (
    <View style={styles.insidious} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.insidiousRow}>
        <View style={[styles.insidiousLine, { backgroundColor: theme.colors.hairline }]} />
        <RedDoor open={doorOpening(index)} frame={sill} />
        <View style={[styles.insidiousLine, { backgroundColor: theme.colors.hairline }]} />
      </View>
      <Txt variant="displayL" align="center" numberOfLines={2}>
        {label}
      </Txt>
      {stories && (
        <Txt variant="spaced" tone="tertiary" align="center">
          {stories}
        </Txt>
      )}
    </View>
  );
}

/** Section headings for the horror themes, by theme name. Themes not listed use their built-in `layout.sections` style. */
export const horrorHeadings: HeadingRegistry = {
  nosferatu: NosferatuHeading,
  thering: RingHeading,
  midsommar: MidsommarHeading,
  scream: ScreamHeading,
  insidious: InsidiousHeading,
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: GUTTER },
  tabular: { fontVariant: ['tabular-nums'] },

  intertitle: { borderWidth: 1, padding: 4, backgroundColor: '#080605' },
  intertitleInner: {
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 26,
    alignItems: 'center',
    gap: 6,
  },
  flourish: { position: 'absolute', width: 16, height: 16 },
  left: { left: 4 },
  right: { right: 4 },
  top: { top: 4 },
  bottom: { bottom: 4 },

  ring: { paddingHorizontal: GUTTER + 2, gap: 6 },
  osd: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  osdPlay: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tracking: { height: 4, justifyContent: 'center', marginTop: 4 },
  trackLine: { height: 1 },
  trackSlip: { position: 'absolute', top: 2, width: '22%', height: 1 },

  midsommar: { paddingHorizontal: GUTTER, gap: 10 },
  midsommarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  midsommarTitle: { flexShrink: 1 },
  stitchSide: { flex: 1, minWidth: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },

  scream: { paddingHorizontal: GUTTER + 2, gap: 6 },
  screamTop: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 20 },
  screamLine: { height: 1 },
  redRule: { width: 28, height: 3 },

  insidious: { paddingHorizontal: GUTTER, gap: 8, alignItems: 'center' },
  insidiousRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginBottom: 2 },
  insidiousLine: { width: 56, height: 1, marginBottom: 2 },
});
