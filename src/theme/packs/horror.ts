// Horror-inspired themes: Nosferatu, The Ring, Midsommar, Scream, Insidious.
// Each theme is a whole look (typefaces, shapes, card style, sections), like the ones in ../themes.ts.
//
// Atmosphere comes from the cover art, the type and one small detail in each section heading
// (components/headings/horror.tsx): never gore, never novelty fonts. Reading text always sits on a
// calm, opaque card. All five covers are original art made for Brewsy.

import { ArchivoNarrow_400Regular } from '@expo-google-fonts/archivo-narrow/400Regular';
import { ArchivoNarrow_600SemiBold } from '@expo-google-fonts/archivo-narrow/600SemiBold';
import { ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow/700Bold';
import { Fraunces_300Light } from '@expo-google-fonts/fraunces/300Light';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { IMFellEnglish_400Regular } from '@expo-google-fonts/im-fell-english/400Regular';
import { IMFellEnglish_400Regular_Italic } from '@expo-google-fonts/im-fell-english/400Regular_Italic';
import { IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc/400Regular';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { Italiana_400Regular } from '@expo-google-fonts/italiana/400Regular';
import { LibreCaslonText_400Regular } from '@expo-google-fonts/libre-caslon-text/400Regular';
import { LibreCaslonText_400Regular_Italic } from '@expo-google-fonts/libre-caslon-text/400Regular_Italic';
import { LibreCaslonText_700Bold } from '@expo-google-fonts/libre-caslon-text/700Bold';
import { LibreFranklin_400Regular } from '@expo-google-fonts/libre-franklin/400Regular';
import { LibreFranklin_600SemiBold } from '@expo-google-fonts/libre-franklin/600SemiBold';
import { LibreFranklin_700Bold } from '@expo-google-fonts/libre-franklin/700Bold';
import { Marcellus_400Regular } from '@expo-google-fonts/marcellus/400Regular';
import { Spectral_400Regular } from '@expo-google-fonts/spectral/400Regular';
import { Spectral_400Regular_Italic } from '@expo-google-fonts/spectral/400Regular_Italic';
import { Spectral_500Medium } from '@expo-google-fonts/spectral/500Medium';
import { Spectral_600SemiBold } from '@expo-google-fonts/spectral/600SemiBold';
import { UnifrakturMaguntia_400Regular } from '@expo-google-fonts/unifrakturmaguntia/400Regular';
import { VT323_400Regular } from '@expo-google-fonts/vt323/400Regular';
import type { FontSource } from 'expo-font';

import type { Theme } from '../themes';

// ─── Nosferatu ────────────────────────────────────────────────────────────────
// A 1922 print: near-black with an amber tint, cream type, old-style faces cut from period books
// (IM Fell), a blackletter weekday, Caslon for reading. Cards carry a thin double border, and each
// section opens on an intertitle card numbered by act. On the cover's stair window, a ship (the
// Empusa) comes into harbour; its lines mention the coach, the hold and the Book of Vampires.
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
  lines: {
    signOff: 'Until cockcrow.',
    brewing: 'The coach is on its way',
    emptySaved: 'Nothing in the hold yet',
    noResults: 'Not in the Book of Vampires',
  },
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
// Each topic opens on a PLAY line with a tape counter. A fly sits on the cover, the way one sits
// on the TV glass in the film; the lines rewind, run to static and end on "Seven days."
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
  lines: {
    signOff: 'Seven days.',
    brewing: 'Still rewinding',
    emptySaved: 'A blank tape',
    noResults: 'Nothing but static',
  },
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
// flowers. Everything centered; each section opens between two embroidered borders. The cover
// keeps the little yellow temple and a rune stone at the meadow's edge.
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
  lines: {
    signOff: 'Skål.',
    brewing: 'The dance isn’t over',
    emptySaved: 'Nothing held yet',
    noResults: 'Not in the Rubi Radr',
  },
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
// Woodsboro, 1996, the phone ringing in an empty kitchen. The poster's language: black, white and
// one blood red. Tall, sharp serif capitals (Instrument Serif) for the weekday and titles; Franklin
// Gothic's revival (Libre Franklin) for reading, like the local news. Square corners throughout.
// Each topic opens with one of Randy's rules ("Rule #3"); the cover hides the Jiffy Pop, the caller
// ID and someone out in the yard.
const scream: Theme = {
  name: 'scream',
  label: 'Scream',
  group: 'horror',
  tagline: 'Woodsboro, 1996. The phone is ringing',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/scream.jpg'),
  credit: null,
  background: ['#0A0A0B', '#08080A', '#060607'],
  type: {
    displayXL: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 66, lineHeight: 78, letterSpacing: 0.6, textTransform: 'uppercase' },
    displayL: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 40, lineHeight: 48, letterSpacing: 0.4, textTransform: 'uppercase' },
    displayM: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 25, lineHeight: 31, letterSpacing: 0.6, textTransform: 'uppercase' },
    displayS: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 28, lineHeight: 34 },
    stat: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 64, lineHeight: 74 },
    mega: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 96, lineHeight: 112, letterSpacing: 1, textTransform: 'uppercase' },
    headline: { fontFamily: 'LibreFranklin_700Bold', fontSize: 20.5, lineHeight: 27, letterSpacing: -0.3 },
    title: { fontFamily: 'LibreFranklin_600SemiBold', fontSize: 16.5, lineHeight: 22, letterSpacing: -0.1 },
    reading: { fontFamily: 'LibreFranklin_400Regular', fontSize: 16, lineHeight: 27 },
    body: { fontFamily: 'LibreFranklin_400Regular', fontSize: 14.5, lineHeight: 22 },
    bodySm: { fontFamily: 'LibreFranklin_400Regular', fontSize: 12.5, lineHeight: 19 },
    label: { fontFamily: 'LibreFranklin_600SemiBold', fontSize: 14, lineHeight: 19 },
    caption: { fontFamily: 'LibreFranklin_400Regular', fontSize: 12.5, lineHeight: 17 },
    kicker: { fontFamily: 'LibreFranklin_700Bold', fontSize: 11, lineHeight: 15, letterSpacing: 1.9 },
    spaced: { fontFamily: 'LibreFranklin_600SemiBold', fontSize: 11.5, lineHeight: 16, letterSpacing: 4, paddingLeft: 4 },
  },
  shape: { scale: 0.06, control: 2 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: true },
  lines: {
    signOff: 'What’s your favorite scary movie?',
    brewing: 'Still ringing',
    emptySaved: 'Nothing saved. Nobody’s safe.',
    noResults: 'Wrong number',
  },
  colors: {
    bg: '#0A0A0B',
    card: '#141415',
    cardBorder: 'rgba(245, 243, 239, 0.09)',
    text: '#F5F3EF',
    textSecondary: 'rgba(245, 243, 239, 0.76)',
    textTertiary: 'rgba(245, 243, 239, 0.60)',
    glassFill: 'rgba(28, 28, 30, 0.66)',
    glassOverlay: 'rgba(10, 10, 11, 0.50)',
    glassFillFallback: 'rgba(24, 24, 26, 0.96)',
    glassOverlayFallback: 'rgba(10, 10, 11, 0.76)',
    glassBorder: 'rgba(245, 243, 239, 0.16)',
    onCover: '#F7F5F1',
    sheet: '#111112',
    hairline: 'rgba(245, 243, 239, 0.12)',
    skeleton: 'rgba(245, 243, 239, 0.06)',
    skeletonHighlight: 'rgba(245, 243, 239, 0.12)',
    accent: '#F2303C',
    accentInk: '#0A0A0B',
    up: '#8ACB98',
    down: '#FF6B66',
    inverseBg: '#F5F3EF',
    inverseText: '#0A0A0B',
  },
};

// ─── Insidious ────────────────────────────────────────────────────────────────
// The Further: a smoky, lamp-lit dark where an old house's red door waits. Cold blue-black, cards
// edged in warm lamplight, thin Edwardian capitals (Italiana) for the weekday and titles, Spectral
// for reading. Everything centered, like a doorway. Each topic opens under a small red door that
// stands a little further open the deeper you read.
const insidious: Theme = {
  name: 'insidious',
  label: 'Insidious',
  group: 'horror',
  tagline: 'It’s not the house that’s haunted',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/insidious.jpg'),
  credit: null,
  background: ['#101316', '#0C0E10', '#08090B'],
  type: {
    displayXL: { fontFamily: 'Italiana_400Regular', fontSize: 48, lineHeight: 60, letterSpacing: 6, paddingLeft: 6, textTransform: 'uppercase' },
    displayL: { fontFamily: 'Italiana_400Regular', fontSize: 34, lineHeight: 44, letterSpacing: 0.6 },
    displayM: { fontFamily: 'Spectral_400Regular_Italic', fontSize: 21, lineHeight: 28 },
    // Italiana's figures read as letters (1 like I, 0 like O), so numbers are set in Spectral.
    displayS: { fontFamily: 'Spectral_400Regular', fontSize: 24, lineHeight: 31, fontVariant: ['lining-nums'] },
    stat: { fontFamily: 'Spectral_400Regular', fontSize: 50, lineHeight: 62, fontVariant: ['lining-nums'] },
    mega: { fontFamily: 'Italiana_400Regular', fontSize: 80, lineHeight: 96, letterSpacing: 6, textTransform: 'uppercase' },
    headline: { fontFamily: 'Spectral_600SemiBold', fontSize: 20.5, lineHeight: 27, letterSpacing: -0.1 },
    title: { fontFamily: 'Spectral_600SemiBold', fontSize: 17, lineHeight: 23 },
    reading: { fontFamily: 'Spectral_400Regular', fontSize: 16.5, lineHeight: 28 },
    body: { fontFamily: 'Spectral_400Regular', fontSize: 15, lineHeight: 23 },
    bodySm: { fontFamily: 'Spectral_400Regular', fontSize: 13, lineHeight: 19 },
    label: { fontFamily: 'Spectral_500Medium', fontSize: 14.5, lineHeight: 19 },
    caption: { fontFamily: 'Spectral_400Regular_Italic', fontSize: 12.5, lineHeight: 17 },
    kicker: { fontFamily: 'Spectral_600SemiBold', fontSize: 11, lineHeight: 15, letterSpacing: 2.2 },
    spaced: { fontFamily: 'Spectral_500Medium', fontSize: 11.5, lineHeight: 16, letterSpacing: 4.5, paddingLeft: 4.5 },
  },
  shape: { scale: 0.2, control: 4 },
  surface: 'outline',
  layout: { heroAlign: 'center', sections: 'rule', capsButtons: false },
  lines: {
    signOff: 'Tiptoe through the tulips.',
    brewing: 'Still in The Further',
    emptySaved: 'Nothing followed you back',
    noResults: 'Nothing came through',
  },
  colors: {
    bg: '#101316',
    card: '#15181B',
    cardBorder: 'rgba(226, 204, 170, 0.15)',
    text: '#ECE5DA',
    textSecondary: 'rgba(236, 229, 218, 0.76)',
    textTertiary: 'rgba(236, 229, 218, 0.58)',
    glassFill: 'rgba(30, 34, 38, 0.64)',
    glassOverlay: 'rgba(16, 19, 22, 0.50)',
    glassFillFallback: 'rgba(26, 30, 34, 0.95)',
    glassOverlayFallback: 'rgba(16, 19, 22, 0.76)',
    glassBorder: 'rgba(226, 204, 170, 0.20)',
    onCover: '#F0E9DE',
    sheet: '#13161A',
    hairline: 'rgba(226, 204, 170, 0.13)',
    skeleton: 'rgba(236, 229, 218, 0.06)',
    skeletonHighlight: 'rgba(236, 229, 218, 0.12)',
    accent: '#E0544A',
    accentInk: '#120D0C',
    up: '#9CC9A0',
    down: '#EE8577',
    inverseBg: '#ECE5DA',
    inverseText: '#101316',
  },
};

/** In picker order. */
export const horrorThemes: Theme[] = [nosferatu, thering, midsommar, scream, insidious];

/** Every typeface these themes use, by the fontFamily name the themes refer to. */
export const horrorFonts: Record<string, FontSource> = {
  ArchivoNarrow_400Regular,
  ArchivoNarrow_600SemiBold,
  ArchivoNarrow_700Bold,
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  IMFellEnglish_400Regular,
  IMFellEnglish_400Regular_Italic,
  IMFellEnglishSC_400Regular,
  InstrumentSerif_400Regular,
  Italiana_400Regular,
  LibreCaslonText_400Regular,
  LibreCaslonText_400Regular_Italic,
  LibreCaslonText_700Bold,
  LibreFranklin_400Regular,
  LibreFranklin_600SemiBold,
  LibreFranklin_700Bold,
  Marcellus_400Regular,
  Spectral_400Regular,
  Spectral_400Regular_Italic,
  Spectral_500Medium,
  Spectral_600SemiBold,
  UnifrakturMaguntia_400Regular,
  VT323_400Regular,
};
