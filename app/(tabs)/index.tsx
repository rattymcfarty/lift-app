/**
 * Home — dashboard + workout flow entry point. (P4a)
 *
 * Dashboard sections (all REAL stats from logged data, no mocks):
 * - Today card: current program session targets when enrolled, else a
 *   suggestion to start a workout.
 * - Stats grid: this week's volume, workouts, streak, consistency.
 * - Sparkline: last 8 weeks of volume (react-native-svg).
 * - Recent PRs: top 3 from PR tracking.
 * Workout flow (preserved from P1): active-workout resume, start button,
 * nav buttons, recent workouts. Empty states invite, never look broken.
 */

import { useCallback, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getActiveWorkout,
  listPRsWithExercises,
  listRecentWorkouts,
  type PRWithExercise,
  type WorkoutDetail,
} from '../../src/data/repositories';
import type { Workout } from '../../src/db/schema';
import { getConsistency, getDashboardStats, fetchStatWorkouts } from '../../src/stats/queries';
import type { Consistency, DashboardStats } from '../../src/stats/queries';
import { startOfWeekMonday } from '../../src/stats/volume';
import { cardioPillar, cardioWorkoutMinutes, strengthPillar, strengthSessions, type PillarStatus } from '../../src/stats/pillars';
import { cardioMinutesInRange } from '../../src/data/cardio';
import { getCurrentSessionTargets, type CurrentSessionTargets } from '../../src/programs/engine';
import { catchUpProgramAdvancement } from '../../src/programs/sessions';
import { listEnrollments } from '../../src/programs/enrollments';
import { useTheme } from '../../src/theme';
import { useBreakpoint } from '../../src/theme/breakpoints';
import { formatDuration, formatWorkoutDay } from '../../src/components/workout/format';
import { Button, Card, EmptyState } from '../../src/components/workout/ui';
import { Sparkline } from '../../src/components/dashboard/Sparkline';
import { prKindLabel } from '../../src/components/dashboard/prLabels';

function formatKg(kg: number): string {
  if (kg >= 999.5) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

function RecentRow({ workout }: { workout: Workout }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const duration =
    workout.endedAt != null
      ? formatDuration(workout.endedAt.getTime() - workout.startedAt.getTime())
      : null;
  return (
    <Pressable
      onPress={() => router.push(`/workout/${workout.id}/summary`)}
      accessibilityRole="button"
      accessibilityLabel={`View summary of ${workout.name}`}
      style={({ pressed }) => [
        styles.recentRow,
        {
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.recentText}>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }}
          numberOfLines={1}
        >
          {workout.name}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          {formatWorkoutDay(workout.startedAt)}
          {duration ? ` · ${duration}` : ''}
        </Text>
      </View>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
    </Pressable>
  );
}

function StatCell({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View style={[styles.statCell, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
        {label}
      </Text>
      <Text
        style={{ color: theme.colors.text, fontSize: t.size.section, fontWeight: t.weight.bold }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      {hint ? (
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export default function Home(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { width: windowWidth } = useWindowDimensions();
  // P5: on tablet/wide screens the 2x2 stats grid becomes a single 4-across
  // row — same data, better use of horizontal space. Phones keep 2x2.
  const { isWide } = useBreakpoint();

  const [active, setActive] = useState<WorkoutDetail | null>(null);
  const [recent, setRecent] = useState<Workout[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [consistency, setConsistency] = useState<Consistency | null>(null);
  const [today, setToday] = useState<CurrentSessionTargets | null>(null);
  const [todayProgram, setTodayProgram] = useState<string | null>(null);
  const [prs, setPrs] = useState<PRWithExercise[]>([]);
  const [pillars, setPillars] = useState<PillarStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  // Stale-response guard: every focus starts a new load; only the latest
  // may write state.
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const alive = () => loadIdRef.current === loadId;

    // Phase 1 — core workout flow. Loads first; the spinner clears here so
    // "Resume workout" never waits on dashboard stats.
    try {
      const [a, r] = await Promise.all([getActiveWorkout(), listRecentWorkouts(11)]);
      if (!alive()) return;
      setActive(a);
      setRecent(r.filter((w) => w.endedAt != null).slice(0, 10));
    } catch {
      if (!alive()) return;
      setActive(null);
      setRecent([]);
    } finally {
      if (alive()) setLoading(false);
    }

    // Phase 2 — dashboard sections. Each fails independently; a stats
    // failure never hides the workout flow or the other sections.
    // Enrollments are resolved once and shared by consistency + today card.
    let enrollment: { id: string; programName: string } | null = null;
    try {
      const list = await listEnrollments('active');
      if (alive() && list.length > 0) {
        enrollment = { id: list[0].enrollment.id, programName: list[0].program.name };
      }
    } catch (e) {
      console.warn('[home] enrollments failed', e);
    }
    // Phase 2 — program catch-up runs FIRST (sequenced, not parallel):
    // it advances the pointer for finished sessions, so consistency and
    // the today card below read post-advancement state.
    if (enrollment && alive()) {
      try {
        await catchUpProgramAdvancement(enrollment.id);
      } catch (e) {
        console.warn('[home] program catch-up failed', e);
      }
    }
    if (!alive()) return;

    // Phase 3 — dashboard sections. Each fails independently; a stats
    // failure never hides the workout flow or the other sections.
    const settle = async <T,>(p: Promise<T>, apply: (v: T) => void): Promise<void> => {
      try {
        const v = await p;
        if (alive()) apply(v);
      } catch (e) {
        console.warn('[home] dashboard section failed', e);
      }
    };
    await Promise.all([
      settle(getDashboardStats(), setStats),
      settle(getConsistency(new Date(), enrollment?.id), setConsistency),
      settle(
        listPRsWithExercises().then((all) => all.slice(0, 3)),
        setPrs,
      ),
      settle(
        (async () => {
          // One clock read for the whole window. Cardio uses end-of-week
          // (not "now") so near-future logs aren't excluded.
          const now = new Date();
          const weekStart = startOfWeekMonday(now);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const [workouts, cardioMin] = await Promise.all([
            fetchStatWorkouts(weekStart, now),
            cardioMinutesInRange(weekStart, weekEnd),
          ]);
          // Same definition as the Pillars screen (see src/stats/pillars.ts).
          const sessions = strengthSessions(workouts);
          const totalCardio = cardioMin + cardioWorkoutMinutes(workouts);
          return [strengthPillar(sessions), cardioPillar(totalCardio)];
        })(),
        setPillars,
      ),
      settle(
        (async () => {
          if (!enrollment) return null;
          try {
            const targets = await getCurrentSessionTargets(enrollment.id);
            return { targets, programName: enrollment.programName };
          } catch (e) {
            // No session at the pointer (complete / gap) — fall back to
            // the generic card. Log it so corrupt data doesn't hide.
            console.warn('[home] today-card: no session targets', e);
            return null;
          }
        })(),
        (v) => {
          setToday(v?.targets ?? null);
          setTodayProgram(v?.programName ?? null);
        },
      ),
    ]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sparkWidth = Math.max(160, windowWidth - theme.spacing.md * 4);
  // hasData considers both stats and the recent list: a stats failure
  // must not greet a returning user as new.
  const hasData = (stats?.totalWorkouts ?? 0) > 0 || recent.length > 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={[styles.header, { paddingHorizontal: theme.spacing.md, flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: t.size.brand, fontWeight: t.weight.bold, letterSpacing: 4 }}>
            LIFT
          </Text>
          <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
            Longevity Intelligent Fitness Trainer
          </Text>
        </View>
        <Pressable
          testID="home-settings"
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={8}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: theme.colors.muted, fontSize: t.size.section }}>⚙</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(w) => w.id}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.md }}
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.md }}>
              {active ? (
                <Card>
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                    WORKOUT IN PROGRESS
                  </Text>
                  <Text
                    style={{ color: theme.colors.text, fontSize: t.size.card, fontWeight: t.weight.bold }}
                    numberOfLines={2}
                  >
                    {active.workout.name}
                  </Text>
                  <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                    {active.items.length} exercise{active.items.length === 1 ? '' : 's'} ·{' '}
                    {active.items.reduce((n, i) => n + i.sets.length, 0)} sets logged
                  </Text>
                  <Button
                    title="Resume workout"
                    size="large"
                    testID="home-resume-workout"
                    onPress={() => router.push(`/workout/${active.workout.id}`)}
                  />
                </Card>
              ) : null}

              {/* UP NEXT — program session pointer or suggestion */}
              <Card>
                <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>UP NEXT</Text>
                {today ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <Text style={{ color: theme.colors.text, fontSize: t.size.card, fontWeight: t.weight.bold }} numberOfLines={2}>
                      {today.routineName}
                    </Text>
                    <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                      {todayProgram} · Week {today.week}, Day {today.day}
                    </Text>
                    {today.isDeloadWeek ? (
                      <Text style={{ color: theme.colors.success, fontSize: t.size.body, fontWeight: t.weight.medium }}>
                        Deload week — targets reduced
                        {today.volumeFactor != null ? ` to ${Math.round(today.volumeFactor * 100)}%` : ''}.
                        Train light.
                      </Text>
                    ) : null}
                    {today.exercises.slice(0, 3).map((ex) => (
                      <Text
                        key={`${ex.position}-${ex.exerciseId}`}
                        style={{ color: theme.colors.muted, fontSize: t.size.caption }}
                        numberOfLines={1}
                      >
                        {ex.exerciseName}: {formatTarget(ex.sets, ex.repMin, ex.repMax, ex.weightKg)}
                      </Text>
                    ))}
                    {today.exercises.length > 3 ? (
                      <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                        +{today.exercises.length - 3} more
                      </Text>
                    ) : null}
                    {active ? null : (
                      <View style={{ gap: theme.spacing.sm }}>
                        <Button
                          title="Start this session"
                          size="large"
                          testID="home-start-session"
                          onPress={() =>
                            router.push({
                              pathname: '/workout/new',
                              params: {
                                planId: today.routineId,
                                enrollmentId: today.enrollmentId,
                                week: String(today.week),
                                day: String(today.day),
                              },
                            })
                          }
                        />
                        <Button
                          title="Start freeform workout"
                          variant="secondary"
                          onPress={() => router.push('/workout/new')}
                        />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ gap: theme.spacing.sm }}>
                    <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
                      {hasData ? 'No program session scheduled.' : 'Welcome to LIFT.'}
                    </Text>
                    <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                      {hasData
                        ? 'Enroll in a program for guided progression, or train freely.'
                        : 'Log your first workout — every set is stored on this device only.'}
                    </Text>
                    <Button title="Start workout" testID="home-start-workout" onPress={() => router.push('/workout/new')} />
                  </View>
                )}
              </Card>

              {/* STATS GRID — 2x2 on phones, 4-across on tablet/wide (P5) */}
              <View>
                <Text
                  style={{
                    color: theme.colors.muted,
                    fontSize: t.size.caption,
                    fontWeight: t.weight.medium,
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  THIS WEEK
                </Text>
                {isWide ? (
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <StatCell label="Volume" value={formatKg(stats?.thisWeekVolumeKg ?? 0)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <StatCell label="Workouts" value={String(stats?.thisWeekWorkouts ?? 0)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <StatCell
                        label="Streak"
                        value={`${stats?.streakWeeks ?? 0} wk`}
                        hint={(stats?.streakWeeks ?? 0) === 0 && hasData ? 'Log this week to restart' : undefined}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <StatCell
                        label="Consistency"
                        value={consistency?.score != null ? `${consistency.score}%` : '—'}
                        hint={
                          consistency?.score == null
                            ? 'Log workouts to measure'
                            : consistency.basis === 'program'
                              ? 'of planned sessions'
                              : 'of recent weeks active'
                        }
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <StatCell label="Volume" value={formatKg(stats?.thisWeekVolumeKg ?? 0)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <StatCell label="Workouts" value={String(stats?.thisWeekWorkouts ?? 0)} />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <StatCell
                          label="Streak"
                          value={`${stats?.streakWeeks ?? 0} wk`}
                          hint={(stats?.streakWeeks ?? 0) === 0 && hasData ? 'Log this week to restart' : undefined}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <StatCell
                          label="Consistency"
                          value={consistency?.score != null ? `${consistency.score}%` : '—'}
                          hint={
                            consistency?.score == null
                              ? 'Log workouts to measure'
                              : consistency.basis === 'program'
                                ? 'of planned sessions'
                                : 'of recent weeks active'
                          }
                        />
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* SPARKLINE */}
              <Card>
                <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                  VOLUME · LAST 8 WEEKS
                </Text>
                <Sparkline values={(stats?.weeklyVolume ?? []).map((b) => b.volumeKg)} width={sparkWidth} />
                {!hasData ? (
                  <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                    Your trend appears here once you log workouts.
                  </Text>
                ) : null}
              </Card>

              {/* LONGEVITY PILLARS */}
              {pillars ? (
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
                    <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                      LONGEVITY PILLARS · THIS WEEK
                    </Text>
                  </View>
                  {pillars.map((p) => {
                    const color = p.state === 'met' ? theme.colors.success : p.state === 'progress' ? theme.colors.muted : theme.colors.faint;
                    return (
                      <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.xs }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: theme.spacing.sm }} />
                        <Text style={{ color: theme.colors.text, fontSize: t.size.body, flex: 1 }}>
                          {p.label}
                        </Text>
                        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                          {p.summary}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              ) : null}


              {/* RECENT PRs */}
              {prs.length > 0 ? (
                <Card>
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                    RECENT PERSONAL RECORDS
                  </Text>
                  {prs.map((pr, i) => (
                    <View
                      key={pr.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: theme.spacing.xs,
                        borderBottomColor: theme.colors.border,
                        borderBottomWidth: i === prs.length - 1 ? 0 : 1,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }} numberOfLines={1}>
                          {pr.exerciseName}
                        </Text>
                        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                          {prKindLabel(pr.kind)}
                        </Text>
                      </View>
                      <Text style={{ color: theme.colors.success, fontSize: t.size.body, fontWeight: t.weight.bold }}>
                        {trimNum(pr.value)} {pr.unit}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              {/* MORE — secondary destinations as quiet rows, not buttons,
                  so they stop competing with the hero actions above. */}
              <View>
                <Text
                  style={{
                    color: theme.colors.muted,
                    fontSize: t.size.caption,
                    fontWeight: t.weight.medium,
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  MORE
                </Text>
                <MoreRow label="Measure" onPress={() => router.push('/measure')} />
                <MoreRow label="Calculators" onPress={() => router.push('/calculators')} />
                <MoreRow label="Personal records" onPress={() => router.push('/prs')} />
                <MoreRow label="Muscle balance" onPress={() => router.push('/balance')} />
                <MoreRow label="Longevity pillars" onPress={() => router.push('/pillars')} last />
              </View>
              {recent.length > 0 ? (
                <Text
                  style={{
                    color: theme.colors.muted,
                    fontSize: t.size.caption,
                    fontWeight: t.weight.medium,
                    marginTop: theme.spacing.sm,
                  }}
                >
                  RECENT WORKOUTS
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <RecentRow workout={item} />}
          ListEmptyComponent={
            active ? null : (
              <EmptyState
                message="No workouts yet."
                hint="Start your first workout — every set is stored on this device only."
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

/**
 * One quiet navigation row for the MORE section: label + chevron, no
 * button chrome. `last` drops the bottom divider.
 */
function MoreRow({
  label,
  onPress,
  last = false,
}: {
  label: string;
  onPress: () => void;
  last?: boolean;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.moreRow,
        {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: last ? 0 : 1,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={{ color: theme.colors.text, fontSize: t.size.body, flex: 1 }}>{label}</Text>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
    </Pressable>
  );
}

function trimNum(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** "3×8–12 @ 60 kg", "3×8 @ 60 kg", "3 sets @ 60 kg", "3 sets" — never "3×–". */
function formatTarget(
  sets: number,
  repMin: number | null,
  repMax: number | null,
  weightKg: number | null,
): string {
  let reps = '';
  if (repMin != null && repMax != null && repMin !== repMax) {
    reps = `×${repMin}–${repMax}`;
  } else if (repMin != null) {
    reps = `×${repMin}`;
  } else if (repMax != null) {
    reps = `×${repMax}`;
  }
  const weight = weightKg != null ? ` @ ${trimNum(weightKg)} kg` : '';
  return `${sets} set${sets === 1 ? '' : 's'}${reps}${weight}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    gap: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  recentText: {
    flex: 1,
    gap: 2,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCell: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
});
