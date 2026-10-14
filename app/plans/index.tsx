/**
 * Plan list — workout templates. Rows show name, exercise count,
 * estimated duration, and last-used date. Tap a card for the detail screen;
 * "New" starts the builder.
 *
 * Naming: user-facing term is "Plan". Internal identifiers (DB tables,
 * repository functions, the `Routine` type) keep the historical name
 * `routine` — renaming those would require a data migration and break
 * backup-format compatibility. See PIPELINE.md dispatch log.
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
import { Button, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { formatWorkoutDay } from '../../src/components/workout/format';

function PlanCard({ item }: { item: RoutineListItem }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { routine, exerciseCount, lastUsedAt } = item;
  const meta: string[] = [`${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`];
  if (routine.estimatedMinutes != null) meta.push(`~${routine.estimatedMinutes} min`);
  meta.push(lastUsedAt ? `last used ${formatWorkoutDay(lastUsedAt)}` : 'never used');
  return (
    <Pressable
      onPress={() => router.push(`/plans/${routine.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open plan ${routine.name}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }}
          numberOfLines={2}
        >
          {routine.name}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.meta }}>
          {meta.join(' · ')}
        </Text>
      </View>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
    </Pressable>
  );
}

export default function PlanListScreen(): JSX.Element {
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
        title="Plans"
        subtitle="Workout plans"
        onBack={() => router.back()}
        right={
          <Button title="New" variant="secondary" onPress={() => router.push('/plans/new')} />
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
          }}
          renderItem={({ item }) => <PlanCard item={item} />}
          ListEmptyComponent={
            <EmptyState
              message="No plans yet."
              hint="Build a plan once, then start workouts from it in one tap."
              action={
                <Button title="Create plan" onPress={() => router.push('/plans/new')} />
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
