// Polyfill crypto.getRandomValues BEFORE anything else: Hermes does not
// provide Web Crypto, and src/db/id.ts needs it the first time newId() runs.
// Ships inside Expo Go (bundled native module); declared in package.json so
// dev builds autolink it. Must stay first.
import 'react-native-get-random-values';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useDrizzleMigrations } from '../src/db/useMigrations';
import { importSnapshotOnFirstLaunch } from '../src/kb';
import { MigrationErrorBoundary } from '../src/components/MigrationErrorBoundary';
import { ThemeProvider, useTheme } from '../src/theme';
import { WorkoutLifecycleWatcher } from '../src/workouts/WorkoutLifecycleWatcher';
import { PanelsProvider } from '../src/chrome/panels';
import { TopBar } from '../src/components/chrome/TopBar';

/**
 * P5: cap OS dynamic-type scaling at 1.15x app-wide. React Native respects the
 * OS text-size setting by default (good for accessibility), but uncapped
 * scaling breaks fixed layouts — buttons overflow, rows clip, charts
 * overlap. 1.15x keeps text readable for low-vision users without breaking
 * any screen (verified against the dashboard, workout logging, and charts).
 * Set once here so every Text/TextInput inherits it; individual components
 * can still override per-instance when a design truly needs it.
 */
if ((Text as unknown as { defaultProps?: object }).defaultProps == null) {
  (Text as unknown as { defaultProps: object }).defaultProps = {};
}
Object.assign((Text as unknown as { defaultProps: object }).defaultProps, {
  maxFontSizeMultiplier: 1.15,
});
if ((TextInput as unknown as { defaultProps?: object }).defaultProps == null) {
  (TextInput as unknown as { defaultProps: object }).defaultProps = {};
}
Object.assign((TextInput as unknown as { defaultProps: object }).defaultProps, {
  maxFontSizeMultiplier: 1.15,
});

function AppShell() {
  const { theme, mode } = useTheme();
  const { success, error } = useDrizzleMigrations();
  // P5 fix (found by Maestro E2E): the KB snapshot was never imported —
  // importSnapshotOnFirstLaunch() existed but had no caller, so fresh
  // installs had zero exercises. Seed it once migrations succeed.
  const [kbReady, setKbReady] = useState(false);
  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    void (async () => {
      try {
        await importSnapshotOnFirstLaunch();
      } catch (e) {
        console.warn('[kb] snapshot import failed', e);
      } finally {
        if (!cancelled) setKbReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success]);

  // StatusBar lives in the root layout so every screen inherits the
  // theme-matching style, even as the theme changes at runtime.
  const statusBar = (
    <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
  );

  if (error) {
    throw new Error(`Database migrations failed: ${String(error)}`);
  }

  if (!success || !kbReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.muted} />
        {statusBar}
      </View>
    );
  }

  return (
    <PanelsProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
        <WorkoutLifecycleWatcher />
        {/* Top bar: absolute overlay above the Stack, pointerEvents='box-none'.
            It renders the companion circle in its centre slot. */}
        <TopBar />
        {statusBar}
      </View>
    </PanelsProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      {/* Catches migration failures (and any other AppShell render crash)
          and shows the themed recovery screen instead of a hard crash. */}
      <MigrationErrorBoundary>
        <AppShell />
      </MigrationErrorBoundary>
    </ThemeProvider>
  );
}
