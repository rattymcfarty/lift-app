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
 *
 * Style (reference): the exercise name is large bold purple; the card gets
 * the blue active border while it has pending (in-progress) set rows;
 * the table header is muted small-caps — Set / Target / weight / Reps —
 * where Target is the previous performance to beat; the footer is
 * reference-style text actions ("⊕ Add Set", "Swap").
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import {
  logSet,
  removeWorkoutExercise,
  softDeleteSet,
  getProgressionSuggestion,
  isProgressionAvailable,
  resolveAutoProgression,
  type PreviousPerformance,
  type WorkoutExerciseDetail,
} from '../../data/repositories';
import { decodeStringArray } from '../../db/schema';
import { displayName } from '../../kb/taxonomy';
import { useTheme } from '../../theme';
import { getSettings } from '../../data/settings';
import { formatWeight, kgToLb } from '../../lib/units';
import { formatPreviousPerformance } from './format';
import { RestTimer } from './RestTimer';
import { SetRow, type SetInputValues, type SetRowMode } from './SetRow';
import { Card } from './ui';
import { ExerciseActionsSheet } from './ExerciseActionsSheet';
import { FONT_WEIGHT } from '../../theme/tokens';
import { GRID_FLEX, GRID_MAX_FONT_SCALE, gridMetrics } from './setGrid';
import { SwipeableRow } from '../ui/SwipeableRow';

interface PendingSetState {
  /**
   * Stable local identity for this pending row. Set numbers alone can't
   * key rows: two rapid "+ Add Set" taps reserve numbers before React
   * re-renders, so rows are matched by key, never by setNumber.
   */
  key: string;
  /** The set number this pending row represents. */
  setNumber: number;
  /** Prefilled values (strings for inputs). */
  initial: { reps: string; weightKg: string; rpe: string };
  /** Whether this pending row is a warmup set. */
  isWarmup: boolean;
  /** Local validation error for this row. */
  error: string | null;
  /** Whether a log operation is in flight. */
  busy: boolean;
  /** Bumped to remount the row when its prefill is replaced. */
  rev?: number;
}

interface ExerciseCardProps {
  detail: WorkoutExerciseDetail;
  /**
   * "Last time" for this exercise. undefined = still loading (row shows a
   * placeholder); null = looked up, none found.
   */
  previous: PreviousPerformance | null | undefined;
  onChanged: () => void;
  onSetComplete: (restSeconds: number, workoutExerciseId: string, isLastInSuperset: boolean) => void;
  workoutItems?: WorkoutExerciseDetail[];
  workoutId?: string;
}

export function ExerciseCard({
  detail,
  previous,
  onChanged,
  onSetComplete,
  workoutItems = [],
  workoutId = '',
}: ExerciseCardProps): JSX.Element {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const gm = gridMetrics(windowWidth);
  const t = theme.typography;
  const [restKey, setRestKey] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  /**
   * Flexible pending rows: "+ Add Set" appends a new editable row
   * immediately — it never waits for another row to be logged, and no
   * field is required to add the next row. Each row is independently
   * editable and loggable; logging still requires reps or weight
   * (SetRow validates that at log time, not at add time).
   */
  const [pendings, setPendings] = useState<PendingSetState[]>([]);
  // Synchronous mirror of pendings: handleAddSet reserves a set number
  // BEFORE its async progression fetch, so two rapid taps can't collide.
  const pendingsRef = useRef<PendingSetState[]>([]);
  // Highest set number reserved by a pending row. Monotonic within the
  // component lifetime: it is NEVER pulled down on cancel, because the
  // `sets` prop can lag the DB (a just-logged set may not be in props
  // yet) and pulling down could re-issue a number that already exists
  // in the DB. A cancelled max row leaves a cosmetic gap in numbering;
  // a collision would be a real log failure. Gaps win.
  const reservedRef = useRef(0);
  // Set when a progression suggestion fetch has been seeded for the
  // current "first pending row". Reset when pendings empty out so the
  // next first row gets a fresh suggestion. Guards the race where two
  // rapid taps both see zero pendings and both fetch.
  const progressionSeededRef = useRef(false);
  // Monotonic suffix for pending row keys.
  const pendingKeyRef = useRef(0);
  const [settings, setSettings] = useState<{ weightUnit: 'kg' | 'lb'; defaultRestSeconds: number } | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { workoutExercise, exercise, sets } = detail;

  // Load settings once on mount
  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled) {
        setSettings({ weightUnit: s.weightUnit, defaultRestSeconds: s.defaultRestSeconds });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve display unit: per-exercise override > global setting
  const displayUnit = settings
    ? (workoutExercise.unitPreference ?? settings.weightUnit)
    : 'kg';

  // Reserve the next set number synchronously — MUST run before any await
  // in handleAddSet so rapid taps get distinct numbers. reservedRef is
  // always >= any pending set number (it is set on every reservation),
  // so max(loggedMax, reservedRef) covers both.
  const reserveSetNumber = (): number => {
    const loggedMax = sets.reduce((max, s) => Math.max(max, s.setNumber), 0);
    const n = Math.max(loggedMax, reservedRef.current) + 1;
    reservedRef.current = n;
    return n;
  };

  // Remove a pending row by key. The reservation is NOT pulled down
  // (see reservedRef note above). When the last pending row leaves,
  // reset the progression-seed flag so the next first row gets a fresh
  // suggestion.
  // Live (unlogged) edits per pending row, reported by SetRow.
  const liveRef = useRef<Record<string, { reps: string; weightKg: string; rpe: string }>>({});

  const removePending = (key: string): void => {
    delete liveRef.current[key];
    const next = pendingsRef.current.filter((p) => p.key !== key);
    pendingsRef.current = next;
    setPendings(next);
    if (next.length === 0) progressionSeededRef.current = false;
  };

  // Cancel a pending row: same removal as logging it away, minus the
  // DB write. (Previously this pulled the reservation down; that could
  // re-issue a set number that a just-logged set already owns, because
  // the `sets` prop lags the DB until the parent refetch lands.)
  const cancelPending = (key: string): void => {
    removePending(key);
  };

  // Build prefill for a new pending row: previous pending row's starting
  // values > last logged set > last previous set > blank. Live edits in a
  // pending row are NOT copied (they live in SetRow state) — the new row
  // starts from the previous row's prefill and the user fills it in.
  const lastLogged = sets.length > 0 ? sets[sets.length - 1] : undefined;
  const lastPrevSet =
    previous && previous.sets.length > 0
      ? previous.sets[previous.sets.length - 1]
      : undefined;
  const source = lastLogged ?? lastPrevSet;
  const prefill = (v: number | null | undefined): string => (v == null ? '' : String(v));
  // Weights are stored in kg; the input is in the user's display unit.
  const prefillWeight = (kg: number | null | undefined): string => {
    if (kg == null) return '';
    if (displayUnit === 'lb') return String(Math.round(kgToLb(kg) * 10) / 10);
    return String(kg);
  };
  const hasValue = (v: { reps: string; weightKg: string; rpe: string } | undefined): boolean =>
    !!v && (v.reps !== '' || v.weightKg !== '' || v.rpe !== '');
  const buildInitial = () => {
    // Carry over what the user is typing: the previous pending row's LIVE
    // values win, then its prefill, then the last logged set, then history.
    const lastPending = pendingsRef.current[pendingsRef.current.length - 1];
    if (lastPending) {
      const live = liveRef.current[lastPending.key];
      if (hasValue(live)) return { ...live };
      if (hasValue(lastPending.initial)) return { ...lastPending.initial };
    }
    return {
      reps: prefill(source?.reps),
      weightKg: prefillWeight(source?.weightKg),
      rpe: prefill(source?.rpe),
    };
  };

  // Get the "Target" cell text for a given set number (1-based): the
  // previous performance for that set is the target to beat.
  const getPreviousText = (setNumber: number): string => {
    if (!previous || previous.sets.length === 0) return '';
    const idx = setNumber - 1;
    if (idx >= previous.sets.length) return '';
    const ps = previous.sets[idx];
    if (ps.weightKg == null && ps.reps == null) return '';
    const weightStr = ps.weightKg != null ? formatWeight(ps.weightKg, displayUnit) : '';
    const repsStr = ps.reps != null ? String(ps.reps) : '';
    if (weightStr && repsStr) return `${weightStr}×${repsStr}`;
    if (weightStr) return weightStr;
    return `${repsStr} reps`;
  };

  // Update one pending row's busy/error flags by key.
  const patchPending = (key: string, patch: Partial<PendingSetState>): void => {
    const next = pendingsRef.current.map((p) => (p.key === key ? { ...p, ...patch } : p));
    pendingsRef.current = next;
    setPendings(next);
  };

  // Handle logging a pending set
  const handleLogPending = async (
    key: string,
    setNumber: number,
    values: SetInputValues,
    isWarmup: boolean,
  ): Promise<void> => {
    patchPending(key, { busy: true, error: null });
    try {
      // No explicit number: the data layer appends after the last live set,
      // so numbering always follows what is actually in the list.
      await logSet({
        workoutExerciseId: workoutExercise.id,
        ...values,
        completed: true,
        isWarmup,
      });
      // Determine if this is the last exercise in its superset group.
      // If so, start the rest timer once using the max of member rest defaults.
      const supersetId = workoutExercise.supersetId;
      let isLastInSuperset = true;
      let restSecondsToUse =
        workoutExercise.restSeconds ?? settings?.defaultRestSeconds ?? 90;
      if (supersetId && workoutItems.length > 0) {
        const members = workoutItems
          .filter((w) => w.workoutExercise.supersetId === supersetId)
          .sort((a, b) => a.workoutExercise.position - b.workoutExercise.position);
        if (members.length > 0) {
          isLastInSuperset =
            members[members.length - 1].workoutExercise.id === workoutExercise.id;
          if (isLastInSuperset) {
            const maxRest = members.reduce((max, m) => {
              const r = m.workoutExercise.restSeconds ?? settings?.defaultRestSeconds ?? 90;
              return Math.max(max, r);
            }, 0);
            restSecondsToUse = maxRest;
          }
        }
      }
      setRestKey((k) => k + 1);
      setRestSeconds(restSecondsToUse);
      onSetComplete(restSecondsToUse, workoutExercise.id, isLastInSuperset);
      // Rows still waiting that the user hasn't touched inherit this set's
      // numbers, so a run of sets only needs the first one typed.
      const logged = {
        reps: values.reps != null ? String(values.reps) : '',
        weightKg: values.weightKg != null ? String(values.weightKg) : '',
        rpe: '',
      };
      if (!isWarmup && hasValue(logged)) {
        const updated = pendingsRef.current.map((p) =>
          p.key !== key && !p.isWarmup && !hasValue(liveRef.current[p.key]) && !hasValue(p.initial)
            ? { ...p, initial: logged, rev: (p.rev ?? 0) + 1 }
            : p,
        );
        pendingsRef.current = updated;
        setPendings(updated);
      }
      removePending(key);
      onChanged();
    } catch (e) {
      patchPending(key, {
        busy: false,
        error: e instanceof Error ? e.message : 'Could not log the set.',
      });
    }
  };

  // Handle "Add Set" button press — append a pending input row. Adding
  // never blocks on another pending row and never requires fields: fill
  // reps/weight per row whenever, log rows in any order.
  const handleAddSet = async (
    isWarmup = false,
    seed?: { reps: string; weightKg: string; rpe: string },
  ): Promise<void> => {
    // Reserve BEFORE any await so rapid taps get distinct set numbers.
    const setNumber = reserveSetNumber();
    const key = `pending-${workoutExercise.id}-${++pendingKeyRef.current}`;
    const hadPendings = pendingsRef.current.length > 0;
    let initial = seed ?? buildInitial();
    // Progression suggestion seeds the first pending row only, once per
    // empty-to-nonempty transition. The flag is set synchronously here
    // so a second rapid tap doesn't fetch a duplicate suggestion; it
    // resets when pendings empty out (see removePending).
    const shouldSeed = !seed && !hadPendings && !progressionSeededRef.current;
    if (shouldSeed) {
      progressionSeededRef.current = true;
      const available = await isProgressionAvailable(workoutId, workoutExercise.exerciseId).catch(() => false);
      const effective = resolveAutoProgression(workoutExercise.autoProgression, available);
      if (effective.effective) {
        const suggestion = await getProgressionSuggestion(workoutExercise.id).catch(() => null);
        if (suggestion) {
          initial = {
            reps: prefill(suggestion.reps),
            weightKg: prefillWeight(suggestion.weightKg),
            rpe: '',
          };
        }
      }
    }
    const next = [
      ...pendingsRef.current,
      { key, setNumber, initial, isWarmup, error: null, busy: false },
    ];
    pendingsRef.current = next;
    setPendings(next);
  };

  // Handle delete of a logged set
  const handleDeleteSet = async (setId: string): Promise<void> => {
    try {
      await softDeleteSet(setId);
      onChanged();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete the set.');
    }
  };

  // One warmup row per tap. (The old double-call was a workaround for the
  // single-pending guard; with multiple pending rows it would create two
  // warmup rows, so it is gone.)
  const handleAddWarmup = (): void => {
    void handleAddSet(true);
  };

  const handleRemoveExercise = (): void => {
    Alert.alert(
      'Remove exercise?',
      `"${displayName(exercise)}" and its logged sets will be removed from this workout.`,
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
              Alert.alert(
                'Error',
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

  // Determine if we should show column headers (any rows exist: logged or pending)
  const hasAnyRows = sets.length > 0 || pendings.length > 0;

  // The card gets the blue active border while it has pending
  // (in-progress) set rows — the reference's "current exercise" signal.
  const isActive = pendings.length > 0;

  return (
    <SwipeableRow
      backgroundColor={theme.colors.background}
      borderRadius={theme.radius.lg}
      rightLabel="+ Add exercise"
      onSwipeRight={() => router.push(`/workout/${workoutId}/add-exercise`)}
      confirm={{
        title: 'Remove exercise?',
        message: `"${displayName(exercise)}" and its logged sets will be removed from this workout.`,
        confirmLabel: 'Remove',
      }}
      onDelete={async () => {
        try {
          await removeWorkoutExercise(workoutExercise.id);
          onChanged();
        } catch (e) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove the exercise.');
        }
      }}
    >
    <Card
      style={
        isActive
          ? { borderColor: theme.colors.highlight, borderWidth: 2 }
          : undefined
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text
            style={{
              color: theme.colors.accent,
              fontSize: t.size.card,
              fontWeight: t.weight.bold,
            }}
          >
            {displayName(exercise)}
            {workoutExercise.notes ? (
              <Text style={{ color: theme.colors.accent, fontSize: t.size.caption, marginLeft: 4 }}>📝</Text>
            ) : null}
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
        <Pressable
          testID="exercise-actions"
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${displayName(exercise)}`}
          onPress={() => setSheetVisible(true)}
          style={{ padding: theme.spacing.xs }}
        >
          <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>⋯</Text>
        </Pressable>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        {/* Column headers — the same proportions as every SetRow (setGrid.ts) */}
        {hasAnyRows && (
          <View style={[styles.headerRow, styles.columnHeaders, { borderBottomColor: theme.colors.border, alignItems: 'center' }]}>
            {(
              [
                ['Set', GRID_FLEX.set],
                ['Previous', GRID_FLEX.prev],
                [displayUnit === 'kg' ? 'Kg' : 'Lb', GRID_FLEX.weight],
                ['Reps', GRID_FLEX.reps],
                ['RPE', GRID_FLEX.rpe],
              ] as [string, number][]
            ).map(([label, flex]) => (
              <Text
                key={label}
                style={[styles.columnHeader, { flex, minWidth: 0, color: theme.colors.muted, fontSize: gm.fontHeader }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
              >
                {label}
              </Text>
            ))}
            <Text style={[styles.columnHeader, { flex: GRID_FLEX.check + GRID_FLEX.remove, color: theme.colors.muted, fontSize: gm.fontHeader }]} maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}>
              ✓
            </Text>
          </View>
        )}

        {/* Logged sets */}
        {sets.map((s) => (
          <SetRow
            key={s.id}
            setNumber={s.setNumber}
            mode="logged"
            loggedSet={s}
            displayUnit={displayUnit}
            previousText={getPreviousText(s.setNumber)}
            onDelete={() => void handleDeleteSet(s.id)}
            onAddSet={(v) => void handleAddSet(false, v)}
          />
        ))}

        {/* Pending input rows — multiple can coexist; each logs or
            cancels independently. Adding a row never requires filling
            another row first. */}
        {pendings.map((p, idx) => (
          <SetRow
            key={`${p.key}-${p.rev ?? 0}`}
            setNumber={sets.length + 1 + idx}
            mode="pending"
            initial={p.initial}
            displayUnit={displayUnit}
            previousText={getPreviousText(sets.length + 1 + idx)}
            isWarmup={p.isWarmup}
            busy={p.busy}
            error={p.error}
            onLog={(values) => void handleLogPending(p.key, p.setNumber, values, p.isWarmup)}
            onCancel={() => cancelPending(p.key)}
            onValuesChange={(v) => {
              liveRef.current[p.key] = v;
            }}
            onAddSet={(v) => void handleAddSet(false, v)}
          />
        ))}

        {/* Add / Swap — compact tonal actions; Add set is always available
            so sets can be added freely and filled in afterward. */}
        <View style={styles.footerRow}>
          <Pressable
            testID="add-set"
            onPress={() => void handleAddSet(false)}
            accessibilityRole="button"
            accessibilityLabel="Add set"
            style={({ pressed }) => [
              styles.footerButton,
              { flex: 1, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontSize: t.size.meta + 1, fontWeight: t.weight.semibold }} maxFontSizeMultiplier={1.15}>
              + Add set
            </Text>
          </Pressable>
          <Pressable
            testID="swap-exercise"
            onPress={() => router.push(`/workout/${workoutId}/swap-exercise?workoutExerciseId=${workoutExercise.id}`)}
            accessibilityRole="button"
            accessibilityLabel="Swap exercise"
            style={({ pressed }) => [
              styles.footerButton,
              { paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: theme.colors.muted, fontSize: t.size.meta + 1, fontWeight: t.weight.medium }} maxFontSizeMultiplier={1.15}>
              ⇄ Swap
            </Text>
          </Pressable>
        </View>
      </View>

      {restSeconds != null ? (
        <RestTimer
          key={`${workoutExercise.id}-rest-${restKey}`}
          seconds={restSeconds}
          onDone={() => setRestSeconds(null)}
        />
      ) : null}

      <ExerciseActionsSheet
        visible={sheetVisible}
        detail={detail}
        workoutItems={workoutItems}
        workoutId={workoutId}
        onClose={() => setSheetVisible(false)}
        onChanged={onChanged}
        onAddWarmup={handleAddWarmup}
      />
    </Card>
    </SwipeableRow>
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
  columnHeaders: {
    marginBottom: 4,
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  columnHeader: {
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'center',
  },
  footerRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  footerButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
