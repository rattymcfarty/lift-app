/**
 * Start a workout: name it, then either start blank or from a routine
 * template. "Manage routines" opens the P1b routine builder.
 *
 * P4a: accepts an optional `routineId` nav param (from the dashboard's
 * "Start this session" card) to auto-start from that routine.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createWorkout,
  getActiveWorkout,
  listRoutines,
  startWorkoutFromRoutine,
  type WorkoutDetail,
} from '../../src/data/repositories';
import type { Routine } from '../../src/db/schema';
import { useTheme } from '../../src/theme';
import { Button, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { assertSessionLinkable, linkWorkoutToSession } from '../../src/programs/sessions';

function defaultWorkoutName(): string {
  const now = new Date();
  const day = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Workout · ${day}`;
}

/**
 * Starting a second workout while one is still active would strand the old
 * one where the UI can't reach it (home only resumes the newest). Offer to
 * resume instead. Returns 'cancelled' when the caller must not proceed.
 */
async function resolveActiveConflict(): Promise<'cancelled' | 'proceeded'> {
  let active: WorkoutDetail | null = null;
  try {
    active = await getActiveWorkout();
  } catch {
    return 'proceeded';
  }
  if (!active) return 'proceeded';
  const activeWorkout = active;
  const choice = await new Promise<'resume' | 'new' | 'cancel'>((resolve) => {
    Alert.alert(
      'Workout in progress',
      `"${activeWorkout.workout.name}" is still active.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
        {
          text: 'Resume it',
          onPress: () => resolve('resume'),
        },
        { text: 'Start new anyway', onPress: () => resolve('new') },
      ],
    );
  });
  if (choice === 'resume') {
    router.replace(`/workout/${activeWorkout.workout.id}`);
    return 'cancelled';
  }
  return choice === 'new' ? 'proceeded' : 'cancelled';
}

export default function NewWorkoutScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const params = useLocalSearchParams<{
    routineId?: string;
    enrollmentId?: string;
    week?: string;
    day?: string;
  }>();
  const [name, setName] = useState(defaultWorkoutName());
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // P4a: distinguishes "routine list failed to load" from "routine not
  // found" for the auto-start error message.
  const [routinesFailed, setRoutinesFailed] = useState(false);
  // Re-entrancy guard: the disabled button state updates async, so two
  // rapid taps could otherwise create two workouts (the routine path has a
  // DB-level 60s guard; the blank path needs this).
  const startingRef = useRef(false);
  // P4a: auto-start from the routineId param exactly once per mount.
  const autoStartedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setRoutines(await listRoutines());
      setRoutinesFailed(false);
    } catch {
      setRoutines([]);
      setRoutinesFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goToWorkout = (workoutId: string): void => {
    router.replace(`/workout/${workoutId}`);
  };

  const handleStartBlank = async (): Promise<void> => {
    // Set synchronously, before any await: two rapid taps must not both
    // reach the conflict dialog and create two workouts.
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const trimmed = name.trim();
      if (!trimmed) {
        setError('Give the workout a name.');
        return;
      }
      if ((await resolveActiveConflict()) === 'cancelled') return;
      setStarting(true);
      setError(null);
      goToWorkout(await createWorkout({ name: trimmed }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the workout.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const handleStartFromRoutine = async (routine: Routine, opts?: { useRoutineName?: boolean }): Promise<void> => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // P4a: program auto-start uses the routine's name so the history
      // entry keeps the session's identity instead of "Workout · <date>".
      const trimmed = opts?.useRoutineName ? '' : name.trim();
      if ((await resolveActiveConflict()) === 'cancelled') return;
      setStarting(true);
      setError(null);
      const workoutId = await startWorkoutFromRoutine(
        routine.id,
        trimmed ? trimmed : undefined,
      );
      if (!workoutId) {
        setError('That routine has no exercises to start from.');
        return;
      }
      goToWorkout(workoutId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the workout.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  // P4a: when opened with ?routineId= (dashboard "Start this session"),
  // auto-start from that routine once routines have loaded. When session
  // params are present, link the created workout to the program session so
  // finishing it advances the enrollment.
  useEffect(() => {
    if (loading || autoStartedRef.current) return;
    const rid = params.routineId;
    if (!rid) return;
    autoStartedRef.current = true;
    if (routinesFailed) {
      setError('Could not load routines. Please try again.');
      return;
    }
    const routine = routines.find((r) => r.id === rid);
    if (!routine) {
      setError('The program session\u2019s routine was not found.');
      return;
    }
    void (async () => {
      const week = params.week != null ? parseInt(params.week, 10) : NaN;
      const day = params.day != null ? parseInt(params.day, 10) : NaN;
      const hasSession =
        params.enrollmentId != null && Number.isFinite(week) && Number.isFinite(day);
      // handleStartFromRoutine navigates away on success; for session
      // linking we need the workout id, so create directly here.
      if (!hasSession) {
        await handleStartFromRoutine(routine, { useRoutineName: true });
        return;
      }
      if (startingRef.current) return;
      startingRef.current = true;
      try {
        if ((await resolveActiveConflict()) === 'cancelled') return;
        setStarting(true);
        setError(null);
        // Verify the session can be linked BEFORE creating the workout —
        // otherwise a link failure orphans an active workout (P4a).
        await assertSessionLinkable(params.enrollmentId as string, week, day);
        const workoutId = await startWorkoutFromRoutine(routine.id, undefined);
        if (!workoutId) {
          setError('That routine has no exercises to start from.');
          return;
        }
        await linkWorkoutToSession(params.enrollmentId as string, week, day, workoutId);
        goToWorkout(workoutId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start the workout.');
      } finally {
        startingRef.current = false;
        setStarting(false);
      }
    })();
    // All route params in deps; handleStartFromRoutine is intentionally
    // omitted (plain function, would re-trigger). autoStartedRef guards
    // against repeat runs.
  }, [loading, routines, routinesFailed, params.routineId, params.enrollmentId, params.week, params.day]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="New workout" onBack={() => router.back()} />
      <View style={[styles.body, { paddingHorizontal: theme.spacing.md, gap: theme.spacing.md }]}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
            WORKOUT NAME
          </Text>
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            placeholder="Workout name"
            placeholderTextColor={theme.colors.faint}
            returnKeyType="done"
            editable={!starting}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontSize: t.size.body,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
            }}
          />
        </View>

        <Button
          title={starting ? 'Starting…' : 'Start blank workout'}
          testID="new-workout-start-blank"
          onPress={() => void handleStartBlank()}
          busy={starting}
        />
        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>{error}</Text>
        ) : null}

        <Text
          style={{
            color: theme.colors.muted,
            fontSize: t.size.caption,
            fontWeight: t.weight.medium,
            marginTop: theme.spacing.sm,
          }}
        >
          OR START FROM A ROUTINE
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.colors.muted} />
        ) : (
          <FlatList
            data={routines}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => void handleStartFromRoutine(item)}
                disabled={starting}
                accessibilityRole="button"
                accessibilityLabel={`Start workout from ${item.name}`}
                style={({ pressed }) => [
                  styles.routineRow,
                  {
                    borderBottomColor: theme.colors.border,
                    paddingVertical: theme.spacing.sm,
                    opacity: pressed || starting ? 0.6 : 1,
                  },
                ]}
              >
                <View style={styles.routineText}>
                  <Text
                    style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.estimatedMinutes != null ? (
                    <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                      ~{item.estimatedMinutes} min
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <EmptyState
                message="No routines yet."
                hint="Build a template once, then start workouts from it in one tap."
              />
            }
          />
        )}
        <Button
          title="Manage routines"
          variant="secondary"
          onPress={() => router.push('/routines')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  routineText: {
    flex: 1,
    gap: 2,
  },
});
