import type { ComponentType } from 'react';

import { WhalesLayer } from './Whales';
import type { ThemeName } from '@/theme/themes';

/**
 * Themes with something alive behind the page: drawn over the theme's background and wallpaper,
 * under everything else (see ThemeBackground).
 */
export const AMBIENT: Partial<Record<ThemeName, ComponentType>> = {
  whales: WhalesLayer,
};
