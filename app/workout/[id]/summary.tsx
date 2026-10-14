/**
 * Post-workout summary: duration, exercises, sets, total volume.
 * Reached after finishWorkout; "Done" returns home. A workout that isn't
 * finished yet is bounced back to the active screen — this route never
 * shows a live workout.
 */

import { useCallback, useState, type JSX } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getWorkoutDetail,
  type WorkoutDetail,
} from '../../../src/data/repositories';
import { useTheme } from '../../../src/theme';
import {
  formatDuration,
  formatSetSummary,
  formatWorkoutDay,
  totalVolumeKg,
  trimNumber,
} from '../../../src/components/workout/format';
import { displayName } from '../../../src/kb/taxonomy';
import { Button, Card, EmptyState, ScreenHeader } from '../../../src/components/workout/ui';

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View style={styles.stat}>
      <Text
        style={{ color: theme.colors.text, fontSize: t.size.display, fontWeight: t.weight.bold }}
      >
        {value}
      </Text>
      <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>{label}</Text>
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

          <Card>
            <View style={styles.statRow}>
              <Stat label="EXERCISES" value={String(detail.items.length)} />
              <Stat label="SETS" value={String(allSets.length)} />
              <Stat label="VOLUME (KG)" value={trimNumber(totalVolumeKg(allSets))} />
            </View>
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
