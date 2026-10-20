// Horror-inspired themes: Overlook, Nosferatu, The Ring, Midsommar, Scream.
// Each theme is a whole look (typefaces, shapes, card style, sections), like the ones in ../themes.ts.
//
// Atmosphere comes from the cover art, the type and one small detail in each section heading
// (components/headings/horror.tsx): never gore, never novelty fonts. Reading text always sits on a
// calm, opaque card. All five covers are original art made for Brewsy.

import { Anton_400Regular } from '@expo-google-fonts/anton/400Regular';
import { ArchivoNarrow_400Regular } from '@expo-google-fonts/archivo-narrow/400Regular';
import { ArchivoNarrow_600SemiBold } from '@expo-google-fonts/archivo-narrow/600SemiBold';
import { ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow/700Bold';
import { BarlowCondensed_500Medium } from '@expo-google-fonts/barlow-condensed/500Medium';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { Fraunces_300Light } from '@expo-google-fonts/fraunces/300Light';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { IMFellEnglish_400Regular } from '@expo-google-fonts/im-fell-english/400Regular';
import { IMFellEnglish_400Regular_Italic } from '@expo-google-fonts/im-fell-english/400Regular_Italic';
import { IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc/400Regular';
import { LibreBaskerville_400Regular } from '@expo-google-fonts/libre-baskerville/400Regular';
import { LibreBaskerville_700Bold } from '@expo-google-fonts/libre-baskerville/700Bold';
import { LibreCaslonText_400Regular } from '@expo-google-fonts/libre-caslon-text/400Regular';
import { LibreCaslonText_400Regular_Italic } from '@expo-google-fonts/libre-caslon-text/400Regular_Italic';
import { LibreCaslonText_700Bold } from '@expo-google-fonts/libre-caslon-text/700Bold';
import { Marcellus_400Regular } from '@expo-google-fonts/marcellus/400Regular';
import { NewsCycle_400Regular } from '@expo-google-fonts/news-cycle/400Regular';
import { NewsCycle_700Bold } from '@expo-google-fonts/news-cycle/700Bold';
import { SpecialElite_400Regular } from '@expo-google-fonts/special-elite/400Regular';
import { UnifrakturMaguntia_400Regular } from '@expo-google-fonts/unifrakturmaguntia/400Regular';
import { VT323_400Regular } from '@expo-google-fonts/vt323/400Regular';
import type { FontSource } from 'expo-font';

import type { Theme } from '../themes';

// ─── Overlook ─────────────────────────────────────────────────────────────────
// A mountain hotel after closing day: the hexagon carpet under a lamp, walnut cards trimmed in
// brass, tall condensed capitals like the film's day cards ("TUESDAY"), typewritten small labels.
// Each topic opens under a brass room plaque.
const overlook: Theme = {
  name: 'overlook',
  label: 'Overlook',
  group: 'horror',
  tagline: 'Hexagon carpet, long quiet corridors',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/overlook.jpg'),
  credit: null,
  background: ['#1F0B08', '#170806', '#100504'],
  type: {
    displayXL: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 64, lineHeight: 76, letterSpacing: 3, textTransform: 'uppercase' },
    displayL: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 34, lineHeight: 42, letterSpacing: 1.4, textTransform: 'uppercase' },
    displayM: { fontFamily: 'LibreBaskerville_700Bold', fontSize: 18.5, lineHeight: 26, letterSpacing: -0.2 },
    displayS: { fontFamily: 'LibreBaskerville_400Regular', fontSize: 20, lineHeight: 27 },
    stat: { fontFamily: 'BarlowCondensed_500Medium', fontSize: 54, lineHeight: 64, letterSpacing: 0.5 },
    mega: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 86, lineHeight: 100, letterSpacing: 2, textTransform: 'uppercase' },
    headline: { fontFamily: 'LibreBaskerville_700Bold', fontSize: 19.5, lineHeight: 27, letterSpacing: -0.3 },
    title: { fontFamily: 'LibreBaskerville_700Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
    reading: { fontFamily: 'LibreBaskerville_400Regular', fontSize: 15.5, lineHeight: 27, letterSpacing: -0.1 },
    body: { fontFamily: 'LibreBaskerville_400Regular', fontSize: 14, lineHeight: 22 },
    bodySm: { fontFamily: 'LibreBaskerville_400Regular', fontSize: 12.5, lineHeight: 19 },
    label: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 16.5, lineHeight: 20, letterSpacing: 0.5 },
    caption: { fontFamily: 'SpecialElite_400Regular', fontSize: 12.5, lineHeight: 17, letterSpacing: 0.1 },
    kicker: { fontFamily: 'SpecialElite_400Regular', fontSize: 12, lineHeight: 15, letterSpacing: 1.6 },
    spaced: { fontFamily: 'SpecialElite_400Regular', fontSize: 12.5, lineHeight: 17, letterSpacing: 3.6 },
  },
  shape: { scale: 0.22, control: 4 },
  surface: 'outline',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  colors: {
    bg: '#1F0B08',
    card: '#2A1410',
    cardBorder: 'rgba(212, 168, 98, 0.26)',
    text: '#F4E7D2',
    textSecondary: 'rgba(244, 231, 210, 0.76)',
    textTertiary: 'rgba(244, 231, 210, 0.58)',
    glassFill: 'rgba(54, 26, 18, 0.62)',
    glassOverlay: 'rgba(31, 11, 8, 0.48)',
    glassFillFallback: 'rgba(46, 22, 16, 0.95)',
    glassOverlayFallback: 'rgba(31, 11, 8, 0.74)',
    glassBorder: 'rgba(212, 168, 98, 0.30)',
    onCover: '#F7EBD8',
    sheet: '#25100C',
    hairline: 'rgba(212, 168, 98, 0.18)',
    skeleton: 'rgba(244, 231, 210, 0.06)',
    skeletonHighlight: 'rgba(244, 231, 210, 0.12)',
    accent: '#E07B3C',
    accentInk: '#1F0B08',
    up: '#A7C98F',
    down: '#F08C6C',
    inverseBg: '#F4E7D2',
    inverseText: '#1F0B08',
  },
};

// ─── Nosferatu ────────────────────────────────────────────────────────────────
// A 1922 print: near-black with an amber tint, cream type, old-style faces cut from period books
// (IM Fell), a blackletter weekday, Caslon for reading. Cards carry a thin double border, and each
// section opens on an intertitle card numbered by act.
const nosferatu: Theme = {
  name: 'nosferatu',
  label: 'Nosferatu',
  group: 'horror',
  tagline: 'Silent film, a shadow on the stairs',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/nosferatu.jpg'),
  credit: null,
  background: ['#120E0A', '#0E0B08', '#0A0806'],
  type: {
    displayXL: { fontFamily: 'UnifrakturMaguntia_400Regular', fontSize: 60, lineHeight: 80, letterSpacing: 0.5, paddingHorizontal: 4 },
    displayL: { fontFamily: 'IMFellEnglish_400Regular', fontSize: 34, lineHeight: 44, letterSpacing: -0.5 },
    displayM: { fontFamily: 'IMFellEnglishSC_400Regular', fontSize: 19, lineHeight: 26, letterSpacing: 1.4, paddingLeft: 1.4 },
    displayS: { fontFamily: 'LibreCaslonText_400Regular', fontSize: 21, lineHeight: 28 },
    stat: { fontFamily: 'IMFellEnglish_400Regular', fontSize: 54, lineHeight: 66 },
    mega: { fontFamily: 'IMFellEnglish_400Regular_Italic', fontSize: 84, lineHeight: 104, paddingRight: 8 },
    headline: { fontFamily: 'IMFellEnglish_400Regular', fontSize: 23, lineHeight: 30, letterSpacing: -0.1 },
    title: { fontFamily: 'LibreCaslonText_700Bold', fontSize: 16, lineHeight: 22 },
    reading: { fontFamily: 'LibreCaslonText_400Regular', fontSize: 15.5, lineHeight: 27, letterSpacing: 0.3 },
    body: { fontFamily: 'LibreCaslonText_400Regular', fontSize: 14, lineHeight: 22, letterSpacing: 0.25 },
    bodySm: { fontFamily: 'LibreCaslonText_400Regular', fontSize: 12.5, lineHeight: 19, letterSpacing: 0.2 },
    label: { fontFamily: 'LibreCaslonText_700Bold', fontSize: 14, lineHeight: 18 },
    caption: { fontFamily: 'LibreCaslonText_400Regular_Italic', fontSize: 12.5, lineHeight: 17 },
    kicker: { fontFamily: 'IMFellEnglishSC_400Regular', fontSize: 13.5, lineHeight: 17, letterSpacing: 1.6 },
    spaced: { fontFamily: 'LibreCaslonText_400Regular', fontSize: 12, lineHeight: 17, letterSpacing: 4, paddingLeft: 4 },
  },
  shape: { scale: 0.1, control: 2 },
  surface: 'framed',
  layout: { heroAlign: 'center', sections: 'rule', capsButtons: true },
  colors: {
    bg: '#120E0A',
    card: '#1A140E',
    cardBorder: 'rgba(222, 190, 132, 0.24)',
    text: '#EFE3C8',
    textSecondary: 'rgba(239, 227, 200, 0.75)',
    textTertiary: 'rgba(239, 227, 200, 0.57)',
    glassFill: 'rgba(36, 28, 20, 0.62)',
    glassOverlay: 'rgba(18, 14, 10, 0.50)',
    glassFillFallback: 'rgba(30, 24, 17, 0.95)',
    glassOverlayFallback: 'rgba(18, 14, 10, 0.76)',
    glassBorder: 'rgba(222, 190, 132, 0.26)',
    onCover: '#F4E9D0',
    sheet: '#16110C',
    hairline: 'rgba(222, 190, 132, 0.16)',
    skeleton: 'rgba(239, 227, 200, 0.06)',
    skeletonHighlight: 'rgba(239, 227, 200, 0.12)',
    accent: '#D9A65C',
    accentInk: '#140F0A',
    up: '#B9C98E',
    down: '#E48F6E',
    inverseBg: '#EFE3C8',
    inverseText: '#120E0A',
  },
};

// ─── The Ring ─────────────────────────────────────────────────────────────────
// A worn videotape: cold teal-grey, flat outlined cards like a TV's bezel, the VCR's on-screen
// lettering (VT323) for the weekday, kickers and times, a plain narrow grotesk for reading.
// Each topic opens on a PLAY line with a tape counter.
const thering: Theme = {
  name: 'thering',
  label: 'The Ring',
  group: 'horror',
  tagline: 'A worn tape, cold rain light',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/thering.jpg'),
  credit: null,
  background: ['#121819', '#0E1314', '#0A0E0F'],
  // VT323 is drawn small on its em, so it runs larger than the other faces at the same role.
  type: {
    displayXL: { fontFamily: 'VT323_400Regular', fontSize: 80, lineHeight: 92, letterSpacing: 3, textTransform: 'uppercase' },
    displayL: { fontFamily: 'ArchivoNarrow_700Bold', fontSize: 31, lineHeight: 38, letterSpacing: -0.3 },
    displayM: { fontFamily: 'ArchivoNarrow_700Bold', fontSize: 20, lineHeight: 26, letterSpacing: -0.1 },
    displayS: { fontFamily: 'VT323_400Regular', fontSize: 28, lineHeight: 33 },
    stat: { fontFamily: 'VT323_400Regular', fontSize: 64, lineHeight: 74 },
    mega: { fontFamily: 'VT323_400Regular', fontSize: 104, lineHeight: 120, textTransform: 'uppercase' },
    headline: { fontFamily: 'ArchivoNarrow_600SemiBold', fontSize: 22.5, lineHeight: 28, letterSpacing: -0.2 },
    title: { fontFamily: 'ArchivoNarrow_600SemiBold', fontSize: 18, lineHeight: 23 },
    reading: { fontFamily: 'ArchivoNarrow_400Regular', fontSize: 17.5, lineHeight: 27 },
    body: { fontFamily: 'ArchivoNarrow_400Regular', fontSize: 16, lineHeight: 23 },
    bodySm: { fontFamily: 'ArchivoNarrow_400Regular', fontSize: 14, lineHeight: 20 },
    label: { fontFamily: 'ArchivoNarrow_600SemiBold', fontSize: 15.5, lineHeight: 19, letterSpacing: 0.2 },
    caption: { fontFamily: 'VT323_400Regular', fontSize: 17, lineHeight: 20, letterSpacing: 0.4 },
    kicker: { fontFamily: 'VT323_400Regular', fontSize: 17.5, lineHeight: 21, letterSpacing: 1.6 },
    spaced: { fontFamily: 'VT323_400Regular', fontSize: 18, lineHeight: 21, letterSpacing: 3.4 },
  },
  shape: { scale: 0.14, control: 3 },
  surface: 'outline',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  colors: {
    bg: '#121819',
    card: '#151C1D',
    cardBorder: 'rgba(176, 210, 205, 0.17)',
    text: '#E3ECEA',
    textSecondary: 'rgba(227, 236, 234, 0.74)',
    textTertiary: 'rgba(227, 236, 234, 0.56)',
    glassFill: 'rgba(26, 36, 38, 0.62)',
    glassOverlay: 'rgba(14, 20, 21, 0.48)',
    glassFillFallback: 'rgba(24, 33, 35, 0.95)',
    glassOverlayFallback: 'rgba(14, 20, 21, 0.74)',
    glassBorder: 'rgba(176, 210, 205, 0.22)',
    onCover: '#EEF4F2',
    sheet: '#141B1C',
    hairline: 'rgba(176, 210, 205, 0.13)',
    skeleton: 'rgba(176, 210, 205, 0.06)',
    skeletonHighlight: 'rgba(176, 210, 205, 0.12)',
    accent: '#8FD0C4',
    accentInk: '#0B1314',
    up: '#8FD0C4',
    down: '#E79A86',
    inverseBg: '#E3ECEA',
    inverseText: '#0E1314',
  },
};

// ─── Midsommar ────────────────────────────────────────────────────────────────
// Daylight that never ends: sun-bleached cream, white paper cards, ink-blue type, a classical
// engraved face for titles and a soft old-style serif for reading. Rose for the accent, like the
// flowers. Everything centered; each section opens between two embroidered borders.
const midsommar: Theme = {
  name: 'midsommar',
  label: 'Midsommar',
  group: 'horror',
  tagline: 'Endless daylight, ribbons and wildflowers',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 40,
  cover: require('../../../assets/themes/midsommar.jpg'),
  credit: null,
  background: ['#F5EFE0', '#F2EAD8'],
  type: {
    displayXL: { fontFamily: 'Marcellus_400Regular', fontSize: 46, lineHeight: 58, letterSpacing: 6, paddingLeft: 6, textTransform: 'uppercase' },
    displayL: { fontFamily: 'Marcellus_400Regular', fontSize: 31, lineHeight: 40, letterSpacing: 0.2 },
    displayM: { fontFamily: 'Marcellus_400Regular', fontSize: 17, lineHeight: 24, letterSpacing: 3.2, paddingLeft: 3.2, textTransform: 'uppercase' },
    displayS: { fontFamily: 'Fraunces_400Regular', fontSize: 22, lineHeight: 28 },
    stat: { fontFamily: 'Fraunces_300Light', fontSize: 52, lineHeight: 62, letterSpacing: -0.8 },
    mega: { fontFamily: 'Marcellus_400Regular', fontSize: 76, lineHeight: 94, letterSpacing: 4, textTransform: 'uppercase' },
    headline: { fontFamily: 'Fraunces_600SemiBold', fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, lineHeight: 22 },
    reading: { fontFamily: 'Fraunces_400Regular', fontSize: 16.5, lineHeight: 27 },
    body: { fontFamily: 'Fraunces_400Regular', fontSize: 15, lineHeight: 22 },
    bodySm: { fontFamily: 'Fraunces_400Regular', fontSize: 13, lineHeight: 19 },
    label: { fontFamily: 'Fraunces_600SemiBold', fontSize: 14.5, lineHeight: 19 },
    caption: { fontFamily: 'Fraunces_400Regular_Italic', fontSize: 13, lineHeight: 17 },
    kicker: { fontFamily: 'Marcellus_400Regular', fontSize: 11.5, lineHeight: 15, letterSpacing: 2.6 },
    spaced: { fontFamily: 'Fraunces_400Regular', fontSize: 11.5, lineHeight: 16, letterSpacing: 4.5, paddingLeft: 4.5 },
  },
  shape: { scale: 0.7, control: 999 },
  surface: 'solid',
  layout: { heroAlign: 'center', sections: 'rule', capsButtons: false },
  colors: {
    bg: '#F5EFE0',
    card: '#FFFDF7',
    cardBorder: 'rgba(52, 62, 40, 0.09)',
    text: '#283149',
    textSecondary: 'rgba(40, 49, 73, 0.80)',
    textTertiary: 'rgba(40, 49, 73, 0.70)',
    glassFill: 'rgba(255, 253, 247, 0.74)',
    glassOverlay: 'rgba(255, 253, 247, 0.60)',
    glassFillFallback: 'rgba(255, 253, 247, 0.95)',
    glassOverlayFallback: 'rgba(255, 253, 247, 0.84)',
    glassBorder: 'rgba(40, 49, 73, 0.12)',
    onCover: '#283149',
    sheet: '#FBF7EC',
    hairline: 'rgba(40, 49, 73, 0.11)',
    skeleton: 'rgba(40, 49, 73, 0.06)',
    skeletonHighlight: 'rgba(40, 49, 73, 0.11)',
    accent: '#A84866',
    accentInk: '#FFFDF7',
    up: '#4C7A3A',
    down: '#B23A3A',
    inverseBg: '#283149',
    inverseText: '#FFFDF7',
  },
};

// ─── Scream ───────────────────────────────────────────────────────────────────
// A small town in 1996, the phone ringing after dark: midnight blue, slate cards, one red for the
// accent. Tall poster capitals (Anton) for the weekday and titles, News Gothic (News Cycle) for
// reading, like the local paper. Each topic opens with one of the rules ("Rule #3").
const scream: Theme = {
  name: 'scream',
  label: 'Scream',
  group: 'horror',
  tagline: 'A ringing phone, a quiet cul-de-sac',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/scream.jpg'),
  credit: null,
  background: ['#0C0F17', '#0A0D14', '#08090F'],
  // Anton's capitals stand tall on the em, so its lines get extra room.
  type: {
    displayXL: { fontFamily: 'Anton_400Regular', fontSize: 62, lineHeight: 82, letterSpacing: 1.5, textTransform: 'uppercase' },
    displayL: { fontFamily: 'Anton_400Regular', fontSize: 31, lineHeight: 42, letterSpacing: 0.6, textTransform: 'uppercase' },
    displayM: { fontFamily: 'Anton_400Regular', fontSize: 18.5, lineHeight: 26, letterSpacing: 1, textTransform: 'uppercase' },
    displayS: { fontFamily: 'Anton_400Regular', fontSize: 24, lineHeight: 33 },
    stat: { fontFamily: 'Anton_400Regular', fontSize: 52, lineHeight: 70 },
    mega: { fontFamily: 'Anton_400Regular', fontSize: 88, lineHeight: 116, letterSpacing: 1, textTransform: 'uppercase' },
    headline: { fontFamily: 'NewsCycle_700Bold', fontSize: 21, lineHeight: 27, letterSpacing: -0.1 },
    title: { fontFamily: 'NewsCycle_700Bold', fontSize: 17, lineHeight: 22 },
    reading: { fontFamily: 'NewsCycle_400Regular', fontSize: 16.5, lineHeight: 27 },
    body: { fontFamily: 'NewsCycle_400Regular', fontSize: 15, lineHeight: 22 },
    bodySm: { fontFamily: 'NewsCycle_400Regular', fontSize: 13, lineHeight: 19 },
    label: { fontFamily: 'NewsCycle_700Bold', fontSize: 15, lineHeight: 19, letterSpacing: 0.2 },
    caption: { fontFamily: 'NewsCycle_400Regular', fontSize: 13, lineHeight: 17 },
    kicker: { fontFamily: 'NewsCycle_700Bold', fontSize: 12, lineHeight: 15, letterSpacing: 1.8 },
    spaced: { fontFamily: 'NewsCycle_700Bold', fontSize: 12, lineHeight: 17, letterSpacing: 4, paddingLeft: 4 },
  },
  shape: { scale: 0.3, control: 4 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: true },
  colors: {
    bg: '#0C0F17',
    card: '#131826',
    cardBorder: 'rgba(205, 214, 235, 0.10)',
    text: '#EEF1F6',
    textSecondary: 'rgba(238, 241, 246, 0.76)',
    textTertiary: 'rgba(238, 241, 246, 0.58)',
    glassFill: 'rgba(24, 30, 46, 0.62)',
    glassOverlay: 'rgba(12, 15, 23, 0.48)',
    glassFillFallback: 'rgba(22, 27, 41, 0.95)',
    glassOverlayFallback: 'rgba(12, 15, 23, 0.74)',
    glassBorder: 'rgba(205, 214, 235, 0.16)',
    onCover: '#F3F5F9',
    sheet: '#11151F',
    hairline: 'rgba(205, 214, 235, 0.12)',
    skeleton: 'rgba(238, 241, 246, 0.06)',
    skeletonHighlight: 'rgba(238, 241, 246, 0.12)',
    accent: '#DD3C42',
    accentInk: '#FFFFFF',
    up: '#86C99C',
    down: '#F2877C',
    inverseBg: '#EEF1F6',
    inverseText: '#0C0F17',
  },
};

/** In picker order. */
export const horrorThemes: Theme[] = [overlook, nosferatu, thering, midsommar, scream];

/** Every typeface these themes use, by the fontFamily name the themes refer to. */
export const horrorFonts: Record<string, FontSource> = {
  Anton_400Regular,
  ArchivoNarrow_400Regular,
  ArchivoNarrow_600SemiBold,
  ArchivoNarrow_700Bold,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  IMFellEnglish_400Regular,
  IMFellEnglish_400Regular_Italic,
  IMFellEnglishSC_400Regular,
  LibreBaskerville_400Regular,
  LibreBaskerville_700Bold,
  LibreCaslonText_400Regular,
  LibreCaslonText_400Regular_Italic,
  LibreCaslonText_700Bold,
  Marcellus_400Regular,
  NewsCycle_400Regular,
  NewsCycle_700Bold,
  SpecialElite_400Regular,
  UnifrakturMaguntia_400Regular,
  VT323_400Regular,
};
