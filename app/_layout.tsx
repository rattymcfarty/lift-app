// Polyfill crypto.getRandomValues BEFORE anything else: Hermes does not
// provide Web Crypto, and src/db/id.ts needs it the first time newId() runs.
// Ships inside Expo Go (bundled native module); declared in package.json so
// dev builds autolink it. Must stay first.
import 'react-native-get-random-values';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useDrizzleMigrations } from '../src/db/useMigrations';
import { ThemeProvider, useTheme } from '../src/theme';

function AppShell() {
  const { theme, mode } = useTheme();
  const { success, error } = useDrizzleMigrations();

  // StatusBar lives in the root layout so every screen inherits the
  // theme-matching style, even as the theme changes at runtime.
  const statusBar = (
    <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
  );

  if (error) {
    throw new Error(`Database migrations failed: ${String(error)}`);
  }

  if (!success) {
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
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
      {statusBar}
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
