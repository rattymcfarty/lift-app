/**
 * InfoScreen — the shell every explainer route renders.
 *
 * One route file per page (`app/learn/<slug>.tsx`) rather than a dynamic
 * `[slug]` route, because `scripts/test-panel.mjs` checks that every link in the
 * app points at a screen file that exists: an explicit file per page keeps that
 * invariant (a rename cannot leave a dead menu item), and each route stays three
 * lines. The words live in `src/content/infoPages.ts`.
 */
import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../theme';
import { Button, EmptyState } from '../workout/ui';
import { InfoPageView } from './InfoPage';
import { infoPage } from '../../content/infoPages';

export function InfoScreen({ slug }: { slug: string }): JSX.Element {
  const { theme } = useTheme();
  const page = infoPage(slug);

  if (!page) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <EmptyState
          message="That page is not here."
          hint="It may have been renamed — the menu links to the pages that exist."
          action={<Button title="Back" variant="secondary" onPress={() => router.back()} />}
        />
      </SafeAreaView>
    );
  }

  return <InfoPageView page={page} onBack={() => router.back()} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
});
