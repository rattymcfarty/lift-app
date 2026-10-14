/**
 * Standalone history route (deep links, "View all"). The Train tab embeds the
 * same HistoryList under its History segment.
 */
import type { JSX } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryList } from '../src/components/history/HistoryList';
import { ScreenHeader } from '../src/components/workout/ui';
import { useTheme } from '../src/theme';

export default function HistoryScreen(): JSX.Element {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScreenHeader title="History" onBack={() => router.back()} />
      <HistoryList />
    </SafeAreaView>
  );
}
