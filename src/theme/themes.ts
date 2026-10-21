import { useFonts, type FontSource } from 'expo-font';
import type { ImageSourcePropType, TextStyle } from 'react-native';

import { filmFonts, filmThemes } from './packs/films';
import { glassFonts, glassThemes } from './packs/glass';
import { horrorFonts, horrorThemes } from './packs/horror';
import { whalesFonts, whalesThemes } from './packs/whales';
import { TOPIC_LABEL, type TopicKey } from '@/data/topics';

export { TOPIC_LABEL, type TopicKey };

export type ThemeName =
  | 'dune'
  | 'space'
  | 'atlantis'
  | 'highlands'
  | 'alpine'
  | 'matrix'
  | 'tron'
  | 'bladerunner'
  | 'budapest'
  // Glass (Apple-style frosted glass; light and dark variants, see packs/glass.ts)
  | 'glass'
  // Whales (a sunlit sea with whales drifting behind the page, see packs/whales.ts)
  | 'whales'
  // Films (packs/films.ts)
  | 'starwars'
  | 'hogwarts'
  | 'lalaland'
  | 'ghibli'
  | 'fightclub'
  // Horror (packs/horror.ts)
  | 'nosferatu'
  | 'thering'
  | 'midsommar'
  | 'scream'
  | 'insidious';

/** Where a theme sits in the picker. */
export type ThemeGroup = 'classic' | 'films' | 'horror' | 'custom';

export const THEME_GROUPS: { id: ThemeGroup; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'films', label: 'Films' },
  { id: 'horror', label: 'Horror' },
  // Looks made for Brewsy rather than after a place or a film (Whales).
  { id: 'custom', label: 'Custom' },
];

/** Text roles every screen uses; each theme restyles them (see Txt). */
export type TxtVariant =
  | 'displayXL' // the weekday on Today
  | 'displayL' // page titles, section titles
  | 'headline' // story headlines
  | 'displayM' // card titles ("The 60-second version"), state screens
  | 'displayS' // numerals
  | 'stat' // big numbers on tiles
  | 'mega' // the giant word across a section cover
  | 'title'
  | 'reading' // long-form body text
  | 'body'
  | 'bodySm'
  | 'label' // buttons, list rows
  | 'caption'
  | 'kicker' // SMALL LABELS above text
  | 'spaced'; // W I D E L Y  spaced subtitle

/** Who took a cover photo, and under which license (shown in Settings → Theme). */
export type PhotoCredit = {
  title: string;
  author: string;
  license: string;
  /** Wikimedia Commons file page. */
  url: string;
  /** CC BY-SA asks us to say we cropped and recolored it. */
  adapted: boolean;
};

/**
 * A theme's own small lines: a nod to its film or place where the app would otherwise say something
 * plain. Each is optional (the plain line is used without it). Keep them short, and never in place of
 * something the reader needs: times, counts and how-tos stay as they are.
 */
export type ThemeLines = {
  /** One extra line under "You're all caught up" at the end of today's edition. */
  signOff?: string;
  /** Title of the card shown before today's edition is out (instead of "Still brewing"). */
  brewing?: string;
  /** Title of the empty Reading List (instead of "Nothing saved yet"). */
  emptySaved?: string;
  /** Title when search finds nothing (instead of "No matches"). */
  noResults?: string;
};

/** The border colors of a liquid-glass pane, by edge. */
export type GlassRim = { top: string; side: string; bottom: string };

/**
 * A theme is a whole look, not just colors: its own typefaces, corner shapes,
 * card style, header layout and section style.
 */
export type Theme = {
  name: ThemeName;
  label: string;
  group: ThemeGroup;
  /** One line under the name in the theme picker. */
  tagline: string;
  isDark: boolean;
  blurTint: 'dark' | 'light';
  blurIntensity: number;
  /** Photo at the top of Today and the Reading List. It fades into the background before any text. */
  cover: ImageSourcePropType;
  /** null when the cover is original art made for Brewsy. */
  credit: PhotoCredit | null;
  /** Behind everything below the cover: one color, or a slow top-to-bottom gradient. */
  background: [string, ...string[]];
  /**
   * Optional image fixed behind every screen, over `background` (the Glass wallpaper).
   * With a backdrop, the cover adds nothing of its own: the top of Today is the wallpaper itself.
   */
  backdrop?: ImageSourcePropType;
  /**
   * Liquid-glass finish (Glass): panels and controls catch light along their top edge and sit on a
   * soft shadow. Themes without it draw plain one-color borders.
   */
  liquid?: {
    /** Edge colors of cards: brightest on top, where the light catches. */
    cardRim: GlassRim;
    /** Edge colors of buttons and chips. They may sit on a card, so their lower edges can be darker. */
    controlRim: GlassRim;
    /** Card fill where real blur sits behind it (iOS, web). `colors.card` is the fill without blur (Android). */
    cardOverBlur: string;
    /** Soft lift under cards (a boxShadow value). */
    cardShadow: string;
    /** Smaller lift under buttons and chips (a boxShadow value). */
    controlShadow: string;
  };
  /** Per-role type: font family, size, tracking, case. Merged over the defaults in Txt. */
  type: Partial<Record<TxtVariant, TextStyle>>;
  shape: {
    /** Multiplies the default corner radii (0.15 = nearly square, 1 = soft). */
    scale: number;
    /** Radius for pills, chips and round buttons (999 = fully round). */
    control: number;
  };
  /**
   * How story cards are drawn. Text always sits on something calm:
   * solid = opaque card · outline = opaque card with a crisp border · glass = frosted over a smooth gradient ·
   * framed = opaque card with a second, inset border (like a printed card).
   */
  surface: 'solid' | 'outline' | 'glass' | 'framed';
  layout: {
    /** Where the date sits on the cover. */
    heroAlign: 'left' | 'center';
    /**
     * How each topic opens: rule = "── WORLD ──" centered, cover = photo card with the
     * topic as a giant word, title = the topic in large type, prompt = a terminal line
     * ("> world_"), circuit = the title over a lit trace line.
     */
    sections: 'rule' | 'cover' | 'title' | 'prompt' | 'circuit';
    /** Buttons and chips use small spaced capitals. */
    capsButtons: boolean;
  };
  /** Small lines of its own (see ThemeLines). */
  lines?: ThemeLines;
  /**
   * The "Stories today" tile under the cover. Without this it's filled with the accent; 'card' draws
   * it like the Listen tile beside it, with the number in the accent; or a fill and ink of its own.
   */
  leadTile?: 'card' | { fill: string; ink: string };
  colors: {
    /** Flat base color (status bar strip, navigation, behind the cover while it loads). */
    bg: string;
    /** Story cards and other reading surfaces. */
    card: string;
    cardBorder: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    /** Frosted controls (chips, round buttons, tab bar). */
    glassFill: string;
    /** Frosted controls sitting on the cover photo. */
    glassOverlay: string;
    /** Used instead of real blur where the platform can't blur. */
    glassFillFallback: string;
    glassOverlayFallback: string;
    glassBorder: string;
    /** Icons and text drawn straight on the cover photo (top bar). */
    onCover: string;
    /** Bottom sheets: opaque. */
    sheet: string;
    hairline: string;
    skeleton: string;
    skeletonHighlight: string;
    /** The theme's one accent: the stories tile, progress, "New". */
    accent: string;
    /** Text and icons on the accent color. */
    accentInk: string;
    up: string;
    down: string;
    /** Solid buttons (selected day, active tab, Continue). */
    inverseBg: string;
    inverseText: string;
  };
};

const BY_SA = (v: string) => `CC BY-SA ${v}`;
const BY = (v: string) => `CC BY ${v}`;

// ─── Dune ─────────────────────────────────────────────────────────────────────
// Sand-colored and light, thin capitals set wide like the film's titles, sharp
// architectural corners, everything centered. After the travel reference. Section rules carry a
// little worm sign: the sand lifting over something moving underneath (headings/films.tsx).
// Centered capitals get a left pad equal to their tracking: letter-spacing adds space after
// the last letter too, which would otherwise push the text off center.
const dune: Theme = {
  name: 'dune',
  label: 'Dune',
  group: 'films',
  tagline: 'Sand, spice and wide-set capitals',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 40,
  cover: require('../../assets/themes/dune.jpg'),
  credit: {
    title: 'Dune 45 in Sossusvlei at sunrise',
    author: 'Giles Laurent',
    license: BY_SA('4.0'),
    url: 'https://commons.wikimedia.org/wiki/File:006_Dune_45_in_Sossusvlei_at_sunrise_Photo_by_Giles_Laurent.jpg',
    adapted: true,
  },
  background: ['#E9DAC2', '#E2CFB1'],
  type: {
    displayXL: { fontFamily: 'Jost_300Light', fontSize: 40, lineHeight: 52, letterSpacing: 9, paddingLeft: 9, textTransform: 'uppercase' },
    displayL: { fontFamily: 'Jost_400Regular', fontSize: 25, lineHeight: 34, letterSpacing: 5, textTransform: 'uppercase' },
    displayM: { fontFamily: 'Jost_500Medium', fontSize: 16, lineHeight: 24, letterSpacing: 3.6, paddingLeft: 3.6, textTransform: 'uppercase' },
    displayS: { fontFamily: 'Jost_400Regular', fontSize: 20, lineHeight: 26, letterSpacing: 0.4 },
    stat: { fontFamily: 'Jost_300Light', fontSize: 48, lineHeight: 58, letterSpacing: -0.5 },
    mega: { fontFamily: 'Jost_300Light', fontSize: 60, lineHeight: 74, letterSpacing: 8, textTransform: 'uppercase' },
    headline: { fontFamily: 'Jost_500Medium', fontSize: 22, lineHeight: 28, letterSpacing: -0.1 },
    title: { fontFamily: 'Jost_500Medium', fontSize: 17.5, lineHeight: 22 },
    label: { fontFamily: 'Jost_500Medium', fontSize: 14.5, lineHeight: 18, letterSpacing: 0.3 },
    caption: { fontFamily: 'Jost_400Regular', fontSize: 12.5, lineHeight: 16, letterSpacing: 0.3 },
    kicker: { fontFamily: 'Jost_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 2.8 },
    spaced: { fontFamily: 'Jost_500Medium', fontSize: 11.5, lineHeight: 16, letterSpacing: 5.5, paddingLeft: 5.5 },
  },
  shape: { scale: 0.15, control: 3 },
  surface: 'solid',
  layout: { heroAlign: 'center', sections: 'rule', capsButtons: true },
  lines: {
    signOff: 'The spice must flow.',
    brewing: 'The sleeper must awaken',
    noResults: 'Not a ripple on the sand',
  },
  colors: {
    bg: '#E9DAC2',
    card: '#F6EEE1',
    cardBorder: 'rgba(58, 38, 22, 0.10)',
    text: '#2A1C12',
    textSecondary: 'rgba(42, 28, 18, 0.74)',
    textTertiary: 'rgba(42, 28, 18, 0.68)',
    glassFill: 'rgba(246, 238, 225, 0.70)',
    glassOverlay: 'rgba(246, 238, 225, 0.55)',
    glassFillFallback: 'rgba(246, 238, 225, 0.92)',
    glassOverlayFallback: 'rgba(246, 238, 225, 0.80)',
    glassBorder: 'rgba(58, 38, 22, 0.14)',
    onCover: '#2A1C12',
    sheet: '#F3E9D8',
    hairline: 'rgba(58, 38, 22, 0.12)',
    skeleton: 'rgba(58, 38, 22, 0.06)',
    skeletonHighlight: 'rgba(58, 38, 22, 0.11)',
    // Spice rust, deep enough for small labels anywhere on the sand gradient (4.5:1 at its darkest).
    accent: '#954119',
    accentInk: '#FBF4EA',
    up: '#4A6E35',
    down: '#A23E1C',
    inverseBg: '#2A1C12',
    inverseText: '#F6EEE1',
  },
};

// ─── Space ────────────────────────────────────────────────────────────────────
// Pure black, mission-control monospace details, one signal-orange accent, used sparingly: the
// stories tile is an outlined panel like the rest, with only its count lit in orange.
// Each topic opens on a photo card with the topic as a giant word (the month-cards reference).
const space: Theme = {
  name: 'space',
  label: 'Space',
  group: 'classic',
  tagline: 'Black sky, mission-control type',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 40,
  cover: require('../../assets/themes/space.jpg'),
  credit: {
    title: 'Earthset (art002e009288)',
    author: 'NASA',
    license: 'Public domain',
    url: 'https://commons.wikimedia.org/wiki/File:Earthset_(art002e009288).jpg',
    adapted: true,
  },
  background: ['#000000'],
  type: {
    displayXL: { fontFamily: 'SpaceGrotesk_300Light', fontSize: 62, lineHeight: 74, letterSpacing: -2.4 },
    displayL: { fontFamily: 'SpaceGrotesk_300Light', fontSize: 36, lineHeight: 44, letterSpacing: -1.1 },
    displayM: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
    displayS: { fontFamily: 'SpaceMono_400Regular', fontSize: 18, lineHeight: 24 },
    stat: { fontFamily: 'SpaceGrotesk_300Light', fontSize: 46, lineHeight: 56, letterSpacing: -2 },
    mega: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 80, lineHeight: 94, letterSpacing: -3 },
    headline: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 23, lineHeight: 29, letterSpacing: -0.5 },
    title: { fontFamily: 'SpaceGrotesk_600SemiBold' },
    label: { fontFamily: 'SpaceGrotesk_500Medium' },
    kicker: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
    spaced: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 2.4 },
    caption: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, lineHeight: 15, letterSpacing: 0 },
  },
  shape: { scale: 0.6, control: 999 },
  surface: 'outline',
  layout: { heroAlign: 'left', sections: 'cover', capsButtons: false },
  leadTile: 'card',
  lines: {
    signOff: 'Mission control, signing off.',
    brewing: 'Counting down',
    noResults: 'No signal',
  },
  colors: {
    bg: '#000000',
    card: '#0B0C0F',
    cardBorder: 'rgba(255, 255, 255, 0.13)',
    text: '#F5F6F8',
    textSecondary: 'rgba(245, 246, 248, 0.70)',
    textTertiary: 'rgba(245, 246, 248, 0.50)',
    glassFill: 'rgba(28, 30, 36, 0.60)',
    glassOverlay: 'rgba(10, 11, 14, 0.45)',
    glassFillFallback: 'rgba(22, 24, 29, 0.94)',
    glassOverlayFallback: 'rgba(10, 11, 14, 0.70)',
    glassBorder: 'rgba(255, 255, 255, 0.14)',
    onCover: '#F5F6F8',
    sheet: '#0E0F13',
    hairline: 'rgba(255, 255, 255, 0.10)',
    skeleton: 'rgba(255, 255, 255, 0.06)',
    skeletonHighlight: 'rgba(255, 255, 255, 0.12)',
    accent: '#FF5A1F',
    accentInk: '#000000',
    up: '#7FD6A8',
    down: '#FF7A5C',
    inverseBg: '#F5F6F8',
    inverseText: '#000000',
  },
};

// ─── Atlantis ─────────────────────────────────────────────────────────────────
// Deep-water gradient, an old-world serif, very round frosted shapes.
// The background is smooth, so frosted cards stay easy to read. After the health reference.
// The cover looks up through a kelp forest at the sun; each topic opens with a depth gauge that reads
// a little deeper as the edition goes on.
const atlantis: Theme = {
  name: 'atlantis',
  label: 'Atlantis',
  group: 'classic',
  tagline: 'Deep water, old-world serif',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../assets/themes/atlantis.jpg'),
  credit: {
    title: 'Kelp forest, Channel Islands NMS',
    author: 'NOAA Photo Library',
    license: 'Public domain',
    url: 'https://commons.wikimedia.org/wiki/File:Kelp_forest,_Channel_Islands_NMS.jpg',
    adapted: true,
  },
  background: ['#0A3850', '#06263B', '#041828', '#020D17'],
  // Cormorant's default numerals are old-style ("II" for 11), so numbers use lining figures.
  type: {
    displayXL: { fontFamily: 'CormorantGaramond_500Medium_Italic', fontSize: 70, lineHeight: 84, letterSpacing: -1, paddingRight: 8 },
    displayL: { fontFamily: 'CormorantGaramond_500Medium_Italic', fontSize: 44, lineHeight: 54, letterSpacing: -0.6, paddingRight: 6, fontVariant: ['lining-nums'] },
    displayM: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, lineHeight: 37, letterSpacing: -0.3, fontVariant: ['lining-nums'] },
    displayS: { fontFamily: 'CormorantGaramond_500Medium', fontSize: 28, lineHeight: 34, fontVariant: ['lining-nums'] },
    stat: { fontFamily: 'CormorantGaramond_500Medium', fontSize: 56, lineHeight: 66, letterSpacing: -1, fontVariant: ['lining-nums'] },
    mega: { fontFamily: 'CormorantGaramond_500Medium_Italic', fontSize: 96, lineHeight: 112, paddingRight: 10 },
    headline: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 28, lineHeight: 34, letterSpacing: -0.2, fontVariant: ['lining-nums'] },
    kicker: { fontSize: 11, letterSpacing: 2.4 },
    spaced: { fontSize: 11, letterSpacing: 5 },
  },
  shape: { scale: 1.1, control: 999 },
  surface: 'glass',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  leadTile: 'card',
  lines: {
    signOff: 'Time to surface.',
    emptySaved: 'Nothing salvaged yet',
  },
  colors: {
    bg: '#06263B',
    card: 'rgba(150, 215, 240, 0.09)',
    cardBorder: 'rgba(170, 225, 255, 0.16)',
    text: '#EDF7FB',
    textSecondary: 'rgba(237, 247, 251, 0.76)',
    textTertiary: 'rgba(237, 247, 251, 0.64)',
    glassFill: 'rgba(150, 215, 240, 0.12)',
    glassOverlay: 'rgba(4, 30, 46, 0.40)',
    glassFillFallback: 'rgba(16, 58, 80, 0.94)',
    glassOverlayFallback: 'rgba(4, 30, 46, 0.70)',
    glassBorder: 'rgba(170, 225, 255, 0.18)',
    onCover: '#EDF7FB',
    sheet: '#072B40',
    hairline: 'rgba(170, 225, 255, 0.12)',
    skeleton: 'rgba(170, 225, 255, 0.07)',
    skeletonHighlight: 'rgba(170, 225, 255, 0.14)',
    accent: '#7FD8E0',
    accentInk: '#032230',
    up: '#8FE0BE',
    down: '#FFA48E',
    inverseBg: '#EDF7FB',
    inverseText: '#05263A',
  },
};

// ─── Highlands ────────────────────────────────────────────────────────────────
// Forest greens, bold italic headings, chunky rounded tiles with big italic numbers, one fern-green
// accent. The cover is Buachaille Etive Mòr at the head of Glen Coe, with the little white cottage at
// its foot; the stories tile is moss, the fern kept for small marks. Each topic opens at a waymarker
// ("Stage 2"). After the hiking reference.
const highlands: Theme = {
  name: 'highlands',
  label: 'Highlands',
  group: 'classic',
  tagline: 'Moss, stone and bold italics',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 36,
  cover: require('../../assets/themes/highlands.jpg'),
  credit: {
    title: 'Lagangarbh cottage with Buachaille Etive Mòr',
    author: 'Colin',
    license: BY_SA('4.0'),
    url: 'https://commons.wikimedia.org/wiki/File:Lagangarbh_cottage_with_Buachaille_Etive_M%C3%B2r.jpg',
    adapted: true,
  },
  background: ['#121A15', '#0D130F'],
  type: {
    displayXL: { fontFamily: 'Barlow_700Bold_Italic', fontSize: 60, lineHeight: 72, letterSpacing: -1.2, paddingRight: 6 },
    displayL: { fontFamily: 'Barlow_700Bold_Italic', fontSize: 38, lineHeight: 46, letterSpacing: -0.6, paddingRight: 4 },
    displayM: { fontFamily: 'Barlow_600SemiBold_Italic', fontSize: 26, lineHeight: 32, letterSpacing: -0.3, paddingRight: 3 },
    displayS: { fontFamily: 'Barlow_600SemiBold', fontSize: 24, lineHeight: 30 },
    stat: { fontFamily: 'Barlow_700Bold_Italic', fontSize: 56, lineHeight: 66, letterSpacing: -1, paddingRight: 4 },
    mega: { fontFamily: 'Barlow_800ExtraBold_Italic', fontSize: 88, lineHeight: 104, letterSpacing: -2, paddingRight: 10 },
    headline: { fontFamily: 'Barlow_600SemiBold', fontSize: 24, lineHeight: 29, letterSpacing: -0.1 },
    title: { fontFamily: 'Barlow_600SemiBold', fontSize: 18 },
    label: { fontFamily: 'Barlow_600SemiBold', fontSize: 15 },
    caption: { fontFamily: 'Barlow_500Medium', fontSize: 13 },
    kicker: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, lineHeight: 15, letterSpacing: 1.6 },
    spaced: { fontFamily: 'Barlow_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 3.5 },
  },
  shape: { scale: 0.9, control: 999 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  leadTile: { fill: '#2C4733', ink: '#EFF3EC' },
  lines: {
    signOff: 'That’s the summit for today.',
    emptySaved: 'Your pack is empty',
  },
  colors: {
    bg: '#121A15',
    card: '#1B251F',
    cardBorder: 'rgba(222, 238, 215, 0.08)',
    text: '#EFF3EC',
    textSecondary: 'rgba(239, 243, 236, 0.74)',
    textTertiary: 'rgba(239, 243, 236, 0.58)',
    glassFill: 'rgba(30, 40, 33, 0.62)',
    glassOverlay: 'rgba(16, 22, 18, 0.45)',
    glassFillFallback: 'rgba(28, 36, 30, 0.95)',
    glassOverlayFallback: 'rgba(16, 22, 18, 0.72)',
    glassBorder: 'rgba(222, 238, 215, 0.13)',
    onCover: '#FFFFFF',
    sheet: '#18211B',
    hairline: 'rgba(222, 238, 215, 0.09)',
    skeleton: 'rgba(222, 238, 215, 0.06)',
    skeletonHighlight: 'rgba(222, 238, 215, 0.12)',
    accent: '#A6CF84',
    accentInk: '#0F1F10',
    up: '#9AD6A4',
    down: '#EBA287',
    inverseBg: '#EFF3EC',
    inverseText: '#121813',
  },
};

// ─── Alpine ───────────────────────────────────────────────────────────────────
// Swiss poster style: white cards, heavy tight grotesk, signal red, crisp corners. The cover is the
// Matterhorn from Gornergrat, a red mountain train waiting in the snow where it fades out. Each topic
// opens on a grid: a heavy black rule, the section number in red, the topic in bold.
const alpine: Theme = {
  name: 'alpine',
  label: 'Alpine',
  group: 'classic',
  tagline: 'Snow-white, Swiss red',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 50,
  cover: require('../../assets/themes/alpine.jpg'),
  credit: {
    title: 'GGB Bhe 2/4 at Gornergrat',
    author: 'Kabelleger / David Gubler',
    license: BY_SA('3.0'),
    url: 'https://commons.wikimedia.org/wiki/File:GGB_Bhe_2-4_Gornergrat.jpg',
    adapted: true,
  },
  background: ['#EEF0F2'],
  type: {
    displayXL: { fontFamily: 'Inter_700Bold', fontSize: 54, lineHeight: 64, letterSpacing: -2.4 },
    displayL: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -1.4 },
    displayM: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: -0.7 },
    displayS: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 24, letterSpacing: -0.5 },
    stat: { fontFamily: 'Inter_700Bold', fontSize: 46, lineHeight: 56, letterSpacing: -2.2 },
    mega: { fontFamily: 'Inter_700Bold', fontSize: 80, lineHeight: 94, letterSpacing: -3.6 },
    headline: { fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 27, letterSpacing: -0.6 },
    kicker: { fontFamily: 'Inter_700Bold', fontSize: 10.5, lineHeight: 14, letterSpacing: 1.3 },
    spaced: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 3 },
  },
  shape: { scale: 0.4, control: 999 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  lines: {
    signOff: 'Next departure tomorrow, on the minute.',
    brewing: 'Arriving on schedule',
  },
  colors: {
    bg: '#EEF0F2',
    card: '#FFFFFF',
    cardBorder: 'rgba(15, 19, 24, 0.06)',
    text: '#0F1318',
    textSecondary: 'rgba(15, 19, 24, 0.72)',
    textTertiary: 'rgba(15, 19, 24, 0.62)',
    glassFill: 'rgba(255, 255, 255, 0.72)',
    glassOverlay: 'rgba(255, 255, 255, 0.62)',
    glassFillFallback: 'rgba(255, 255, 255, 0.95)',
    glassOverlayFallback: 'rgba(255, 255, 255, 0.85)',
    glassBorder: 'rgba(15, 19, 24, 0.09)',
    onCover: '#0F1318',
    sheet: '#F7F8F9',
    hairline: 'rgba(15, 19, 24, 0.08)',
    skeleton: 'rgba(15, 19, 24, 0.06)',
    skeletonHighlight: 'rgba(15, 19, 24, 0.11)',
    // Signal red, just deep enough to read as small text on the grey page as well as on white.
    accent: '#D0221A',
    accentInk: '#FFFFFF',
    up: '#157A49',
    down: '#C8251C',
    inverseBg: '#0F1318',
    inverseText: '#FFFFFF',
  },
};

// ─── Matrix ───────────────────────────────────────────────────────────────────
// A terminal: black, phosphor green, monospace everything, square corners.
// The cover is a real DEC VT100's screen, its directory listing turned phosphor green.
// Sections open on a prompt ("> world_"). Reading text is pale green-white, not pure green.
const matrix: Theme = {
  name: 'matrix',
  label: 'Matrix',
  group: 'films',
  tagline: 'Green phosphor, terminal type',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../assets/themes/matrix.jpg'),
  credit: {
    title: 'DEC VT100 terminal',
    author: 'Jason Scott',
    license: BY('2.0'),
    url: 'https://commons.wikimedia.org/wiki/File:DEC_VT100_terminal.jpg',
    adapted: true,
  },
  background: ['#000000'],
  type: {
    displayXL: { fontFamily: 'ShareTechMono_400Regular', fontSize: 46, lineHeight: 56, letterSpacing: 1, textTransform: 'uppercase' },
    displayL: { fontFamily: 'ShareTechMono_400Regular', fontSize: 30, lineHeight: 38, letterSpacing: 0.5 },
    displayM: { fontFamily: 'ShareTechMono_400Regular', fontSize: 21, lineHeight: 28, letterSpacing: 0.4 },
    displayS: { fontFamily: 'ShareTechMono_400Regular', fontSize: 20, lineHeight: 26 },
    stat: { fontFamily: 'ShareTechMono_400Regular', fontSize: 46, lineHeight: 56, letterSpacing: -1 },
    mega: { fontFamily: 'ShareTechMono_400Regular', fontSize: 72, lineHeight: 86 },
    headline: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 18.5, lineHeight: 26, letterSpacing: -0.3 },
    title: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 16, lineHeight: 22 },
    reading: { fontFamily: 'IBMPlexMono_400Regular', fontSize: 15.5, lineHeight: 26, letterSpacing: -0.2 },
    body: { fontFamily: 'IBMPlexMono_400Regular', fontSize: 14, lineHeight: 22, letterSpacing: -0.2 },
    bodySm: { fontFamily: 'IBMPlexMono_400Regular', fontSize: 12.5, lineHeight: 19, letterSpacing: -0.1 },
    label: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 13.5, lineHeight: 18 },
    caption: { fontFamily: 'IBMPlexMono_400Regular', fontSize: 11.5, lineHeight: 16 },
    kicker: { fontFamily: 'ShareTechMono_400Regular', fontSize: 12, lineHeight: 15, letterSpacing: 1.6 },
    spaced: { fontFamily: 'ShareTechMono_400Regular', fontSize: 12, lineHeight: 16, letterSpacing: 3.5 },
  },
  shape: { scale: 0.08, control: 2 },
  surface: 'outline',
  layout: { heroAlign: 'left', sections: 'prompt', capsButtons: true },
  lines: {
    signOff: 'Follow the white rabbit.',
    brewing: 'Wake up…',
    noResults: 'There is no spoon',
  },
  colors: {
    bg: '#000000',
    card: '#030A05',
    cardBorder: 'rgba(60, 255, 120, 0.20)',
    text: '#D6F5DD',
    textSecondary: 'rgba(160, 235, 180, 0.80)',
    textTertiary: 'rgba(120, 220, 150, 0.60)',
    glassFill: 'rgba(4, 22, 10, 0.62)',
    glassOverlay: 'rgba(0, 10, 4, 0.55)',
    glassFillFallback: 'rgba(4, 18, 9, 0.95)',
    glassOverlayFallback: 'rgba(0, 10, 4, 0.78)',
    glassBorder: 'rgba(60, 255, 120, 0.24)',
    onCover: '#D6F5DD',
    sheet: '#020904',
    hairline: 'rgba(60, 255, 120, 0.14)',
    skeleton: 'rgba(60, 255, 120, 0.06)',
    skeletonHighlight: 'rgba(60, 255, 120, 0.13)',
    accent: '#3CFF7A',
    accentInk: '#001A08',
    up: '#3CFF7A',
    down: '#FF6B5E',
    inverseBg: '#3CFF7A',
    inverseText: '#001A08',
  },
};

// ─── Tron ─────────────────────────────────────────────────────────────────────
// The Grid: black glass, cyan light lines, wide futurist capitals, clipped corners. The cover is a
// highway interchange at night seen from above, its traffic turned to cyan light trails.
// Sections open on a title over a light-cycle trail that turns a hard corner and ends in a disc.
const tron: Theme = {
  name: 'tron',
  label: 'Tron',
  group: 'films',
  tagline: 'The Grid: black glass and light lines',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../assets/themes/tron.jpg'),
  credit: {
    title: 'Waru Interchange, Surabaya, at night',
    author: 'consigliere ivan',
    license: BY('2.0'),
    url: 'https://commons.wikimedia.org/wiki/File:Waru_Interchange_and_City_of_Tomorrow_Superblocks,_bordering_with_Surabaya_and_Sidoarjo_(July_2018)..jpg',
    adapted: true,
  },
  background: ['#03070D', '#010205'],
  type: {
    displayXL: { fontFamily: 'Orbitron_700Bold', fontSize: 38, lineHeight: 48, letterSpacing: 4, textTransform: 'uppercase' },
    displayL: { fontFamily: 'Orbitron_600SemiBold', fontSize: 22, lineHeight: 30, letterSpacing: 2.4, textTransform: 'uppercase' },
    displayM: { fontFamily: 'Orbitron_600SemiBold', fontSize: 15, lineHeight: 22, letterSpacing: 1.8, textTransform: 'uppercase' },
    displayS: { fontFamily: 'Orbitron_500Medium', fontSize: 18, lineHeight: 24, letterSpacing: 1 },
    stat: { fontFamily: 'Orbitron_500Medium', fontSize: 40, lineHeight: 50 },
    mega: { fontFamily: 'Orbitron_800ExtraBold', fontSize: 56, lineHeight: 70, letterSpacing: 4, textTransform: 'uppercase' },
    headline: { fontFamily: 'Rajdhani_600SemiBold', fontSize: 23, lineHeight: 28, letterSpacing: 0.1 },
    title: { fontFamily: 'Rajdhani_600SemiBold', fontSize: 18, lineHeight: 22 },
    label: { fontFamily: 'Rajdhani_600SemiBold', fontSize: 15.5, lineHeight: 19, letterSpacing: 0.6 },
    caption: { fontFamily: 'Rajdhani_500Medium', fontSize: 13.5, lineHeight: 17, letterSpacing: 0.3 },
    kicker: { fontFamily: 'Rajdhani_700Bold', fontSize: 12.5, lineHeight: 15, letterSpacing: 2.4 },
    spaced: { fontFamily: 'Orbitron_500Medium', fontSize: 10.5, lineHeight: 15, letterSpacing: 4 },
  },
  shape: { scale: 0.2, control: 4 },
  surface: 'outline',
  layout: { heroAlign: 'left', sections: 'circuit', capsButtons: true },
  lines: {
    signOff: 'End of line.',
    brewing: 'Greetings, program',
    emptySaved: 'Your disc is empty',
  },
  colors: {
    bg: '#03070D',
    card: '#050C15',
    cardBorder: 'rgba(110, 230, 255, 0.30)',
    text: '#E4FAFF',
    textSecondary: 'rgba(214, 244, 252, 0.74)',
    textTertiary: 'rgba(180, 230, 245, 0.56)',
    glassFill: 'rgba(8, 24, 38, 0.60)',
    glassOverlay: 'rgba(2, 8, 14, 0.50)',
    glassFillFallback: 'rgba(8, 20, 32, 0.95)',
    glassOverlayFallback: 'rgba(2, 8, 14, 0.75)',
    glassBorder: 'rgba(110, 230, 255, 0.32)',
    onCover: '#E4FAFF',
    sheet: '#050B13',
    hairline: 'rgba(110, 230, 255, 0.16)',
    skeleton: 'rgba(110, 230, 255, 0.06)',
    skeletonHighlight: 'rgba(110, 230, 255, 0.13)',
    accent: '#6FE6FF',
    accentInk: '#00141B',
    up: '#6FE6FF',
    down: '#FF8A3D',
    inverseBg: '#6FE6FF',
    inverseText: '#00141B',
  },
};

// ─── Blade Runner ─────────────────────────────────────────────────────────────
// Amber haze over a dark city: a warm smoky gradient, frosted panels, a squared-off
// techno face, and one neon pink accent. The cover is a Tokyo alley on a wet night, lanterns and
// signs glowing over the umbrellas; some days an origami unicorn turns up on a section heading
// (components/headings/films.tsx).
const bladerunner: Theme = {
  name: 'bladerunner',
  label: 'Blade Runner',
  group: 'films',
  tagline: 'Amber haze, neon in the rain',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 34,
  cover: require('../../assets/themes/bladerunner.jpg'),
  credit: {
    title: 'A Tokyo alley in the rain',
    author: 'Toomore Chiang',
    license: BY('2.0'),
    url: 'https://commons.wikimedia.org/wiki/File:2%E7%95%AA%E7%9B%AE%E3%81%AB_(22035861012).jpg',
    adapted: true,
  },
  background: ['#2B1309', '#1A0B06', '#0D0604'],
  type: {
    displayXL: { fontFamily: 'Oxanium_300Light', fontSize: 58, lineHeight: 70, letterSpacing: -1 },
    displayL: { fontFamily: 'Oxanium_400Regular', fontSize: 36, lineHeight: 44, letterSpacing: -0.6 },
    displayM: { fontFamily: 'Oxanium_600SemiBold', fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
    displayS: { fontFamily: 'Oxanium_500Medium', fontSize: 20, lineHeight: 26 },
    stat: { fontFamily: 'Oxanium_300Light', fontSize: 50, lineHeight: 60, letterSpacing: -1.4 },
    mega: { fontFamily: 'Oxanium_700Bold', fontSize: 80, lineHeight: 96, letterSpacing: -2 },
    headline: { fontFamily: 'Oxanium_600SemiBold', fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
    title: { fontFamily: 'Oxanium_600SemiBold', fontSize: 17, lineHeight: 22 },
    label: { fontFamily: 'Oxanium_500Medium', fontSize: 14.5, lineHeight: 18 },
    caption: { fontFamily: 'Oxanium_400Regular', fontSize: 12, lineHeight: 16 },
    kicker: { fontFamily: 'Oxanium_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 2.4 },
    spaced: { fontFamily: 'Oxanium_500Medium', fontSize: 11.5, lineHeight: 16, letterSpacing: 5 },
  },
  shape: { scale: 0.45, control: 6 },
  surface: 'glass',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  lines: {
    signOff: 'Like tears in rain.',
    emptySaved: 'No memories yet',
    noResults: 'Enhance. Still nothing',
  },
  colors: {
    bg: '#1A0B06',
    card: 'rgba(255, 170, 100, 0.08)',
    cardBorder: 'rgba(255, 180, 120, 0.16)',
    text: '#FCEBDD',
    textSecondary: 'rgba(252, 235, 221, 0.74)',
    textTertiary: 'rgba(252, 235, 221, 0.56)',
    glassFill: 'rgba(255, 170, 100, 0.10)',
    glassOverlay: 'rgba(30, 10, 4, 0.42)',
    glassFillFallback: 'rgba(52, 24, 14, 0.95)',
    glassOverlayFallback: 'rgba(30, 10, 4, 0.72)',
    glassBorder: 'rgba(255, 180, 120, 0.18)',
    onCover: '#FCEBDD',
    sheet: '#211008',
    hairline: 'rgba(255, 180, 120, 0.12)',
    skeleton: 'rgba(255, 180, 120, 0.06)',
    skeletonHighlight: 'rgba(255, 180, 120, 0.13)',
    accent: '#FF4FA0',
    accentInk: '#1C0410',
    up: '#5FE0D2',
    down: '#FF8A5C',
    inverseBg: '#FCEBDD',
    inverseText: '#1A0B06',
  },
};

// ─── Budapest ─────────────────────────────────────────────────────────────────
// A grand pastel hotel: pink and plum, an elegant serif with Futura-style capitals,
// everything centered and symmetrical, cards with a printed double border. The cover is the
// Grandhotel Pupp in Karlovy Vary, the film's model, its cream stone washed pastel pink under a deep
// blue sky. Sections open under a concierge's crossed keys (components/headings/films.tsx).
const budapest: Theme = {
  name: 'budapest',
  label: 'Budapest',
  group: 'films',
  tagline: 'Pastel pink, perfect symmetry',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 40,
  cover: require('../../assets/themes/budapest.jpg'),
  credit: {
    title: 'Grandhotel Pupp, Karlovy Vary',
    author: 'Manecke',
    license: BY_SA('3.0'),
    url: 'https://commons.wikimedia.org/wiki/File:Grandhotel_Pupp_(3).JPG',
    adapted: true,
  },
  background: ['#F2D6D3', '#EDCBC8'],
  type: {
    displayXL: { fontFamily: 'PlayfairDisplay_500Medium_Italic', fontSize: 50, lineHeight: 64, letterSpacing: -0.5, paddingHorizontal: 4 },
    displayL: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 30, lineHeight: 40, letterSpacing: -0.3 },
    displayM: { fontFamily: 'Jost_600SemiBold', fontSize: 15, lineHeight: 22, letterSpacing: 3.6, paddingLeft: 3.6, textTransform: 'uppercase' },
    displayS: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 22, lineHeight: 28, fontVariant: ['lining-nums'] },
    stat: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 48, lineHeight: 60, fontVariant: ['lining-nums'] },
    mega: { fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 80, lineHeight: 100, paddingRight: 8 },
    headline: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 21, lineHeight: 28, letterSpacing: -0.1, fontVariant: ['lining-nums'] },
    title: { fontFamily: 'Jost_500Medium', fontSize: 17, lineHeight: 22 },
    label: { fontFamily: 'Jost_500Medium', fontSize: 14.5, lineHeight: 18, letterSpacing: 0.3 },
    caption: { fontFamily: 'Jost_400Regular', fontSize: 12.5, lineHeight: 16, letterSpacing: 0.3 },
    kicker: { fontFamily: 'Jost_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 2.8 },
    spaced: { fontFamily: 'Jost_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 5.5, paddingLeft: 5.5 },
  },
  shape: { scale: 0.25, control: 3 },
  surface: 'framed',
  layout: { heroAlign: 'center', sections: 'rule', capsButtons: true },
  lines: {
    signOff: 'With the compliments of the Society of the Crossed Keys.',
    // Broken by hand: the wide-set capitals would otherwise leave one word on the second line.
    brewing: 'Still in the oven\nat Mendl’s',
    noResults: 'No one by that name\nin the register',
  },
  colors: {
    bg: '#F2D6D3',
    card: '#FBEFEC',
    cardBorder: 'rgba(92, 34, 66, 0.22)',
    text: '#3A1730',
    textSecondary: 'rgba(58, 23, 48, 0.76)',
    textTertiary: 'rgba(58, 23, 48, 0.69)',
    glassFill: 'rgba(251, 239, 236, 0.72)',
    glassOverlay: 'rgba(251, 239, 236, 0.58)',
    glassFillFallback: 'rgba(251, 239, 236, 0.94)',
    glassOverlayFallback: 'rgba(251, 239, 236, 0.82)',
    glassBorder: 'rgba(92, 34, 66, 0.18)',
    onCover: '#3A1730',
    sheet: '#F8E6E3',
    hairline: 'rgba(92, 34, 66, 0.16)',
    skeleton: 'rgba(92, 34, 66, 0.06)',
    skeletonHighlight: 'rgba(92, 34, 66, 0.11)',
    accent: '#6B2A5E',
    accentInk: '#FBEFEC',
    up: '#3E7A5A',
    down: '#B5323F',
    inverseBg: '#3A1730',
    inverseText: '#FBEFEC',
  },
};

const ORDERED: Theme[] = [
  ...glassThemes,
  ...whalesThemes,
  space,
  atlantis,
  highlands,
  alpine,
  dune,
  matrix,
  tron,
  bladerunner,
  budapest,
  ...filmThemes,
  ...horrorThemes,
];

export const themes = Object.fromEntries(ORDERED.map((t) => [t.name, t])) as Record<ThemeName, Theme>;

/** Picker order: Classic, then Films, then Horror, then Custom. */
export const THEME_ORDER: ThemeName[] = THEME_GROUPS.flatMap((g) =>
  ORDERED.filter((t) => t.group === g.id).map((t) => t.name),
);

/**
 * Typefaces the theme packs use (about 9 MB). Startup waits only for the current theme's pack
 * (fontsForTheme); app/_layout.tsx loads the rest in the background once the app is up.
 */
export const packFonts: Record<string, FontSource> = { ...glassFonts, ...whalesFonts, ...filmFonts, ...horrorFonts };

const PACKS: [Theme[], Record<string, FontSource>][] = [
  [glassThemes, glassFonts],
  [whalesThemes, whalesFonts],
  [filmThemes, filmFonts],
  [horrorThemes, horrorFonts],
];

/** The typefaces a theme needs beyond the classic ones (empty for the classic themes). */
export function fontsForTheme(name: ThemeName): Record<string, FontSource> {
  return PACKS.find(([list]) => list.some((t) => t.name === name))?.[1] ?? {};
}

/**
 * For screens that preview every theme in its own type (the theme picker): loads all the packs'
 * typefaces if they aren't yet, and re-renders once they are.
 */
export function usePackFonts() {
  useFonts(packFonts);
}

/** Theme names from before the current themes (saved in older settings). */
const LEGACY: Record<string, ThemeName> = { dark: 'space', earth: 'highlands', light: 'alpine', overlook: 'nosferatu' };

export function resolveThemeName(name: string | null | undefined): ThemeName {
  if (name && name in themes) return name as ThemeName;
  return (name && LEGACY[name]) || 'dune';
}

/**
 * The theme's background color at a height on the screen (0 = top, 1 = bottom), where the background
 * is a gradient fixed to the screen. Null when its colors aren't plain '#RRGGBB'.
 */
export function backgroundAt(theme: Theme, at: number): string | null {
  const stops = theme.background;
  if (!stops.every((c) => /^#[0-9a-f]{6}$/i.test(c))) return null;
  if (stops.length === 1) return stops[0];
  const pos = Math.min(1, Math.max(0, at)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  const channel = (c: string, k: number) => parseInt(c.slice(1 + k * 2, 3 + k * 2), 16);
  const mixed = [0, 1, 2].map((k) => Math.round(channel(stops[i], k) * (1 - f) + channel(stops[i + 1], k) * f));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A default radius (from tokens.radii) in this theme's shape language. */
export function themeRadius(theme: Theme, r: number): number {
  return r >= 999 ? theme.shape.control : Math.round(r * theme.shape.scale);
}
