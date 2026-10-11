/**
 * Routine detail: the full template breakdown, plus Start / Edit / Delete.
 * "Start workout" hands off to the active-workout flow via
 * startWorkoutFromRoutine — targets become rest-timer defaults and the user
 * logs sets fresh.
 */

import { useCallback, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  decodePillars,
  getActiveWorkout,
  getRoutine,
  softDeleteRoutine,
  startWorkoutFromRoutine,
  type RoutineDetail,
} from '../../src/data/repositories';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { formatTargets } from '../../src/components/routines/format';

function BreakdownRow({ item }: { item: RoutineDetail['items'][number] }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing.sm,
          gap: 2,
        },
      ]}
    >
      <Text
        style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}
        numberOfLines={1}
      >
        {item.exercise.name}
      </Text>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
        {item.exercise.category} · {formatTargets(item.routineExercise)}
      </Text>
    </View>
  );
}

export default function RoutineDetailScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const params = useLocalSearchParams<{ id: string }>();
  const routineId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [detail, setDetail] = useState<RoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Re-entrancy guard: disabled-button state updates async.
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!routineId) {
      setLoading(false);
      return;
    }
    try {
      setDetail(await getRoutine(routineId));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * Starting while another workout is active would strand it where the UI
   * can't reach it (home only resumes the newest). Same guard as NewWorkout.
   */
  const handleStart = async (): Promise<void> => {
    if (!routineId || busyRef.current) return;
    busyRef.current = true;
    try {
      setStarting(true);
      setError(null);
      const active = await getActiveWorkout().catch(() => null);
      if (active) {
        const choice = await new Promise<'resume' | 'new' | 'cancel'>((resolve) => {
          Alert.alert('Workout in progress', `"${active.workout.name}" is still active.`, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
            { text: 'Resume it', onPress: () => resolve('resume') },
            { text: 'Start new anyway', onPress: () => resolve('new') },
          ]);
        });
        if (choice === 'resume') {
          router.replace(`/workout/${active.workout.id}`);
          return;
        }
        if (choice === 'cancel') return;
      }
      const workoutId = await startWorkoutFromRoutine(routineId);
      if (!workoutId) {
        setError('That routine has no exercises to start from.');
        return;
      }
      router.replace(`/workout/${workoutId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the workout.');
    } finally {
      busyRef.current = false;
      setStarting(false);
    }
  };

  const handleDelete = (): void => {
    if (!routineId || busyRef.current) return;
    Alert.alert(
      'Delete routine?',
      'The template and its items will be removed. Past workouts are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            busyRef.current = true;
            setDeleting(true);
            void softDeleteRoutine(routineId)
              .then(() => router.back())
              .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Could not delete the routine.');
              })
              .finally(() => {
                busyRef.current = false;
                setDeleting(false);
              });
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top', 'bottom']}
      >
        <ScreenHeader title="Routine" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top', 'bottom']}
      >
        <ScreenHeader title="Routine" onBack={() => router.back()} />
        <EmptyState
          message="This routine no longer exists."
          action={<Button title="Back to routines" onPress={() => router.back()} />}
        />
      </SafeAreaView>
    );
  }

  const pillars = decodePillars(detail.routine.longevityPillars);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader
        title={detail.routine.name}
        subtitle={
          detail.routine.estimatedMinutes != null
            ? `~${detail.routine.estimatedMinutes} min`
            : undefined
        }
        onBack={() => router.back()}
      />
      <FlatList
        data={detail.items}
        keyExtractor={(i) => i.routineExercise.id}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.xl,
          gap: theme.spacing.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            {detail.routine.notes ? (
              <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>
                {detail.routine.notes}
              </Text>
            ) : null}
            {pillars.length > 0 ? (
              <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                Pillars: {pillars.join(', ')}
              </Text>
            ) : null}
            <Card>
              <Text
                style={{
                  color: theme.colors.muted,
                  fontSize: t.size.caption,
                  fontWeight: t.weight.medium,
                }}
              >
                {detail.items.length} EXERCISE{detail.items.length === 1 ? '' : 'S'}
              </Text>
              {detail.items.length === 0 ? (
                <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>
                  No exercises in this template yet.
                </Text>
              ) : null}
            </Card>
            {error ? (
              <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>
                {error}
              </Text>
            ) : null}
            <Button
              title="Start workout"
              onPress={() => void handleStart()}
              busy={starting}
              disabled={detail.items.length === 0}
            />
            <Button
              title="Edit routine"
              variant="secondary"
              onPress={() => router.push(`/routines/${routineId}/edit`)}
            />
          </View>
        }
        renderItem={({ item }) => <BreakdownRow item={item} />}
        ListFooterComponent={
          <View style={{ marginTop: theme.spacing.md }}>
            <Button
              title="Delete routine"
              variant="danger"
              onPress={handleDelete}
              busy={deleting}
            />
          </View>
        }
      />
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
    borderBottomWidth: 1,
  },
});
