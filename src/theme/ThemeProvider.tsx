/**
 * ThemeProvider — resolves the active theme from the user's persisted
 * preference and exposes it (plus theme-aware helpers) to the component
 * tree.
 *
 * Preference is 'light' | 'dark', DEFAULT 'dark', persisted in
 * AsyncStorage under THEME_PREFERENCE_KEY. The in-app preference always
 * wins — the app does not follow the OS setting. On first launch (nothing
 * stored) the app starts dark. Children render only after the stored
 * preference has loaded, so a returning light-mode user never sees a
 * dark flash.
 *
 * Uses only React Native core APIs (Appearance.setColorScheme) — no new
 * native modules, Expo Go compatible.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  darkTheme,
  lightTheme,
  type ResolvedThemeMode,
  type Theme,
  type ThemePreference,
} from './tokens';

const THEME_PREFERENCE_KEY = 'lift:theme-preference';

export interface ThemeContextValue {
  /** Resolved token set for the active mode. */
  theme: Theme;
  /** Resolved mode (= the preference; there is no 'system' mode). */
  mode: ResolvedThemeMode;
  /** User preference, persisted. Default 'dark'. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial preference (useful for tests/snapshots). Defaults to 'dark'. */
  defaultPreference?: ThemePreference;
}

async function loadStoredPreference(): Promise<ThemePreference | null> {
  try {
    const raw = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
    return null;
  } catch {
    return null;
  }
}

/** If the storage read hangs, fall back to the default instead of a
 *  blank screen forever. */
const LOAD_TIMEOUT_MS = 1500;

function loadWithTimeout(): Promise<ThemePreference | null> {
  return Promise.race([
    loadStoredPreference(),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
    }),
  ]);
}

export function ThemeProvider({
  children,
  defaultPreference = 'dark',
}: ThemeProviderProps): React.JSX.Element {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(defaultPreference);
  const [loaded, setLoaded] = useState(false);

  // Load the persisted preference once. Until it lands, render nothing so
  // the first paint already uses the right theme (no dark→light flash).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadWithTimeout();
      if (!cancelled && stored != null) {
        setPreferenceState(stored);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep native UI (status bar, alerts, keyboard, pickers) in sync with the
  // in-app choice, even when it differs from the OS setting. Web is not a
  // target (scope-cut to v1.1) and react-native-web has no setColorScheme.
  // Don't touch native UI until the stored preference has loaded — the
  // first run would otherwise flash dark system UI for a light user.
  useEffect(() => {
    if (!loaded) return;
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(preference);
    }
  }, [preference, loaded]);

  const setPreference = (next: ThemePreference): void => {
    // Runtime guard: TS enforces the union at compile time, but an
    // untyped caller could pass anything.
    if (next !== 'light' && next !== 'dark') return;
    setPreferenceState(next);
    // Fire-and-forget: a failed write just means the choice doesn't
    // survive a restart; the in-memory theme still applies now.
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, next).catch(() => {
      // ignore — see above
    });
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: preference === 'dark' ? darkTheme : lightTheme,
      mode: preference,
      preference,
      setPreference,
    }),
    [preference],
  );

  if (!loaded) {
    return <></>;
  }

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
