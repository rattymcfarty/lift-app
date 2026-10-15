/**
 * Plan detail: the full template breakdown, plus Start / Edit / Delete.
 * "Start workout" hands off to the active-workout flow via
 * startWorkoutFromRoutine — targets become rest-timer defaults and the user
 * logs sets fresh.
 *
 * Style (reference): the exercises render as one card with a
 * "# EXERCISE SETS REPS" table — orange numbers, name + target detail,
 * sets/reps in darker inset pills. LIFT plans are flat templates (no
 * day-grouping), so the whole plan is one table, not one card per day.
 */

import { useCallback, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
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
import { duplicateRoutine } from '../../src/data/routines';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { trimNumber } from '../../src/components/workout/format';
import { displayName } from '../../src/kb/taxonomy';
import { FONT_WEIGHT } from '../../src/theme/tokens';

/** Extra target detail shown under the name (weight / RPE / rest). */
function targetDetail(item: RoutineDetail['items'][number]): string {
  const re = item.routineExercise;
  const parts: string[] = [];
  if (re.targetWeightKg != null) parts.push(`${trimNumber(re.targetWeightKg)} kg`);
  if (re.targetRpe != null) parts.push(`RPE ${trimNumber(re.targetRpe)}`);
  if (re.targetRestSeconds != null) parts.push(`rest ${re.targetRestSeconds}s`);
  return parts.join(' · ');
}

function BreakdownRow({
  item,
  index,
}: {
  item: RoutineDetail['items'][number];
  index: number;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const re = item.routineExercise;
  const detail = targetDetail(item);
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
      <View style={styles.rowMain}>
        <Text
          style={{
            color: theme.colors.highlight,
            fontSize: t.size.body,
            fontWeight: t.weight.bold,
            minWidth: 28,
            textAlign: 'center',
          }}
        >
          {index + 1}
        </Text>
        <View style={styles.rowName}>
          <Text
            style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}
            numberOfLines={1}
          >
            {displayName(item.exercise)}
          </Text>
          {detail ? (
            <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
            {re.targetSets != null ? String(re.targetSets) : '—'}
          </Text>
        </View>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
            {re.targetReps ?? '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function PlanDetailScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const params = useLocalSearchParams<{ id: string }>();
  const planId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [detail, setDetail] = useState<RoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Re-entrancy guard: disabled-button state updates async.
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!planId) {
      setLoading(false);
      return;
    }
    try {
      setDetail(await getRoutine(planId));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

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
    if (!planId || busyRef.current) return;
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
      const workoutId = await startWorkoutFromRoutine(planId);
      if (!workoutId) {
        setError('That plan has no exercises to start from.');
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
    if (!planId || busyRef.current) return;
    Alert.alert(
      'Delete plan?',
      'The plan and its items will be removed. Past workouts are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            busyRef.current = true;
            setDeleting(true);
            void softDeleteRoutine(planId)
              .then(() => router.back())
              .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Could not delete the plan.');
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
        <ScreenHeader title="Plan" onBack={() => router.back()} />
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
        <ScreenHeader title="Plan" onBack={() => router.back()} />
        <EmptyState
          message="This plan no longer exists."
          action={<Button title="Back to plans" onPress={() => router.back()} />}
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
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.xl,
          gap: theme.spacing.md,
        }}
      >
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
          {error ? (
            <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>
              {error}
            </Text>
          ) : null}
          <Button
            title="Start workout"
            size="large"
            variant="gold"
            testID="plan-start-workout"
            onPress={() => void handleStart()}
            busy={starting}
            disabled={detail.items.length === 0}
          />
          <Button
            title="Edit plan"
            variant="secondary"
            testID="plan-edit"
            onPress={() => router.push(`/plans/${planId}/edit`)}
          />
          <Button
            title="Duplicate as my own plan"
            variant="secondary"
            testID="plan-duplicate"
            onPress={() => {
              void (async () => {
                try {
                  const copyId = await duplicateRoutine(planId);
                  router.replace(`/plans/${copyId}`);
                } catch (e) {
                  Alert.alert('Could not duplicate', e instanceof Error ? e.message : 'Try again.');
                }
              })();
            }}
          />
        </View>

        <Card>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { color: theme.colors.muted, fontSize: t.size.caption, minWidth: 28, textAlign: 'center' }]}>
              #
            </Text>
            <Text style={[styles.tableHeaderText, { color: theme.colors.muted, fontSize: t.size.caption, flex: 1 }]}>
              Exercise
            </Text>
            <Text style={[styles.tableHeaderText, { color: theme.colors.muted, fontSize: t.size.caption, minWidth: 60, textAlign: 'center' }]}>
              Sets
            </Text>
            <Text style={[styles.tableHeaderText, { color: theme.colors.muted, fontSize: t.size.caption, minWidth: 60, textAlign: 'center' }]}>
              Reps
            </Text>
          </View>
          {detail.items.length === 0 ? (
            <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>
              No exercises in this template yet.
            </Text>
          ) : (
            detail.items.map((item, i) => (
              <BreakdownRow key={item.routineExercise.id} item={item} index={i} />
            ))
          )}
        </Card>

        <View style={{ marginTop: theme.spacing.md }}>
          <Button
            title="Delete plan"
            variant="danger"
            testID="plan-delete"
            onPress={handleDelete}
            busy={deleting}
          />
        </View>
      </ScrollView>
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
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    flex: 1,
    gap: 2,
  },
  pill: {
    minWidth: 60,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  tableHeaderText: {
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'uppercase',
  },
});
