import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Pill } from './Pill';
import { PressableScale } from './PressableScale';
import { Divider } from './settings/SettingsParts';
import { Txt } from './Txt';
import { Tap } from '@/components/Tap';
import { openLink } from '@/lib/links';
import { updateSettings, useSettings, type Settings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { THEME_GROUPS, THEME_ORDER, themeRadius, themes, usePackFonts, type Theme, type ThemeGroup } from '@/theme/themes';
import { TAP, capsLabel, radii, withAlpha } from '@/theme/tokens';

const TILE_W = 112;
const TILE_H = 168;
const TILE_GAP = 10;
/** Horizontal padding of the Settings card this sits in. */
const CARD_PAD = 16;

const APPEARANCES: { id: Settings['glassAppearance']; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto' },
];

/**
 * Classic · Films · Horror · Custom, a row of cover tiles for the chosen group, and the credit for the
 * chosen cover. Opens on the group of the current theme. Glass adds its light / dark / auto choice.
 */
export function ThemePicker() {
  const { theme, setThemeName } = useTheme();
  usePackFonts(); // tiles show each theme's own type
  const { credit } = theme;
  const [group, setGroup] = useState<ThemeGroup>(theme.group);
  const names = THEME_ORDER.filter((n) => themes[n].group === group);
  const row = useRef<ScrollView>(null);

  // Bring the current theme into view when its group shows (it may sit far along the row).
  const selectedIndex = names.indexOf(theme.name);
  useEffect(() => {
    const x = selectedIndex > 1 ? (selectedIndex - 1) * (TILE_W + TILE_GAP) : 0;
    row.current?.scrollTo({ x, animated: false });
    // Only when the group changes, not on every theme tap (that would jump the row under your finger).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  return (
    <View style={styles.wrap}>
      <GroupSwitch value={group} onChange={setGroup} />

      <ScrollView
        ref={row}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Reach the card's edges so tiles scroll right up to them.
        style={styles.bleed}
        contentContainerStyle={styles.row}>
        {names.map((name) => {
          // Glass has one tile for both looks: it shows the one in use.
          const t = theme.name === name ? theme : themes[name];
          return (
            <ThemeTile
              key={name}
              t={t}
              selected={theme.name === name}
              borderColor={theme.colors.glassBorder}
              selectedColor={theme.colors.text}
              onPress={() => setThemeName(name)}
            />
          );
        })}
      </ScrollView>

      <Txt variant="bodySm" tone="secondary">
        {theme.tagline}
      </Txt>
      {credit ? (
        <Tap onPress={() => openLink(credit.url)} accessibilityRole="link" hitSlop={6}>
          <Txt variant="caption" tone="tertiary">
            {'film' in credit ? (
              `Still from ${credit.film} · © ${credit.owner}`
            ) : (
              <>
                Photo: “{credit.title}” by {credit.author} · {credit.license}
                {credit.adapted ? ' · cropped and recolored' : ''}
              </>
            )}
          </Txt>
        </Tap>
      ) : (
        <Txt variant="caption" tone="tertiary">
          Cover: original artwork made for Brewsy
        </Txt>
      )}

      {theme.name === 'glass' && <GlassAppearance />}
    </View>
  );
}

/** Classic · Films · Horror · Custom, as a segmented control in the theme's shape. */
export function GroupSwitch({ value, onChange }: { value: ThemeGroup; onChange: (g: ThemeGroup) => void }) {
  const { theme } = useTheme();
  const control = theme.shape.control;
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.segments,
        {
          backgroundColor: withAlpha(theme.colors.text.slice(0, 7), theme.isDark ? 0.08 : 0.06),
          borderColor: theme.colors.hairline,
          borderRadius: control,
        },
      ]}>
      {GROUPS.map((g) => {
        const active = g.id === value;
        return (
          <PressableScale
            key={g.id}
            onPress={() => onChange(g.id)}
            scaleTo={0.96}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${g.label} themes`}
            hitSlop={{ top: (TAP - SEGMENT_H) / 2, bottom: (TAP - SEGMENT_H) / 2 }}
            style={[
              styles.segment,
              { borderRadius: Math.max(0, control - 3) },
              active && { backgroundColor: theme.colors.inverseBg },
            ]}>
            <Txt
              variant="label"
              tone={active ? 'inverse' : 'secondary'}
              numberOfLines={1}
              style={theme.layout.capsButtons && [capsLabel, styles.capsTight]}>
              {g.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

const SEGMENT_H = 34;

/** Groups that have at least one theme. */
const GROUPS = THEME_GROUPS.filter((g) => THEME_ORDER.some((n) => themes[n].group === g.id));

/** A tiny preview of a theme: its cover dissolving into its own background, its name in its own type. */
function ThemeTile({
  t,
  selected,
  borderColor,
  selectedColor,
  onPress,
}: {
  t: Theme;
  selected: boolean;
  borderColor: string;
  selectedColor: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${t.label} theme. ${t.tagline}`}>
      <View
        style={[
          styles.tile,
          {
            backgroundColor: t.colors.bg,
            borderColor: selected ? selectedColor : borderColor,
            borderRadius: themeRadius(t, radii.md),
          },
          selected && styles.tileSelected,
        ]}>
        {t.backdrop ? (
          // A wallpaper is soft all the way down, so it fills the tile as it is.
          <Image source={t.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        ) : (
          <>
            <Image source={t.cover} style={styles.photo} contentFit="cover" accessible={false} />
            <LinearGradient
              colors={[withAlpha(t.background[0], 0), t.background[0]]}
              locations={[0.35, 1]}
              style={styles.photo}
            />
          </>
        )}
        {selected && (
          <View style={[styles.check, { backgroundColor: t.colors.inverseBg }]}>
            <Check size={13} color={t.colors.inverseText} strokeWidth={3} />
          </View>
        )}
        {/* Two-word names (Blade Runner) wrap at the space rather than shrinking to nothing. */}
        <Text
          numberOfLines={t.label.includes(' ') ? 2 : 1}
          adjustsFontSizeToFit
          style={[
            styles.name,
            t.type.displayL,
            // Wide capitals (Dune, Tron) need a smaller size to fit the tile.
            t.type.displayL?.textTransform === 'uppercase' ? styles.nameCaps : styles.nameSize,
            // Long one-word names (Highlands, Midsommar) step down a size rather than relying on
            // shrink-to-fit, which the web preview doesn't do.
            !t.label.includes(' ') && t.label.length > 8 && t.type.displayL?.textTransform !== 'uppercase' && styles.nameLong,
            { color: t.colors.text },
          ]}>
          {t.label}
        </Text>
        <View style={[styles.swatch, { backgroundColor: t.colors.accent }]} />
      </View>
    </PressableScale>
  );
}

/** Glass only: always light, always dark, or light by day and dark at night. */
function GlassAppearance() {
  const { theme } = useTheme();
  const { glassAppearance } = useSettings();
  return (
    <>
      <Divider />
      <View style={styles.appearance}>
        <Txt variant="label">Appearance</Txt>
        <View style={styles.pills} accessibilityRole="radiogroup">
          {APPEARANCES.map((o) => {
            const on = glassAppearance === o.id;
            return (
              <Pill
                key={o.id}
                label={o.label}
                size="md"
                variant={on ? 'solid' : 'glass'}
                color={theme.colors.inverseBg}
                selected={on}
                onPress={() => updateSettings({ glassAppearance: o.id })}
                accessibilityLabel={`${o.label} appearance`}
              />
            );
          })}
        </View>
        <Txt variant="bodySm" tone="tertiary">
          Auto is light from 7 am to 7 pm and dark at night.
        </Txt>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingVertical: 16 },
  segments: { flexDirection: 'row', padding: 3, gap: 2, borderWidth: 1, marginBottom: 8 },
  // Each tab as wide as its label (then sharing what's left), so four still fit in wide capitals.
  segment: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', height: SEGMENT_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  capsTight: { letterSpacing: 1 },
  bleed: { marginHorizontal: -CARD_PAD, marginBottom: 6 },
  row: { gap: TILE_GAP, paddingHorizontal: CARD_PAD },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  photo: { position: 'absolute', left: 0, right: 0, top: 0, height: '78%' },
  nameSize: { fontSize: 20, lineHeight: 24 },
  nameLong: { fontSize: 17, lineHeight: 24 },
  nameCaps: { fontSize: 13, lineHeight: 24, letterSpacing: 2 },
  swatch: { position: 'absolute', left: 12, bottom: 10, width: 16, height: 3, borderRadius: 2 },
  tileSelected: { borderWidth: 2 },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { paddingHorizontal: 12, paddingBottom: 20, includeFontPadding: false },
  appearance: { gap: 12, paddingTop: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
