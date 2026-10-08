// Design tokens shared by every theme. Colors live in themes.ts.

export const fonts = {
  /** Large, airy numbers and titles. */
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const radii = {
  xl: 30, // large cards (story panels, summary)
  lg: 24,
  md: 20, // medium cards, tiles
  sm: 14,
  pill: 999,
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

/** Horizontal page margin. */
export const GUTTER = 20;

/** Minimum tap target (Apple HIG / Material guidance). */
export const TAP = 44;

/** Soft, low-opacity shadows. `boxShadow` works on iOS, Android and web. */
export const shadows = {
  card: { boxShadow: '0px 16px 36px rgba(0, 0, 0, 0.28)' },
  float: { boxShadow: '0px 12px 30px rgba(0, 0, 0, 0.32)' },
  soft: { boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.20)' },
  /** Cards on light themes: barely-there lift. */
  paper: { boxShadow: '0px 1px 2px rgba(30, 20, 10, 0.05), 0px 6px 18px rgba(30, 20, 10, 0.06)' },
} as const;

/** Button text in themes with capital-letter buttons (Dune). */
export const capsLabel = { textTransform: 'uppercase', letterSpacing: 1.6, fontSize: 12 } as const;

/** '#RRGGBB' + alpha (0–1) -> 'rgba(r, g, b, a)'. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Spring presets for press feedback and entrances. */
export const springs = {
  press: { damping: 18, stiffness: 320, mass: 0.6 },
  release: { damping: 14, stiffness: 220, mass: 0.7 },
  gentle: { damping: 20, stiffness: 140, mass: 1 },
} as const;
