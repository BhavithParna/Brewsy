// Film-inspired themes: Star Wars, Hogwarts, La La Land, Ghibli.
// Each theme is a whole look (typefaces, shapes, card style, sections), like the ones in ../themes.ts.
// The covers are original artwork made for Brewsy (assets/themes/*.jpg): no stills, logos or characters.
// Section headings are drawn in components/headings/films.tsx.

import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display/400Regular_Italic';
import { EBGaramond_400Regular } from '@expo-google-fonts/eb-garamond/400Regular';
import { EBGaramond_400Regular_Italic } from '@expo-google-fonts/eb-garamond/400Regular_Italic';
import { EBGaramond_600SemiBold } from '@expo-google-fonts/eb-garamond/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { JosefinSans_600SemiBold } from '@expo-google-fonts/josefin-sans/600SemiBold';
import { Jost_400Regular } from '@expo-google-fonts/jost/400Regular';
import { Jost_500Medium } from '@expo-google-fonts/jost/500Medium';
import { NewsCycle_400Regular } from '@expo-google-fonts/news-cycle/400Regular';
import { NewsCycle_700Bold } from '@expo-google-fonts/news-cycle/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import type { FontSource } from 'expo-font';

import type { Theme } from '../themes';

// Zen Maru Gothic without its Japanese characters (3.8 MB → 93 KB): Brewsy only sets English in it.
// Every Latin, Greek and Cyrillic glyph is kept. Made with fontTools' pyftsubset; license in assets/fonts.
const ZenMaruGothic_700Bold: FontSource = require('../../../assets/fonts/ZenMaruGothic_700Bold-latin.ttf');

// ─── Star Wars ────────────────────────────────────────────────────────────────
// Deep-space black and a binary sunset. News Cycle (a News Gothic revival, the opening crawl's
// typeface) sets condensed capitals for titles and labels; stories read in Inter. The crawl's
// yellow is kept for section titles and the one accent. Outline cards, near-square corners,
// everything centered like the crawl. Sections open "Episode IV / WORLD" (headings/films.tsx).
// Centered capitals get a left pad equal to their tracking (letter-spacing also trails the last letter).
const starwars: Theme = {
  name: 'starwars',
  label: 'Star Wars',
  group: 'films',
  tagline: 'Twin suns, crawl-yellow capitals',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/starwars.jpg'),
  credit: null,
  background: ['#000000'],
  type: {
    displayXL: { fontFamily: 'NewsCycle_700Bold', fontSize: 50, lineHeight: 62, letterSpacing: 6, paddingLeft: 6, textTransform: 'uppercase' },
    displayL: { fontFamily: 'NewsCycle_700Bold', fontSize: 28, lineHeight: 36, letterSpacing: 3, textTransform: 'uppercase' },
    displayM: { fontFamily: 'NewsCycle_700Bold', fontSize: 18, lineHeight: 24, letterSpacing: 2.6, paddingLeft: 2.6, textTransform: 'uppercase' },
    displayS: { fontFamily: 'NewsCycle_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: 0.3, paddingBottom: 1 },
    stat: { fontFamily: 'NewsCycle_400Regular', fontSize: 56, lineHeight: 66 },
    mega: { fontFamily: 'NewsCycle_700Bold', fontSize: 72, lineHeight: 88, letterSpacing: 6, textTransform: 'uppercase' },
    // News Cycle has a tall ascent and a short descent: with a tight line height Android would trim
    // the last line's descenders, so mixed-case styles get a little room underneath.
    headline: { fontFamily: 'NewsCycle_700Bold', fontSize: 24.5, lineHeight: 30, letterSpacing: 0.1, paddingBottom: 2 },
    title: { fontFamily: 'NewsCycle_700Bold', fontSize: 19, lineHeight: 24, paddingBottom: 1 },
    reading: { fontFamily: 'Inter_400Regular', fontSize: 16.5, lineHeight: 27, letterSpacing: -0.1 },
    label: { fontFamily: 'NewsCycle_700Bold', fontSize: 16, lineHeight: 20, letterSpacing: 0.3, paddingBottom: 1 },
    caption: { fontFamily: 'NewsCycle_400Regular', fontSize: 13.5, lineHeight: 17, letterSpacing: 0.3, paddingBottom: 1 },
    kicker: { fontFamily: 'NewsCycle_700Bold', fontSize: 12, lineHeight: 15, letterSpacing: 2.4 },
    spaced: { fontFamily: 'NewsCycle_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 5, paddingLeft: 5 },
  },
  shape: { scale: 0.1, control: 3 },
  surface: 'outline',
  layout: { heroAlign: 'center', sections: 'rule', capsButtons: true },
  colors: {
    bg: '#000000',
    card: '#08090C',
    cardBorder: 'rgba(205, 214, 232, 0.17)',
    text: '#EEEFF1',
    textSecondary: 'rgba(238, 239, 241, 0.72)',
    textTertiary: 'rgba(238, 239, 241, 0.54)',
    glassFill: 'rgba(24, 25, 30, 0.62)',
    glassOverlay: 'rgba(0, 0, 0, 0.40)',
    glassFillFallback: 'rgba(18, 19, 23, 0.95)',
    glassOverlayFallback: 'rgba(0, 0, 0, 0.66)',
    glassBorder: 'rgba(205, 214, 232, 0.20)',
    onCover: '#EEEFF1',
    sheet: '#0A0B0E',
    hairline: 'rgba(205, 214, 232, 0.12)',
    skeleton: 'rgba(205, 214, 232, 0.06)',
    skeletonHighlight: 'rgba(205, 214, 232, 0.12)',
    accent: '#FFE81F',
    accentInk: '#0A0900',
    up: '#7CD4A4',
    down: '#FF6B5B',
    inverseBg: '#EEEFF1',
    inverseText: '#000000',
  },
};

// ─── Hogwarts ─────────────────────────────────────────────────────────────────
// A castle at night: ink-blue stone, candlelit parchment-colored type, gold leaf and crimson.
// Cinzel sets inscription capitals for titles and labels; EB Garamond sets headlines and reading,
// like a well-made book. Cards are framed twice in gold, like book plates; sections open like
// chapters ("Chapter four", then the title, then a small ornament). Crimson marks what's selected.
// Theme tokens give cards and the page one text color, so the cards are dark vellum rather than
// light parchment: the parchment is in the type.
const hogwarts: Theme = {
  name: 'hogwarts',
  label: 'Hogwarts',
  group: 'films',
  tagline: 'Candlelit stone, gold leaf and crimson',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 32,
  cover: require('../../../assets/themes/hogwarts.jpg'),
  credit: null,
  background: ['#100F1A', '#100F1A', '#100F1A', '#0C0B14'],
  type: {
    displayXL: { fontFamily: 'Cinzel_600SemiBold', fontSize: 44, lineHeight: 58, letterSpacing: 4, paddingLeft: 4 },
    displayL: { fontFamily: 'EBGaramond_400Regular_Italic', fontSize: 37, lineHeight: 48, paddingRight: 4 },
    displayM: { fontFamily: 'Cinzel_600SemiBold', fontSize: 17, lineHeight: 25, letterSpacing: 2.4, paddingLeft: 2.4 },
    displayS: { fontFamily: 'EBGaramond_600SemiBold', fontSize: 25, lineHeight: 32.5, fontVariant: ['lining-nums'] },
    stat: { fontFamily: 'EBGaramond_400Regular', fontSize: 60, lineHeight: 70, fontVariant: ['lining-nums'] },
    mega: { fontFamily: 'Cinzel_600SemiBold', fontSize: 62, lineHeight: 80, letterSpacing: 4 },
    // No tracking on Garamond text: letter-spacing turns off its fi/fl ligatures and leaves gaps.
    headline: { fontFamily: 'EBGaramond_600SemiBold', fontSize: 25, lineHeight: 32.5, fontVariant: ['lining-nums'] },
    title: { fontFamily: 'EBGaramond_600SemiBold', fontSize: 20, lineHeight: 26 },
    reading: { fontFamily: 'EBGaramond_400Regular', fontSize: 19.5, lineHeight: 29.5, fontVariant: ['lining-nums'] },
    body: { fontFamily: 'EBGaramond_400Regular', fontSize: 17.5, lineHeight: 25 },
    bodySm: { fontFamily: 'EBGaramond_400Regular', fontSize: 15.5, lineHeight: 21 },
    label: { fontFamily: 'EBGaramond_600SemiBold', fontSize: 16.5, lineHeight: 21 },
    caption: { fontFamily: 'EBGaramond_400Regular', fontSize: 15, lineHeight: 19 },
    kicker: { fontFamily: 'Cinzel_700Bold', fontSize: 11, lineHeight: 15, letterSpacing: 2.2 },
    spaced: { fontFamily: 'Cinzel_600SemiBold', fontSize: 11.5, lineHeight: 16, letterSpacing: 4.5, paddingLeft: 4.5 },
  },
  shape: { scale: 0.2, control: 3 },
  surface: 'framed',
  layout: { heroAlign: 'center', sections: 'rule', capsButtons: true },
  colors: {
    bg: '#100F1A',
    card: '#191825',
    cardBorder: 'rgba(212, 176, 98, 0.34)',
    text: '#F1E7CF',
    textSecondary: 'rgba(241, 231, 207, 0.76)',
    textTertiary: 'rgba(241, 231, 207, 0.58)',
    glassFill: 'rgba(30, 29, 44, 0.62)',
    glassOverlay: 'rgba(10, 10, 20, 0.45)',
    glassFillFallback: 'rgba(26, 25, 38, 0.95)',
    glassOverlayFallback: 'rgba(10, 10, 20, 0.72)',
    glassBorder: 'rgba(212, 176, 98, 0.30)',
    onCover: '#F1E7CF',
    sheet: '#15141F',
    hairline: 'rgba(212, 176, 98, 0.20)',
    skeleton: 'rgba(241, 231, 207, 0.06)',
    skeletonHighlight: 'rgba(241, 231, 207, 0.12)',
    accent: '#D4B062',
    accentInk: '#1A1408',
    up: '#93C9A0',
    down: '#E5735F',
    inverseBg: '#8E2433',
    inverseText: '#F6ECD5',
  },
};

// ─── La La Land ───────────────────────────────────────────────────────────────
// Magic hour over the city: an indigo-to-dusky-rose gradient, frosted panes (the gradient is smooth,
// so text stays crisp), and the yellow of the dress as the one accent. DM Serif Display in italic
// for titles, Josefin Sans art-deco capitals for small labels, Jost for reading. Sections open
// like numbers in a musical's program ("Nº 3").
const lalaland: Theme = {
  name: 'lalaland',
  label: 'La La Land',
  group: 'films',
  tagline: 'Magic hour, a yellow dress, city lights',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 34,
  cover: require('../../../assets/themes/lalaland.jpg'),
  credit: null,
  // The cover fades into the first color at ~60% of the screen; the dusk gradient starts below it.
  background: ['#1D1A46', '#1D1A46', '#1D1A46', '#1D1A46', '#1D1A46', '#1D1A46', '#221B4B', '#2F1F57', '#43275E', '#5A3063'],
  type: {
    displayXL: { fontFamily: 'DMSerifDisplay_400Regular_Italic', fontSize: 62, lineHeight: 76, letterSpacing: -0.6, paddingRight: 8 },
    displayL: { fontFamily: 'DMSerifDisplay_400Regular_Italic', fontSize: 38, lineHeight: 48, letterSpacing: -0.3, paddingRight: 6 },
    displayM: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 24, lineHeight: 30, letterSpacing: -0.1 },
    displayS: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 24, lineHeight: 30 },
    stat: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 56, lineHeight: 68 },
    mega: { fontFamily: 'DMSerifDisplay_400Regular_Italic', fontSize: 84, lineHeight: 102, paddingRight: 10 },
    headline: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 24, lineHeight: 30, letterSpacing: 0 },
    title: { fontFamily: 'Jost_500Medium', fontSize: 17.5, lineHeight: 23 },
    reading: { fontFamily: 'Jost_400Regular', fontSize: 17.5, lineHeight: 28 },
    body: { fontFamily: 'Jost_400Regular', fontSize: 15.5, lineHeight: 23 },
    bodySm: { fontFamily: 'Jost_400Regular', fontSize: 13.5, lineHeight: 19.5 },
    label: { fontFamily: 'Jost_500Medium', fontSize: 15, lineHeight: 19, letterSpacing: 0.2 },
    caption: { fontFamily: 'Jost_400Regular', fontSize: 13, lineHeight: 17, letterSpacing: 0.2 },
    kicker: { fontFamily: 'JosefinSans_600SemiBold', fontSize: 11.5, lineHeight: 15, letterSpacing: 2.6 },
    spaced: { fontFamily: 'JosefinSans_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 5 },
  },
  shape: { scale: 0.75, control: 999 },
  surface: 'glass',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: true },
  colors: {
    bg: '#1D1A46',
    card: 'rgba(255, 228, 246, 0.08)',
    cardBorder: 'rgba(255, 222, 242, 0.16)',
    text: '#FFF5EE',
    textSecondary: 'rgba(255, 245, 238, 0.76)',
    textTertiary: 'rgba(255, 245, 238, 0.66)',
    glassFill: 'rgba(255, 228, 246, 0.11)',
    glassOverlay: 'rgba(22, 16, 54, 0.40)',
    glassFillFallback: 'rgba(52, 36, 92, 0.95)',
    glassOverlayFallback: 'rgba(22, 16, 54, 0.70)',
    glassBorder: 'rgba(255, 222, 242, 0.20)',
    onCover: '#FFF5EE',
    sheet: '#241E4E',
    hairline: 'rgba(255, 222, 242, 0.14)',
    skeleton: 'rgba(255, 222, 242, 0.07)',
    skeletonHighlight: 'rgba(255, 222, 242, 0.14)',
    accent: '#F6CF48',
    accentInk: '#2A1C04',
    up: '#8EE3C4',
    down: '#FF9C8A',
    inverseBg: '#FFF5EE',
    inverseText: '#231B4E',
  },
};

// ─── Ghibli ───────────────────────────────────────────────────────────────────
// A summer afternoon: towering clouds, green hills, a morning mist fading to warm cream.
// White, very round cards on a soft lift; Zen Maru Gothic (rounded) for titles, Nunito for
// everything else. Meadow green for what's selected, a warm red as the accent.
// Sections open on a title with a short brushed wave under it (headings/films.tsx).
const ghibli: Theme = {
  name: 'ghibli',
  label: 'Ghibli',
  group: 'films',
  tagline: 'Summer clouds over green hills',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 44,
  cover: require('../../../assets/themes/ghibli.jpg'),
  credit: null,
  // Mist through the cover's height (it fades into the first color), warming to cream below.
  background: ['#E3ECE6', '#E3ECE6', '#E3ECE6', '#E6EDE5', '#EEEFE4', '#F4EFE2'],
  type: {
    displayXL: { fontFamily: 'ZenMaruGothic_700Bold', fontSize: 52, lineHeight: 66, letterSpacing: -0.8 },
    displayL: { fontFamily: 'ZenMaruGothic_700Bold', fontSize: 30, lineHeight: 40, letterSpacing: -0.3 },
    displayM: { fontFamily: 'ZenMaruGothic_700Bold', fontSize: 21, lineHeight: 28, letterSpacing: -0.2 },
    displayS: { fontFamily: 'Nunito_700Bold', fontSize: 22, lineHeight: 28 },
    stat: { fontFamily: 'Nunito_600SemiBold', fontSize: 52, lineHeight: 64, letterSpacing: -1 },
    mega: { fontFamily: 'ZenMaruGothic_700Bold', fontSize: 72, lineHeight: 92, letterSpacing: -1.5 },
    headline: { fontFamily: 'ZenMaruGothic_700Bold', fontSize: 21, lineHeight: 29, letterSpacing: -0.2 },
    title: { fontFamily: 'Nunito_700Bold', fontSize: 17.5, lineHeight: 23 },
    reading: { fontFamily: 'Nunito_400Regular', fontSize: 17, lineHeight: 27.5 },
    body: { fontFamily: 'Nunito_400Regular', fontSize: 15.5, lineHeight: 23 },
    bodySm: { fontFamily: 'Nunito_400Regular', fontSize: 13.5, lineHeight: 19.5 },
    label: { fontFamily: 'Nunito_700Bold', fontSize: 15, lineHeight: 19 },
    caption: { fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, lineHeight: 16.5 },
    kicker: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, lineHeight: 15, letterSpacing: 1.4 },
    spaced: { fontFamily: 'Nunito_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 3.6 },
  },
  shape: { scale: 1.3, control: 999 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  colors: {
    bg: '#E3ECE6',
    card: '#FFFEFA',
    cardBorder: 'rgba(52, 76, 58, 0.07)',
    text: '#2B3A31',
    textSecondary: 'rgba(43, 58, 49, 0.80)',
    textTertiary: 'rgba(43, 58, 49, 0.70)',
    glassFill: 'rgba(255, 254, 250, 0.72)',
    glassOverlay: 'rgba(255, 254, 250, 0.60)',
    glassFillFallback: 'rgba(255, 254, 250, 0.94)',
    glassOverlayFallback: 'rgba(255, 254, 250, 0.84)',
    glassBorder: 'rgba(52, 76, 58, 0.12)',
    onCover: '#22342A',
    sheet: '#FBF9F2',
    hairline: 'rgba(52, 76, 58, 0.10)',
    skeleton: 'rgba(52, 76, 58, 0.06)',
    skeletonHighlight: 'rgba(52, 76, 58, 0.11)',
    accent: '#C4502F',
    accentInk: '#FFFFFF',
    up: '#3C7D46',
    down: '#C4502F',
    inverseBg: '#3D6B45',
    inverseText: '#FFFFFF',
  },
};

/** In picker order. */
export const filmThemes: Theme[] = [starwars, hogwarts, lalaland, ghibli];

/** Every typeface these themes use, by the fontFamily name the themes refer to. */
export const filmFonts: Record<string, FontSource> = {
  // Star Wars
  NewsCycle_400Regular,
  NewsCycle_700Bold,
  Inter_400Regular,
  // Hogwarts
  Cinzel_600SemiBold,
  Cinzel_700Bold,
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_600SemiBold,
  // La La Land
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
  JosefinSans_600SemiBold,
  Jost_400Regular,
  Jost_500Medium,
  // Ghibli. Zen Maru Gothic carries Japanese too (3.7 MB a weight), so it's one weight, for titles only.
  ZenMaruGothic_700Bold,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
};
