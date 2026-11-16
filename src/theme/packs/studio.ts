// Four more looks in the Custom group, each after a reference picture the owner chose. All four
// covers are original art made for Brewsy (no photos, no brands), so none carries a credit.
//
//   Pixel Sky   cream pixel-art clouds on a grey-teal sky, fixed behind the page like a wallpaper.
//               Cream cards, black chrome, the date and numbers in a bitmap face.
//   Console     a greige hardware panel: a green scope screen, dark knobs, stamped capitals.
//               Squared-off cards with crisp borders; the stories tile is the scope's green.
//   Nightfall   slate navy with one warm tan, soft rounded type and corners, a few small stars.
//   Mirage      a desert at dusk in pinks and sand, light geometric type, round controls and one
//               dark tile.
//
// Reading text sits on solid cards in every one of them.

import { ArchivoNarrow_400Regular } from '@expo-google-fonts/archivo-narrow/400Regular';
import { ArchivoNarrow_600SemiBold } from '@expo-google-fonts/archivo-narrow/600SemiBold';
import { ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow/700Bold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { Jost_300Light } from '@expo-google-fonts/jost/300Light';
import { Jost_400Regular } from '@expo-google-fonts/jost/400Regular';
import { Jost_500Medium } from '@expo-google-fonts/jost/500Medium';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { VT323_400Regular } from '@expo-google-fonts/vt323/400Regular';
import type { FontSource } from 'expo-font';

import type { Theme } from '../themes';

// ─── Pixel Sky ────────────────────────────────────────────────────────────────
const pixelsky: Theme = {
  name: 'pixelsky',
  label: 'Pixel Sky',
  group: 'custom',
  tagline: 'Pixel clouds, cream cards, black chrome',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 40,
  cover: require('../../../assets/themes/pixelsky.jpg'),
  // A quieter sky than the cover, with the clouds low, fixed behind every screen.
  backdrop: require('../../../assets/themes/pixelsky-sky.jpg'),
  credit: null,
  background: ['#92A6AA', '#869BA0', '#7A9096'],
  type: {
    // VT323 runs small and narrow for its point size, so it's set larger than the other themes' display type.
    displayXL: { fontFamily: 'VT323_400Regular', fontSize: 88, lineHeight: 102, letterSpacing: 0 },
    displayL: { fontFamily: 'VT323_400Regular', fontSize: 50, lineHeight: 58, letterSpacing: 0 },
    displayM: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
    displayS: { fontFamily: 'VT323_400Regular', fontSize: 30, lineHeight: 35, letterSpacing: 0 },
    stat: { fontFamily: 'VT323_400Regular', fontSize: 68, lineHeight: 78, letterSpacing: 0 },
    mega: { fontFamily: 'VT323_400Regular', fontSize: 112, lineHeight: 130, letterSpacing: 0 },
    headline: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 21.5, lineHeight: 27.5, letterSpacing: -0.3 },
    title: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 17, lineHeight: 22 },
    label: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14.5, lineHeight: 19 },
    kicker: { fontFamily: 'SpaceMono_400Regular', fontSize: 10.5, lineHeight: 14, letterSpacing: 1.2 },
    spaced: { fontFamily: 'SpaceMono_400Regular', fontSize: 11.5, lineHeight: 16, letterSpacing: 3 },
  },
  shape: { scale: 0.75, control: 12 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  leadTile: { fill: '#0F1314', ink: '#F6F0DF' },
  lines: {
    signOff: 'Sky’s clear. Go outside.',
    brewing: 'Rendering the morning',
    emptySaved: 'Nothing saved to disk yet',
    noResults: 'Nothing on this map',
  },
  colors: {
    bg: '#92A6AA',
    card: '#F6F0DF',
    cardBorder: 'rgba(15, 21, 22, 0.10)',
    text: '#0F1516',
    // Small text can sit straight on the sky, so the second and third tones stay dark.
    textSecondary: 'rgba(15, 21, 22, 0.90)',
    textTertiary: 'rgba(15, 21, 22, 0.84)',
    glassFill: 'rgba(246, 240, 223, 0.66)',
    glassOverlay: 'rgba(246, 240, 223, 0.58)',
    glassFillFallback: 'rgba(246, 240, 223, 0.92)',
    glassOverlayFallback: 'rgba(246, 240, 223, 0.84)',
    glassBorder: 'rgba(15, 21, 22, 0.14)',
    onCover: '#0F1516',
    sheet: '#F3EDDD',
    hairline: 'rgba(15, 21, 22, 0.10)',
    skeleton: 'rgba(15, 21, 22, 0.06)',
    skeletonHighlight: 'rgba(15, 21, 22, 0.11)',
    accent: '#1D5661',
    accentInk: '#FFFFFF',
    up: '#1E6B45',
    down: '#A8402E',
    inverseBg: '#0F1314',
    inverseText: '#F6F0DF',
  },
};

// ─── Console ──────────────────────────────────────────────────────────────────
const consoleTheme: Theme = {
  name: 'console',
  label: 'Console',
  group: 'custom',
  tagline: 'A hardware panel: scope green, stamped capitals',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 30,
  cover: require('../../../assets/themes/console.jpg'),
  credit: null,
  background: ['#B8B0A0', '#ADA595'],
  type: {
    displayXL: { fontFamily: 'ArchivoNarrow_700Bold', fontSize: 62, lineHeight: 72, letterSpacing: 1, textTransform: 'uppercase' },
    displayL: { fontFamily: 'ArchivoNarrow_700Bold', fontSize: 36, lineHeight: 43, letterSpacing: 0.8, textTransform: 'uppercase' },
    displayM: { fontFamily: 'ArchivoNarrow_600SemiBold', fontSize: 22, lineHeight: 28, letterSpacing: 0.6, textTransform: 'uppercase' },
    displayS: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 21, lineHeight: 27 },
    stat: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 46, lineHeight: 56, letterSpacing: -1.5 },
    mega: { fontFamily: 'ArchivoNarrow_700Bold', fontSize: 84, lineHeight: 98, letterSpacing: 1, textTransform: 'uppercase' },
    headline: { fontFamily: 'ArchivoNarrow_600SemiBold', fontSize: 23.5, lineHeight: 29, letterSpacing: 0.1 },
    title: { fontFamily: 'ArchivoNarrow_600SemiBold', fontSize: 18, lineHeight: 23 },
    label: { fontFamily: 'ArchivoNarrow_600SemiBold', fontSize: 15.5, lineHeight: 19, letterSpacing: 0.5 },
    caption: { fontFamily: 'IBMPlexMono_400Regular', fontSize: 11.5, lineHeight: 16, letterSpacing: 0 },
    kicker: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 10.5, lineHeight: 14, letterSpacing: 1.6 },
    spaced: { fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, lineHeight: 16, letterSpacing: 3.4 },
  },
  shape: { scale: 0.45, control: 6 },
  surface: 'outline',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: true },
  // The scope screen: phosphor green on dark green.
  leadTile: { fill: '#35522A', ink: '#C6F5A0' },
  lines: {
    signOff: 'Signal ends. Power down.',
    brewing: 'Warming up',
    emptySaved: 'No tapes on the shelf',
    noResults: 'No signal on that band',
  },
  colors: {
    bg: '#B8B0A0',
    card: '#D5CEC0',
    cardBorder: 'rgba(30, 29, 26, 0.30)',
    text: '#1E1D1A',
    textSecondary: 'rgba(30, 29, 26, 0.88)',
    textTertiary: 'rgba(30, 29, 26, 0.80)',
    glassFill: 'rgba(213, 206, 192, 0.80)',
    glassOverlay: 'rgba(213, 206, 192, 0.74)',
    glassFillFallback: 'rgba(213, 206, 192, 0.96)',
    glassOverlayFallback: 'rgba(213, 206, 192, 0.90)',
    glassBorder: 'rgba(30, 29, 26, 0.30)',
    onCover: '#1E1D1A',
    sheet: '#CFC8B9',
    hairline: 'rgba(30, 29, 26, 0.18)',
    skeleton: 'rgba(30, 29, 26, 0.07)',
    skeletonHighlight: 'rgba(30, 29, 26, 0.13)',
    accent: '#2C5519',
    accentInk: '#E6F7D6',
    up: '#2C5519',
    down: '#A3321F',
    inverseBg: '#2B2C2A',
    inverseText: '#E8E2D4',
  },
};

// ─── Nightfall ────────────────────────────────────────────────────────────────
const nightfall: Theme = {
  name: 'nightfall',
  label: 'Nightfall',
  group: 'custom',
  tagline: 'Slate navy and warm tan, soft and round',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/nightfall.jpg'),
  credit: null,
  background: ['#2B2E3B', '#262936'],
  type: {
    displayXL: { fontFamily: 'Nunito_700Bold', fontSize: 58, lineHeight: 70, letterSpacing: -1 },
    displayL: { fontFamily: 'Nunito_700Bold', fontSize: 34, lineHeight: 42, letterSpacing: -0.5 },
    displayM: { fontFamily: 'Nunito_700Bold', fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
    displayS: { fontFamily: 'Nunito_600SemiBold', fontSize: 21, lineHeight: 27 },
    stat: { fontFamily: 'Nunito_700Bold', fontSize: 50, lineHeight: 60, letterSpacing: -1 },
    mega: { fontFamily: 'Nunito_700Bold', fontSize: 76, lineHeight: 90, letterSpacing: -1.5 },
    headline: { fontFamily: 'Nunito_700Bold', fontSize: 21.5, lineHeight: 28, letterSpacing: -0.2 },
    title: { fontFamily: 'Nunito_700Bold', fontSize: 17, lineHeight: 22 },
    reading: { fontFamily: 'Nunito_400Regular', fontSize: 17, lineHeight: 27.5 },
    body: { fontFamily: 'Nunito_400Regular', fontSize: 15.5, lineHeight: 23 },
    bodySm: { fontFamily: 'Nunito_400Regular', fontSize: 13.5, lineHeight: 19.5 },
    label: { fontFamily: 'Nunito_700Bold', fontSize: 15, lineHeight: 19 },
    caption: { fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, lineHeight: 16.5 },
    kicker: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, lineHeight: 15, letterSpacing: 1.2 },
    spaced: { fontFamily: 'Nunito_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 3.2 },
  },
  shape: { scale: 0.8, control: 14 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  lines: {
    signOff: 'That’s the day. Sleep well.',
    brewing: 'Not morning yet',
    emptySaved: 'Nothing on the nightstand',
    noResults: 'Nothing out tonight',
  },
  colors: {
    bg: '#2B2E3B',
    card: '#363B4C',
    cardBorder: 'rgba(239, 233, 225, 0.08)',
    text: '#EFE9E1',
    textSecondary: 'rgba(239, 233, 225, 0.80)',
    textTertiary: 'rgba(239, 233, 225, 0.64)',
    glassFill: 'rgba(86, 92, 114, 0.50)',
    glassOverlay: 'rgba(30, 32, 44, 0.46)',
    glassFillFallback: 'rgba(64, 69, 88, 0.96)',
    glassOverlayFallback: 'rgba(30, 32, 44, 0.76)',
    glassBorder: 'rgba(239, 233, 225, 0.14)',
    onCover: '#F4EEE6',
    sheet: '#313546',
    hairline: 'rgba(239, 233, 225, 0.10)',
    skeleton: 'rgba(239, 233, 225, 0.06)',
    skeletonHighlight: 'rgba(239, 233, 225, 0.12)',
    accent: '#D6AA86',
    accentInk: '#262936',
    up: '#9AD9B0',
    down: '#F0A08C',
    inverseBg: '#D6AA86',
    inverseText: '#262936',
  },
};

// ─── Mirage ───────────────────────────────────────────────────────────────────
const mirage: Theme = {
  name: 'mirage',
  label: 'Mirage',
  group: 'custom',
  tagline: 'A desert at dusk, light type, one dark tile',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 40,
  cover: require('../../../assets/themes/mirage.jpg'),
  credit: null,
  background: ['#D3B8B4', '#D6BCAE', '#C6AA97'],
  type: {
    displayXL: { fontFamily: 'Jost_300Light', fontSize: 64, lineHeight: 76, letterSpacing: -0.6 },
    displayL: { fontFamily: 'Jost_400Regular', fontSize: 36, lineHeight: 44, letterSpacing: -0.3 },
    displayM: { fontFamily: 'Jost_500Medium', fontSize: 22, lineHeight: 28, letterSpacing: -0.1 },
    displayS: { fontFamily: 'Jost_300Light', fontSize: 24, lineHeight: 30 },
    stat: { fontFamily: 'Jost_300Light', fontSize: 54, lineHeight: 64, letterSpacing: -1 },
    mega: { fontFamily: 'Jost_400Regular', fontSize: 84, lineHeight: 98, letterSpacing: -1 },
    headline: { fontFamily: 'Jost_500Medium', fontSize: 23, lineHeight: 29, letterSpacing: -0.1 },
    title: { fontFamily: 'Jost_500Medium', fontSize: 18, lineHeight: 23 },
    reading: { fontFamily: 'Jost_400Regular', fontSize: 17.5, lineHeight: 27 },
    body: { fontFamily: 'Jost_400Regular', fontSize: 16, lineHeight: 23 },
    bodySm: { fontFamily: 'Jost_400Regular', fontSize: 14, lineHeight: 20 },
    label: { fontFamily: 'Jost_500Medium', fontSize: 15.5, lineHeight: 19 },
    caption: { fontFamily: 'Jost_500Medium', fontSize: 12.5, lineHeight: 16.5, letterSpacing: 0.2 },
    kicker: { fontFamily: 'Jost_500Medium', fontSize: 11.5, lineHeight: 15, letterSpacing: 2 },
    spaced: { fontFamily: 'Jost_400Regular', fontSize: 12, lineHeight: 16, letterSpacing: 4 },
  },
  shape: { scale: 1.15, control: 999 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  leadTile: { fill: '#2A2426', ink: '#F8E9E6' },
  lines: {
    signOff: 'The light’s going. See you at dawn.',
    brewing: 'Still over the horizon',
    emptySaved: 'Nothing packed yet',
    noResults: 'Only sand out here',
  },
  colors: {
    bg: '#D6BCAE',
    card: '#F7EEE9',
    cardBorder: 'rgba(42, 34, 36, 0.08)',
    text: '#2A2224',
    textSecondary: 'rgba(42, 34, 36, 0.86)',
    textTertiary: 'rgba(42, 34, 36, 0.76)',
    glassFill: 'rgba(247, 238, 233, 0.66)',
    glassOverlay: 'rgba(247, 238, 233, 0.56)',
    glassFillFallback: 'rgba(247, 238, 233, 0.92)',
    glassOverlayFallback: 'rgba(247, 238, 233, 0.84)',
    glassBorder: 'rgba(42, 34, 36, 0.12)',
    onCover: '#2A2224',
    sheet: '#F4E9E3',
    hairline: 'rgba(42, 34, 36, 0.10)',
    skeleton: 'rgba(42, 34, 36, 0.06)',
    skeletonHighlight: 'rgba(42, 34, 36, 0.11)',
    accent: '#93395A',
    accentInk: '#FFFFFF',
    up: '#2F6B4E',
    down: '#A23B3B',
    inverseBg: '#2A2426',
    inverseText: '#F8E9E6',
  },
};

/** In picker order. */
export const studioThemes: Theme[] = [pixelsky, consoleTheme, nightfall, mirage];

/** Every typeface these themes use, by the fontFamily name they refer to. */
export const studioFonts: Record<string, FontSource> = {
  ArchivoNarrow_400Regular,
  ArchivoNarrow_600SemiBold,
  ArchivoNarrow_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  Jost_300Light,
  Jost_400Regular,
  Jost_500Medium,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceMono_400Regular,
  VT323_400Regular,
};
