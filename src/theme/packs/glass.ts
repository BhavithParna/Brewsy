// Glass: Apple-style liquid glass, in light and dark.
// Each theme is a whole look (typefaces, shapes, card style, sections), like the ones in ../themes.ts.
//
// A soft wallpaper sits fixed behind every screen (original art, assets/themes/glass-*.jpg) and the
// top of Today is the wallpaper itself. Cards are frosted panes with a bright top rim; buttons and
// chips are glass capsules. Type is Inter, set like the system font: bold large titles, semibold
// headlines, sentence-case labels. One iOS-blue accent.
//
// Readability comes first: Android can't blur behind cards, so each fill is opaque enough to read on
// by itself. Where real blur exists (iOS, web), the panes get a little clearer.
//
// Both variants are named 'glass'. The picker shows one tile; ThemeProvider picks light or dark from
// Settings → Theme → Appearance (light, dark, or auto: light from 7:00 to 18:59).

import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import type { FontSource } from 'expo-font';
import type { TextStyle } from 'react-native';

import type { Theme, TxtVariant } from '../themes';

// Inter at display sizes tracks tighter, the way the system font's display cut does.
// Kickers and section labels stay in sentence case (textTransform none overrides Txt's capitals).
const type: Partial<Record<TxtVariant, TextStyle>> = {
  displayXL: { fontFamily: 'Inter_700Bold', fontSize: 54, lineHeight: 64, letterSpacing: -1.5 },
  displayL: { fontFamily: 'Inter_700Bold', fontSize: 31, lineHeight: 38, letterSpacing: -0.8 },
  displayM: { fontFamily: 'Inter_600SemiBold', fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  displayS: { fontFamily: 'Inter_500Medium', fontSize: 17, lineHeight: 24, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  stat: { fontFamily: 'Inter_600SemiBold', fontSize: 48, lineHeight: 58, letterSpacing: -1.8 },
  mega: { fontFamily: 'Inter_800ExtraBold', fontSize: 76, lineHeight: 90, letterSpacing: -2.6 },
  headline: { fontFamily: 'Inter_600SemiBold', fontSize: 20.5, lineHeight: 27, letterSpacing: -0.45 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  reading: { fontFamily: 'Inter_400Regular', fontSize: 16.5, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  bodySm: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18.5, letterSpacing: -0.05 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 12.5, lineHeight: 16, letterSpacing: -0.05 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 17, letterSpacing: -0.1, textTransform: 'none' },
  spaced: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, lineHeight: 16, letterSpacing: 0.7 },
};

const shared = {
  name: 'glass',
  label: 'Glass',
  group: 'classic',
  tagline: 'Frosted panes on a soft wallpaper, light or dark',
  credit: null,
  type,
  // Generous corners: story cards come out around 35pt, chips and buttons are capsules.
  shape: { scale: 1.15, control: 999 },
  surface: 'glass',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  // A frosted pane like the Listen tile, the count in the accent blue (as a system widget would).
  leadTile: 'card',
} as const satisfies Partial<Theme>;

const LIGHT_ART = require('../../../assets/themes/glass-light.jpg');
const DARK_ART = require('../../../assets/themes/glass-dark.jpg');

export const glassLight: Theme = {
  ...shared,
  isDark: false,
  blurTint: 'light',
  blurIntensity: 50,
  cover: LIGHT_ART,
  backdrop: LIGHT_ART,
  // The wallpaper's colors, for the moment before it loads. The first is its flat top edge.
  background: ['#E3EBF8', '#C9C6F2', '#F4CDD6'],
  liquid: {
    cardRim: { top: 'rgba(255, 255, 255, 0.96)', side: 'rgba(255, 255, 255, 0.62)', bottom: 'rgba(255, 255, 255, 0.34)' },
    // White on top; a faint shade below so a chip still has an edge on a white card.
    controlRim: { top: 'rgba(255, 255, 255, 0.95)', side: 'rgba(13, 17, 28, 0.08)', bottom: 'rgba(13, 17, 28, 0.13)' },
    cardOverBlur: 'rgba(255, 255, 255, 0.56)',
    cardShadow: '0px 10px 30px rgba(52, 60, 120, 0.10), 0px 1px 3px rgba(52, 60, 120, 0.06)',
    controlShadow: '0px 2px 8px rgba(40, 48, 100, 0.08)',
  },
  colors: {
    bg: '#E3EBF8',
    card: 'rgba(255, 255, 255, 0.70)',
    cardBorder: 'rgba(255, 255, 255, 0.62)',
    text: '#0D111C',
    textSecondary: 'rgba(13, 17, 28, 0.72)',
    textTertiary: 'rgba(13, 17, 28, 0.62)',
    glassFill: 'rgba(255, 255, 255, 0.46)',
    glassOverlay: 'rgba(255, 255, 255, 0.40)',
    glassFillFallback: 'rgba(255, 255, 255, 0.72)',
    glassOverlayFallback: 'rgba(255, 255, 255, 0.58)',
    glassBorder: 'rgba(13, 17, 28, 0.12)',
    onCover: '#0D111C',
    sheet: '#F1F3F9',
    hairline: 'rgba(13, 17, 28, 0.08)',
    skeleton: 'rgba(13, 17, 28, 0.06)',
    skeletonHighlight: 'rgba(13, 17, 28, 0.11)',
    // A shade deeper than the system blue, so it reads as text on a frosted card too.
    accent: '#0062E0',
    accentInk: '#FFFFFF',
    up: '#13793F',
    down: '#C42D25',
    inverseBg: '#0D111C',
    inverseText: '#FFFFFF',
  },
};

export const glassDark: Theme = {
  ...shared,
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 50,
  cover: DARK_ART,
  backdrop: DARK_ART,
  background: ['#080C1D', '#1A1A4A', '#0E2C3C'],
  liquid: {
    cardRim: { top: 'rgba(255, 255, 255, 0.30)', side: 'rgba(255, 255, 255, 0.13)', bottom: 'rgba(255, 255, 255, 0.07)' },
    controlRim: { top: 'rgba(255, 255, 255, 0.32)', side: 'rgba(255, 255, 255, 0.15)', bottom: 'rgba(255, 255, 255, 0.09)' },
    cardOverBlur: 'rgba(20, 24, 44, 0.50)',
    cardShadow: '0px 12px 32px rgba(0, 0, 0, 0.30)',
    controlShadow: '0px 2px 10px rgba(0, 0, 0, 0.22)',
  },
  colors: {
    bg: '#080C1D',
    card: 'rgba(18, 22, 42, 0.64)',
    cardBorder: 'rgba(255, 255, 255, 0.13)',
    text: '#F3F5FB',
    textSecondary: 'rgba(243, 245, 251, 0.74)',
    textTertiary: 'rgba(243, 245, 251, 0.56)',
    glassFill: 'rgba(48, 54, 90, 0.38)',
    glassOverlay: 'rgba(40, 46, 82, 0.34)',
    glassFillFallback: 'rgba(36, 42, 74, 0.80)',
    glassOverlayFallback: 'rgba(30, 36, 68, 0.64)',
    glassBorder: 'rgba(255, 255, 255, 0.16)',
    onCover: '#F3F5FB',
    sheet: '#10142A',
    hairline: 'rgba(255, 255, 255, 0.09)',
    skeleton: 'rgba(255, 255, 255, 0.06)',
    skeletonHighlight: 'rgba(255, 255, 255, 0.12)',
    // The system's accessible dark-mode blue: legible as text on a dark pane, with deep navy on it.
    accent: '#409CFF',
    accentInk: '#04142E',
    up: '#4CD388',
    down: '#FF6B61',
    inverseBg: '#F3F5FB',
    inverseText: '#0B0F22',
  },
};

/** In picker order. One tile: the light variant stands for both (see ThemeProvider). */
export const glassThemes: Theme[] = [glassLight];

/** Every typeface these themes use, by the fontFamily name the themes refer to. */
export const glassFonts: Record<string, FontSource> = {
  // Inter 300–700 are loaded in app/_layout.tsx with the classic themes.
  Inter_800ExtraBold,
};
