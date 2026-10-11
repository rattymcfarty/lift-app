/**
 * ThemeProvider — resolves the active theme from the user's preference and
 * exposes it (plus theme-aware helpers) to the component tree.
 *
 * Preference defaults to 'system', so the app follows the OS light/dark
 * setting out of the box. `setPreference` is available for a future
 * Settings screen; the choice is currently in-memory only.
 *
 * Uses only React Native core APIs (useColorScheme) — no new native modules,
 * Expo Go compatible.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import {
  darkTheme,
  lightTheme,
  type ResolvedThemeMode,
  type Theme,
  type ThemePreference,
} from './tokens';

export interface ThemeContextValue {
  /** Resolved token set for the active mode. */
  theme: Theme;
  /** Resolved mode after applying the preference ('system' → OS setting). */
  mode: ResolvedThemeMode;
  /** User preference; 'system' follows the OS. In-memory only for now —
   *  it resets on every launch. Persist it (e.g. AsyncStorage) when the
   *  Settings screen lands; until then treat setPreference as provisional. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial preference (useful for tests/snapshots). Defaults to 'system'. */
  defaultPreference?: ThemePreference;
}

export function ThemeProvider({
  children,
  defaultPreference = 'system',
}: ThemeProviderProps): React.JSX.Element {
  const [preference, setPreference] =
    useState<ThemePreference>(defaultPreference);
  // Anything that isn't 'dark' resolves to light.
  const systemScheme = useColorScheme();

  // Keep native UI (status bar, alerts, keyboard, pickers) in sync when the
  // user forces a theme that differs from the OS setting. 'unspecified'
  // clears the override so the OS drives everything again. Web is not a
  // target (scope-cut to v1.1) and react-native-web has no setColorScheme.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(
        preference === 'system' ? 'unspecified' : preference,
      );
    }
  }, [preference]);

  const mode: ResolvedThemeMode =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: mode === 'dark' ? darkTheme : lightTheme,
      mode,
      preference,
      setPreference,
    }),
    [mode, preference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Access the active theme. Must be called inside a <ThemeProvider>.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
