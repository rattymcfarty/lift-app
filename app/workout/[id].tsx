/**
 * Active workout screen — the P1 exit criterion lives here: a user must be
 * able to log a full workout.
 *
 * - Current exercises with set rows (reps / weight / RPE), the accent LOG
 *   action, rest countdown entry, remove-exercise.
 * - "Last time" previous performance per exercise (fetched once per
 *   exercise and cached — never refetched on every logged set).
 * - Add exercises, finish (→ summary), discard (confirm → soft-delete).
 *
 * Data flow: every mutation goes through repositories, then the detail is
 * re-fetched. The DB is the single source of truth; no local set cache.
 * Refocusing the screen (e.g. back from add-exercise) refreshes silently —
 * the list is never unmounted, so rest timers and half-typed input survive.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  finishWorkout,
  getPreviousPerformance,
  getWorkoutDetail,
  softDeleteWorkout,
  type PreviousPerformance,
  type WorkoutDetail,
  type WorkoutExerciseDetail,
} from '../../src/data/repositories';
import { useTheme } from '../../src/theme';
import { formatDuration } from '../../src/components/workout/format';
import { Button, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';
import { advanceEnrollmentForWorkout } from '../../src/programs/sessions';
import { invalidateConsistencyCache } from '../../src/stats/queries';

/**
 * Elapsed-time readout with its own ticking state, so the once-per-second
 * update doesn't re-render the whole exercise list (input lag on low-end
 * Android). Lives in the header, next to the workout name.
 */
function ElapsedTime({ startedAt }: { startedAt: Date }): JSX.Element {
  const { theme } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.caption }}>
      Elapsed {formatDuration(now - startedAt.getTime())}
    </Text>
  );
}

export default function ActiveWorkoutScreen(): JSX.Element {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  // undefined = not fetched yet (row shows "looking up"); null = none found.
  const [previousMap, setPreviousMap] = useState<Record<string, PreviousPerformance | null>>({});
  const previousMapRef = useRef(previousMap);
  previousMapRef.current = previousMap;
  // Tracks whether ANY detail has ever loaded, so a transient refresh
  // failure keeps the stale screen instead of wiping timers and input.
  const hasDetailRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  /** Fetch "last time" only for exercises we haven't looked up yet. */
  const loadPreviousFor = useCallback(async (items: WorkoutExerciseDetail[], wid: string) => {
    const missing = items.filter((i) => !(i.exercise.id in previousMapRef.current));
    if (missing.length === 0) return;
    const entries = await Promise.all(
      missing.map(async (item) => {
        try {
          const prev = await getPreviousPerformance(item.exercise.id, wid);
          return [item.exercise.id, prev] as const;
        } catch {
          return [item.exercise.id, null] as const;
        }
      }),
    );
    setPreviousMap((prevMap) => ({ ...prevMap, ...Object.fromEntries(entries) }));
  }, []);

  const load = useCallback(async () => {
    if (!workoutId) {
      setLoadError('Missing workout id.');
      setLoading(false);
      return;
    }
    try {
      const d = await getWorkoutDetail(workoutId);
      if (!d) {
        // Genuinely gone (deleted elsewhere) — even stale detail would lie.
        hasDetailRef.current = false;
        setDetail(null);
        setLoadError('Workout not found. It may have been deleted.');
        setLoading(false);
        return;
      }
      hasDetailRef.current = true;
      setDetail(d);
      setLoadError(null);
      void loadPreviousFor(d.items, workoutId);
    } catch (e) {
      // Transient failure on a silent refresh: keep the stale screen
      // (timers keep running, typed input survives) instead of wiping it.
      if (!hasDetailRef.current) {
        setLoadError(e instanceof Error ? e.message : 'Could not load the workout.');
      }
    } finally {
      setLoading(false);
    }
  }, [workoutId, loadPreviousFor]);

  // Silent refresh on refocus: the list stays mounted (timers keep running,
  // typed input is preserved) and swaps to fresh data when it arrives.
  // `loading` is only ever true for the very first mount.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A finished workout doesn't belong here — hand off to the summary.
  useEffect(() => {
    if (detail?.workout.endedAt != null && workoutId) {
      router.replace(`/workout/${workoutId}/summary`);
    }
  }, [detail, workoutId]);

  // Integration seam for workstream #4 (rest-timer): fired after every
  // logged set with the rest seconds used. The countdown itself now lives
  // in <RestTimer/> (useRestTimer); this observes for future global UX.
  const handleSetComplete = useCallback((_restSeconds: number) => {
    // #4: hook cross-exercise rest UX here if needed.
  }, []);

  const handleFinish = (): void => {
    if (!workoutId || finishing) return;
    const setCount = detail?.items.reduce((n, i) => n + i.sets.length, 0) ?? 0;
    Alert.alert(
      'Finish workout?',
      setCount === 0
        ? 'No sets logged yet. Finish anyway?'
        : `Finish with ${setCount} set${setCount === 1 ? '' : 's'} logged?`,
      [
        { text: 'Keep lifting', style: 'cancel' },
        {
          text: 'Finish',
          onPress: () => {
            setFinishing(true);
            void (async () => {
              try {
                const w = await finishWorkout(workoutId);
                if (!w) throw new Error('Workout no longer exists.');
                // P4a: if this workout was started from a program session,
                // advance the enrollment (idempotent; no-op otherwise).
                // Invalidate the dashboard's refresh throttle so the new
                // consistency score shows immediately.
                try {
                  await advanceEnrollmentForWorkout(workoutId);
                } catch (e) {
                  console.warn('[workout] program advancement failed', e);
                } finally {
                  invalidateConsistencyCache();
                }
                router.replace(`/workout/${workoutId}/summary`);
              } catch (e) {
                Alert.alert(
                  'Could not finish',
                  e instanceof Error ? e.message : 'Please try again.',
                );
                setFinishing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleDiscard = (): void => {
    if (!workoutId) return;
    Alert.alert(
      'Discard workout?',
      'This deletes the workout and all logged sets. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await softDeleteWorkout(workoutId);
                invalidateConsistencyCache();
                router.replace('/');
              } catch (e) {
                // Stay on the screen: nothing was deleted, so leaving
                // would strand the user away from their live workout.
                Alert.alert(
                  'Could not discard',
                  e instanceof Error ? e.message : 'Please try again.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  const renderExercise = ({ item }: { item: WorkoutExerciseDetail }): JSX.Element => (
    <ExerciseCard
      detail={item}
      previous={item.exercise.id in previousMap ? previousMap[item.exercise.id] : undefined}
      onChanged={() => void load()}
      onSetComplete={handleSetComplete}
    />
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader
        title={detail?.workout.name ?? 'Workout'}
        subtitle={
          detail ? <ElapsedTime startedAt={new Date(detail.workout.startedAt)} /> : undefined
        }
        onBack={() => router.replace('/')}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      ) : loadError || !detail ? (
        <EmptyState
          message={loadError ?? 'Workout not found.'}
          action={<Button title="Back home" variant="secondary" onPress={() => router.replace('/')} />}
        />
      ) : (
        <FlatList
          data={detail.items}
          keyExtractor={(item) => item.workoutExercise.id}
          renderItem={renderExercise}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.md,
          }}
          ListEmptyComponent={
            <EmptyState
              message="No exercises yet."
              hint="Add your first exercise to start logging sets."
            />
          }
          ListFooterComponent={
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <Button
                title="+ Add exercise"
                variant="secondary"
                onPress={() => router.push(`/workout/${workoutId}/add-exercise`)}
              />
              <Button
                title={finishing ? 'Finishing…' : 'Finish workout'}
                variant="primary"
                onPress={handleFinish}
                busy={finishing}
              />
              <Button title="Discard workout" variant="danger" onPress={handleDiscard} />
            </View>
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
