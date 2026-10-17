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

import { useCallback, useRef, useState, type JSX } from 'react';
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
} from '../../src/data/history';
import { useTheme } from '../../src/theme';
import { trimNumber } from '../../src/components/workout/format';
import { displayName } from '../../src/kb/taxonomy';
import { Button, Card, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { AnalyticsOverview } from '../../src/components/analytics/Overview';
import {
  ProgressionLineChart,
  VolumeBarChart,
  MuscleStackChart,
  type ProgressionDatum,
  type MuscleStackWeek,
} from '../../src/components/history';
import { volumeByMuscleByWeek } from '../../src/stats/balance';
import { startOfWeekMonday } from '../../src/stats/volume';
import { fetchStatWorkouts } from '../../src/stats/queries';
import { listMeasurements } from '../../src/data/repositories';
import { useTopBarInset } from '../../src/components/chrome/TopBar';

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
            accessibilityLabel={`Show progression for ${displayName(o.exercise)}`}
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
              {displayName(o.exercise)}
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
  const topInset = useTopBarInset();

  const [weekly, setWeekly] = useState<WeeklyVolumePoint[] | null>(null);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseHistoryOption[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chart, setChart] = useState<StrengthChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [muscleWeeks, setMuscleWeeks] = useState<MuscleStackWeek[] | null>(null);
  const [weightSeries, setWeightSeries] = useState<ProgressionDatum[] | null>(null);
  const [waistSeries, setWaistSeries] = useState<ProgressionDatum[] | null>(null);
  const [weightUnit, setWeightUnit] = useState('');
  const [waistUnit, setWaistUnit] = useState('');
  // loadExtra completion flag — prevents the empty state from flickering
  // for users with only measurement data while the extra charts load.
  const [extraLoaded, setExtraLoaded] = useState(false);
  // Stale-response guard for loadExtra (same pattern as the dashboard).
  const extraLoadIdRef = useRef(0);

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

  // Stale-response guard for the exercise chart (tapping chips quickly
  // must not render A's series under B's name).
  const chartLoadIdRef = useRef(0);
  const loadChart = useCallback(async (exerciseId: string) => {
    const loadId = ++chartLoadIdRef.current;
    const alive = () => chartLoadIdRef.current === loadId;
    setChartLoading(true);
    try {
      const points = await getExerciseProgression(exerciseId);
      if (!alive()) return;
      setChart(toChartData(points));
    } catch {
      if (!alive()) return;
      setChart(null);
    } finally {
      if (alive()) setChartLoading(false);
    }
  }, []);

  const loadExtra = useCallback(async () => {
    const loadId = ++extraLoadIdRef.current;
    const alive = () => extraLoadIdRef.current === loadId;
    try {
      // Monday-aligned 12-week window, same as the Balance screen.
      const end = startOfWeekMonday(new Date());
      end.setDate(end.getDate() + 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 12 * 7);
      const [workouts, weight, waist] = await Promise.all([
        fetchStatWorkouts(start, end),
        listMeasurements('body_weight', 60),
        listMeasurements('waist', 60),
      ]);
      if (!alive()) return;
      const pts = volumeByMuscleByWeek(workouts, 12);
      setMuscleWeeks(
        pts.map((p) => ({
          label: shortDay(p.weekStart),
          segments: [...p.byGroup.entries()]
            .map(([group, volumeKg]) => ({ group, volumeKg: Math.round(volumeKg) }))
            .sort((a, b) => b.volumeKg - a.volumeKg),
        })),
      );
      const toDatum = (m: { measuredAt: Date; value: number }): ProgressionDatum => ({
        label: shortDay(new Date(m.measuredAt)),
        value: m.value,
        best: false,
      });
      // Measurements carry their own unit; plot only rows matching the most
      // common unit (units are never converted — mixing kg and lb on one
      // line would lie).
      const commonUnit = (rows: { unit: string }[]): string => {
        const counts = new Map<string, number>();
        for (const r of rows) counts.set(r.unit, (counts.get(r.unit) ?? 0) + 1);
        return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      };
      const weightUnit = commonUnit(weight);
      const waistUnit = commonUnit(waist);
      const weightRows = weight.slice().reverse().filter((m) => m.unit === weightUnit);
      const waistRows = waist.slice().reverse().filter((m) => m.unit === waistUnit);
      setWeightSeries(weightRows.map(toDatum));
      setWaistSeries(waistRows.map(toDatum));
      setWeightUnit(weightUnit);
      setWaistUnit(waistUnit);
    } catch (e) {
      console.warn('[progress] extra charts failed', e);
      if (!alive()) return;
      setMuscleWeeks([]);
      setWeightSeries([]);
      setWaistSeries([]);
    } finally {
      if (alive()) setExtraLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
      void loadExtra();
    }, [loadOverview, loadExtra]),
  );

  useFocusEffect(
    useCallback(() => {
      if (selectedId) void loadChart(selectedId);
    }, [selectedId, loadChart]),
  );

  const loading = weekly == null || exerciseOptions == null;
  // Weeks are always seeded (12 entries), so emptiness = no workouts at all.
  const hasData = weekly?.some((w) => w.workoutCount > 0) ?? false;
  const selectedExercise = exerciseOptions?.find((o) => o.exercise.id === selectedId)?.exercise;
  const selectedName = selectedExercise ? displayName(selectedExercise) : undefined;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={{ paddingTop: topInset }} />
      <ScreenHeader title="Analytics" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      ) : !hasData && extraLoaded && (weightSeries == null || weightSeries.length <= 1) && (waistSeries == null || waistSeries.length <= 1) ? (
        <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}>
          <AnalyticsOverview />
          <EmptyState
            message="No training data yet."
            hint="Log your first workout and your volume and strength trends will appear here."
            action={
              <Button title="Start workout" onPress={() => router.push('/workout/new')} />
            }
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
        >
          <AnalyticsOverview />
          {hasData ? (
          <>
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

          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <SectionTitle>MUSCLE VOLUME</SectionTitle>
            </View>
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <Card>
                {muscleWeeks == null ? (
                  <View style={styles.chartLoading}>
                    <ActivityIndicator color={theme.colors.muted} />
                  </View>
                ) : muscleWeeks.some((w) => w.segments.length > 0) ? (
                  <>
                    <MuscleStackChart weeks={muscleWeeks} />
                    <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, marginTop: 4 }}>
                      Volume per primary muscle group · last 12 weeks{'\n'}
                      Each set is credited to every primary muscle it works, so stacked totals exceed the weekly volume above.
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                    Not enough data yet.
                  </Text>
                )}
              </Card>
            </View>
          </View>
          </>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <SectionTitle>BODY MEASUREMENTS</SectionTitle>
            </View>
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <Card>
                {weightSeries == null ? (
                  <View style={styles.chartLoading}>
                    <ActivityIndicator color={theme.colors.muted} />
                  </View>
                ) : weightSeries.length > 1 ? (
                  <>
                    <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium, marginBottom: 4 }}>
                      Body weight
                    </Text>
                    <ProgressionLineChart data={weightSeries} unit={weightUnit} />
                  </>
                ) : (
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                    Log body weight in Measure to see the trend.
                  </Text>
                )}
              </Card>
            </View>
            {waistSeries != null && waistSeries.length > 1 ? (
              <View style={{ paddingHorizontal: theme.spacing.md }}>
                <Card>
                  <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium, marginBottom: 4 }}>
                    Waist
                  </Text>
                  <ProgressionLineChart data={waistSeries} unit={waistUnit} />
                </Card>
              </View>
            ) : null}
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
