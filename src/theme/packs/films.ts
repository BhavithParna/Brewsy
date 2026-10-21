// Film-inspired themes: Star Wars, Hogwarts, La La Land, Ghibli, Fight Club. (Dune, Matrix, Tron,
// Blade Runner and Budapest sit in the Films group too, but live in ../themes.ts with the classic type.)
// Each theme is a whole look (typefaces, shapes, card style, sections), like the ones in ../themes.ts.
// The covers are real photographs of places and things that recall each film (Wikimedia Commons,
// credited in Settings → Theme), cropped and graded to the theme: never stills, logos or characters.
// Section headings are drawn in components/headings/films.tsx. Each film hides a few nods to itself
// in its `lines` and its section headings.

import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime/400Regular';
import { CourierPrime_700Bold } from '@expo-google-fonts/courier-prime/700Bold';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display/400Regular_Italic';
import { EBGaramond_400Regular } from '@expo-google-fonts/eb-garamond/400Regular';
import { EBGaramond_400Regular_Italic } from '@expo-google-fonts/eb-garamond/400Regular_Italic';
import { EBGaramond_600SemiBold } from '@expo-google-fonts/eb-garamond/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { JosefinSans_600SemiBold } from '@expo-google-fonts/josefin-sans/600SemiBold';
import { Jost_400Regular } from '@expo-google-fonts/jost/400Regular';
import { Jost_500Medium } from '@expo-google-fonts/jost/500Medium';
import { LibreFranklin_400Regular } from '@expo-google-fonts/libre-franklin/400Regular';
import { LibreFranklin_600SemiBold } from '@expo-google-fonts/libre-franklin/600SemiBold';
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
// The cover is the Chott el Djerid salt flat in Tunisia, where the homestead scenes were filmed, at
// sunset, the sky darkening to space above the horizon.
// Centered capitals get a left pad equal to their tracking (letter-spacing also trails the last letter).
const starwars: Theme = {
  name: 'starwars',
  label: 'Star Wars',
  group: 'films',
  tagline: 'Desert dusk, crawl-yellow capitals',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/starwars.jpg'),
  credit: {
    title: 'Salt pan at sunset in Chott el Djerid, Tunisia',
    author: 'Josep M. Gracia',
    license: 'CC BY-SA 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:CHO_-_Salt_pan_at_sunset_in_Chott_el_Djerid,_Tunisia,_2023.jpg',
    adapted: true,
  },
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
  lines: {
    signOff: 'May the Force be with you.',
    noResults: 'These aren’t the stories you’re looking for',
  },
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
// Candlelit stone: warm dark stone, parchment-colored type, gold leaf and crimson. The cover is the
// fan-vaulted cloisters of Gloucester Cathedral, which played the school's corridors.
// Cinzel sets inscription capitals for titles and labels; EB Garamond sets headlines and reading,
// like a well-made book. Cards are framed twice in gold, like book plates; sections open like
// chapters ("Chapter four", then the title, then a small ornament; chapter one's ornament has a
// lightning bolt). Crimson marks what's selected.
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
  credit: {
    title: 'The Cloisters of Gloucester Cathedral',
    author: 'Saffron Blaze',
    license: 'CC BY-SA 3.0',
    url: 'https://commons.wikimedia.org/wiki/File:The_Cloisters_of_Gloucester_Cathedral.jpg',
    adapted: true,
  },
  background: ['#15110C', '#15110C', '#15110C', '#100D09'],
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
  lines: {
    signOff: 'Mischief managed.',
    brewing: 'The owls aren’t in yet',
    noResults: 'Accio… nothing',
  },
  colors: {
    bg: '#15110C',
    card: '#1E1913',
    cardBorder: 'rgba(212, 176, 98, 0.34)',
    text: '#F1E7CF',
    textSecondary: 'rgba(241, 231, 207, 0.76)',
    textTertiary: 'rgba(241, 231, 207, 0.58)',
    glassFill: 'rgba(44, 36, 26, 0.62)',
    glassOverlay: 'rgba(16, 12, 8, 0.45)',
    glassFillFallback: 'rgba(38, 31, 23, 0.95)',
    glassOverlayFallback: 'rgba(16, 12, 8, 0.72)',
    glassBorder: 'rgba(212, 176, 98, 0.30)',
    onCover: '#F1E7CF',
    sheet: '#1A1610',
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
// like numbers in a musical's program ("Nº 3"). The cover is Griffith Observatory at dusk, where the
// two of them dance among the stars.
const lalaland: Theme = {
  name: 'lalaland',
  label: 'La La Land',
  group: 'films',
  tagline: 'Magic hour, a yellow dress, city lights',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 34,
  cover: require('../../../assets/themes/lalaland.jpg'),
  credit: {
    title: 'Griffith Observatory at dusk',
    author: 'Jeremye77',
    license: 'CC BY-SA 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:Griffith_Observatory_-_Dusk.jpg',
    adapted: true,
  },
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
  lines: {
    signOff: 'Here’s to the ones who dream.',
    brewing: 'Another day of sun',
  },
  colors: {
    bg: '#1D1A46',
    card: 'rgba(255, 228, 246, 0.08)',
    cardBorder: 'rgba(255, 222, 242, 0.16)',
    text: '#FFF5EE',
    textSecondary: 'rgba(255, 245, 238, 0.76)',
    textTertiary: 'rgba(255, 245, 238, 0.70)',
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
    down: '#FFB09F',
    inverseBg: '#FFF5EE',
    inverseText: '#231B4E',
  },
};

// ─── Ghibli ───────────────────────────────────────────────────────────────────
// A summer afternoon: towering clouds, green hills, a morning mist fading to warm cream.
// White, very round cards on a soft lift; Zen Maru Gothic (rounded) for titles, Nunito for
// everything else. Meadow green for what's selected, a warm red as the accent.
// Sections open on a title with a short brushed wave under it (headings/films.tsx); some days a couple
// of acorns lie at the end of one. The cover is the hills of Biei, Hokkaido, under summer clouds.
const ghibli: Theme = {
  name: 'ghibli',
  label: 'Ghibli',
  group: 'films',
  tagline: 'Summer clouds over green hills',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 44,
  cover: require('../../../assets/themes/ghibli.jpg'),
  credit: {
    title: 'The hills of Northwest Outlook Park, Biei',
    author: 't-konno',
    license: 'CC BY-SA 3.0',
    url: 'https://commons.wikimedia.org/wiki/File:%E5%8C%97%E8%A5%BF%E3%81%AE%E4%B8%98%E5%B1%95%E6%9C%9B%E5%8F%B0%EF%BC%88The_hills_of_northwest_Outlook_park%EF%BC%89_-_panoramio.jpg',
    adapted: true,
  },
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
  lines: {
    brewing: 'The cat bus is running late',
    emptySaved: 'Only soot sprites in here',
  },
  colors: {
    bg: '#E3ECE6',
    card: '#FFFEFA',
    cardBorder: 'rgba(52, 76, 58, 0.07)',
    text: '#2B3A31',
    textSecondary: 'rgba(43, 58, 49, 0.80)',
    textTertiary: 'rgba(43, 58, 49, 0.74)',
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
    // Deep enough for small labels on the misty page as well as on white cards.
    accent: '#B0472A',
    accentInk: '#FFFFFF',
    up: '#3C7D46',
    down: '#B0472A',
    inverseBg: '#3D6B45',
    inverseText: '#FFFFFF',
  },
};

// ─── Fight Club ───────────────────────────────────────────────────────────────
// A bare bulb in a dark basement. Grimy green-black, like the film's grade, with off-white
// type that has a little of the fluorescent green in it and soap pink as the one accent. Courier
// Prime sets titles, labels and captions like a typewritten report; Libre Franklin, a plain American
// gothic, sets headlines and reading. Outline cards, near-square corners, controls rounded like a
// bar of soap. Each section is a reel: "Reel 2" and a reel-change cue mark in its corner, the
// "cigarette burns" (headings/films.tsx). The lines are the Narrator's.
const fightclub: Theme = {
  name: 'fightclub',
  label: 'Fight Club',
  group: 'films',
  tagline: 'Pink soap, a bare bulb, typewriter type',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../../assets/themes/fightclub.jpg'),
  credit: {
    title: 'Filament bulb',
    author: 'Subasis Mahat',
    license: 'CC BY-SA 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:Filament_bulb.jpg',
    adapted: true,
  },
  background: ['#151C19', '#141A17', '#121714'],
  // Courier is wide: titles are set a size smaller than other themes and tracked in a little.
  type: {
    displayXL: { fontFamily: 'CourierPrime_700Bold', fontSize: 46, lineHeight: 56, letterSpacing: -1.6 },
    displayL: { fontFamily: 'CourierPrime_700Bold', fontSize: 27, lineHeight: 34, letterSpacing: -0.8 },
    displayM: { fontFamily: 'CourierPrime_700Bold', fontSize: 19, lineHeight: 25, letterSpacing: -0.4 },
    displayS: { fontFamily: 'CourierPrime_700Bold', fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
    stat: { fontFamily: 'CourierPrime_400Regular', fontSize: 50, lineHeight: 60, letterSpacing: -2.4 },
    mega: { fontFamily: 'CourierPrime_700Bold', fontSize: 64, lineHeight: 78, letterSpacing: -2.4 },
    headline: { fontFamily: 'LibreFranklin_600SemiBold', fontSize: 21.5, lineHeight: 27.5, letterSpacing: -0.3 },
    title: { fontFamily: 'LibreFranklin_600SemiBold', fontSize: 17, lineHeight: 22.5, letterSpacing: -0.2 },
    reading: { fontFamily: 'LibreFranklin_400Regular', fontSize: 16.5, lineHeight: 27, letterSpacing: -0.1 },
    body: { fontFamily: 'LibreFranklin_400Regular', fontSize: 15, lineHeight: 22.5 },
    bodySm: { fontFamily: 'LibreFranklin_400Regular', fontSize: 13.5, lineHeight: 19.5 },
    label: { fontFamily: 'CourierPrime_700Bold', fontSize: 14.5, lineHeight: 18 },
    caption: { fontFamily: 'CourierPrime_400Regular', fontSize: 12.5, lineHeight: 16 },
    kicker: { fontFamily: 'CourierPrime_700Bold', fontSize: 12, lineHeight: 15, letterSpacing: 1.2 },
    spaced: { fontFamily: 'CourierPrime_400Regular', fontSize: 12.5, lineHeight: 16, letterSpacing: 3 },
  },
  shape: { scale: 0.18, control: 6 },
  surface: 'outline',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: true },
  // Courier is wide, so the longer lines are broken by hand rather than left with one word on the last line.
  lines: {
    signOff: 'You met me at a very strange time\nin my life.',
    brewing: 'I am Jack’s raging impatience',
    emptySaved: 'You are not\nyour reading list',
    noResults: 'I am Jack’s complete\nlack of results',
  },
  colors: {
    bg: '#151C19',
    card: '#1B2420',
    cardBorder: 'rgba(214, 230, 216, 0.14)',
    text: '#E8ECE3',
    textSecondary: 'rgba(232, 236, 227, 0.75)',
    textTertiary: 'rgba(232, 236, 227, 0.60)',
    glassFill: 'rgba(30, 40, 35, 0.62)',
    glassOverlay: 'rgba(10, 14, 12, 0.45)',
    glassFillFallback: 'rgba(28, 37, 33, 0.95)',
    glassOverlayFallback: 'rgba(10, 14, 12, 0.72)',
    glassBorder: 'rgba(214, 230, 216, 0.16)',
    onCover: '#E8ECE3',
    sheet: '#18201C',
    hairline: 'rgba(214, 230, 216, 0.11)',
    skeleton: 'rgba(214, 230, 216, 0.06)',
    skeletonHighlight: 'rgba(214, 230, 216, 0.12)',
    accent: '#F2A3BE',
    accentInk: '#2A0D18',
    up: '#A8D9AE',
    down: '#F49484',
    inverseBg: '#E8ECE3',
    inverseText: '#141A17',
  },
};

/** In picker order. */
export const filmThemes: Theme[] = [starwars, hogwarts, lalaland, ghibli, fightclub];

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
  // Ghibli. Zen Maru Gothic is one weight, for titles only (a Latin-only copy, see the top of this file).
  ZenMaruGothic_700Bold,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  // Fight Club
  CourierPrime_400Regular,
  CourierPrime_700Bold,
  LibreFranklin_400Regular,
  LibreFranklin_600SemiBold,
};
