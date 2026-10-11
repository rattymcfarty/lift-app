/**
 * Home — the workout flow's entry point. (The full dashboard with longevity
 * analytics lands in P4; this screen owns start / resume / recent only.)
 *
 * - Active workout (started, not ended) -> prominent resume card.
 * - "Start workout" -> /workout/new (blank or from a routine template).
 * - Recent finished workouts -> tap for the summary.
 * Screens never touch Drizzle directly — everything via repositories.
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
  getActiveWorkout,
  listRecentWorkouts,
  type WorkoutDetail,
} from '../src/data/repositories';
import type { Workout } from '../src/db/schema';
import { useTheme } from '../src/theme';
import { formatDuration, formatWorkoutDay } from '../src/components/workout/format';
import { Button, Card, EmptyState } from '../src/components/workout/ui';

function RecentRow({ workout }: { workout: Workout }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const duration =
    workout.endedAt != null
      ? formatDuration(workout.endedAt.getTime() - workout.startedAt.getTime())
      : null;
  return (
    <Pressable
      onPress={() => router.push(`/workout/${workout.id}/summary`)}
      accessibilityRole="button"
      accessibilityLabel={`View summary of ${workout.name}`}
      style={({ pressed }) => [
        styles.recentRow,
        {
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.recentText}>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}
          numberOfLines={1}
        >
          {workout.name}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          {formatWorkoutDay(new Date(workout.startedAt))}
          {duration ? ` · ${duration}` : ''}
        </Text>
      </View>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
    </Pressable>
  );
}

export default function Home(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [active, setActive] = useState<WorkoutDetail | null>(null);
  const [recent, setRecent] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Fetch one extra: the active workout is filtered out below, and the
      // list should still show 10 finished workouts.
      const [a, r] = await Promise.all([getActiveWorkout(), listRecentWorkouts(11)]);
      setActive(a);
      // The active workout also appears in recents — keep the list to
      // finished workouts so the two sections never overlap.
      setRecent(r.filter((w) => w.endedAt != null).slice(0, 10));
    } catch {
      // Home degrades to the start button; the error surfaces when the
      // user opens a workout. Never a dead end.
      setActive(null);
      setRecent([]);
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
      <View style={[styles.header, { paddingHorizontal: theme.spacing.md }]}>
        <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 }}>
          LIFT
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          Longevity Intelligent Fitness Trainer
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(w) => w.id}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.md }}
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.md }}>
              {active ? (
                <Card>
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                    WORKOUT IN PROGRESS
                  </Text>
                  <Text
                    style={{ color: theme.colors.text, fontSize: t.size.title, fontWeight: t.weight.bold }}
                    numberOfLines={1}
                  >
                    {active.workout.name}
                  </Text>
                  <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                    {active.items.length} exercise{active.items.length === 1 ? '' : 's'} ·{' '}
                    {active.items.reduce((n, i) => n + i.sets.length, 0)} sets logged
                  </Text>
                  <Button
                    title="Resume workout"
                    onPress={() => router.push(`/workout/${active.workout.id}`)}
                  />
                </Card>
              ) : null}
              <Button title="Start workout" onPress={() => router.push('/workout/new')} />
              {/* P1b #8: history + progress entry points (secondary actions). */}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="History"
                    variant="secondary"
                    onPress={() => router.push('/history')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Progress"
                    variant="secondary"
                    onPress={() => router.push('/progress')}
                  />
                </View>
              </View>
              {recent.length > 0 ? (
                <Text
                  style={{
                    color: theme.colors.muted,
                    fontSize: t.size.caption,
                    fontWeight: t.weight.medium,
                    marginTop: theme.spacing.sm,
                  }}
                >
                  RECENT WORKOUTS
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <RecentRow workout={item} />}
          ListEmptyComponent={
            active ? null : (
              <EmptyState
                message="No workouts yet."
                hint="Start your first workout — every set is stored on this device only."
              />
            )
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
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    gap: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  recentText: {
    flex: 1,
    gap: 2,
  },
});
