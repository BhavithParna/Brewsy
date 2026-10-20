import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Txt } from '../Txt';
import type { HeadingProps, HeadingRegistry } from './types';
import { useRadius, useTheme } from '@/theme/ThemeProvider';
import { GUTTER, radii } from '@/theme/tokens';

function storiesLabel(count?: number): string | null {
  return count != null ? `${count} ${count === 1 ? 'story' : 'stories'}` : null;
}

function a11yLabel(label: string, count?: number): string {
  const c = storiesLabel(count);
  return c ? `${label}, ${c}` : label;
}

/** 3 -> "03" */
function two(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Space: month cards ───────────────────────────────────────────────────────

/**
 * Space: each topic opens on a photo card, like a page of a photo calendar. The section number and
 * story count run along the top in mono, joined by a fine line; the topic sits across the foot as one
 * giant word. Other sections get the title over a mono readout line.
 */
function SpaceHeading({ label, count, cover, imageUrl, index }: HeadingProps) {
  const { theme } = useTheme();
  const radius = useRadius();
  const { width } = useWindowDimensions();
  const countLabel = storiesLabel(count);

  if (cover) {
    // The giant word fills the card but never runs off it: long topics ("Entertainment") step down.
    // (adjustsFontSizeToFit does the same on phones; this keeps the web preview honest too.)
    const designed = theme.type.mega?.fontSize ?? 80;
    const room = Math.min(width, 560) - GUTTER * 2 - SPACE_PAD * 2;
    const size = Math.min(designed, Math.floor(room / (label.length * 0.6)));
    const fitted = {
      fontSize: size,
      lineHeight: Math.round(size * 1.18),
      letterSpacing: ((theme.type.mega?.letterSpacing as number | undefined) ?? -3) * (size / designed),
    };
    return (
      <View style={styles.pad} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
        <View style={[styles.spaceCard, { borderRadius: radius(radii.xl), borderColor: theme.colors.cardBorder }]}>
          <Image
            source={imageUrl ? { uri: imageUrl } : theme.cover}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            accessible={false}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0.24)', 'rgba(0,0,0,0.78)']}
            locations={[0, 0.32, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.spaceTop}>
            {index != null && (
              <Txt variant="kicker" color="#FFFFFF">
                {two(index)}
              </Txt>
            )}
            <View style={styles.spaceTopLine} />
            {countLabel && (
              <Txt variant="kicker" color="rgba(255, 255, 255, 0.88)">
                {countLabel}
              </Txt>
            )}
          </View>
          <Txt variant="mega" color="#FFFFFF" numberOfLines={1} adjustsFontSizeToFit style={[styles.spaceWord, fitted]}>
            {label}
          </Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.spacePlain} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <Txt variant="displayL" numberOfLines={2}>
        {label}
      </Txt>
      <View style={styles.readout}>
        {countLabel && (
          <Txt variant="kicker" tone="tertiary">
            {countLabel}
          </Txt>
        )}
        <View style={[styles.flexLine, { backgroundColor: theme.colors.hairline }]} />
      </View>
    </View>
  );
}

// ─── Atlantis: a depth gauge ──────────────────────────────────────────────────

/** Each topic is a little deeper than the last. */
const METRES_PER_SECTION = 40;

/** A small dive-gauge dial; the needle turns a step further for each section. */
function DepthDial({ step, ring, needle }: { step: number; ring: string; needle: string }) {
  // 0 sits at seven o'clock, the way a gauge starts; each section turns the needle 30°, up to five o'clock.
  const deg = -135 + Math.min(9, Math.max(1, step)) * 30;
  const rad = (deg * Math.PI) / 180;
  const x = 8 + 5.4 * Math.sin(rad);
  const y = 8 - 5.4 * Math.cos(rad);
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Circle cx={8} cy={8} r={7} stroke={ring} strokeWidth={1} fill="none" />
      <Line x1={8} y1={8} x2={x} y2={y} stroke={needle} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={8} cy={8} r={1.4} fill={needle} />
    </Svg>
  );
}

/**
 * Atlantis: the topic in large italic serif, with a quiet line under it like a caption on an old
 * chart: a depth gauge reading (40 m, 80 m… as the edition goes deeper) and the story count.
 */
function AtlantisHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = storiesLabel(count);
  const depth = index != null ? index * METRES_PER_SECTION : null;
  return (
    <View style={styles.left} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <Txt variant="displayL" numberOfLines={2}>
        {label}
      </Txt>
      {(depth != null || countLabel) && (
        <View style={styles.gaugeRow}>
          {depth != null && (
            <>
              <DepthDial step={index ?? 1} ring={theme.colors.textTertiary} needle={theme.colors.accent} />
              <Txt variant="caption" color={theme.colors.accent} style={styles.tabular}>
                {`${depth} m`}
              </Txt>
              {countLabel && <View style={[styles.gaugeTick, { backgroundColor: theme.colors.hairline }]} />}
            </>
          )}
          {countLabel && (
            <Txt variant="caption" tone="tertiary">
              {countLabel}
            </Txt>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Highlands: a trail marker ────────────────────────────────────────────────

/** A waymarker disc, the kind nailed to a post where a path turns. */
function Waymark({ fill, ink }: { fill: string; ink: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={10} fill={fill} />
      <Path d="M6.2 13.8 L13.4 6.6 M8.4 6.4 H13.6 V11.6" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/**
 * Highlands: a waymarker disc and "Stage 2 · 4 stories", like the sign at the start of a stretch of
 * trail, over the topic in bold italic.
 */
function HighlandsHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = storiesLabel(count);
  return (
    <View style={styles.left} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={styles.markRow}>
        <Waymark fill={theme.colors.accent} ink={theme.colors.accentInk} />
        {index != null && (
          <Txt variant="kicker" color={theme.colors.accent}>
            {`Stage ${index}`}
          </Txt>
        )}
        {index != null && countLabel && (
          <Txt variant="kicker" tone="tertiary">
            ·
          </Txt>
        )}
        {countLabel && (
          <Txt variant="kicker" tone="secondary">
            {countLabel}
          </Txt>
        )}
      </View>
      <Txt variant="displayL" numberOfLines={2}>
        {label}
      </Txt>
    </View>
  );
}

// ─── Alpine: Swiss grid ───────────────────────────────────────────────────────

/**
 * Alpine: a Swiss poster's grid. A heavy black rule across the column, the section number in red at
 * the left and the count at the right, then the topic in tight bold grotesk.
 */
function AlpineHeading({ label, count, index }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = storiesLabel(count);
  return (
    <View style={styles.swiss} accessible accessibilityRole="header" accessibilityLabel={a11yLabel(label, count)}>
      <View style={[styles.swissRule, { backgroundColor: theme.colors.text }]} />
      {index != null || countLabel ? (
        <View style={styles.swissRow}>
          <Txt variant="kicker" color={theme.colors.accent} style={styles.tabular}>
            {index != null ? two(index) : ''}
          </Txt>
          {countLabel && (
            <Txt variant="kicker" tone="secondary">
              {countLabel}
            </Txt>
          )}
        </View>
      ) : (
        <View style={styles.swissGap} />
      )}
      <Txt variant="displayL" numberOfLines={2}>
        {label}
      </Txt>
    </View>
  );
}

/** Section headings for the classic themes in themes.ts, by theme name. (Glass has its own, in glass.tsx.) */
export const classicHeadings: HeadingRegistry = {
  space: SpaceHeading,
  atlantis: AtlantisHeading,
  highlands: HighlandsHeading,
  alpine: AlpineHeading,
};

const SPACE_PAD = 18;

const styles = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER },
  left: { paddingHorizontal: GUTTER + 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  flexLine: { flex: 1, height: 1 },

  spaceCard: { height: 200, overflow: 'hidden', borderWidth: 1, justifyContent: 'flex-end' },
  spaceTop: {
    position: 'absolute',
    top: 16,
    left: SPACE_PAD,
    right: SPACE_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spaceTopLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.32)' },
  spaceWord: { paddingHorizontal: SPACE_PAD, paddingBottom: 6 },
  spacePlain: { paddingHorizontal: GUTTER + 2, gap: 8 },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 14 },

  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  gaugeTick: { width: 14, height: 1, marginHorizontal: 2 },

  markRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },

  swiss: { paddingHorizontal: GUTTER + 2 },
  swissRule: { height: 3 },
  swissRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  swissGap: { height: 10 },
});
