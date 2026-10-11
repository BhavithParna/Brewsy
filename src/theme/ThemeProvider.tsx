import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { glassDark, glassLight } from './packs/glass';
import { resolveThemeName, themeRadius, themes, type Theme, type ThemeName } from './themes';
import { updateSettings, useSettings, type Settings } from '@/state/settings';

type ThemeContextValue = {
  theme: Theme;
  setThemeName: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Provides the theme chosen in Settings. Glass comes in light and dark (Settings → Theme → Appearance). */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  // Older installs saved 'dark' / 'earth' / 'light'.
  const name = resolveThemeName(settings.theme);
  const daytime = useDaytime(name === 'glass' && settings.glassAppearance === 'auto');
  const theme = name === 'glass' ? glassVariant(settings.glassAppearance, daytime) : themes[name];

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setThemeName: (next) => updateSettings({ theme: next }) }),
    [theme],
  );
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

// ─── Glass: light or dark ─────────────────────────────────────────────────────

/** Auto is light from 7:00 to 18:59, dark the rest of the time. */
const DAY_STARTS = 7;
const NIGHT_STARTS = 19;

function glassVariant(appearance: Settings['glassAppearance'], daytime: boolean): Theme {
  if (appearance === 'light') return glassLight;
  if (appearance === 'dark') return glassDark;
  return daytime ? glassLight : glassDark;
}

function isDaytime(now = new Date()): boolean {
  const h = now.getHours();
  return h >= DAY_STARTS && h < NIGHT_STARTS;
}

/** Milliseconds until the next 7:00 or 19:00. */
function msToNextSwitch(now = new Date()): number {
  const next = new Date(now);
  const h = now.getHours();
  if (h < DAY_STARTS) next.setHours(DAY_STARTS, 0, 0, 0);
  else if (h < NIGHT_STARTS) next.setHours(NIGHT_STARTS, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(DAY_STARTS, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

/** Short timers only: Android doesn't like very long ones, and the app may sleep in between anyway. */
const MAX_WAIT = 15 * 60 * 1000;

/**
 * Whether it's daytime, kept current while `active`: re-checked at the next 7:00 / 19:00 and whenever
 * the app comes back to the foreground (timers don't run while it's in the background).
 * The system color scheme can't be used: app.json pins the app to dark.
 */
function useDaytime(active: boolean): boolean {
  const [daytime, setDaytime] = useState(isDaytime);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      setDaytime(isDaytime());
      clearTimeout(timer);
      // A second past the switch, so the check lands on the new side of it.
      timer = setTimeout(check, Math.min(msToNextSwitch() + 1000, MAX_WAIT));
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [active]);

  return daytime;
}
