import type { ImageSourcePropType, TextStyle } from 'react-native';

import { TOPIC_LABEL, type TopicKey } from '@/data/topics';

export { TOPIC_LABEL, type TopicKey };

export type ThemeName = 'dune' | 'space' | 'atlantis' | 'highlands' | 'alpine';

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
 * A theme is a whole look, not just colors: its own typefaces, corner shapes,
 * card style, header layout and section style.
 */
export type Theme = {
  name: ThemeName;
  label: string;
  /** One line under the name in the theme picker. */
  tagline: string;
  isDark: boolean;
  blurTint: 'dark' | 'light';
  blurIntensity: number;
  /** Photo at the top of Today and the Reading List. It fades into the background before any text. */
  cover: ImageSourcePropType;
  credit: PhotoCredit;
  /** Behind everything below the cover: one color, or a slow top-to-bottom gradient. */
  background: [string, ...string[]];
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
   * solid = opaque card · outline = opaque card with a crisp border · glass = frosted over a smooth gradient.
   */
  surface: 'solid' | 'outline' | 'glass';
  layout: {
    /** Where the date sits on the cover. */
    heroAlign: 'left' | 'center';
    /**
     * How each topic opens: rule = "── WORLD ──" centered, cover = photo card with the
     * topic as a giant word, title = the topic in large type.
     */
    sections: 'rule' | 'cover' | 'title';
    /** Buttons and chips use small spaced capitals. */
    capsButtons: boolean;
  };
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

// ─── Dune ─────────────────────────────────────────────────────────────────────
// Sand-colored and light, wide-set capitals like the film's titles, sharp
// architectural corners, everything centered. After the travel reference.
const dune: Theme = {
  name: 'dune',
  label: 'Dune',
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
    displayXL: { fontFamily: 'Syncopate_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: 4, textTransform: 'uppercase' },
    displayL: { fontFamily: 'Syncopate_700Bold', fontSize: 20, lineHeight: 28, letterSpacing: 3, textTransform: 'uppercase' },
    displayM: { fontFamily: 'Syncopate_700Bold', fontSize: 14, lineHeight: 20, letterSpacing: 2.4, textTransform: 'uppercase' },
    displayS: { fontFamily: 'Syncopate_400Regular', fontSize: 15, lineHeight: 22, letterSpacing: 1 },
    stat: { fontFamily: 'Syncopate_700Bold', fontSize: 34, lineHeight: 42, letterSpacing: 0 },
    mega: { fontFamily: 'Syncopate_700Bold', fontSize: 52, lineHeight: 60, letterSpacing: 2, textTransform: 'uppercase' },
    headline: { fontFamily: 'Inter_600SemiBold', fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
    title: { fontFamily: 'Inter_600SemiBold' },
    kicker: { fontFamily: 'Syncopate_700Bold', fontSize: 9, lineHeight: 13, letterSpacing: 2.2 },
    spaced: { fontFamily: 'Syncopate_700Bold', fontSize: 10, lineHeight: 14, letterSpacing: 4 },
  },
  shape: { scale: 0.15, control: 3 },
  surface: 'solid',
  layout: { heroAlign: 'center', sections: 'rule', capsButtons: true },
  colors: {
    bg: '#E9DAC2',
    card: '#F6EEE1',
    cardBorder: 'rgba(58, 38, 22, 0.10)',
    text: '#2A1C12',
    textSecondary: 'rgba(42, 28, 18, 0.72)',
    textTertiary: 'rgba(42, 28, 18, 0.56)',
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
    accent: '#A94A1C',
    accentInk: '#FBF4EA',
    up: '#4A6E35',
    down: '#A23E1C',
    inverseBg: '#2A1C12',
    inverseText: '#F6EEE1',
  },
};

// ─── Space ────────────────────────────────────────────────────────────────────
// Pure black, mission-control monospace details, one signal-orange accent.
// Each topic opens on a photo card with the topic as a giant word (the month-cards reference).
const space: Theme = {
  name: 'space',
  label: 'Space',
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
    displayXL: { fontFamily: 'SpaceGrotesk_300Light', fontSize: 62, lineHeight: 70, letterSpacing: -2.4 },
    displayL: { fontFamily: 'SpaceGrotesk_300Light', fontSize: 40, lineHeight: 46, letterSpacing: -1.4 },
    displayM: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
    displayS: { fontFamily: 'SpaceMono_400Regular', fontSize: 18, lineHeight: 24 },
    stat: { fontFamily: 'SpaceGrotesk_300Light', fontSize: 46, lineHeight: 52, letterSpacing: -2 },
    mega: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 84, lineHeight: 84, letterSpacing: -3.5 },
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
const atlantis: Theme = {
  name: 'atlantis',
  label: 'Atlantis',
  tagline: 'Deep water, old-world serif',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 30,
  cover: require('../../assets/themes/atlantis.jpg'),
  credit: {
    title: 'Isla de Corbera, Santander, España',
    author: 'Diego Delso',
    license: BY_SA('4.0'),
    url: 'https://commons.wikimedia.org/wiki/File:Isla_de_Corbera,_Santander,_Espa%C3%B1a,_2019-08-15,_DD_68.jpg',
    adapted: true,
  },
  background: ['#0A3850', '#06263B', '#041828', '#020D17'],
  // Cormorant's default numerals are old-style ("II" for 11), so numbers use lining figures.
  type: {
    displayXL: { fontFamily: 'CormorantGaramond_500Medium_Italic', fontSize: 70, lineHeight: 78, letterSpacing: -1 },
    displayL: { fontFamily: 'CormorantGaramond_500Medium_Italic', fontSize: 44, lineHeight: 50, letterSpacing: -0.6 },
    displayM: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
    displayS: { fontFamily: 'CormorantGaramond_500Medium', fontSize: 28, lineHeight: 30, fontVariant: ['lining-nums'] },
    stat: { fontFamily: 'CormorantGaramond_500Medium', fontSize: 56, lineHeight: 60, letterSpacing: -1, fontVariant: ['lining-nums'] },
    mega: { fontFamily: 'CormorantGaramond_500Medium_Italic', fontSize: 96, lineHeight: 96 },
    headline: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 28, lineHeight: 32, letterSpacing: -0.2, fontVariant: ['lining-nums'] },
    kicker: { fontSize: 11, letterSpacing: 2.4 },
    spaced: { fontSize: 11, letterSpacing: 5 },
  },
  shape: { scale: 1.1, control: 999 },
  surface: 'glass',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  colors: {
    bg: '#06263B',
    card: 'rgba(150, 215, 240, 0.09)',
    cardBorder: 'rgba(170, 225, 255, 0.16)',
    text: '#EDF7FB',
    textSecondary: 'rgba(237, 247, 251, 0.74)',
    textTertiary: 'rgba(237, 247, 251, 0.56)',
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
// Forest greens, bold italic headings, chunky rounded tiles with big numbers.
// After the hiking reference.
const highlands: Theme = {
  name: 'highlands',
  label: 'Highlands',
  tagline: 'Moss, stone and bold italics',
  isDark: true,
  blurTint: 'dark',
  blurIntensity: 36,
  cover: require('../../assets/themes/highlands.jpg'),
  credit: {
    title: 'Mount Lushan, fog',
    author: 'pfctdayelise',
    license: BY_SA('2.5'),
    url: 'https://commons.wikimedia.org/wiki/File:Mount_Lushan_-_fog.JPG',
    adapted: true,
  },
  background: ['#141B16', '#0F1411'],
  type: {
    displayXL: { fontFamily: 'Barlow_700Bold_Italic', fontSize: 60, lineHeight: 66, letterSpacing: -1.2 },
    displayL: { fontFamily: 'Barlow_700Bold_Italic', fontSize: 38, lineHeight: 44, letterSpacing: -0.6 },
    displayM: { fontFamily: 'Barlow_600SemiBold_Italic', fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
    displayS: { fontFamily: 'Barlow_600SemiBold', fontSize: 24, lineHeight: 28 },
    stat: { fontFamily: 'Barlow_600SemiBold', fontSize: 52, lineHeight: 56, letterSpacing: -1 },
    mega: { fontFamily: 'Barlow_800ExtraBold_Italic', fontSize: 92, lineHeight: 92, letterSpacing: -2 },
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
  colors: {
    bg: '#141B16',
    card: '#1C241E',
    cardBorder: 'rgba(225, 240, 222, 0.07)',
    text: '#EFF3EC',
    textSecondary: 'rgba(239, 243, 236, 0.72)',
    textTertiary: 'rgba(239, 243, 236, 0.54)',
    glassFill: 'rgba(30, 40, 33, 0.62)',
    glassOverlay: 'rgba(16, 22, 18, 0.45)',
    glassFillFallback: 'rgba(28, 36, 30, 0.95)',
    glassOverlayFallback: 'rgba(16, 22, 18, 0.72)',
    glassBorder: 'rgba(225, 240, 222, 0.12)',
    onCover: '#FFFFFF',
    sheet: '#19211B',
    hairline: 'rgba(225, 240, 222, 0.09)',
    skeleton: 'rgba(225, 240, 222, 0.06)',
    skeletonHighlight: 'rgba(225, 240, 222, 0.12)',
    accent: '#4C8160',
    accentInk: '#F2F8F0',
    up: '#9AD6A4',
    down: '#EBA287',
    inverseBg: '#EFF3EC',
    inverseText: '#121813',
  },
};

// ─── Alpine ───────────────────────────────────────────────────────────────────
// Swiss poster style: white cards, heavy tight grotesk, signal red.
const alpine: Theme = {
  name: 'alpine',
  label: 'Alpine',
  tagline: 'Snow-white, Swiss red',
  isDark: false,
  blurTint: 'light',
  blurIntensity: 50,
  cover: require('../../assets/themes/alpine.jpg'),
  credit: {
    title: 'Langkofel group from the Sella pass',
    author: 'Wolfgang Moroder',
    license: BY_SA('3.0'),
    url: 'https://commons.wikimedia.org/wiki/File:Langkofel_group_from_the_Sella_pass_2016.jpg',
    adapted: true,
  },
  background: ['#EEF0F2'],
  type: {
    displayXL: { fontFamily: 'Inter_700Bold', fontSize: 54, lineHeight: 60, letterSpacing: -2.4 },
    displayL: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -1.4 },
    displayM: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: -0.7 },
    displayS: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 24, letterSpacing: -0.5 },
    stat: { fontFamily: 'Inter_700Bold', fontSize: 46, lineHeight: 52, letterSpacing: -2.2 },
    mega: { fontFamily: 'Inter_700Bold', fontSize: 84, lineHeight: 84, letterSpacing: -4 },
    headline: { fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 27, letterSpacing: -0.6 },
    kicker: { fontFamily: 'Inter_700Bold', fontSize: 10.5, lineHeight: 14, letterSpacing: 1.3 },
    spaced: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 3 },
  },
  shape: { scale: 0.55, control: 999 },
  surface: 'solid',
  layout: { heroAlign: 'left', sections: 'title', capsButtons: false },
  colors: {
    bg: '#EEF0F2',
    card: '#FFFFFF',
    cardBorder: 'rgba(15, 19, 24, 0.06)',
    text: '#0F1318',
    textSecondary: 'rgba(15, 19, 24, 0.70)',
    textTertiary: 'rgba(15, 19, 24, 0.54)',
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
    accent: '#E2231A',
    accentInk: '#FFFFFF',
    up: '#1F8A55',
    down: '#D0281E',
    inverseBg: '#0F1318',
    inverseText: '#FFFFFF',
  },
};

export const themes: Record<ThemeName, Theme> = { dune, space, atlantis, highlands, alpine };

export const THEME_ORDER: ThemeName[] = ['dune', 'space', 'atlantis', 'highlands', 'alpine'];

/** Theme names from before the current themes (saved in older settings). */
const LEGACY: Record<string, ThemeName> = { dark: 'space', earth: 'highlands', light: 'alpine' };

export function resolveThemeName(name: string | null | undefined): ThemeName {
  if (name && name in themes) return name as ThemeName;
  return (name && LEGACY[name]) || 'dune';
}

/** A default radius (from tokens.radii) in this theme's shape language. */
export function themeRadius(theme: Theme, r: number): number {
  return r >= 999 ? theme.shape.control : Math.round(r * theme.shape.scale);
}
