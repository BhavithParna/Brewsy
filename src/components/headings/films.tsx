import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Txt } from '../Txt';
import type { HeadingProps, HeadingRegistry } from './types';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER } from '@/theme/tokens';

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
 * italic, a fine gold ornament, and the count spelled out like the rest of the page.
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
      <Ornament color={gold} />
      {countText && (
        <Txt variant="caption" tone="secondary" align="center" style={styles.chapterCount}>
          {countText}
        </Txt>
      )}
    </View>
  );
}

/** A fine rule broken by a small lozenge, with a dot either side, like a book's section mark. */
function Ornament({ color }: { color: string }) {
  return (
    <Svg width={168} height={12} viewBox="0 0 168 12" style={styles.ornament}>
      <Path d="M4 6 H62" stroke={color} strokeWidth={0.9} strokeLinecap="round" opacity={0.75} />
      <Path d="M106 6 H164" stroke={color} strokeWidth={0.9} strokeLinecap="round" opacity={0.75} />
      <Path d="M84 1.2 L88.8 6 L84 10.8 L79.2 6 Z" fill={color} />
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

/** Ghibli: the topic in soft rounded type with a short brushed wave under it, like wind in the grass. */
function MeadowHeading({ label, count }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = storiesLabel(count);
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
      <Svg width={58} height={10} viewBox="0 0 58 10" style={styles.wave}>
        <Path
          d="M2.5 6.2 C 8 1.4, 12.5 1.4, 17.5 5.2 S 27 9.2, 32 5.2 S 41.5 1.2, 46.5 4.8 S 53 7.6, 55.5 5.6"
          stroke={theme.colors.inverseBg}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Section headings for the films themes, by theme name. Themes not listed use their built-in `layout.sections` style. */
export const filmHeadings: HeadingRegistry = {
  starwars: EpisodeHeading,
  hogwarts: ChapterHeading,
  lalaland: NumberHeading,
  ghibli: MeadowHeading,
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
  wave: { marginTop: 4, marginLeft: 1 },
});
