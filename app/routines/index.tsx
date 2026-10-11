/**
 * Routine list — workout templates. Cards show name, exercise count,
 * estimated duration, and last-used date. Tap a card for the detail screen;
 * "New" starts the builder.
 */

import { useCallback, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listRoutinesWithStats,
  type RoutineListItem,
} from '../../src/data/routines';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { formatWorkoutDay } from '../../src/components/workout/format';

function RoutineCard({ item }: { item: RoutineListItem }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { routine, exerciseCount, lastUsedAt } = item;
  const meta: string[] = [`${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`];
  if (routine.estimatedMinutes != null) meta.push(`~${routine.estimatedMinutes} min`);
  meta.push(lastUsedAt ? `last used ${formatWorkoutDay(lastUsedAt)}` : 'never used');
  return (
    <Pressable
      onPress={() => router.push(`/routines/${routine.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open routine ${routine.name}`}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <Card>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.title, fontWeight: t.weight.bold }}
          numberOfLines={1}
        >
          {routine.name}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          {meta.join(' · ')}
        </Text>
      </Card>
    </Pressable>
  );
}

export default function RoutineListScreen(): JSX.Element {
  const { theme } = useTheme();
  const [items, setItems] = useState<RoutineListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await listRoutinesWithStats());
    } catch {
      // Degrades to the empty state; the error surfaces on open/create.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader
        title="Routines"
        subtitle="Workout templates"
        onBack={() => router.back()}
        right={
          <Button title="New" variant="secondary" onPress={() => router.push('/routines/new')} />
        }
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.routine.id}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.md,
          }}
          renderItem={({ item }) => <RoutineCard item={item} />}
          ListEmptyComponent={
            <EmptyState
              message="No routines yet."
              hint="Build a template once, then start workouts from it in one tap."
              action={
                <Button title="Create routine" onPress={() => router.push('/routines/new')} />
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
