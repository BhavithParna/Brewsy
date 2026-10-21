// Whales: a sunlit sea, with a few whales drifting slowly behind the page.
// A whole look like the ones in ../themes.ts, in the Classic group.
//
// The sea is a wallpaper fixed behind every screen (original art, assets/themes/whales-sea.jpg):
// pale where the light comes in at the surface, deepening to open-water blue. The whales swim over it
// (components/ambient/Whales.tsx), so the top of Today is the open sea itself, like Glass's wallpaper.
// Reading text sits on solid white cards; only titles sit on the water, in deep navy, and the whales
// are light enough behind them that a title passing over one still reads.
//
// Type is Fredoka, a soft rounded face, for the date, titles and headlines, with Nunito for reading.
// One accent: coral, the warm thing in a blue sea (and the blush on the whales' cheeks).

import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import type { FontSource } from 'expo-font';

import type { Theme } from '../themes';

const SEA = require('../../../assets/themes/whales-sea.jpg');

export const whales: Theme = {
  name: 'whales',
  label: 'Whales',
  group: 'classic',
  tagline: 'A sunlit sea, whales drifting by',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 40,
  // The sea with a mother and calf in it: what the theme pickers show.
  cover: require('../../../assets/themes/whales.jpg'),
  backdrop: SEA,
  credit: null,
  // The wallpaper's colors, for the moment before it loads: surface light down to open water.
  background: ['#E4F5F8', '#AEDCE9', '#86C4D9'],
  type: {
    displayXL: { fontFamily: 'Fredoka_600SemiBold', fontSize: 56, lineHeight: 68, letterSpacing: -0.8 },
    displayL: { fontFamily: 'Fredoka_600SemiBold', fontSize: 33, lineHeight: 41, letterSpacing: -0.4 },
    displayM: { fontFamily: 'Fredoka_600SemiBold', fontSize: 21, lineHeight: 27, letterSpacing: -0.1 },
    displayS: { fontFamily: 'Fredoka_500Medium', fontSize: 20, lineHeight: 26 },
    stat: { fontFamily: 'Fredoka_500Medium', fontSize: 52, lineHeight: 62, letterSpacing: -1 },
    mega: { fontFamily: 'Fredoka_700Bold', fontSize: 72, lineHeight: 88, letterSpacing: -1.2 },
    headline: { fontFamily: 'Fredoka_600SemiBold', fontSize: 21.5, lineHeight: 27, letterSpacing: -0.15 },
    title: { fontFamily: 'Nunito_700Bold', fontSize: 17, lineHeight: 22 },
    reading: { fontFamily: 'Nunito_400Regular', fontSize: 17, lineHeight: 27.5 },
    body: { fontFamily: 'Nunito_400Regular', fontSize: 15.5, lineHeight: 23 },
    bodySm: { fontFamily: 'Nunito_400Regular', fontSize: 13.5, lineHeight: 19.5 },
    label: { fontFamily: 'Nunito_700Bold', fontSize: 15, lineHeight: 19 },
    caption: { fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, lineHeight: 16.5 },
    kicker: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, lineHeight: 15, letterSpacing: 1.2 },
    spaced: { fontFamily: 'Nunito_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 3.2 },
  },
  // Soft and round, like the whales.
  shape: { scale: 1, control: 999 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  // Deep-sea navy, so the one bright block on the page isn't the coral.
  leadTile: { fill: '#103650', ink: '#F2FAFC' },
  lines: {
    signOff: 'That’s the whole pod. Swim safe.',
    brewing: 'Coming up for air',
    emptySaved: 'Nothing in the net yet',
    noResults: 'Nothing in these waters',
  },
  colors: {
    bg: '#E4F5F8',
    card: '#FFFFFF',
    cardBorder: 'rgba(12, 38, 56, 0.07)',
    text: '#0C2638',
    // Darker than other themes' second and third tones: small text here may sit on the deepest water at
    // the foot of the screen, or on a whale passing behind it, and must still read (4.5:1 on the water).
    textSecondary: 'rgba(12, 38, 56, 0.88)',
    textTertiary: 'rgba(12, 38, 56, 0.84)',
    glassFill: 'rgba(255, 255, 255, 0.66)',
    glassOverlay: 'rgba(255, 255, 255, 0.58)',
    glassFillFallback: 'rgba(255, 255, 255, 0.90)',
    glassOverlayFallback: 'rgba(255, 255, 255, 0.82)',
    glassBorder: 'rgba(12, 38, 56, 0.10)',
    onCover: '#0C2638',
    sheet: '#F3FAFC',
    hairline: 'rgba(12, 38, 56, 0.09)',
    skeleton: 'rgba(12, 38, 56, 0.06)',
    skeletonHighlight: 'rgba(12, 38, 56, 0.11)',
    // Coral, deep enough to read as small text on a white card and on the pale water up top.
    accent: '#B8412A',
    accentInk: '#FFFFFF',
    up: '#13734F',
    down: '#B8412A',
    inverseBg: '#0C2638',
    inverseText: '#FFFFFF',
  },
};

/** In picker order. */
export const whalesThemes: Theme[] = [whales];

/** Every typeface this theme uses, by the fontFamily name it refers to. */
export const whalesFonts: Record<string, FontSource> = {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
};
