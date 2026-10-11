/**
 * Progress — training analytics, all on-device.
 *
 * - Weekly volume: total kg lifted per week, last 12 weeks (bar chart).
 * - Strength: per-exercise progression of estimated 1RM (Epley) over time,
 *   with an exercise picker. New all-time bests are marked in the
 *   theme's confirmation color.
 *
 * Charts are pure SVG (react-native-svg ships in Expo Go) — no native
 * modules, no network, monochrome per the accent discipline.
 */

import { useCallback, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getExerciseProgression,
  getWeeklyVolume,
  listExercisesWithHistory,
  type ExerciseHistoryOption,
  type ProgressionPoint,
  type WeeklyVolumePoint,
} from '../src/data/history';
import { useTheme } from '../src/theme';
import { trimNumber } from '../src/components/workout/format';
import { Button, Card, EmptyState, ScreenHeader } from '../src/components/workout/ui';
import {
  ProgressionLineChart,
  VolumeBarChart,
  type ProgressionDatum,
} from '../src/components/history';

/** "Oct 5" — short label for chart axes. */
function shortDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SectionTitle({ children }: { children: string }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Text
      style={{
        color: theme.colors.muted,
        fontSize: t.size.caption,
        fontWeight: t.weight.medium,
        letterSpacing: 1,
      }}
    >
      {children}
    </Text>
  );
}

interface StrengthChartData {
  data: ProgressionDatum[];
  unit: string;
  latestLabel: string;
}

/** One chart-ready series from raw progression points. */
function toChartData(points: ProgressionPoint[]): StrengthChartData | null {
  if (points.length === 0) return null;
  const useKg = points.some((p) => p.estimated1RMKg != null || p.topWeightKg != null);
  const values = points.map((p) =>
    useKg ? (p.estimated1RMKg ?? p.topWeightKg ?? 0) : (p.topReps ?? 0),
  );
  // The first point is the baseline, not a "new best" — only later
  // improvements earn the confirmation color.
  let best = values[0];
  const data: ProgressionDatum[] = points.map((p, i) => {
    const value = values[i];
    const isBest = i > 0 && value > best;
    if (value > best) best = value;
    return { label: shortDay(p.date), value, best: isBest };
  });
  const last = points[points.length - 1];
  const latestLabel = useKg
    ? `${trimNumber(last.estimated1RMKg ?? last.topWeightKg ?? 0)} kg est. 1RM`
    : `${last.topReps ?? 0} reps top set`;
  return { data, unit: useKg ? 'kg' : 'reps', latestLabel };
}

function ExerciseChips({
  options,
  selectedId,
  onSelect,
}: {
  options: ExerciseHistoryOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}
    >
      {options.map((o) => {
        const selected = o.exercise.id === selectedId;
        return (
          <Pressable
            key={o.exercise.id}
            onPress={() => onSelect(o.exercise.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show progression for ${o.exercise.name}`}
            style={{
              backgroundColor: selected ? theme.colors.text : theme.colors.surfaceMuted,
              borderRadius: theme.radius.pill,
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.sm,
              borderWidth: selected ? 0 : 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text
              style={{
                color: selected ? theme.colors.background : theme.colors.text,
                fontSize: t.size.caption,
                fontWeight: t.weight.medium,
              }}
            >
              {o.exercise.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function ProgressScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;

  const [weekly, setWeekly] = useState<WeeklyVolumePoint[] | null>(null);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseHistoryOption[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chart, setChart] = useState<StrengthChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const [w, opts] = await Promise.all([getWeeklyVolume(12), listExercisesWithHistory()]);
      setWeekly(w);
      setExerciseOptions(opts);
      if (opts.length > 0) {
        setSelectedId((prev) => prev ?? opts[0].exercise.id);
      }
    } catch {
      setWeekly([]);
      setExerciseOptions([]);
    }
  }, []);

  const loadChart = useCallback(async (exerciseId: string) => {
    setChartLoading(true);
    try {
      const points = await getExerciseProgression(exerciseId);
      setChart(toChartData(points));
    } catch {
      setChart(null);
    } finally {
      setChartLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview]),
  );

  useFocusEffect(
    useCallback(() => {
      if (selectedId) void loadChart(selectedId);
    }, [selectedId, loadChart]),
  );

  const loading = weekly == null || exerciseOptions == null;
  // Weeks are always seeded (12 entries), so emptiness = no workouts at all.
  const hasData = weekly?.some((w) => w.workoutCount > 0) ?? false;
  const selectedName = exerciseOptions?.find((o) => o.exercise.id === selectedId)?.exercise.name;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="Progress" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      ) : !hasData ? (
        <EmptyState
          message="No training data yet."
          hint="Log your first workout and your volume and strength trends will appear here."
          action={
            <Button title="Start workout" onPress={() => router.push('/workout/new')} />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
        >
          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <SectionTitle>WEEKLY VOLUME</SectionTitle>
            </View>
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <Card>
                <VolumeBarChart
                  data={weekly.map((w) => ({ label: shortDay(w.weekStart), value: w.volumeKg }))}
                />
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                  Total kg lifted per week · last 12 weeks
                </Text>
              </Card>
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <SectionTitle>STRENGTH</SectionTitle>
            </View>
            {exerciseOptions.length > 0 ? (
              <>
                <ExerciseChips
                  options={exerciseOptions}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <View style={{ paddingHorizontal: theme.spacing.md }}>
                  <Card>
                    {chartLoading ? (
                      <View style={styles.chartLoading}>
                        <ActivityIndicator color={theme.colors.muted} />
                      </View>
                    ) : chart ? (
                      <>
                        <View style={styles.chartHeader}>
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontSize: t.size.body,
                              fontWeight: t.weight.medium,
                            }}
                            numberOfLines={1}
                          >
                            {selectedName}
                          </Text>
                          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                            {chart.latestLabel}
                          </Text>
                        </View>
                        <ProgressionLineChart data={chart.data} unit={chart.unit} />
                      </>
                    ) : (
                      <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                        Not enough data for this exercise yet.
                      </Text>
                    )}
                  </Card>
                </View>
              </>
            ) : (
              <View style={{ paddingHorizontal: theme.spacing.md }}>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                  Strength trends appear after your first logged workout.
                </Text>
              </View>
            )}
          </View>
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
  chartLoading: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartHeader: {
    gap: 2,
    marginBottom: 4,
  },
});
