import { createContext, useContext, type ReactNode } from 'react';

import { resolveThemeName, themeRadius, themes, type Theme, type ThemeName } from './themes';
import { updateSettings, useSettings } from '@/state/settings';

type ThemeContextValue = {
  theme: Theme;
  setThemeName: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Provides the theme chosen in Settings (Dune, Space, Atlantis, Highlands, Alpine). */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const value: ThemeContextValue = {
    // Older installs saved 'dark' / 'earth' / 'light'.
    theme: themes[resolveThemeName(settings.theme)],
    setThemeName: (name) => updateSettings({ theme: name }),
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <AppThemeProvider>');
  return ctx;
}

/** Turns a default radius (tokens.radii) into the current theme's shape: square for Dune, soft for Atlantis. */
export function useRadius(): (r: number) => number {
  const { theme } = useTheme();
  return (r) => themeRadius(theme, r);
}
