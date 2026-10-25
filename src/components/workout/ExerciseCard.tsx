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
import * as Haptics from 'expo-haptics';
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
import { formatWeight, kgToLb, parseWeightInput } from '../../lib/units';
import { supersetTagText, shouldStartRest, nextSupersetMember } from '../../lib/exerciseMenu';
import type { Href } from 'expo-router';
import type { PlannedSetRow } from '../../data/plannedSets';
import { formatPreviousPerformance } from './format';
import { RestTimer } from './RestTimer';
import { SetRow, type SetInputValues, type SetRowMode } from './SetRow';
import { Card } from './ui';
import { ExerciseActionsSheet } from './ExerciseActionsSheet';
import { ExerciseInfoSheet } from './ExerciseInfoSheet';
import { exerciseInfo } from './exerciseInfo';
import { ActionIcon } from '../icons';
import { FONT_WEIGHT } from '../../theme/tokens';
import { GRID_FLEX, GRID_MAX_FONT_SCALE, gridMetrics } from './setGrid';
import { SwipeableRow } from '../ui/SwipeableRow';
import { companionSetLogged } from '../../companion/triggers';

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
  /**
   * True while this row is an untouched plan seed (the plan's opening rows).
   * Cleared the moment the user edits it, which is what lights the card's
   * "current exercise" border — a planned workout must not glow on every
   * card at once.
   */
  seeded?: boolean;
}

export interface SupersetGroupInfo {
  /** The superset letter (A, B, C...). */
  letter: string;
  /** True if this is the first member of the superset group. */
  isFirst: boolean;
  /** True if this is the last member of the superset group. */
  isLast: boolean;
  /** Total number of members in the superset group. */
  memberCount: number;
  /** The superset ID for testID. */
  supersetId: string;
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
  /** Workout name, used as the reorder sheet's title. */
  workoutName?: string;
  /**
   * The plan/program targets this exercise was started from, one entry per
   * planned set. Absent for a from-scratch workout, an ad-hoc exercise or a
   * template with no declared sets — the card then opens empty.
   */
  plannedSets?: PlannedSetRow[];
  /** Superset group info for visual indicators, or null if not in a superset. */
  supersetGroup?: SupersetGroupInfo | null;
  /**
   * Opens the RPE explainer from the set table's RPE header. Absent outside the
   * workout screen, where the header then stays a plain label.
   */
  onRpeHelp?: () => void;
}

export function ExerciseCard({
  detail,
  previous,
  onChanged,
  onSetComplete,
  workoutItems = [],
  workoutId = '',
  workoutName,
  plannedSets,
  supersetGroup = null,
  onRpeHelp,
}: ExerciseCardProps): JSX.Element {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const gm = gridMetrics(windowWidth);
  const t = theme.typography;
  /**
   * Exercise-title size. ONE size for every exercise in the workout, computed
   * from the card's measured text width and the LONGEST name in the workout —
   * the same model as setGrid/filterMetrics, not per-label shrinking. A long
   * name ("Romanian Deadlift (Dumbbell)") used to clip at a fixed 18 pt on a
   * 320 pt Display-Zoom screen; now the whole workout steps down together.
   * `padding` reserves the note icon + gap so a noted exercise can't clip either.
   */
  const [restKey, setRestKey] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  /** Collapsed cards hide the set table; remembered for the session. */
  const [collapsed, setCollapsed] = useState(false);
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
  /** The mid-workout "about this exercise" sheet (opened from the title). */
  const [infoVisible, setInfoVisible] = useState(false);

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

  /** The progression engine's targets for the opening row, if the program has any. */
  const firstRowSuggestion = async (): Promise<{ reps: string; weightKg: string; rpe: string } | null> => {
    const available = await isProgressionAvailable(workoutId, workoutExercise.exerciseId).catch(() => false);
    if (!resolveAutoProgression(workoutExercise.autoProgression, available).effective) return null;
    const suggestion = await getProgressionSuggestion(workoutExercise.id).catch(() => null);
    if (!suggestion) return null;
    return {
      reps: prefill(suggestion.reps),
      weightKg: prefillWeight(suggestion.weightKg),
      rpe: '',
    };
  };

  // Materialise the plan's targets as this workout's opening rows.
  //
  // workout_exercises has no set/reps columns (sets are ordinary rows in
  // `sets`), so `startWorkoutFromRoutine` cannot carry the plan's targets
  // into the logging screen and a planned workout used to open blank —
  // only "+ Add set". The mapping lives in src/data/plannedSets.ts; here the
  // rows become ordinary *pending* rows, so nothing is written until the
  // user logs a set and history/stats still count only what was done.
  //
  // Runs at most once per card, and only while nothing is logged yet: the
  // plan's opening rows must never reappear after the user has started
  // (they may be deliberately doing fewer sets). Waits for `settings` so a
  // lb user sees lb values instead of a flash of kg.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!settings) return;
    if (sets.length > 0) return;
    if (!plannedSets || plannedSets.length === 0) return;
    seededRef.current = true;
    // Keep "+ Add set" after the plan's rows. The first row still takes the
    // progression suggestion (above) instead of a second one on "+ Add set".
    reservedRef.current = Math.max(reservedRef.current, plannedSets.length);
    progressionSeededRef.current = true;
    const rows = plannedSets.map((planned, idx) => ({
      key: `pending-${workoutExercise.id}-${++pendingKeyRef.current}`,
      setNumber: idx + 1,
      initial: {
        reps: prefill(planned.reps),
        weightKg: prefillWeight(planned.weightKg),
        rpe: prefill(planned.rpe),
      },
      isWarmup: false,
      error: null,
      busy: false,
      seeded: true,
    }));
    pendingsRef.current = rows;
    setPendings(rows);
    // A program day also knows the weight the progression engine has moved
    // to; the template's target is the enrollment-time value, so refining
    // the first row keeps what "+ Add set" gave on an empty card. Guarded:
    // never clobbers a row the user has already touched or logged.
    const firstKey = rows[0].key;
    void firstRowSuggestion().then((suggestion) => {
      if (!suggestion) return;
      const current = pendingsRef.current;
      const first = current.find((p) => p.key === firstKey);
      if (!first || !first.seeded || hasValue(liveRef.current[firstKey])) return;
      const refined = {
        reps: suggestion.reps !== '' ? suggestion.reps : first.initial.reps,
        weightKg: suggestion.weightKg !== '' ? suggestion.weightKg : first.initial.weightKg,
        rpe: first.initial.rpe,
      };
      const next = current.map((p) =>
        p.key === firstKey ? { ...p, initial: refined, rev: (p.rev ?? 0) + 1 } : p,
      );
      pendingsRef.current = next;
      setPendings(next);
    });
    // prefill/prefillWeight are re-created each render; the guard above keeps
    // this a one-shot, so they are intentionally not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, plannedSets, sets.length, workoutExercise.id]);

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
      // Companion: a very occasional cheer (rate-limited in the trigger).
      if (!isWarmup) companionSetLogged();

      // Superset rest/flow logic
      const supersetId = workoutExercise.supersetId;
      let restSecondsToUse =
        workoutExercise.restSeconds ?? settings?.defaultRestSeconds ?? 90;
      let shouldRest = true;
      let nextMemberId: string | null = null;

      if (supersetId && workoutItems.length > 0) {
        // Build member list in position order
        const members = workoutItems
          .filter((w) => w.workoutExercise.supersetId === supersetId)
          .sort((a, b) => a.workoutExercise.position - b.workoutExercise.position)
          .map((m) => m.workoutExercise.id);

        // Build logged counts from workoutItems, adding 1 for the just-logged set
        const loggedCounts = new Map<string, number>();
        for (const item of workoutItems) {
          if (item.workoutExercise.supersetId === supersetId) {
            loggedCounts.set(item.workoutExercise.id, item.sets.length);
          }
        }
        // Account for the set we just logged (not yet in workoutItems)
        loggedCounts.set(workoutExercise.id, (loggedCounts.get(workoutExercise.id) ?? 0) + 1);

        // Decide if rest should start
        shouldRest = shouldStartRest(members, loggedCounts, workoutExercise.id);

        // If not resting, find next member to focus
        if (!shouldRest) {
          nextMemberId = nextSupersetMember(members, loggedCounts, workoutExercise.id);
        }

        // If this is the last member and we're resting, use max rest of group
        const isLastInSuperset = members[members.length - 1] === workoutExercise.id;
        if (shouldRest && isLastInSuperset) {
          const maxRest = members.reduce((max, m) => {
            const item = workoutItems.find((w) => w.workoutExercise.id === m);
            const r = item?.workoutExercise.restSeconds ?? settings?.defaultRestSeconds ?? 90;
            return Math.max(max, r);
          }, 0);
          restSecondsToUse = maxRest;
        }
      }

      if (shouldRest) {
        setRestKey((k) => k + 1);
        setRestSeconds(restSecondsToUse);
      }
      onSetComplete(restSecondsToUse, workoutExercise.id, shouldRest);

      // If not resting and there's a next member, request scroll to it
      if (!shouldRest && nextMemberId) {
        // TODO: implement scroll to next member via callback from parent FlatList
        // For now, the next member will be visible when the list re-renders after onChanged()
      }

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
      const suggestion = await firstRowSuggestion();
      if (suggestion) initial = suggestion;
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

  /**
   * The first working set's weight, for the warmup ramp: the first editable
   * working row the user has typed into, else the last logged working set,
   * else the first set from last time. Canonical kg, or null when unknown.
   */
  const firstWorkingWeightKg = (): number | null => {
    for (const p of pendingsRef.current) {
      if (p.isWarmup) continue;
      const live = liveRef.current[p.key];
      const text = live?.weightKg ?? p.initial.weightKg;
      if (text) {
        const kg = parseWeightInput(text, displayUnit);
        if (kg !== undefined && !Number.isNaN(kg) && kg > 0) return kg;
      }
    }
    const logged = [...sets].reverse().find((s) => s.isWarmup !== true && s.weightKg != null && s.weightKg > 0);
    if (logged?.weightKg != null) return logged.weightKg;
    const prevSet = previous?.sets.find((s) => s.weightKg != null && s.weightKg > 0);
    if (prevSet?.weightKg != null) return prevSet.weightKg;
    return null;
  };

  /**
   * The previous-performance weight for the warm-up sheet's prefill: the last
   * working (non-warm-up) set from the previous performance, canonical kg.
   */
  const previousPerformanceWeightKg = (): number | null => {
    if (!previous || previous.sets.length === 0) return null;
    const working = previous.sets.filter(
      (s) => s.isWarmup !== true && s.weightKg != null && s.weightKg > 0,
    );
    return working.length > 0 ? working[working.length - 1].weightKg : null;
  };

  /**
   * Insert the warm-up sheet's confirmed rows as pending warm-up rows above
   * the working rows. Still-unlogged warm-up rows from an earlier warm-up are
   * replaced; logged sets are never touched (pending rows are local until
   * logged). Weights arrive in canonical kg and are prefilled in the user's
   * unit — never as 0 (an all-zero row reads as "no set"), and a row with
   * neither reps nor weight is dropped entirely.
   */
  const handleAddWarmupRows = (
    rows: Array<{ reps: string; weightKg: number | null; isWarmup: true }>,
  ): void => {
    const kept = pendingsRef.current.filter((p) => !p.isWarmup);
    const warmupRows = rows
      .map((r) => ({
        key: `pending-${workoutExercise.id}-${++pendingKeyRef.current}`,
        setNumber: reserveSetNumber(),
        initial: {
          reps: r.reps,
          weightKg: r.weightKg != null && r.weightKg > 0 ? prefillWeight(r.weightKg) : '',
          rpe: '',
        },
        isWarmup: true,
        error: null,
        busy: false,
      }))
      .filter((p) => p.initial.reps !== '' || p.initial.weightKg !== '');
    const next = [...warmupRows, ...kept];
    pendingsRef.current = next;
    setPendings(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
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

  /**
   * The plan's target for this exercise, one line (the sheet's "Your plan").
   * `plannedSets` carries one row per planned set with the same targets, so the
   * count and the first row describe it.
   */
  const plannedTarget =
    plannedSets && plannedSets.length > 0
      ? [
          plannedSets[0].reps != null
            ? `${plannedSets.length} × ${plannedSets[0].reps} reps`
            : `${plannedSets.length} sets`,
          plannedSets[0].weightKg != null ? formatWeight(plannedSets[0].weightKg, displayUnit) : '',
          plannedSets[0].rpe != null ? `RPE ${plannedSets[0].rpe}` : '',
        ]
          .filter((part) => part.length > 0)
          .join(' · ')
      : undefined;

  /** Everything the info sheet shows, derived from what the card already has. */
  const info = exerciseInfo({
    name: displayName(exercise),
    muscles,
    kbDetailJson: exercise.kbDetailJson,
    longevityNotes: exercise.longevityNotes,
    target: plannedTarget,
    lastTime: previous ? formatPreviousPerformance(previous) : undefined,
  });

  // Determine if we should show column headers (any rows exist: logged or pending)
  const hasAnyRows = sets.length > 0 || pendings.length > 0;

  // The card gets the blue active border while it has pending
  // (in-progress) set rows — the reference's "current exercise" signal.
  // Plan-seeded rows start unlit so a planned workout doesn't light every
  // card at once; touching one (or adding/loading a row) lights it.
  const isActive = pendings.some((p) => !p.seeded);

  // Superset visual indicators
  const isInSuperset = supersetGroup != null;
  const isFirstInSuperset = supersetGroup?.isFirst ?? false;
  const isLastInSuperset = supersetGroup?.isLast ?? false;
  const supersetTag = isFirstInSuperset && supersetGroup
    ? supersetTagText(`SUPERSET ${supersetGroup.letter}`, supersetGroup.memberCount)
    : null;

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
      style={[
        isActive
          ? { borderColor: theme.colors.highlight, borderWidth: 2 }
          : undefined,
        // Reduce vertical margin between superset members (hairline gap)
        isInSuperset && !isFirstInSuperset ? { marginTop: -theme.spacing.md + 1 } : undefined,
      ]}
    >
      {/* Superset visual indicators: left accent bar + tag on first member */}
      {isInSuperset && (
        <View style={styles.supersetIndicators} pointerEvents="none">
          {/* Vertical accent bar on left edge */}
          <View
            style={[
              styles.supersetBar,
              { backgroundColor: theme.colors.accent, height: '100%' },
            ]}
          />
          {/* Tag on first member */}
          {supersetTag && (
            <Text
              testID={`superset-tag-${supersetGroup.supersetId}`}
              style={{
                fontSize: t.size.caption,
                fontWeight: t.weight.semibold,
                color: theme.colors.accent,
                backgroundColor: theme.colors.accent + '26', // 15% opacity
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: theme.radius.sm,
                marginLeft: -2,
              }}
            >
              {supersetTag}
            </Text>
          )}
        </View>
      )}
      <View style={styles.headerRow}>
        <Text
          style={{ color: theme.colors.highlight, fontSize: t.size.card, fontWeight: t.weight.bold, marginRight: theme.spacing.sm }}
          accessibilityLabel={`Exercise ${workoutExercise.position + 1}`}
        >
          {workoutExercise.position + 1}
        </Text>
        <View style={styles.headerText}>
          <Pressable
            testID={`exercise-info-${workoutExercise.position + 1}`}
            onPress={() => setInfoVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`About ${displayName(exercise)}`}
            accessibilityHint="Key cues, safety and last time"
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}
          >
            {/* Never shrunk, never cut: a long name wraps to as many lines as it
                needs and the card grows (owner decision 2026-10-25). */}
            <Text
              style={{
                flexShrink: 1,
                color: theme.colors.accent,
                fontSize: t.size.card,
                fontWeight: t.weight.bold,
              }}
            >
              {displayName(exercise)}
            </Text>
            <ActionIcon name="info" color={theme.colors.accent} size={14} />
            {workoutExercise.notes ? <ActionIcon name="note" color={theme.colors.accent} size={16} /> : null}
          </Pressable>
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
          testID="exercise-collapse"
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          accessibilityLabel={collapsed ? `Expand ${displayName(exercise)}` : `Collapse ${displayName(exercise)}`}
          onPress={() => setCollapsed((v) => !v)}
          hitSlop={8}
          style={{ padding: theme.spacing.xs }}
        >
          <View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
            <ActionIcon name="chevron-down" color={theme.colors.faint} size={22} />
          </View>
        </Pressable>
      </View>

      {!collapsed ? (
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
            ).map(([label, flex]) =>
              label === 'RPE' && onRpeHelp ? (
                <Pressable
                  key={label}
                  testID="rpe-help"
                  onPress={onRpeHelp}
                  accessibilityRole="button"
                  accessibilityLabel="What is RPE?"
                  accessibilityHint="Opens a short explanation of the RPE scale"
                  hitSlop={10}
                  style={[styles.rpeHeader, { flex }]}
                >
                  <Text
                    style={[styles.columnHeader, { color: theme.colors.accent, fontSize: gm.fontHeader }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
                  >
                    {label}
                  </Text>
                  <ActionIcon name="info" color={theme.colors.accent} size={gm.fontHeader + 1} />
                </Pressable>
              ) : (
                <Text
                  key={label}
                  style={[styles.columnHeader, { flex, minWidth: 0, color: theme.colors.muted, fontSize: gm.fontHeader }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
                >
                  {label}
                </Text>
              ),
            )}
            <View style={{ flex: GRID_FLEX.check + GRID_FLEX.remove, alignItems: 'center' }}>
              <ActionIcon name="check" color={theme.colors.muted} size={gm.fontHeader + 6} />
            </View>
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
              // First edit on a plan seed: the user has taken over this row,
              // so the card counts as in progress from now on.
              if (p.seeded) patchPending(p.key, { seeded: false });
            }}
            onAddSet={(v) => void handleAddSet(false, v)}
          />
        ))}

        {/* Footer — light text actions: (+) Add Set and Swap on the left,
            the actions "⋯" on the right (REFERENCE C). */}
        <View style={styles.footerRow}>
          <Pressable
            testID="add-set"
            onPress={() => void handleAddSet(false)}
            accessibilityRole="button"
            accessibilityLabel="Add set"
            style={({ pressed }) => [styles.footerTextButton, { opacity: pressed ? 0.55 : 1 }]}
          >
            <ActionIcon name="plus" color={theme.colors.text} size={20} />
            <Text style={{ color: theme.colors.text, fontSize: t.size.meta + 1, fontWeight: t.weight.semibold }} maxFontSizeMultiplier={1.15}>
              Add Set
            </Text>
          </Pressable>
          <Pressable
            testID="swap-exercise"
            onPress={() => router.push(`/workout/${workoutId}/swap-exercise?workoutExerciseId=${workoutExercise.id}`)}
            accessibilityRole="button"
            accessibilityLabel="Swap exercise"
            style={({ pressed }) => [styles.footerTextButton, { opacity: pressed ? 0.55 : 1 }]}
          >
            <ActionIcon name="swap" color={theme.colors.muted} size={20} />
            <Text style={{ color: theme.colors.muted, fontSize: t.size.meta + 1, fontWeight: t.weight.medium }} maxFontSizeMultiplier={1.15}>
              Swap
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            testID="exercise-actions"
            onPress={() => setSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${displayName(exercise)}`}
            hitSlop={8}
            style={({ pressed }) => [{ padding: theme.spacing.xs, opacity: pressed ? 0.55 : 1 }]}
          >
            <ActionIcon name="more" color={theme.colors.faint} size={24} />
          </Pressable>
        </View>
      </View>
      ) : null}

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
        workoutName={workoutName}
        defaultRestSeconds={settings?.defaultRestSeconds}
        onClose={() => setSheetVisible(false)}
        onChanged={onChanged}
        onAddWarmupRows={handleAddWarmupRows}
        firstWorkingWeightKg={firstWorkingWeightKg()}
        previousPerformanceWeightKg={previousPerformanceWeightKg()}
        routineTargetWeightKg={plannedSets?.[0]?.weightKg ?? null}
        hasUnloggedWarmups={pendings.some((p) => p.isWarmup)}
        globalUnit={displayUnit}
      />

      {/* About this exercise — opened from the title. Never navigates away: the
          pending set stays exactly as it was. */}
      <ExerciseInfoSheet
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
        info={info}
        onOpenGuide={() => router.push(`/exercises/${exercise.id}` as Href)}
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
  /** The RPE header doubles as the explainer's trigger. */
  rpeHeader: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  footerRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  footerTextButton: {
    minHeight: 38,
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Superset visual indicators
  supersetIndicators: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    justifyContent: 'flex-start',
    paddingTop: 12,
    paddingLeft: 2,
    zIndex: 1,
  },
  supersetBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  
});
