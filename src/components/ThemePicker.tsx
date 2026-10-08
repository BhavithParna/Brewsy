import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Txt } from './Txt';
import { openLink } from '@/lib/links';
import { useTheme } from '@/theme/ThemeProvider';
import { THEME_ORDER, themeRadius, themes } from '@/theme/themes';
import { radii, withAlpha } from '@/theme/tokens';

const TILE_W = 112;
const TILE_H = 168;
/** Horizontal padding of the Settings card this sits in. */
const CARD_PAD = 16;

/** A row of photo tiles, one per theme, plus the credit for the chosen photo. */
export function ThemePicker() {
  const { theme, setThemeName } = useTheme();
  const { credit } = theme;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Reach the card's edges so tiles scroll right up to them.
        style={styles.bleed}
        contentContainerStyle={styles.row}>
        {THEME_ORDER.map((name) => {
          const t = themes[name];
          const selected = theme.name === name;
          return (
            <PressableScale
              key={name}
              onPress={() => setThemeName(name)}
              scaleTo={0.96}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${t.label} theme. ${t.tagline}`}>
              <View
                style={[
                  styles.tile,
                  {
                    backgroundColor: t.colors.bg,
                    borderColor: selected ? theme.colors.text : theme.colors.glassBorder,
                    borderRadius: themeRadius(t, radii.md),
                  },
                  selected && styles.tileSelected,
                ]}>
                {/* A tiny preview of the theme: its photo dissolving into its own background. */}
                <Image source={t.cover} style={styles.photo} contentFit="cover" accessible={false} />
                <LinearGradient
                  colors={[withAlpha(t.background[0], 0), t.background[0]]}
                  locations={[0.35, 1]}
                  style={styles.photo}
                />
                {selected && (
                  <View style={[styles.check, { backgroundColor: t.colors.inverseBg }]}>
                    <Check size={13} color={t.colors.inverseText} strokeWidth={3} />
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.name,
                    t.type.displayL,
                    // Wide capitals (Dune) need a smaller size to fit the tile.
                    t.type.displayL?.textTransform === 'uppercase' ? styles.nameCaps : styles.nameSize,
                    { color: t.colors.text },
                  ]}>
                  {t.label}
                </Text>
                <View style={[styles.swatch, { backgroundColor: t.colors.accent }]} />
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      <Txt variant="bodySm" tone="secondary">
        {theme.tagline}
      </Txt>
      <Pressable onPress={() => openLink(credit.url)} accessibilityRole="link" hitSlop={6}>
        <Txt variant="caption" tone="tertiary">
          Photo: “{credit.title}” by {credit.author} · {credit.license}
          {credit.adapted ? ' · cropped and recolored' : ''}
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingVertical: 16 },
  bleed: { marginHorizontal: -CARD_PAD, marginBottom: 6 },
  row: { gap: 10, paddingHorizontal: CARD_PAD },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  photo: { position: 'absolute', left: 0, right: 0, top: 0, height: '78%' },
  nameSize: { fontSize: 20, lineHeight: 24 },
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
});
