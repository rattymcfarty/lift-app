/**
 * Settings — in-app preferences, persisted on this device.
 *
 * The controls themselves live in `src/components/settings/SettingsBody.tsx`
 * so the right side panel can show the same block without a second copy.
 */
import type { JSX } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { ScreenHeader } from '../src/components/workout/ui';
import { SettingsBody } from '../src/components/settings/SettingsBody';
import { useTabBarSpace } from '../src/components/nav/TabBar';

export default function SettingsScreen(): JSX.Element {
  const tabBarSpace = useTabBarSpace();
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="Settings" onBack={() => router.back()} compact />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing.xl + tabBarSpace,
        }}
      >
        <SettingsBody />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
