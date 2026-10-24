/**
 * Post-workout summary: duration, exercises, sets, total volume.
 * Reached after finishWorkout; "Done" returns home. A workout that isn't
 * finished yet is bounced back to the active screen — this route never
 * shows a live workout.
 */

import { useCallback, useEffect, useState, type JSX } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getWorkoutDetail,
  type WorkoutDetail,
} from '../../../src/data/repositories';
import { useTheme } from '../../../src/theme';
import { useGroupFit } from '../../../src/theme/adaptive';
import {
  formatDuration,
  formatSetSummary,
  formatWorkoutDay,
  totalVolumeKg,
  trimNumber,
} from '../../../src/components/workout/format';
import { displayName } from '../../../src/kb/taxonomy';
import { Button, Card, EmptyState, ScreenHeader } from '../../../src/components/workout/ui';
import { Celebration, type CelebrationRecord } from '../../../src/components/workout/Celebration';
import { listPRsWithExercises } from '../../../src/data/repositories';
import { prKindLabel } from '../../../src/components/dashboard/prLabels';
import { companionRecords, companionWorkoutFinished } from '../../../src/companion/triggers';

function Stat({ label, value, size }: { label: string; value: string; size: number }): JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.stat}>
      <Text
        style={{ color: theme.colors.text, fontSize: size, fontWeight: theme.typography.weight.bold }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.caption }}>{label}</Text>
    </View>
  );
}

/**
 * The three summary numbers. They used to shrink individually, so a long volume
 * sat smaller than a two-digit set count. Now one size is computed for the row
 * from its widest value and given to all three.
 */
function StatRow({ stats }: { stats: ReadonlyArray<{ label: string; value: string }> }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const longest = stats.reduce((a, s) => (s.value.length > a.length ? s.value : a), '');
  const fit = useGroupFit({ longest, base: t.size.display, min: t.size.section, count: stats.length });
  return (
    <View onLayout={fit.onLayout} style={styles.statRow}>
      {stats.map((s) => (
        <Stat key={s.label} label={s.label} value={s.value} size={fit.size} />
      ))}
    </View>
  );
}

export default function WorkoutSummaryScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [records, setRecords] = useState<CelebrationRecord[]>([]);

  const load = useCallback(async () => {
    if (!workoutId) {
      setLoadError('Missing workout id.');
      setLoading(false);
      return;
    }
    try {
      const d = await getWorkoutDetail(workoutId);
      if (!d) {
        setLoadError('Workout not found.');
      } else if (d.workout.endedAt == null) {
        // Live workout — this route is summary-only.
        router.replace(`/workout/${workoutId}`);
        return;
      } else {
        setDetail(d);
        try {
          const prs = await listPRsWithExercises();
          setRecords(
            prs
              .filter((p) => p.workoutId === workoutId)
              .map((p) => ({
                id: p.id,
                exerciseName: p.exerciseName,
                label: prKindLabel(p.kind),
                value: trimNumber(Math.round(p.value * 10) / 10),
              })),
          );
        } catch {
          setRecords([]);
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the workout.');
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const allSets = detail?.items.flatMap((i) => i.sets) ?? [];
  const duration =
    detail?.workout.endedAt != null
      ? formatDuration(
          new Date(detail.workout.endedAt).getTime() -
            new Date(detail.workout.startedAt).getTime(),
        )
      : '—';

  // Companion: one cheer when the summary opens (a finished workout), and a
  // record nudge when this session set PRs. Purely additive; the queue handles
  // ordering/dedupe and is a no-op while the companion is off.
  useEffect(() => {
    if (detail && detail.workout.endedAt != null) companionWorkoutFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.workout.id]);
  useEffect(() => {
    if (records.length > 0) companionRecords(records.length);
  }, [records.length]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="Workout complete" />
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
        <ScrollView
          style={styles.body}
          contentContainerStyle={[
            styles.bodyContent,
            { paddingHorizontal: theme.spacing.md, gap: theme.spacing.md },
          ]}
        >
          <View>
            <Text
              style={{ color: theme.colors.text, fontSize: t.size.card, fontWeight: t.weight.bold }}
              numberOfLines={2}
            >
              {detail.workout.name}
            </Text>
            <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
              {formatWorkoutDay(new Date(detail.workout.startedAt))} · {duration}
            </Text>
          </View>

          <Celebration records={records} setCount={allSets.length} />

          <Card>
            <StatRow
              stats={[
                { label: 'EXERCISES', value: String(detail.items.length) },
                { label: 'SETS', value: String(allSets.length) },
                { label: 'VOLUME (KG)', value: trimNumber(totalVolumeKg(allSets)) },
              ]}
            />
          </Card>

          {detail.items.map((item) => (
            <View key={item.workoutExercise.id} style={{ gap: theme.spacing.xs }}>
              <Text
                style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }}
              >
                {displayName(item.exercise)}
              </Text>
              {item.sets.map((s) => (
                <Text
                  key={s.id}
                  style={{ color: theme.colors.muted, fontSize: t.size.caption }}
                >
                  Set {s.setNumber}: {formatSetSummary(s)}
                </Text>
              ))}
            </View>
          ))}

          <Button title="Done" onPress={() => router.replace('/')} />
        </ScrollView>
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 32,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
});
