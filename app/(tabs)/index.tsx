/**
 * Train tab — "Train | History".
 *
 * Train: resume banner, the next program session (or a nudge), and Quick
 * Actions (empty workout, library, create program, bodyweight, calculators).
 * History: the finished-workout archive. Settings lives on the gear.
 *
 * Stats, records and charts live on the Analytics tab; this screen is only
 * about starting a workout fast.
 */

import { useCallback, useRef, useState, type JSX } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getActiveWorkout, listMeasurements, type WorkoutDetail } from '../../src/data/repositories';
import { getCurrentSessionTargets, type CurrentSessionTargets } from '../../src/programs/engine';
import { catchUpProgramAdvancement } from '../../src/programs/sessions';
import { listEnrollments } from '../../src/programs/enrollments';
import { getSettings, type WeightUnit } from '../../src/data/settings';
import { kgToLb } from '../../src/lib/units';
import { useTheme } from '../../src/theme';
import { trimNumber } from '../../src/components/workout/format';
import { Button, Card } from '../../src/components/workout/ui';
import { Sparkline } from '../../src/components/dashboard/Sparkline';
import { SegmentedTitle } from '../../src/components/nav/SegmentedTitle';
import { HistoryList } from '../../src/components/history/HistoryList';
import { WeekProgress } from '../../src/components/train/WeekProgress';
import { ReadinessCard } from '../../src/components/train/ReadinessCard';
import { getProfile, type Profile } from '../../src/data/profile';
import { listRoutinesWithStats, type RoutineListItem } from '../../src/data/routines';
import { fetchWorkoutStarts } from '../../src/stats/queries';
import { GENERATED_PREFIX } from '../../src/data/generatedPlan';
import {
  dismissNotice,
  finishAtLastActivity,
  getNotices,
  reconcileWorkouts,
  type AutoClosedNotice,
  type OpenWorkoutStatus,
} from '../../src/workouts/lifecycle';
import { softDeleteWorkout } from '../../src/data/repositories';

type Segment = 'train' | 'history';

/** "3×8–12 @ 60 kg", "3×8 @ 60 kg", "3 sets @ 60 kg", "3 sets" — never "3×–". */
function formatTarget(
  sets: number,
  repMin: number | null,
  repMax: number | null,
  weightKg: number | null,
): string {
  let reps = '';
  if (repMin != null && repMax != null && repMin !== repMax) reps = `×${repMin}–${repMax}`;
  else if (repMin != null) reps = `×${repMin}`;
  else if (repMax != null) reps = `×${repMax}`;
  const weight = weightKg != null ? ` @ ${trimNumber(weightKg)} kg` : '';
  return `${sets} set${sets === 1 ? '' : 's'}${reps}${weight}`;
}

function ActionTile({
  label,
  glyph,
  onPress,
  testID,
  children,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  testID?: string;
  children?: JSX.Element | null;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 56,
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>{glyph}</Text>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium, flexShrink: 1 }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
      </View>
      {children}
    </Pressable>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function TrainScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const [segment, setSegment] = useState<Segment>('train');
  const [active, setActive] = useState<WorkoutDetail | null>(null);
  const [today, setToday] = useState<CurrentSessionTargets | null>(null);
  const [todayProgram, setTodayProgram] = useState<string | null>(null);
  const [weights, setWeights] = useState<number[]>([]);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trained, setTrained] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [suggested, setSuggested] = useState<RoutineListItem | null>(null);
  const [status, setStatus] = useState<OpenWorkoutStatus | null>(null);
  const [notices, setNotices] = useState<AutoClosedNotice[]>([]);
  const [loading, setLoading] = useState(true);
  // Stale-response guard: every focus starts a new load; only the latest may write state.
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const alive = () => loadIdRef.current === loadId;
    // Close anything abandoned BEFORE reading the active workout, so a
    // forgotten session never shows up as "Resume workout".
    try {
      const r = await reconcileWorkouts();
      if (alive()) setStatus(r.current);
      const n = await getNotices();
      if (alive()) setNotices(n);
    } catch (e) {
      console.warn('[train] reconcile failed', e);
    }
    try {
      const a = await getActiveWorkout();
      if (alive()) setActive(a);
    } catch {
      if (alive()) setActive(null);
    } finally {
      if (alive()) setLoading(false);
    }

    // Program pointer: catch up finished sessions FIRST, then read targets.
    try {
      const list = await listEnrollments('active');
      if (!alive()) return;
      if (list.length > 0) {
        const enrollmentId = list[0].enrollment.id;
        await catchUpProgramAdvancement(enrollmentId).catch((e: unknown) => console.warn('[train] catch-up failed', e));
        const targets = await getCurrentSessionTargets(enrollmentId).catch(() => null);
        if (alive()) {
          setToday(targets);
          setTodayProgram(targets ? list[0].program.name : null);
        }
      } else if (alive()) {
        setToday(null);
        setTodayProgram(null);
      }
    } catch (e) {
      console.warn('[train] enrollment load failed', e);
    }

    try {
      const [prof, starts, plans] = await Promise.all([getProfile(), fetchWorkoutStarts(), listRoutinesWithStats()]);
      if (!alive()) return;
      setProfile(prof);
      if (!prof.onboarded && starts.length === 0) {
        // First launch: a short personal set-up before anything else.
        router.replace('/onboarding');
        return;
      }
      const now = new Date();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
      const week = [false, false, false, false, false, false, false];
      for (const w of starts) {
        const d = new Date(w.startedAt);
        const diff = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - monday.getTime()) / 86400000);
        if (diff >= 0 && diff < 7) week[diff] = true;
      }
      setTrained(week);
      // Rotation: the least-recently-used generated plan; else any plan.
      const mine = plans.filter((p) => p.routine.name.startsWith(GENERATED_PREFIX));
      const pool = mine.length > 0 ? mine : plans;
      const ordered = [...pool].sort(
        (a, b) => (a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0) - (b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0),
      );
      setSuggested(ordered[0] ?? null);
    } catch (e) {
      console.warn('[train] week/suggestion load failed', e);
    }

    try {
      const [rows, settings] = await Promise.all([listMeasurements('body_weight', 12), getSettings()]);
      if (!alive()) return;
      setUnit(settings.weightUnit);
      setWeights(rows.map((r) => r.value).reverse());
    } catch {
      if (alive()) setWeights([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const latest = weights.length > 0 ? weights[weights.length - 1] : null;
  const shown = (kg: number): string => trimNumber(unit === 'lb' ? Math.round(kgToLb(kg) * 10) / 10 : kg);
  const tileWidth = Math.max(120, (width - theme.spacing.md * 2 - theme.spacing.sm) / 2 - theme.spacing.md * 2);

  const gear = (
    <Pressable
      testID="home-settings"
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={8}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: c.muted, fontSize: t.size.section }}>⚙</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <SegmentedTitle
        segments={[
          { key: 'train', label: 'Train', testID: 'train-segment-train' },
          { key: 'history', label: 'History', testID: 'train-segment-history' },
        ]}
        active={segment}
        onChange={setSegment}
        right={gear}
      />
      {segment === 'history' ? (
        <HistoryList />
      ) : loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.muted} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          {profile?.name ? (
            <Text style={{ color: c.muted, fontSize: t.size.body }}>
              {greeting()}, {profile.name}.
            </Text>
          ) : null}
          <Card>
            <WeekProgress
              trained={trained}
              todayIndex={(new Date().getDay() + 6) % 7}
              goal={profile?.daysPerWeek ?? 3}
            />
          </Card>
          {active ? null : <ReadinessCard />}
          {notices.map((n) => (
            <Card key={n.workoutId}>
              <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>FINISHED AUTOMATICALLY</Text>
              <Text style={{ color: c.text, fontSize: t.size.row, fontWeight: t.weight.bold }} numberOfLines={2}>
                {n.name}
              </Text>
              <Text style={{ color: c.faint, fontSize: t.size.caption }}>
                It went quiet, so LIFT closed it at your last activity
                ({new Date(n.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}) with {n.setCount} set
                {n.setCount === 1 ? '' : 's'}. Nothing was lost.
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button title="View summary" variant="secondary" onPress={() => router.push(`/workout/${n.workoutId}/summary`)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Dismiss"
                    variant="secondary"
                    testID={`notice-dismiss-${n.workoutId}`}
                    onPress={() => {
                      void dismissNotice(n.workoutId).then(() => setNotices((prev) => prev.filter((x) => x.workoutId !== n.workoutId)));
                    }}
                  />
                </View>
              </View>
            </Card>
          ))}
          {active ? (
            <Card style={status?.state === 'idle' ? { borderColor: c.warning, borderWidth: 2 } : undefined}>
              <Text style={{ color: status?.state === 'idle' ? c.warning : c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
                {status?.state === 'idle' ? 'WORKOUT PAUSED — STILL TRAINING?' : 'WORKOUT IN PROGRESS'}
              </Text>
              <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }} numberOfLines={2}>
                {active.workout.name}
              </Text>
              <Text style={{ color: c.faint, fontSize: t.size.caption }}>
                {active.items.length} exercise{active.items.length === 1 ? '' : 's'} ·{' '}
                {active.items.reduce((n, i) => n + i.sets.length, 0)} sets logged
                {status ? ` · last activity ${status.idleMs < 60_000 ? 'just now' : `${status.idleText} ago`}` : ''}
              </Text>
              <Button
                title="Resume workout"
                size="large"
                testID="home-resume-workout"
                onPress={() => router.push(`/workout/${active.workout.id}`)}
              />
              {status?.state === 'idle' ? (
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Finish now"
                      variant="secondary"
                      testID="home-finish-idle"
                      onPress={() => {
                        void finishAtLastActivity(status)
                          .then(() => router.push(`/workout/${status.id}/summary`))
                          .catch(() => undefined);
                      }}
                    />
                  </View>
                  {status.setCount === 0 ? (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Discard"
                        variant="danger"
                        onPress={() => {
                          void softDeleteWorkout(status.id).then(() => load());
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>UP NEXT</Text>
            {today ? (
              <View style={{ gap: theme.spacing.xs }}>
                <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }} numberOfLines={2}>
                  {today.routineName}
                </Text>
                <Text style={{ color: c.faint, fontSize: t.size.caption }}>
                  {todayProgram} · Week {today.week}, Day {today.day}
                </Text>
                {today.isDeloadWeek ? (
                  <Text style={{ color: c.success, fontSize: t.size.body, fontWeight: t.weight.medium }}>
                    Deload week — targets reduced
                    {today.volumeFactor != null ? ` to ${Math.round(today.volumeFactor * 100)}%` : ''}. Train light.
                  </Text>
                ) : null}
                {today.exercises.slice(0, 3).map((ex) => (
                  <Text key={`${ex.position}-${ex.exerciseId}`} style={{ color: c.muted, fontSize: t.size.caption }} numberOfLines={1}>
                    {ex.exerciseName}: {formatTarget(ex.sets, ex.repMin, ex.repMax, ex.weightKg)}
                  </Text>
                ))}
                {today.exercises.length > 3 ? (
                  <Text style={{ color: c.faint, fontSize: t.size.caption }}>+{today.exercises.length - 3} more</Text>
                ) : null}
                {active ? null : (
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
                )}
              </View>
            ) : (
              suggested ? (
                <View style={{ gap: theme.spacing.xs }}>
                  <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }} numberOfLines={2}>
                    {suggested.routine.name.replace(GENERATED_PREFIX, '')}
                  </Text>
                  <Text style={{ color: c.faint, fontSize: t.size.caption }}>
                    {suggested.exerciseCount} exercises
                    {suggested.routine.estimatedMinutes ? ` · ~${suggested.routine.estimatedMinutes} min` : ''}
                    {suggested.lastUsedAt ? '' : ' · not done yet'}
                  </Text>
                  {active ? null : (
                    <Button
                      title="Start this workout"
                      size="large"
                      testID="home-start-suggested"
                      onPress={() => router.push({ pathname: '/workout/new', params: { planId: suggested.routine.id } })}
                    />
                  )}
                </View>
              ) : (
                <View style={{ gap: theme.spacing.xs }}>
                  <Text style={{ color: c.text, fontSize: t.size.body }}>No workout planned yet.</Text>
                  <Text style={{ color: c.faint, fontSize: t.size.caption }}>
                    Let LIFT build a plan for you, or train freely — every set stays on this device.
                  </Text>
                  <Button title="Build my plan" variant="secondary" testID="home-build-plan" onPress={() => router.push('/onboarding?edit=1')} />
                </View>
              )
            )}
          </Card>

          <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium, letterSpacing: 1 }}>
            QUICK ACTIONS
          </Text>
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              title="▶  Empty workout"
              variant="secondary"
              size="large"
              testID="home-start-workout"
              onPress={() => router.push('/workout/new')}
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <ActionTile label="Your library" glyph="▤" onPress={() => router.push('/programs')} />
              <ActionTile label="Create program" glyph="✎" onPress={() => router.push('/plans/new')} />
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <ActionTile label="Bodyweight" glyph="⚖" testID="home-bodyweight" onPress={() => router.push('/measure')}>
                {latest != null ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <Sparkline values={weights} width={tileWidth} height={40} />
                    <Text style={{ color: c.text, fontSize: t.size.section, fontWeight: t.weight.bold }}>
                      {shown(latest)} <Text style={{ color: c.muted, fontSize: t.size.meta }}>{unit}</Text>
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: c.faint, fontSize: t.size.caption }}>Log your weight</Text>
                )}
              </ActionTile>
              <ActionTile label="Calculators" glyph="∑" onPress={() => router.push('/calculators')}>
                <Text style={{ color: c.faint, fontSize: t.size.caption }}>1RM, plates, and more</Text>
              </ActionTile>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
