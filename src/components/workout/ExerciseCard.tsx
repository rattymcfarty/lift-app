/**
 * One exercise inside the active workout: header (name, muscles, "last
 * time"), logged set rows, the next-set input row, and the rest countdown.
 *
 * Data flow is deliberately dumb: every mutation goes through the
 * repository layer, then the parent re-fetches the workout detail. No local
 * caching of sets — the DB is the single source of truth, so the UI can
 * never drift from it.
 *
 * `onSetComplete` is the integration seam for workstream #4 (rest-timer):
 * fired with the rest seconds used after each logged set. Currently the
 * rest countdown is the local <RestTimer/> below; #4 may observe or replace
 * it through this callback + the RestTimer props contract.
 */

import { useState, type JSX } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  logSet,
  removeWorkoutExercise,
  softDeleteSet,
  type PreviousPerformance,
  type WorkoutExerciseDetail,
} from '../../data/repositories';
import { decodeStringArray } from '../../db/schema';
import { useTheme } from '../../theme';
import { formatPreviousPerformance } from './format';
import { RestTimer } from './RestTimer';
import { SetRow, type SetInputValues } from './SetRow';
import { Card } from './ui';

/** Default rest between sets when the exercise has no override (seconds). */
const DEFAULT_REST_SECONDS = 90;

interface ExerciseCardProps {
  detail: WorkoutExerciseDetail;
  /**
   * "Last time" for this exercise. undefined = still loading (row shows a
   * placeholder); null = looked up, none found.
   */
  previous: PreviousPerformance | null | undefined;
  onChanged: () => void;
  onSetComplete: (restSeconds: number) => void;
}

export function ExerciseCard({
  detail,
  previous,
  onChanged,
  onSetComplete,
}: ExerciseCardProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restKey, setRestKey] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);

  const { workoutExercise, exercise, sets } = detail;

  // Next set number = max live setNumber + 1 (length+1 would collide after
  // a middle set is deleted — the repo enforces uniqueness per exercise).
  const nextSetNumber =
    sets.reduce((max, s) => Math.max(max, s.setNumber), 0) + 1;

  const lastLogged = sets.length > 0 ? sets[sets.length - 1] : undefined;
  const lastPrevSet =
    previous && previous.sets.length > 0
      ? previous.sets[previous.sets.length - 1]
      : undefined;
  // Prefill the next set from a SINGLE source: the last logged set if any,
  // else the last "last time" set, else blank. (Field-by-field fallback
  // would mix reps from one set with weight from another.)
  // The input row remounts on nextSetNumber so fresh prefills never clobber
  // in-progress typing.
  const source = lastLogged ?? lastPrevSet;
  const prefill = (v: number | null | undefined): string =>
    v == null ? '' : String(v);
  const initial = {
    reps: prefill(source?.reps),
    weightKg: prefill(source?.weightKg),
    rpe: prefill(source?.rpe),
  };

  const handleLog = async (values: SetInputValues): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await logSet({
        workoutExerciseId: workoutExercise.id,
        ...values,
        completed: true,
      });
      const rest = workoutExercise.restSeconds ?? DEFAULT_REST_SECONDS;
      setRestKey((k) => k + 1);
      setRestSeconds(rest);
      onSetComplete(rest);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log the set.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSet = async (setId: string): Promise<void> => {
    try {
      await softDeleteSet(setId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the set.');
    }
  };

  const handleRemoveExercise = (): void => {
    Alert.alert(
      'Remove exercise?',
      `"${exercise.name}" and its logged sets will be removed from this workout.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeWorkoutExercise(workoutExercise.id);
              onChanged();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Could not remove the exercise.',
              );
            }
          },
        },
      ],
    );
  };

  const muscles = decodeStringArray(exercise.primaryMuscles).join(', ');

  const lastTimeLine =
    previous === undefined ? 'Looking up last time…' : formatPreviousPerformance(previous);

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: t.size.title,
              fontWeight: t.weight.bold,
            }}
          >
            {exercise.name}
          </Text>
          {muscles ? (
            <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
              {muscles}
            </Text>
          ) : null}
          {lastTimeLine ? (
            <Text
              style={{
                color: theme.colors.muted,
                fontSize: t.size.caption,
                marginTop: 2,
              }}
            >
              {lastTimeLine}
            </Text>
          ) : null}
        </View>
        <Text
          onPress={handleRemoveExercise}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.name} from workout`}
          style={{
            color: theme.colors.faint,
            fontSize: t.size.body,
            padding: theme.spacing.xs,
          }}
        >
          ×
        </Text>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        {sets.map((s) => (
          <SetRow
            key={s.id}
            setNumber={s.setNumber}
            loggedSet={s}
            initial={{ reps: '', weightKg: '', rpe: '' }}
            busy={false}
            error={null}
            onLog={() => {}}
            onDelete={() => void handleDeleteSet(s.id)}
          />
        ))}
        <SetRow
          key={`${workoutExercise.id}-next-${nextSetNumber}`}
          setNumber={nextSetNumber}
          loggedSet={null}
          initial={initial}
          busy={busy}
          error={error}
          onLog={(values) => void handleLog(values)}
          onDelete={() => {}}
        />
      </View>

      {restSeconds != null ? (
        <RestTimer
          key={`${workoutExercise.id}-rest-${restKey}`}
          seconds={restSeconds}
          onDone={() => setRestSeconds(null)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
});
