/**
 * Start a workout: name it, then either start blank or from a routine
 * template. Routine management UI lands in P1b — this screen only lists
 * existing templates (empty state when there are none).
 */

import { useCallback, useRef, useState, type JSX } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
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
  const [name, setName] = useState(defaultWorkoutName());
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Re-entrancy guard: the disabled button state updates async, so two
  // rapid taps could otherwise create two workouts (the routine path has a
  // DB-level 60s guard; the blank path needs this).
  const startingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setRoutines(await listRoutines());
    } catch {
      setRoutines([]);
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

  const handleStartFromRoutine = async (routine: Routine): Promise<void> => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const trimmed = name.trim();
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
                hint="Routine templates arrive in P1b — start blank for now."
              />
            }
          />
        )}
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
