/**
 * Workout history — finished workouts, newest first.
 *
 * Each row shows date, duration, total volume and exercise count; tapping
 * opens the shared summary view (app/workout/[id]/summary.tsx). Reuses the
 * same repository/UI conventions as Home's recent list, but paginated and
 * complete — Home stays a teaser, this is the archive.
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
  listFinishedWorkouts,
  type WorkoutHistoryRow,
} from '../src/data/history';
import { useTheme } from '../src/theme';
import {
  formatDuration,
  formatWorkoutDay,
  trimNumber,
} from '../src/components/workout/format';
import { Button, EmptyState, ScreenHeader } from '../src/components/workout/ui';

const PAGE_SIZE = 20;

function HistoryRow({ row }: { row: WorkoutHistoryRow }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { workout } = row;
  return (
    <Pressable
      onPress={() => router.push(`/workout/${workout.id}/summary`)}
      accessibilityRole="button"
      accessibilityLabel={`View summary of ${workout.name}`}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rowText}>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }}
          numberOfLines={1}
        >
          {workout.name}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          {formatWorkoutDay(new Date(workout.startedAt))}
          {row.durationMs != null ? ` · ${formatDuration(row.durationMs)}` : ''}
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
          {trimNumber(row.volumeKg)} kg · {row.exerciseCount} exercise
          {row.exerciseCount === 1 ? '' : 's'} · {row.setCount} set
          {row.setCount === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
    </Pressable>
  );
}

export default function HistoryScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [rows, setRows] = useState<WorkoutHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listFinishedWorkouts(PAGE_SIZE, 0);
      setRows(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await listFinishedWorkouts(PAGE_SIZE, rows.length);
      setRows((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, rows.length]);

  useFocusEffect(
    useCallback(() => {
      void loadFirst();
    }, [loadFirst]),
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="History" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.workout.id}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
          renderItem={({ item }) => <HistoryRow row={item} />}
          ListEmptyComponent={
            <EmptyState
              message="No workouts yet."
              hint="Your history starts with your first workout — every set is stored on this device only."
              action={
                <Button title="Start workout" onPress={() => router.push('/workout/new')} />
              }
            />
          }
          ListFooterComponent={
            hasMore && rows.length > 0 ? (
              <View style={{ paddingVertical: theme.spacing.md }}>
                <Button
                  title="Load more"
                  variant="secondary"
                  busy={loadingMore}
                  onPress={() => void loadMore()}
                />
              </View>
            ) : null
          }
        />
      )}
      {rows.length > 0 && !loading ? (
        <Text
          style={{
            color: theme.colors.faint,
            fontSize: t.size.caption,
            textAlign: 'center',
            paddingBottom: theme.spacing.sm,
          }}
        >
          {rows.length} workout{rows.length === 1 ? '' : 's'}
        </Text>
      ) : null}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
