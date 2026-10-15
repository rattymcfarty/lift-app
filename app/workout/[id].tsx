/**
 * Active workout screen — the P1 exit criterion lives here: a user must be
 * able to log a full workout.
 *
 * - Current exercises with set rows (reps / weight / RPE), the accent LOG
 *   action, rest countdown entry, remove-exercise.
 * - "Last time" previous performance per exercise (fetched once per
 *   exercise and cached — never refetched on every logged set).
 * - Add exercises, finish (→ summary), discard (confirm → soft-delete).
 *
 * Data flow: every mutation goes through repositories, then the detail is
 * re-fetched. The DB is the single source of truth; no local set cache.
 * Refocusing the screen (e.g. back from add-exercise) refreshes silently —
 * the list is never unmounted, so rest timers and half-typed input survive.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  finishWorkout,
  getPreviousPerformance,
  getWorkoutDetail,
  softDeleteWorkout,
  type PreviousPerformance,
  type WorkoutDetail,
  type WorkoutExerciseDetail,
} from '../../src/data/repositories';
import { useTheme } from '../../src/theme';
import { formatDuration } from '../../src/components/workout/format';
import { Button, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';
import { TaxonomyIcon } from '../../src/components/icons';
import { ToolIcon } from '../../src/components/icons/ToolIcons';
import { RestTimer } from '../../src/components/workout/RestTimer';
import { advanceEnrollmentForWorkout } from '../../src/programs/sessions';
import { invalidateConsistencyCache } from '../../src/stats/queries';
import { aggregateMuscles } from '../../src/lib/aggregateMuscles';
import { getSupersetGroups } from '../../src/data/repositories';
import { PlateCalculator } from '../../src/components/workout/PlateCalculator';
import { AppState, useWindowDimensions } from 'react-native';
import { recordHeartbeat, reconcileWorkouts } from '../../src/workouts/lifecycle';
import { FONT_WEIGHT } from '../../src/theme/tokens';

/**
 * Elapsed-time readout with its own ticking state, so the once-per-second
 * update doesn't re-render the whole exercise list (input lag on low-end
 * Android). Lives in the header, next to the workout name.
 */
function ElapsedTime({ startedAt }: { startedAt: Date }): JSX.Element {
  const { theme } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.caption }}>
      Elapsed {formatDuration(now - startedAt.getTime())}
    </Text>
  );
}

export default function ActiveWorkoutScreen(): JSX.Element {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  // undefined = not fetched yet (row shows "looking up"); null = none found.
  const [previousMap, setPreviousMap] = useState<Record<string, PreviousPerformance | null>>({});
  const previousMapRef = useRef(previousMap);
  previousMapRef.current = previousMap;
  // Tracks whether ANY detail has ever loaded, so a transient refresh
  // failure keeps the stale screen instead of wiping timers and input.
  const hasDetailRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [plateModalVisible, setPlateModalVisible] = useState(false);
  const [muscleSheetVisible, setMuscleSheetVisible] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [restSecondsForTimer, setRestSecondsForTimer] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const compactMode = width < 360;

  /** Fetch "last time" only for exercises we haven't looked up yet. */
  const loadPreviousFor = useCallback(async (items: WorkoutExerciseDetail[], wid: string) => {
    const missing = items.filter((i) => !(i.exercise.id in previousMapRef.current));
    if (missing.length === 0) return;
    const entries = await Promise.all(
      missing.map(async (item) => {
        try {
          const prev = await getPreviousPerformance(item.exercise.id, wid);
          return [item.exercise.id, prev] as const;
        } catch {
          return [item.exercise.id, null] as const;
        }
      }),
    );
    setPreviousMap((prevMap) => ({ ...prevMap, ...Object.fromEntries(entries) }));
  }, []);

  const load = useCallback(async () => {
    if (!workoutId) {
      setLoadError('Missing workout id.');
      setLoading(false);
      return;
    }
    try {
      const d = await getWorkoutDetail(workoutId);
      if (!d) {
        // Genuinely gone (deleted elsewhere) — even stale detail would lie.
        hasDetailRef.current = false;
        setDetail(null);
        setLoadError('Workout not found. It may have been deleted.');
        setLoading(false);
        return;
      }
      hasDetailRef.current = true;
      setDetail(d);
      setLoadError(null);
      void loadPreviousFor(d.items, workoutId);
      // Any change counts as activity: refresh the "still training?" nudges.
      if (d.workout.endedAt == null) {
        void recordHeartbeat(workoutId).then(() => reconcileWorkouts()).catch(() => undefined);
      }
    } catch (e) {
      // Transient failure on a silent refresh: keep the stale screen
      // (timers keep running, typed input survives) instead of wiping it.
      if (!hasDetailRef.current) {
        setLoadError(e instanceof Error ? e.message : 'Could not load the workout.');
      }
    } finally {
      setLoading(false);
    }
  }, [workoutId, loadPreviousFor]);

  // Silent refresh on refocus: the list stays mounted (timers keep running,
  // typed input is preserved) and swaps to fresh data when it arrives.
  // `loading` is only ever true for the very first mount.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Heartbeat: while this screen is open and the app is foregrounded the
  // workout counts as active, so resting between sets never triggers a
  // "still training?" check-in.
  useEffect(() => {
    if (!workoutId) return undefined;
    const beat = (): void => {
      if (AppState.currentState === 'active') void recordHeartbeat(workoutId);
    };
    beat();
    const timer = setInterval(beat, 60_000);
    return () => {
      clearInterval(timer);
      void recordHeartbeat(workoutId);
    };
  }, [workoutId]);

  // A finished workout doesn't belong here — hand off to the summary.
  useEffect(() => {
    if (detail?.workout.endedAt != null && workoutId) {
      router.replace(`/workout/${workoutId}/summary`);
    }
  }, [detail, workoutId]);

  // Integration seam for workstream #4 (rest-timer): fired after every
  // logged set with the rest seconds used. The countdown itself now lives
  // in <RestTimer/> (useRestTimer); this observes for future global UX.
  //
  // Superset logic: when the LAST exercise of a superset logs a set, start
  // the rest timer once (using the max of member rest defaults). Logging a
  // set on a non-last member does NOT start rest.
  const handleSetComplete = useCallback((restSeconds: number, _workoutExerciseId: string, _isLastInSuperset: boolean) => {
    // #4: hook cross-exercise rest UX here if needed.
  }, []);

  const handleFinish = (): void => {
    if (!workoutId || finishing) return;
    const setCount = detail?.items.reduce((n, i) => n + i.sets.length, 0) ?? 0;
    Alert.alert(
      'Finish workout?',
      setCount === 0
        ? 'No sets logged yet. Finish anyway?'
        : `Finish with ${setCount} set${setCount === 1 ? '' : 's'} logged?`,
      [
        { text: 'Keep lifting', style: 'cancel' },
        {
          text: 'Finish',
          onPress: () => {
            setFinishing(true);
            void (async () => {
              try {
                const w = await finishWorkout(workoutId);
                if (!w) throw new Error('Workout no longer exists.');
                // P4a: if this workout was started from a program session,
                // advance the enrollment (idempotent; no-op otherwise).
                // Invalidate the dashboard's refresh throttle so the new
                // consistency score shows immediately.
                try {
                  await advanceEnrollmentForWorkout(workoutId);
                } catch (e) {
                  console.warn('[workout] program advancement failed', e);
                } finally {
                  invalidateConsistencyCache();
                }
                router.replace(`/workout/${workoutId}/summary`);
              } catch (e) {
                Alert.alert(
                  'Could not finish',
                  e instanceof Error ? e.message : 'Please try again.',
                );
                setFinishing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleDiscard = (): void => {
    if (!workoutId) return;
    Alert.alert(
      'Discard workout?',
      'This deletes the workout and all logged sets. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await softDeleteWorkout(workoutId);
                invalidateConsistencyCache();
                router.replace('/');
              } catch (e) {
                // Stay on the screen: nothing was deleted, so leaving
                // would strand the user away from their live workout.
                Alert.alert(
                  'Could not discard',
                  e instanceof Error ? e.message : 'Please try again.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  const renderExercise = ({ item }: { item: WorkoutExerciseDetail }): JSX.Element => (
    <ExerciseCard
      detail={item}
      previous={item.exercise.id in previousMap ? previousMap[item.exercise.id] : undefined}
      onChanged={() => void load()}
      onSetComplete={handleSetComplete}
      workoutItems={detail?.items ?? []}
      workoutId={workoutId ?? ''}
    />
  );

  // Build superset groups for visual grouping in the list.
  // Exercises sharing a supersetId are wrapped in a labeled container.
  const supersetGroups = detail
    ? getSupersetGroupsForRender(detail.items)
    : [];

  const renderGroup = ({ item }: { item: { label: string; items: WorkoutExerciseDetail[] } }): JSX.Element => (
    <View style={item.label ? [styles.supersetContainer, { borderColor: theme.colors.accent }] : undefined}>
      {item.label ? (
        <Text style={[styles.supersetLabel, { color: theme.colors.accent, fontSize: theme.typography.size.caption }]} testID={`superset-group-${item.label.replace(/\s/g, '').toLowerCase()}`}>
          {item.label}
        </Text>
      ) : null}
      <View style={{ gap: theme.spacing.md }}>
        {item.items.map((exerciseItem) => (
          <ExerciseCard
            key={exerciseItem.workoutExercise.id}
            detail={exerciseItem}
            previous={exerciseItem.exercise.id in previousMap ? previousMap[exerciseItem.exercise.id] : undefined}
            onChanged={() => void load()}
            onSetComplete={handleSetComplete}
            workoutItems={detail?.items ?? []}
            workoutId={workoutId ?? ''}
          />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader
        title={detail?.workout.name ?? 'Workout'}
        onBack={() => router.replace('/')}
        compact
      />

      {/* Compact action bar */}
      {!loadError && detail && (
        <TopActionBar
          detail={detail}
          compactMode={compactMode}
          onTimer={() => setTimerModalVisible(true)}
          onPlate={() => setPlateModalVisible(true)}
          onMuscle={() => setMuscleSheetVisible(true)}
          onFinish={handleFinish}
          finishing={finishing}
        />
      )}

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
        <FlatList
          data={supersetGroups}
          keyExtractor={(group) => group.items[0].workoutExercise.id}
          // Taps on Log/Add exercise/Finish must reach the buttons while the
          // numeric keyboard is up (first tap would otherwise only dismiss it).
          keyboardShouldPersistTaps="handled"
          renderItem={renderGroup}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.md,
          }}
          ListEmptyComponent={
            <EmptyState
              message="No exercises yet."
              hint="Add your first exercise to start logging sets."
            />
          }
          ListFooterComponent={
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <Button
                title="+ Add exercise"
                testID="workout-add-exercise"
                variant="secondary"
                onPress={() => router.push(`/workout/${workoutId}/add-exercise`)}
              />
              <Button
                title={finishing ? 'Finishing…' : 'Finish workout'}
                testID="workout-finish"
                variant="gold"
                size="large"
                onPress={handleFinish}
                busy={finishing}
              />
              <Button title="Discard workout" variant="danger" onPress={handleDiscard} />
            </View>
          }
        />
      )}

      {/* Plate calculator modal */}
      <PlateCalculator
        visible={plateModalVisible}
        onClose={() => setPlateModalVisible(false)}
        onSelectWeight={(kg) => {
          // Write back to pending set row — handled by ExerciseCard via onPlateSelect prop
        }}
      />

      {/* Muscle group bottom sheet */}
      <MuscleSheet
        visible={muscleSheetVisible}
        items={detail?.items ?? []}
        onClose={() => setMuscleSheetVisible(false)}
      />

      {/* Rest timer modal (standalone) */}
      <RestTimerModal
        visible={timerModalVisible}
        onClose={() => setTimerModalVisible(false)}
        onDone={() => setTimerModalVisible(false)}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Compact action bar below header                                      */
/* ------------------------------------------------------------------ */

interface ActionBarProps {
  detail: WorkoutDetail;
  compactMode: boolean;
  onTimer: () => void;
  onPlate: () => void;
  onMuscle: () => void;
  onFinish: () => void;
  finishing: boolean;
}

function TopActionBar({ detail, compactMode, onTimer, onPlate, onMuscle, onFinish, finishing }: ActionBarProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const startedAt = new Date(detail.workout.startedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsedMs = Math.max(0, now - startedAt.getTime());
  const hours = Math.floor(elapsedMs / 3600000);
  const minutes = Math.floor((elapsedMs % 3600000) / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const { width: winW } = useWindowDimensions();
  const toolScale = Math.min(1.1, Math.max(0.84, winW / 390));
  const toolIcon = Math.round(22 * toolScale);
  const chipStyle = {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const chipText = { color: theme.colors.muted, fontSize: t.size.meta, fontWeight: t.weight.medium };
  const timerChip = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', flex: 1, minWidth: 0, justifyContent: 'space-around', alignItems: 'flex-end' }}>
          {(
            [
              { id: 'topbar-timer', label: 'Timer', a11y: 'Rest timer', onPress: onTimer, icon: <ToolIcon name="timer" color={theme.colors.text} size={toolIcon} /> },
              { id: 'topbar-plate', label: 'Plates', a11y: 'Plate calculator', onPress: onPlate, icon: <ToolIcon name="plates" color={theme.colors.text} size={toolIcon} /> },
              { id: 'topbar-muscle', label: 'Muscles', a11y: 'Muscle view', onPress: onMuscle, icon: <TaxonomyIcon kind="muscle" id="Full-Body" size={toolIcon + 2} tiled={false} /> },
            ] as const
          ).map((b) => (
            <Pressable
              key={b.id}
              testID={b.id}
              onPress={b.onPress}
              accessibilityRole="button"
              accessibilityLabel={b.a11y}
              hitSlop={6}
              style={{ alignItems: 'center', gap: 2, minWidth: 0, flexShrink: 1, paddingHorizontal: 2 }}
            >
              {b.icon}
              <Text
                style={{ color: theme.colors.muted, fontSize: Math.round(t.size.caption * toolScale * 2) / 2, fontWeight: t.weight.medium }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={1.1}
              >
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.muted, fontSize: t.size.meta, fontWeight: t.weight.medium, fontVariant: ['tabular-nums'] }} maxFontSizeMultiplier={1.1}>
            {timerChip}
          </Text>
          <Pressable
            testID="workout-finish-bar"
            accessibilityRole="button"
            onPress={onFinish}
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: theme.colors.accentText, fontSize: t.size.meta + 1, fontWeight: t.weight.bold }} maxFontSizeMultiplier={1.1}>
              {finishing ? 'Finish…' : 'Finish'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Superset group helper (pure JS, no React)                            */
/* ------------------------------------------------------------------ */

/**
 * Groups workout items by supersetId, preserving position order.
 * Returns an array of groups, each with a label (SUPERSET A/B/C…) and
 * the member items in position order. Non-superset items are returned
 * as singleton groups with label ''.
 */
export function getSupersetGroupsForRender(
  items: WorkoutExerciseDetail[],
): Array<{ label: string; items: WorkoutExerciseDetail[] }> {
  const groups: Array<{ label: string; items: WorkoutExerciseDetail[] }> = [];
  const supersetLabels = new Map<string, string>();
  let letter = 0;

  for (const item of items) {
    const sid = item.workoutExercise.supersetId;
    if (sid == null) {
      groups.push({ label: '', items: [item] });
      continue;
    }
    let group = groups.find(
      (g) => g.items[0].workoutExercise.supersetId === sid,
    );
    if (!group) {
      const label = `SUPERSET ${String.fromCharCode(65 + letter)}`;
      letter++;
      supersetLabels.set(sid, label);
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    padding: 16,
    maxHeight: '70%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scroll: {
    maxHeight: 500,
  },
  supersetContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  supersetLabel: {
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

/* ------------------------------------------------------------------ */
/* Muscle group bottom sheet                                            */
/* ------------------------------------------------------------------ */

interface MuscleSheetProps {
  visible: boolean;
  items: WorkoutExerciseDetail[];
  onClose: () => void;
}

function MuscleSheet({ visible, items, onClose }: MuscleSheetProps): JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const aggregated = aggregateMuscles(items);

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { paddingTop: insets.top }]} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.headerRow}>
            <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.card, fontWeight: theme.typography.weight.bold }}>Muscle Groups</Text>
            <Pressable testID="muscle-sheet-close" onPress={onClose} hitSlop={12}>
              <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.card }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll}>
            {aggregated.length === 0 ? (
              <Text style={{ color: theme.colors.faint, fontSize: theme.typography.size.body, textAlign: 'center', paddingVertical: 20 }}>
                No working sets logged yet.
              </Text>
            ) : (
              aggregated.map((m) => (
                <View
                  key={m.muscle}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.row, fontWeight: theme.typography.weight.medium }}>
                    {m.muscle}
                  </Text>
                  <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.body }}>
                    {m.sets} set{m.sets === 1 ? '' : 's'}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Rest timer modal (standalone)                                        */
/* ------------------------------------------------------------------ */

interface RestTimerModalProps {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}

function RestTimerModal({ visible, onClose, onDone }: RestTimerModalProps): JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [seconds, setSeconds] = useState<number | null>(null);

  if (!visible) return <></>;

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { paddingTop: insets.top }]} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.headerRow}>
            <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.card, fontWeight: theme.typography.weight.bold }}>Rest Timer</Text>
            <Pressable testID="rest-timer-close" onPress={onClose} hitSlop={12}>
              <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.card }}>✕</Text>
            </Pressable>
          </View>
          <View style={{ gap: 12, paddingVertical: 16 }}>
            <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.body, textAlign: 'center' }}>
              Choose a preset duration
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[30, 60, 90, 120, 180, 300].map((sec) => (
                <Pressable
                  key={sec}
                  testID={`rest-preset-${sec}`}
                  onPress={() => {
                    setSeconds(sec);
                  }}
                  style={{
                    backgroundColor: theme.colors.surfaceMuted,
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.body, fontWeight: theme.typography.weight.medium }}>
                    {sec}s
                  </Text>
                </Pressable>
              ))}
            </View>
            {seconds != null && (
              <RestTimer
                key={`rest-${seconds}`}
                seconds={seconds}
                onDone={() => {
                  setSeconds(null);
                  onDone();
                }}
              />
            )}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
