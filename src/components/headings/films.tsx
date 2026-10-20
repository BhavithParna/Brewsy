import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

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

const ROMAN: [number, string][] = [
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** 4 -> "IV" (topic sections never reach 40). */
export function roman(n: number): string {
  let out = '';
  let rest = Math.max(1, Math.floor(n));
  for (const [value, numeral] of ROMAN) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}

const WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/** 4 -> "four", the way a book spells its chapters. Past twenty, digits. */
export function spelled(n: number): string {
  return WORDS[n - 1] ?? String(n);
}

/**
 * Web preview only: `?eggs=1` puts every rare touch on every topic section at once, to check how
 * they look (listed with the other flags in src/dev/previewState.ts). Never set in production builds.
 */
const ALL_EGGS =
  __DEV__ &&
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location?.search ?? '').get('eggs') === '1';

/**
 * A number from 0 to 1 worked out from today's date and the section's name, so it's the same on
 * every render all day. Rare touches (an origami unicorn, a few acorns, a changeover) sit on the
 * same heading all day and move somewhere else tomorrow. They are still drawings: nothing blinks.
 */
function dayLuck(label: string, salt: number): number {
  if (ALL_EGGS) return 0;
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|${label}|${salt}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Dune: the topic in wide-set capitals between two fine rules, centered. Out on the right-hand rule
 * the sand lifts over something moving underneath, with a ripple behind it: worm sign.
 */
function DuneHeading({ label, count }: HeadingProps) {
  const { theme } = useTheme();
  const rule = withAlpha(theme.colors.text, 0.24);
  const countLabel = storiesLabel(count);
  return (
    <View style={styles.dune} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.duneRow}>
        <View style={styles.duneSide}>
          <View style={[styles.duneLine, { backgroundColor: rule }]} />
        </View>
        <Txt variant="displayM" align="center" style={styles.duneLabel}>
          {label}
        </Txt>
        <View style={styles.duneSide}>
          <View style={[styles.duneLine, styles.duneLead, { backgroundColor: rule }]} />
          <WormSign color={theme.colors.text} />
          <View style={[styles.duneLine, { backgroundColor: rule }]} />
        </View>
      </View>
      {countLabel && (
        <Txt variant="spaced" tone="tertiary" align="center">
          {countLabel}
        </Txt>
      )}
    </View>
  );
}

/** A low mound in a fine rule, with two ripples trailing it. The rule sits at y = 8, like the lines beside it. */
function WormSign({ color }: { color: string }) {
  return (
    <Svg width={44} height={10} viewBox="0 0 44 10">
      <Path d="M0 8 H9 C 14 8, 16 2.6, 21.5 2.6 S 29 8, 34 8 H44" stroke={color} strokeOpacity={0.24} strokeWidth={1} fill="none" />
      <Path d="M30.5 6.6 C 32.2 5.6, 34 5.4, 35.6 5.8" stroke={color} strokeOpacity={0.2} strokeWidth={0.9} strokeLinecap="round" fill="none" />
      <Path d="M35.4 7.6 C 36.8 7, 38.2 6.9, 39.4 7.2" stroke={color} strokeOpacity={0.14} strokeWidth={0.9} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/**
 * Matrix: a terminal line, "> world_". Long names wrap after an underscore, the way a terminal
 * wraps, rather than being cut short (shrink-to-fit isn't reliable everywhere).
 */
function PromptHeading({ label, count }: HeadingProps) {
  const { theme } = useTheme();
  const accent = theme.colors.accent;
  const countLabel = storiesLabel(count);
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <Txt variant="displayL" style={styles.shrink}>
        <Txt variant="displayL" color={accent}>
          {'>\u00A0'}
        </Txt>
        {label.toLowerCase().replace(/ /g, '_\u200B')}
        <Txt variant="displayL" color={accent}>
          _
        </Txt>
      </Txt>
      {countLabel && (
        <Txt variant="caption" tone="tertiary" style={styles.noShrink}>
          {countLabel}
        </Txt>
      )}
    </View>
  );
}

/**
 * Tron: the title over a light trail. The bright trail turns a hard corner, the way a light cycle
 * does, and the dim line runs on to a ring like an identity disc.
 */
function GridHeading({ label, count }: HeadingProps) {
  const { theme } = useTheme();
  const accent = theme.colors.accent;
  const countLabel = storiesLabel(count);
  return (
    <View style={styles.grid} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.row0}>
        <Txt variant="displayL" style={styles.shrink}>
          {label}
        </Txt>
        {countLabel && (
          <Txt variant="kicker" color={accent} style={styles.noShrink}>
            {countLabel}
          </Txt>
        )}
      </View>
      <View style={styles.trail}>
        <Svg width={46} height={9} viewBox="0 0 46 9">
          <Path d="M0 7.2 H32 V4 H46" stroke={accent} strokeWidth={2.4} fill="none" />
        </Svg>
        <View style={[styles.trailLine, { backgroundColor: withAlpha(accent, 0.4) }]} />
        <Svg width={9} height={9} viewBox="0 0 9 9">
          <Circle cx={4.5} cy={4.5} r={3.4} stroke={accent} strokeWidth={1.4} fill="none" />
          <Circle cx={4.5} cy={4.5} r={1.1} fill={accent} />
        </Svg>
      </View>
    </View>
  );
}

/**
 * Blade Runner: a fine rule led by the story count in neon pink, then the topic in the squared-off
 * face. Some days someone has left a folded-paper unicorn on one of the rules.
 */
function EsperHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = storiesLabel(count);
  const unicorn = index != null && dayLuck(label, 2019) < 1 / 7;
  return (
    <View style={styles.left} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.esperRow}>
        {countLabel && (
          <Txt variant="kicker" color={theme.colors.accent}>
            {countLabel}
          </Txt>
        )}
        <View style={[styles.esperLine, { backgroundColor: theme.colors.hairline }]} />
        {unicorn && <Unicorn color={theme.colors.text} />}
      </View>
      <Txt variant="displayL">{label}</Txt>
    </View>
  );
}

/** A small origami unicorn, folded from foil: two shades for the folds, the horn catching the light. */
function Unicorn({ color }: { color: string }) {
  const light = withAlpha(color, 0.82);
  const dark = withAlpha(color, 0.58);
  return (
    <Svg width={24} height={20} viewBox="0 0 26 21" style={styles.unicorn}>
      <Path d="M7.2 11.2 L17.6 10.2 L19 13.6 L8.4 14 Z" fill={light} />
      <Path d="M7.2 11.2 L13 10.6 L8.4 14 Z" fill={dark} />
      <Path d="M17 13.5 L19 13.6 L18.6 20.4 Z" fill={dark} />
      <Path d="M14.8 13.7 L16.4 13.6 L15.4 20.4 Z" fill={light} />
      <Path d="M8.4 14 L10.3 13.9 L9 20.4 Z" fill={light} />
      <Path d="M10.9 13.9 L12.5 13.8 L11.8 20.4 Z" fill={dark} />
      <Path d="M7.2 11.2 L10 10.9 L8.2 5.2 L6 5.6 Z" fill={light} />
      <Path d="M6 5.6 L8.2 5.2 L8 7 L2.6 9 Z" fill={dark} />
      <Path d="M6.4 5.5 L7.6 5.3 L3 0.8 Z" fill={color} />
      <Path d="M17.6 10.2 L19.2 11.4 L22.8 7.6 L21.6 10.6 Z" fill={dark} />
    </Svg>
  );
}

/**
 * Budapest: a concierge's crossed keys over the topic, which sits in Futura-style capitals between
 * double rules (printed, like the cards); the count spaced out underneath. Everything centered.
 */
function KeysHeading({ label, count }: HeadingProps) {
  const { theme } = useTheme();
  const plum = theme.colors.accent;
  const countLabel = storiesLabel(count);
  const line = [styles.doubleLine, { borderColor: theme.colors.hairline }];
  return (
    <View style={styles.center} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <CrossedKeys color={plum} />
      <View style={styles.keysRow}>
        <View style={line} />
        <Txt variant="displayM" align="center" style={styles.keysLabel}>
          {label}
        </Txt>
        <View style={line} />
      </View>
      {countLabel && (
        <Txt variant="spaced" tone="tertiary" align="center" style={styles.below}>
          {countLabel}
        </Txt>
      )}
    </View>
  );
}

/** Two keys crossed, bows down and bits up. */
function CrossedKeys({ color }: { color: string }) {
  return (
    <Svg width={28} height={21} viewBox="0 0 28 21" style={styles.keys}>
      <Path d="M16.83 14.12 L8.34 3.25" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M8.34 3.25 L10.7 1.4 L11.5 2.43 L10.63 3.1 L11.25 3.89 L12.12 3.22 L12.85 4.16 L10.49 6.01 Z" fill={color} />
      <Circle cx={18.56} cy={16.33} r={2.7} stroke={color} strokeWidth={1.3} fill="none" />
      <Path d="M11.17 14.12 L19.66 3.25" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M19.66 3.25 L22.03 5.1 L21.23 6.12 L20.36 5.44 L19.75 6.23 L20.61 6.91 L19.87 7.86 L17.51 6.01 Z" fill={color} />
      <Circle cx={9.44} cy={16.33} r={2.7} stroke={color} strokeWidth={1.3} fill="none" />
    </Svg>
  );
}

/**
 * Fight Club: each section is a reel. "Reel 2" typed small, the topic in typewriter bold, and in
 * the top corner a cue mark: the spot a projectionist watches for at a reel change, the "cigarette
 * burns". Some days one section reads "Changeover" instead. Nobody in the audience notices.
 */
function ReelHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = storiesLabel(count);
  const changeover = index != null && dayLuck(label, 1999) < 1 / 9;
  return (
    <View style={styles.left} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.reelTop}>
        {index != null ? (
          <Txt variant="kicker" tone="tertiary">
            {changeover ? 'Changeover' : `Reel ${index}`}
          </Txt>
        ) : (
          <View />
        )}
        <CueMark color={theme.colors.text} />
      </View>
      <View style={styles.row0}>
        <Txt variant="displayL" style={styles.shrink}>
          {label}
        </Txt>
        {countLabel && (
          <Txt variant="caption" tone="tertiary" style={styles.noShrink}>
            {countLabel}
          </Txt>
        )}
      </View>
    </View>
  );
}

// The burn's ragged outer edge and its paler middle.
const BURN_EDGE =
  'M12.78 7 C12.81 8.16 12.54 9.61 11.88 10.55 C11.22 11.48 9.95 12.23 8.82 12.6 C7.69 12.98 6.25 13.12 5.12 12.79 C3.99 12.45 2.69 11.55 2.06 10.59 C1.43 9.62 1.3 8.15 1.36 7 C1.43 5.85 1.86 4.71 2.48 3.71 C3.09 2.72 4.01 1.4 5.06 1.02 C6.11 0.65 7.69 1.06 8.79 1.49 C9.89 1.92 11.01 2.69 11.67 3.6 C12.34 4.52 12.74 5.84 12.78 7 Z';
const BURN_CORE =
  'M11.38 6.8 C11.36 7.73 11.03 8.83 10.46 9.54 C9.89 10.24 8.86 10.85 7.95 11.03 C7.04 11.21 5.8 11.06 5 10.6 C4.21 10.14 3.52 9.14 3.2 8.26 C2.88 7.37 2.74 6.09 3.09 5.3 C3.44 4.51 4.5 3.94 5.3 3.52 C6.11 3.1 7.03 2.71 7.91 2.78 C8.78 2.86 9.98 3.31 10.56 3.98 C11.14 4.65 11.4 5.87 11.38 6.8 Z';

/**
 * A reel-change cue mark, the "cigarette burn": a small pale spot with a ragged edge, as if punched
 * through the corner of the frame. Solid, so it reads as a mark rather than a button. It never moves.
 */
function CueMark({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d={BURN_EDGE} fill={color} fillOpacity={0.3} />
      <Path d={BURN_CORE} fill={color} fillOpacity={0.72} />
    </Svg>
  );
}

/**
 * Star Wars: the opening crawl's title card. A small "Episode IV" over the topic in crawl-yellow
 * capitals, centered. Sections that aren't topics (Also happening, Markets) have no episode line.
 */
function EpisodeHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const yellow = theme.colors.accent;
  const countLabel = storiesLabel(count);
  return (
    <View style={styles.center} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      {index != null && (
        <Txt variant="kicker" color={yellow} align="center" style={styles.episode}>
          Episode {roman(index)}
        </Txt>
      )}
      <Txt variant="displayL" color={yellow} align="center" style={styles.crawlTitle}>
        {label}
      </Txt>
      {countLabel && (
        <Txt variant="spaced" tone="tertiary" align="center" style={styles.below}>
          {countLabel}
        </Txt>
      )}
    </View>
  );
}

/**
 * Hogwarts: a chapter opening. "Chapter four" in small inscription capitals, the topic in Garamond
 * italic, a fine gold ornament, and the count spelled out like the rest of the page. Chapter one
 * (The Boy Who Lived, in the first book) has a small lightning bolt where the lozenge would be.
 */
function ChapterHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const gold = theme.colors.accent;
  const countText = count != null ? `${capitalize(spelled(count))} ${count === 1 ? 'story' : 'stories'}` : null;
  return (
    <View style={styles.center} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      {index != null && (
        <Txt variant="kicker" color={gold} align="center" style={styles.chapterKicker}>
          Chapter {spelled(index)}
        </Txt>
      )}
      <Txt variant="displayL" align="center">
        {label}
      </Txt>
      <Ornament color={gold} bolt={index === 1} />
      {countText && (
        <Txt variant="caption" tone="secondary" align="center" style={styles.chapterCount}>
          {countText}
        </Txt>
      )}
    </View>
  );
}

/** A fine rule broken by a small lozenge (or a bolt), with a dot either side, like a book's section mark. */
function Ornament({ color, bolt }: { color: string; bolt?: boolean }) {
  return (
    <Svg width={168} height={12} viewBox="0 0 168 12" style={styles.ornament}>
      <Path d="M4 6 H62" stroke={color} strokeWidth={0.9} strokeLinecap="round" opacity={0.75} />
      <Path d="M106 6 H164" stroke={color} strokeWidth={0.9} strokeLinecap="round" opacity={0.75} />
      {bolt ? (
        <Path d="M85.4 0.6 L81.4 6.7 H84.1 L82.6 11.4 L86.8 5.1 H84 Z" fill={color} />
      ) : (
        <Path d="M84 1.2 L88.8 6 L84 10.8 L79.2 6 Z" fill={color} />
      )}
      <Path d="M71 6 m-1.6 0 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0" fill={color} opacity={0.85} />
      <Path d="M97 6 m-1.6 0 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0" fill={color} opacity={0.85} />
    </Svg>
  );
}

/**
 * La La Land: a number in a musical's program. "Nº 3" in yellow art-deco capitals on a fine line
 * that runs to the story count, then the topic in italic display serif.
 */
function NumberHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = storiesLabel(count);
  return (
    <View style={styles.left} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.programRow}>
        {index != null && (
          <Txt variant="kicker" color={theme.colors.accent} style={styles.programNumber}>
            Nº {index}
          </Txt>
        )}
        <View style={[styles.programLine, { backgroundColor: theme.colors.hairline }]} />
        {countLabel && (
          <Txt variant="kicker" tone="tertiary">
            {countLabel}
          </Txt>
        )}
      </View>
      <Txt variant="displayL">{label}</Txt>
    </View>
  );
}

/**
 * Ghibli: the topic in soft rounded type with a short brushed wave under it, like wind in the grass.
 * Some days someone has dropped a couple of acorns at the end of the wave: a trail to follow.
 */
function MeadowHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = storiesLabel(count);
  const acorns = index != null && dayLuck(label, 1988) < 1 / 6;
  return (
    <View style={styles.left} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.meadowRow}>
        <Txt variant="displayL" style={styles.shrink}>
          {label}
        </Txt>
        {countLabel && (
          <Txt variant="caption" tone="tertiary">
            {countLabel}
          </Txt>
        )}
      </View>
      <View style={styles.waveRow}>
        <Svg width={58} height={10} viewBox="0 0 58 10">
          <Path
            d="M2.5 6.2 C 8 1.4, 12.5 1.4, 17.5 5.2 S 27 9.2, 32 5.2 S 41.5 1.2, 46.5 4.8 S 53 7.6, 55.5 5.6"
            stroke={theme.colors.inverseBg}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        {acorns && <Acorns />}
      </View>
    </View>
  );
}

/** One acorn in a 10 × 13.5 box: stem, cap, nut. */
function Acorn({ shine }: { shine?: boolean }) {
  return (
    <>
      <Path d="M5 0.7 L5.7 2.5" stroke="#5E4128" strokeWidth={1.1} strokeLinecap="round" />
      <Path d="M1.7 5.2 C1.7 8.6 3.2 11.6 5 12.8 C6.8 11.6 8.3 8.6 8.3 5.2 Z" fill="#A9713F" />
      <Path d="M0.7 5.6 C0.7 3.3 2.6 2 5 2 C7.4 2 9.3 3.3 9.3 5.6 C7 6.4 3 6.4 0.7 5.6 Z" fill="#6B4A2C" />
      {shine && (
        <Path
          d="M3.2 7.2 C3.3 8.7 3.8 9.9 4.5 10.7"
          stroke="#FFFFFF"
          strokeOpacity={0.35}
          strokeWidth={0.9}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </>
  );
}

/** Two acorns, one standing and one fallen on its side. */
function Acorns() {
  return (
    <Svg width={26} height={14} viewBox="0 0 26 14">
      <G transform="translate(0.4 0.4)">
        <Acorn shine />
      </G>
      <G transform="translate(19.2 10) rotate(-80) scale(0.78) translate(-5 -6.75)">
        <Acorn />
      </G>
    </Svg>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Section headings for the films themes, by theme name. Themes not listed use their built-in `layout.sections` style. */
export const filmHeadings: HeadingRegistry = {
  dune: DuneHeading,
  matrix: PromptHeading,
  tron: GridHeading,
  bladerunner: EsperHeading,
  budapest: KeysHeading,
  starwars: EpisodeHeading,
  hogwarts: ChapterHeading,
  lalaland: NumberHeading,
  ghibli: MeadowHeading,
  fightclub: ReelHeading,
};

const styles = StyleSheet.create({
  center: { paddingHorizontal: GUTTER + 4, alignItems: 'center' },
  left: { paddingHorizontal: GUTTER + 2 },
  shrink: { flexShrink: 1 },
  // Centered capitals: a left pad equal to the tracking keeps them optically centered.
  episode: { paddingLeft: 2.4, marginBottom: 6 },
  crawlTitle: { paddingLeft: 3 },
  below: { marginTop: 6 },
  chapterKicker: { paddingLeft: 2.2, marginBottom: 4 },
  ornament: { marginTop: 8, marginBottom: 8 },
  chapterCount: { fontFamily: 'EBGaramond_400Regular_Italic', fontSize: 15.5, lineHeight: 20 },
  programRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6, minHeight: 15 },
  programLine: { flex: 1, height: 1 },
  // Tight tracking keeps "Nº" reading as one sign.
  programNumber: { letterSpacing: 0.6, fontSize: 13 },
  meadowRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, marginLeft: 1, minHeight: 14 },
  noShrink: { flexShrink: 0 },
  // A title with its count on the right, sharing a baseline.
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingHorizontal: GUTTER + 2 },
  row0: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  // Dune: both sides are 10 high with their rule 1.5 from the bottom, so the two rules line up.
  dune: { gap: 10, paddingHorizontal: GUTTER },
  duneRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  duneSide: { flex: 1, height: 10, flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 1.5 },
  duneLine: { height: 1, flexGrow: 1 },
  duneLead: { flexGrow: 0.35 },
  duneLabel: { flexShrink: 1 },
  grid: { gap: 10, paddingHorizontal: GUTTER + 2 },
  trail: { flexDirection: 'row', alignItems: 'flex-start', height: 9 },
  trailLine: { flex: 1, height: 1, marginTop: 3.5 },
  esperRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6, minHeight: 15 },
  esperLine: { flex: 1, height: 1 },
  // Stands on the rule at its right end, rising into the space above the heading.
  unicorn: { position: 'absolute', right: 2, bottom: 7 },
  keys: { marginBottom: 8 },
  keysRow: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch' },
  keysLabel: { flexShrink: 1 },
  doubleLine: { flex: 1, height: 4, borderTopWidth: 1, borderBottomWidth: 1 },
  reelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 15, marginBottom: 4 },
});
