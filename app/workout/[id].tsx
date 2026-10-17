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
  getRoutine,
  getWorkoutDetail,
  softDeleteWorkout,
  type PreviousPerformance,
  type WorkoutDetail,
  type WorkoutExerciseDetail,
} from '../../src/data/repositories';
import { plannedSetsBySlot, plannedSetSlotKey, type PlannedSetRow } from '../../src/data/plannedSets';
import { useTheme } from '../../src/theme';
import { formatDuration } from '../../src/components/workout/format';
import { Button, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { ExerciseCard, type SupersetGroupInfo } from '../../src/components/workout/ExerciseCard';
import { TaxonomyIcon } from '../../src/components/icons';
import { ToolIcon } from '../../src/components/icons/ToolIcons';
import { RestTimer } from '../../src/components/workout/RestTimer';
import { advanceEnrollmentForWorkout } from '../../src/programs/sessions';
import { invalidateConsistencyCache } from '../../src/stats/queries';
import { aggregateMuscles } from '../../src/lib/aggregateMuscles';
import { getSupersetGroups } from '../../src/data/repositories';
import { buildSupersetRenderGroups, supersetTagText, type SupersetRenderGroup } from '../../src/lib/exerciseMenu';
import { PlateCalculator } from '../../src/components/workout/PlateCalculator';
import { AppState, useWindowDimensions } from 'react-native';
import { recordHeartbeat, reconcileWorkouts } from '../../src/workouts/lifecycle';
import {
  DISCARD_CONFIRM,
  FINISH_SHEET_CHOICES,
  FINISH_SHEET_TITLE,
  finishSheetSubtitle,
} from '../../src/workouts/exits';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
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

  // Planned set rows for the routine this workout was started from, keyed
  // by workout slot (position + exercise). A miss means "no plan targets":
  // a from-scratch workout, an exercise added ad hoc, or a template that
  // never declared sets — those cards open empty, as before.
  const [plannedSets, setPlannedSets] = useState<Map<string, PlannedSetRow[]>>(() => new Map());

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishSheetVisible, setFinishSheetVisible] = useState(false);
  const [plateModalVisible, setPlateModalVisible] = useState(false);
  const [muscleSheetVisible, setMuscleSheetVisible] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [restSecondsForTimer, setRestSecondsForTimer] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const compactMode = width < 360;

  // FlatList ref for scrolling to superset members
  const flatListRef = useRef<FlatList<{ item: WorkoutExerciseDetail; supersetGroup: SupersetGroupInfo | null }> | null>(null);

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

  // A workout started from a routine or a program day knows what was
  // planned. Fetch the template's targets once per routine; each card seeds
  // its opening input rows from them (see ExerciseCard). Nothing is written
  // to the DB here — the rows are ordinary unlogged pending sets, so
  // history and stats still only ever count what the user logs.
  const routineId = detail?.workout.routineId ?? null;
  useEffect(() => {
    if (!routineId) {
      setPlannedSets(new Map());
      return undefined;
    }
    let cancelled = false;
    void getRoutine(routineId)
      .then((routine) => {
        if (cancelled) return;
        setPlannedSets(
          routine ? plannedSetsBySlot(routine.items.map((i) => i.routineExercise)) : new Map(),
        );
      })
      .catch(() => {
        // No targets is the safe fallback: the card opens as it did before.
        if (!cancelled) setPlannedSets(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [routineId]);

  const plannedFor = useCallback(
    (item: WorkoutExerciseDetail): PlannedSetRow[] | undefined =>
      plannedSets.get(plannedSetSlotKey(item.workoutExercise.position, item.exercise.id)),
    [plannedSets],
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

  // Both Finish affordances (header bar + footer button) open the same sheet;
  // the sheet is the one decision point, replacing the old two-button Alert.
  const openFinishSheet = useCallback((): void => {
    if (!workoutId || finishing) return;
    setFinishSheetVisible(true);
  }, [workoutId, finishing]);

  const performFinish = useCallback((): void => {
    if (!workoutId || finishing) return;
    setFinishSheetVisible(false);
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
        // Finishing is the only exit that keeps the workout — the summary
        // screen is where the companion cheers.
        router.replace(`/workout/${workoutId}/summary`);
      } catch (e) {
        Alert.alert(
          'Could not finish',
          e instanceof Error ? e.message : 'Please try again.',
        );
        setFinishing(false);
      }
    })();
  }, [workoutId, finishing]);

  const handleDiscard = useCallback((): void => {
    if (!workoutId) return;
    Alert.alert(
      DISCARD_CONFIRM.title,
      DISCARD_CONFIRM.message,
      [
        { text: DISCARD_CONFIRM.cancelLabel, style: 'cancel' },
        {
          text: DISCARD_CONFIRM.confirmLabel,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await softDeleteWorkout(workoutId);
                invalidateConsistencyCache();
                // Re-derive the open set so any idle prompt/notification
                // scheduled for this workout is cancelled — a discarded
                // workout must not be resurrected or auto-finished.
                await reconcileWorkouts().catch(() => undefined);
                // Back to Train. No summary, and deliberately no companion
                // cheer: discarding leaves nothing to celebrate.
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
  }, [workoutId]);

  // Build superset groups for visual indicators on each card.
  const supersetRenderGroups = detail
    ? buildSupersetRenderGroups(detail.items)
    : [];

  // Flatten groups into individual items with supersetGroup info.
  // For singletons (no supersetId), supersetGroup is null.
  // For grouped items, pass { letter, isFirst, isLast, memberCount, supersetId }.
  const flatItems = supersetRenderGroups.flatMap((group) =>
    group.items.map((item, index) => ({
      item,
      supersetGroup:
        group.supersetId != null
          ? {
              letter: group.label.replace('SUPERSET ', ''),
              isFirst: index === 0,
              isLast: index === group.items.length - 1,
              memberCount: group.items.length,
              supersetId: group.supersetId,
            }
          : null,
    }))
  );

  /** Scroll to the exercise card with the given workoutExerciseId. */
  const scrollToMember = useCallback(
    (workoutExerciseId: string) => {
      flatListRef.current?.scrollToIndex({
        index: flatItems.findIndex((entry) => entry.item.workoutExercise.id === workoutExerciseId),
        animated: true,
        viewPosition: 0.3,
      });
    },
    [flatItems],
  );


  // Sets logged in this workout, for the finish sheet's subtitle.
  const setCount = detail?.items.reduce((n, i) => n + i.sets.length, 0) ?? 0;

  const renderExercise = ({
    item,
  }: {
    item: { item: WorkoutExerciseDetail; supersetGroup: { letter: string; isFirst: boolean; isLast: boolean; memberCount: number; supersetId: string } | null };
  }): JSX.Element => (
    <ExerciseCard
      detail={item.item}
      previous={item.item.exercise.id in previousMap ? previousMap[item.item.exercise.id] : undefined}
      onChanged={() => void load()}
      onSetComplete={handleSetComplete}
      workoutItems={detail?.items ?? []}
      workoutId={workoutId ?? ''}
      workoutName={detail?.workout.name}
      plannedSets={plannedFor(item.item)}
      supersetGroup={item.supersetGroup}
    />
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
          onFinish={openFinishSheet}
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
          data={flatItems}
          keyExtractor={(entry) => entry.item.workoutExercise.id}
          // Taps on Log/Add exercise/Finish must reach the buttons while the
          // numeric keyboard is up (first tap would otherwise only dismiss it).
          keyboardShouldPersistTaps="handled"
          renderItem={renderExercise}
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
                onPress={openFinishSheet}
                busy={finishing}
              />
              <Button title="Discard workout" variant="danger" onPress={handleDiscard} />
            </View>
          }
        />
      )}

      {/* Finish / discard sheet — opened by either Finish affordance. */}
      <BottomSheet
        visible={finishSheetVisible}
        onClose={() => setFinishSheetVisible(false)}
        title={FINISH_SHEET_TITLE}
        subtitle={finishSheetSubtitle(setCount)}
        testID="finish-sheet"
      >
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          {FINISH_SHEET_CHOICES.map((choice) => (
            <Button
              key={choice.id}
              title={choice.label}
              testID={choice.testID}
              variant={choice.variant}
              size={choice.id === 'finish' ? 'large' : 'default'}
              busy={choice.id === 'finish' && finishing}
              onPress={() => {
                if (choice.id === 'finish') {
                  performFinish();
                } else if (choice.id === 'discard') {
                  setFinishSheetVisible(false);
                  handleDiscard();
                } else {
                  setFinishSheetVisible(false);
                }
              }}
            />
          ))}
        </View>
      </BottomSheet>

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
