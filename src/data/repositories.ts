/**
 * Typed query helpers over the Drizzle schema.
 *
 * Conventions:
 * - Every read filters out soft-deleted rows (`deleted_at IS NULL`), except
 *   historical joins (workout detail) which deliberately keep showing
 *   soft-deleted exercises by name.
 * - Deletes are soft deletes (sets `deleted_at`); cascade soft-deletes are
 *   done explicitly in transactions so child rows keep their tombstones.
 *   Tombstones are never rewritten — updates skip already-deleted rows.
 * - Canonical units: kg for weight, seconds for duration, meters for distance.
 * - No UI imports here — the logging UI (workstream #3) consumes these.
 */
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { db, runInTransaction } from '../db/client';
import { newId } from '../db/id';
import {
  decodePillars,
  encodePillars,
  EXERCISE_CATEGORIES,
  exercises,
  measurements,
  personalRecords,
  programEnrollments,
  programSessionStates,
  routineExercises,
  routines,
  sets,
  workouts,
  workoutExercises,
  type Exercise,
  type ExerciseCategory,
  type LoggedSet,
  type LongevityPillar,
  type Measurement,
  type NewLoggedSet,
  type NewMeasurement,
  type NewPersonalRecord,
  type NewRoutine,
  type NewRoutineExercise,
  type NewWorkout,
  type NewWorkoutExercise,
  type PersonalRecord,
  type Routine,
  type RoutineExercise,
  type Workout,
  type WorkoutExercise,
} from '../db/schema';
import { KB_MEDIA_URL_PREFIXES } from './backupFormat';

export { decodePillars, encodePillars };
export type { LongevityPillar };

/* ------------------------------------------------------------------ */
/* internal helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Serializes ALL database writes through a single async mutex.
 *
 * Why global: expo-sqlite's withTransactionAsync issues BEGIN/COMMIT as async
 * native calls while Drizzle queries run synchronously on the same handle —
 * any write that slips in while BEGIN/COMMIT is pending lands inside someone
 * else's transaction (or fails with "cannot start a transaction within a
 * transaction"). Per-key locks can't prevent cross-key races (e.g. logging a
 * set while its workout is being deleted). A single-user workout app does a
 * handful of writes per second, so a global write lock costs nothing and is
 * obviously correct. Reads don't take the lock.
 *
 * Concurrent callers QUEUE on the promise chain — each waits its turn.
 * (An earlier version threw "must never be nested" for merely concurrent
 * callers, which broke legitimate UI races like tapping Log on two cards.)
 *
 * NEVER call this re-entrantly from inside `fn` itself: the inner call
 * would wait on a gate that only releases when the outer `fn` completes,
 * i.e. a silent deadlock. No repository function nests (verified); keep it
 * that way — the type system can't catch this one.
 */
let writeGate: Promise<unknown> = Promise.resolve();

export async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeGate;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  writeGate = prev.then(() => gate);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function assertRpeRir(rpe?: number | null, rir?: number | null): void {
  if (rpe !== undefined && rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) {
    throw new RangeError(`rpe out of range 1–10: ${rpe}`);
  }
  if (rir !== undefined && rir !== null && (!Number.isInteger(rir) || rir < 0 || rir > 10)) {
    throw new RangeError(`rir out of range 0–10: ${rir}`);
  }
}

/** Rejects NaN/Infinity/negatives for measure fields (reps, weight, duration, distance). */
function assertNonNegative(value: number | null | undefined, field: string): void {
  if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new RangeError(`${field} must be a finite non-negative number: ${value}`);
  }
}

/** Integer fields (reps, set numbers, rest seconds, …) reject fractions too. */
function assertInt(value: number | null | undefined, field: string): void {
  if (value !== undefined && value !== null && !Number.isInteger(value)) {
    throw new RangeError(`${field} must be an integer: ${value}`);
  }
}

function assertIntNonNegative(value: number | null | undefined, field: string): void {
  assertInt(value, field);
  assertNonNegative(value, field);
}

/** For free-form real fields (body weight, PR values): finite, sign unrestricted. */
function assertFinite(value: number | null | undefined, field: string): void {
  if (value !== undefined && value !== null && !Number.isFinite(value)) {
    throw new RangeError(`${field} must be a finite number: ${value}`);
  }
}

/** Rejects invalid Date objects (NaN epoch). */
function assertValidDate(value: Date | null | undefined, field: string): void {
  if (value !== undefined && value !== null && !(value instanceof Date && Number.isFinite(value.getTime()))) {
    throw new RangeError(`${field} must be a valid Date`);
  }
}

function assertCategory(category: string): asserts category is ExerciseCategory {
  if (!(EXERCISE_CATEGORIES as readonly string[]).includes(category)) {
    throw new RangeError(`invalid exercise category: ${category}`);
  }
}

/**
 * Path prefixes allowed for KB media URLs. The KB publishes via GitHub
 * Releases + Pages; anything else (a malformed or compromised bundle pointing
 * at a third-party host) would leak which exercises the user opens, plus
 * IP/timing. Compared against the NORMALIZED url (new URL resolves .. and
 * %-encoding) with a trailing slash, so neither
 * https://github.com/rattymcfarty/lift-kb-anything/… nor
 * https://github.com/rattymcfarty/lift-kb/../../attacker/… can slip through.
 * P2 (KB app-side) owns this list — keep it in sync with the publishing setup.
 *
 * Single source of truth lives in ./backupFormat (pure, importable without
 * the DB); the backup importer reuses it so crafted backup files can't
 * smuggle in off-allowlist media hosts either.
 */
const KB_MEDIA_PATH_PREFIXES = [...KB_MEDIA_URL_PREFIXES];

function assertKbMediaUrl(url: string | null | undefined, field: string): void {
  if (url == null || url === '') return;
  let normalized: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new RangeError(`${field} must be https: ${url}`);
    }
    normalized = parsed.origin + parsed.pathname;
  } catch (e) {
    if (e instanceof RangeError) throw e;
    throw new RangeError(`invalid ${field} URL: ${url}`);
  }
  if (!KB_MEDIA_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new RangeError(`${field} origin not in the KB media allowlist: ${url}`);
  }
}

/* ------------------------------------------------------------------ */
/* workouts                                                            */
/* ------------------------------------------------------------------ */

export async function createWorkout(input: {
  name: string;
  notes?: string;
  routineId?: string;
  longevityPillars?: LongevityPillar[];
  startedAt?: Date;
}): Promise<string> {
  return withWriteLock(async () => {
    const values: NewWorkout = {
      name: input.name,
      notes: input.notes,
      routineId: input.routineId,
      longevityPillars: encodePillars(input.longevityPillars ?? []),
      startedAt: input.startedAt ?? new Date(),
    };
    const [row] = await db.insert(workouts).values(values).returning({ id: workouts.id });
    return row.id;
  });
}

export interface WorkoutExerciseDetail {
  workoutExercise: WorkoutExercise;
  exercise: Exercise;
  sets: LoggedSet[];
}

export interface WorkoutDetail {
  workout: Workout;
  items: WorkoutExerciseDetail[];
}

/** Full workout with exercises + sets, in position/set order. */
export async function getWorkoutDetail(id: string): Promise<WorkoutDetail | null> {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), isNull(workouts.deletedAt)));
  if (!workout) return null;

  const items = await db
    .select()
    .from(workoutExercises)
    .where(and(eq(workoutExercises.workoutId, id), isNull(workoutExercises.deletedAt)))
    .orderBy(asc(workoutExercises.position));
  if (items.length === 0) return { workout, items: [] };

  const exerciseIds = [...new Set(items.map((i) => i.exerciseId))];
  const itemIds = items.map((i) => i.id);

  const [exerciseRows, setRows] = await Promise.all([
    // Include soft-deleted exercises: history must keep showing the real
    // name even if the exercise was deleted after the workout.
    db.select().from(exercises).where(inArray(exercises.id, exerciseIds)),
    db
      .select()
      .from(sets)
      .where(and(inArray(sets.workoutExerciseId, itemIds), isNull(sets.deletedAt)))
      .orderBy(asc(sets.setNumber)),
  ]);
  const exerciseById = new Map(exerciseRows.map((e) => [e.id, e]));
  const setsByItem = new Map<string, LoggedSet[]>();
  for (const s of setRows) {
    const list = setsByItem.get(s.workoutExerciseId) ?? [];
    list.push(s);
    setsByItem.set(s.workoutExerciseId, list);
  }

  return {
    workout,
    items: items.map((we) => ({
      workoutExercise: we,
      // FK targets always exist (SQLite keeps the row; deletes are soft).
      // Defensive fallback only if FK enforcement was bypassed.
      exercise: exerciseById.get(we.exerciseId) ?? deletedExercisePlaceholder(we.exerciseId),
      sets: setsByItem.get(we.id) ?? [],
    })),
  };
}

/** Stand-in for an exercise row that vanished despite the FK (never expected). */
function deletedExercisePlaceholder(id: string): Exercise {
  const epoch = new Date(0);
  return {
    id,
    createdAt: epoch,
    updatedAt: epoch,
    deletedAt: epoch,
    name: '(deleted exercise)',
    primaryMuscles: '[]',
    secondaryMuscles: '[]',
    equipment: '[]',
    category: 'other',
    kbCategory: null,
    instructions: null,
    mediaImageUrl: null,
    mediaVideoUrl: null,
    longevityPillars: '[]',
    longevityNotes: null,
    isCustom: false,
    kbId: null,
    kbVersion: null,
    kbDetailJson: null,
  };
}

/** Most recent workouts, newest first. */
export async function listRecentWorkouts(limit = 20): Promise<Workout[]> {
  return db
    .select()
    .from(workouts)
    .where(isNull(workouts.deletedAt))
    .orderBy(desc(workouts.startedAt))
    .limit(limit);
}

/** The in-progress workout (started, not ended), if any. */
export async function getActiveWorkout(): Promise<WorkoutDetail | null> {
  const [active] = await db
    .select()
    .from(workouts)
    .where(and(isNull(workouts.endedAt), isNull(workouts.deletedAt)))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return active ? getWorkoutDetail(active.id) : null;
}

/**
 * Every open (started, not ended, not deleted) workout, newest first. Normally
 * zero or one; more than one means an earlier one was abandoned.
 */
export async function listOpenWorkouts(): Promise<WorkoutDetail[]> {
  const rows = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(isNull(workouts.endedAt), isNull(workouts.deletedAt)))
    .orderBy(desc(workouts.startedAt));
  const out: WorkoutDetail[] = [];
  for (const r of rows) {
    const d = await getWorkoutDetail(r.id);
    if (d) out.push(d);
  }
  return out;
}

/** Returns the updated row, or null if the workout doesn't exist / is deleted. */
export async function finishWorkout(id: string, endedAt: Date = new Date()): Promise<Workout | null> {
  assertValidDate(endedAt, 'endedAt');
  return withWriteLock(() =>
    runInTransaction(async () => {
      const [existing] = await db
        .select({ startedAt: workouts.startedAt })
        .from(workouts)
        .where(and(eq(workouts.id, id), isNull(workouts.deletedAt)))
        .limit(1);
      if (!existing) return null;
      // Validate BEFORE writing (P4a fix): the old code wrote the bad
      // endedAt first, then threw — leaving corrupt duration in the DB.
      if (existing.startedAt && endedAt < existing.startedAt) {
        throw new RangeError('endedAt cannot be before startedAt');
      }
      const [row] = await db
        .update(workouts)
        .set({ endedAt })
        .where(and(eq(workouts.id, id), isNull(workouts.deletedAt)))
        .returning();
      return row ?? null;
    }),
  );
}

export type WorkoutPatch = Partial<Pick<Workout, 'name' | 'notes' | 'startedAt' | 'endedAt'>> & {
  longevityPillars?: LongevityPillar[];
};

/** Returns the updated row, or null if the workout doesn't exist / is deleted. */
export async function updateWorkout(id: string, patch: WorkoutPatch): Promise<Workout | null> {
  assertValidDate(patch.startedAt, 'startedAt');
  assertValidDate(patch.endedAt, 'endedAt');
  if (patch.startedAt && patch.endedAt && patch.endedAt < patch.startedAt) {
    throw new RangeError('endedAt cannot be before startedAt');
  }
  // Runtime pick: the whitelist is compile-time only, so strip anything extra
  // a JS caller might smuggle in (id, createdAt, …).
  const { longevityPillars, name, notes, startedAt, endedAt } = patch;
  return withWriteLock(async () => {
    const [row] = await db
      .update(workouts)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(startedAt !== undefined ? { startedAt } : {}),
        ...(endedAt !== undefined ? { endedAt } : {}),
        ...(longevityPillars !== undefined ? { longevityPillars: encodePillars(longevityPillars) } : {}),
      })
      .where(and(eq(workouts.id, id), isNull(workouts.deletedAt)))
      .returning();
    return row ?? null;
  });
}

/** Soft-deletes the workout and all its exercises + sets (tombstones kept). */
export async function softDeleteWorkout(id: string): Promise<void> {
  return withWriteLock(async () => {
    const now = new Date();
    await runInTransaction(async () => {
      const items = await db
        .select({ id: workoutExercises.id })
        .from(workoutExercises)
        .where(and(eq(workoutExercises.workoutId, id), isNull(workoutExercises.deletedAt)));
      const itemIds = items.map((i) => i.id);
      if (itemIds.length > 0) {
        await db
          .update(sets)
          .set({ deletedAt: now })
          .where(and(inArray(sets.workoutExerciseId, itemIds), isNull(sets.deletedAt)));
      }
      // PRs derived from this workout die with it (e.g. a mistyped 500 kg PR).
      await db
        .update(personalRecords)
        .set({ deletedAt: now })
        .where(and(eq(personalRecords.workoutId, id), isNull(personalRecords.deletedAt)));
      // P4a: unlink from any program session that hasn't counted it yet.
      // 'scheduled' and 'missed' rows are unlinked (P4a lets missed rows
      // be started late); a 'done' session keeps its historical link.
      await db
        .update(programSessionStates)
        .set({ workoutId: null, updatedAt: now })
        .where(
          and(
            eq(programSessionStates.workoutId, id),
            or(
              eq(programSessionStates.status, 'scheduled'),
              eq(programSessionStates.status, 'missed'),
            ),
            isNull(programSessionStates.deletedAt),
          ),
        );
      await db
        .update(workoutExercises)
        .set({ deletedAt: now })
        .where(and(eq(workoutExercises.workoutId, id), isNull(workoutExercises.deletedAt)));
      await db
        .update(workouts)
        .set({ deletedAt: now })
        .where(and(eq(workouts.id, id), isNull(workouts.deletedAt)));
    });
  });
}

/* ------------------------------------------------------------------ */
/* workout_exercises                                                   */
/* ------------------------------------------------------------------ */

export async function addExerciseToWorkout(input: {
  workoutId: string;
  exerciseId: string;
  position?: number;
  restSeconds?: number;
  notes?: string;
}): Promise<string> {
  assertIntNonNegative(input.restSeconds, 'restSeconds');
  assertIntNonNegative(input.position, 'position');
  return withWriteLock(async () => {
    // The workout and the exercise must both be live.
    const [workout] = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(eq(workouts.id, input.workoutId), isNull(workouts.deletedAt)))
      .limit(1);
    if (!workout) {
      throw new RangeError('cannot add an exercise to a deleted workout');
    }
    const [exercise] = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.id, input.exerciseId), isNull(exercises.deletedAt)))
      .limit(1);
    if (!exercise) {
      throw new RangeError('cannot add a deleted exercise to a workout');
    }
    let position = input.position;
    if (position === undefined) {
      const existing = await db
        .select({ position: workoutExercises.position })
        .from(workoutExercises)
        .where(and(eq(workoutExercises.workoutId, input.workoutId), isNull(workoutExercises.deletedAt)))
        .orderBy(desc(workoutExercises.position))
        .limit(1);
      position = existing.length > 0 ? existing[0].position + 1 : 0;
    } else {
      // Explicit positions must be free; the unique index is the backstop.
      const [collision] = await db
        .select({ id: workoutExercises.id })
        .from(workoutExercises)
        .where(
          and(
            eq(workoutExercises.workoutId, input.workoutId),
            eq(workoutExercises.position, position),
            isNull(workoutExercises.deletedAt),
          ),
        )
        .limit(1);
      if (collision) {
        throw new RangeError(`position ${position} is already taken in this workout`);
      }
    }
    const values: NewWorkoutExercise = {
      workoutId: input.workoutId,
      exerciseId: input.exerciseId,
      position,
      restSeconds: input.restSeconds,
      notes: input.notes,
    };
    const [row] = await db.insert(workoutExercises).values(values).returning({ id: workoutExercises.id });
    return row.id;
  });
}

/** Soft-deletes the workout exercise and its sets. */
export async function removeWorkoutExercise(id: string): Promise<void> {
  const [row] = await db
    .select({ workoutId: workoutExercises.workoutId })
    .from(workoutExercises)
    .where(eq(workoutExercises.id, id));
  if (!row) return;
  return withWriteLock(async () => {
    const now = new Date();
    await runInTransaction(async () => {
      const setRows = await db
        .select({ id: sets.id })
        .from(sets)
        .where(and(eq(sets.workoutExerciseId, id), isNull(sets.deletedAt)));
      const setIds = setRows.map((s) => s.id);
      await db
        .update(sets)
        .set({ deletedAt: now })
        .where(and(eq(sets.workoutExerciseId, id), isNull(sets.deletedAt)));
      if (setIds.length > 0) {
        await db
          .update(personalRecords)
          .set({ deletedAt: now })
          .where(and(inArray(personalRecords.setId, setIds), isNull(personalRecords.deletedAt)));
      }
      await db
        .update(workoutExercises)
        .set({ deletedAt: now })
        .where(and(eq(workoutExercises.id, id), isNull(workoutExercises.deletedAt)));
    });
  });
}

/**
 * Reorders exercises within a workout; orderedIds must be exactly the live
 * set of workout-exercise ids, in the new order.
 *
 * Two-phase write: the partial unique index on (workout_id, position) is
 * checked per statement, so rows first move to temporary negative positions
 * (no collisions possible), then to their final positions.
 */
export async function reorderWorkoutExercises(workoutId: string, orderedIds: string[]): Promise<void> {
  return withWriteLock(async () => {
    const live = await db
      .select({ id: workoutExercises.id })
      .from(workoutExercises)
      .where(and(eq(workoutExercises.workoutId, workoutId), isNull(workoutExercises.deletedAt)));
    const liveIds = new Set(live.map((r) => r.id));
    if (orderedIds.length !== liveIds.size || !orderedIds.every((id) => liveIds.has(id))) {
      throw new RangeError('orderedIds must contain exactly the live workout-exercise ids for this workout');
    }
    await runInTransaction(async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(workoutExercises)
          .set({ position: -(i + 1) })
          .where(and(eq(workoutExercises.id, orderedIds[i]), eq(workoutExercises.workoutId, workoutId)));
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(workoutExercises)
          .set({ position: i })
          .where(and(eq(workoutExercises.id, orderedIds[i]), eq(workoutExercises.workoutId, workoutId)));
      }
    });
  });
}

/**
 * Sets the per-exercise display unit preference.
 * @param workoutExerciseId The workout_exercises row to update.
 * @param unit 'kg' | 'lb' | null — null clears the override (follows global setting).
 * @throws RangeError if unit is not 'kg', 'lb', or null.
 */
export async function setExerciseUnitPreference(
  workoutExerciseId: string,
  unit: 'kg' | 'lb' | null,
): Promise<void> {
  if (unit !== null && unit !== 'kg' && unit !== 'lb') {
    throw new RangeError(`invalid unit preference: ${unit}`);
  }
  return withWriteLock(async () => {
    await db
      .update(workoutExercises)
      .set({ unitPreference: unit })
      .where(and(eq(workoutExercises.id, workoutExerciseId), isNull(workoutExercises.deletedAt)));
  });
}

/**
 * Sets the per-exercise rest timer override in seconds.
 * @param workoutExerciseId The workout_exercises row to update.
 * @param seconds Rest time in seconds, or null to inherit the global default.
 * @throws RangeError if seconds is not a positive integer or null.
 */
export async function setExerciseRest(
  workoutExerciseId: string,
  seconds: number | null,
): Promise<void> {
  if (seconds !== null) {
    assertIntNonNegative(seconds, 'restSeconds');
  }
  return withWriteLock(async () => {
    await db
      .update(workoutExercises)
      .set({ restSeconds: seconds })
      .where(and(eq(workoutExercises.id, workoutExerciseId), isNull(workoutExercises.deletedAt)));
  });
}

/**
 * Updates the exercise notes for a workout exercise.
 * @param workoutExerciseId The workout_exercises row to update.
 * @param notes The new notes string, or null to clear.
 */
export async function setExerciseNotes(
  workoutExerciseId: string,
  notes: string | null,
): Promise<void> {
  return withWriteLock(async () => {
    await db
      .update(workoutExercises)
      .set({ notes: notes ?? null })
      .where(and(eq(workoutExercises.id, workoutExerciseId), isNull(workoutExercises.deletedAt)));
  });
}

/**
 * Sets the per-exercise auto-progression override.
 * @param workoutExerciseId The workout_exercises row to update.
 * @param value true = force ON, false = force OFF, null = auto from program linkage.
 */
export async function setExerciseAutoProgression(
  workoutExerciseId: string,
  value: boolean | null,
): Promise<void> {
  return withWriteLock(async () => {
    await db
      .update(workoutExercises)
      .set({ autoProgression: value })
      .where(and(eq(workoutExercises.id, workoutExerciseId), isNull(workoutExercises.deletedAt)));
  });
}

/** Shared: does the workout + exercise have an active program progression? */
export async function isProgressionAvailable(
  workoutId: string,
  exerciseId: string,
): Promise<boolean> {
  const [workout] = await db
    .select({ routineId: workouts.routineId })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), isNull(workouts.deletedAt)))
    .limit(1);
  if (!workout || !workout.routineId) return false;
  const [enrollment] = await db
    .select()
    .from(programEnrollments)
    .where(
      and(
        eq(programEnrollments.status, 'active'),
        isNull(programEnrollments.deletedAt),
      ),
    )
    .limit(1);
  if (!enrollment) return false;
  const state = parseProgressionState(enrollment.progressionState);
  const weightKg = state[exerciseId]?.weightKg;
  if (weightKg == null) return false;
  const [re] = await db
    .select({ id: routineExercises.id })
    .from(routineExercises)
    .where(
      and(
        eq(routineExercises.routineId, workout.routineId),
        eq(routineExercises.exerciseId, exerciseId),
        isNull(routineExercises.deletedAt),
      ),
    )
    .limit(1);
  return !!re;
}

/**
 * Pure helper to resolve the effective auto-progression state label.
 * @param override null = Auto, true = On, false = Off
 * @param available whether program progression is available
 */
export function resolveAutoProgression(
  override: boolean | null,
  available: boolean,
): { label: string; effective: boolean } {
  if (override === true) return { label: 'On', effective: true };
  if (override === false) return { label: 'Off', effective: false };
  if (available) return { label: 'Auto (On)', effective: true };
  return { label: 'Auto (Off)', effective: false };
}

export async function setAutoProgressionOverride(
  workoutExerciseId: string,
  value: boolean | null,
): Promise<void> {
  return withWriteLock(async () => {
    await db
      .update(workoutExercises)
      .set({ autoProgression: value })
      .where(and(eq(workoutExercises.id, workoutExerciseId), isNull(workoutExercises.deletedAt)));
  });
}

/**
 * Gets the progression suggestion for a workout exercise if it has an active
 * program enrollment with progression state.
 * Returns null when:
 * - The workout is not linked to a routine from an active enrollment
 * - The enrollment has no progression state for this exercise
 * - The exercise is bodyweight (no weight progression)
 */
export async function getProgressionSuggestion(
  workoutExerciseId: string,
): Promise<{ weightKg: number; reps: number | null } | null> {
  const [we] = await db
    .select({
      id: workoutExercises.id,
      workoutId: workoutExercises.workoutId,
      exerciseId: workoutExercises.exerciseId,
      routineId: workouts.routineId,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(and(eq(workoutExercises.id, workoutExerciseId), isNull(workoutExercises.deletedAt)))
    .limit(1);

  if (!we || !we.routineId) return null;
  if (!await isProgressionAvailable(we.workoutId, we.exerciseId)) return null;

  // Find active enrollment for this routine
  const [enrollment] = await db
    .select()
    .from(programEnrollments)
    .where(
      and(
        eq(programEnrollments.status, 'active'),
        isNull(programEnrollments.deletedAt),
      ),
    )
    .limit(1);

  if (!enrollment) return null;

  const state = parseProgressionState(enrollment.progressionState);
  const weightKg = state[we.exerciseId]?.weightKg;
  if (weightKg == null) return null;

  // Get the routine template for this exercise to find target reps
  const [routineExercise] = await db
    .select()
    .from(routineExercises)
    .where(
      and(
        eq(routineExercises.routineId, we.routineId),
        eq(routineExercises.exerciseId, we.exerciseId),
        isNull(routineExercises.deletedAt),
      ),
    )
    .limit(1);

  const repRange = routineExercise ? parseRepRange(routineExercise.targetReps) : null;
  const targetReps = repRange?.min ?? null;

  return { weightKg, reps: targetReps };
}

function parseProgressionState(json: string | null | undefined): Record<string, { weightKg: number }> {
  if (!json) return {};
  try {
    const v: unknown = JSON.parse(json);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
    const out: Record<string, { weightKg: number }> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (
        typeof val === 'object' &&
        val !== null &&
        typeof (val as { weightKg?: unknown }).weightKg === 'number' &&
        Number.isFinite((val as { weightKg: number }).weightKg) &&
        (val as { weightKg: number }).weightKg >= 0
      ) {
        out[k] = { weightKg: (val as { weightKg: number }).weightKg };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function parseRepRange(targetReps: string | null | undefined): { min: number; max: number | null } | null {
  if (targetReps == null) return null;
  const t = targetReps.trim();
  if (t.length === 0) return null;

  const RANGE_RE = /^(\d+)\s*[-–—]\s*(\d+)$/;
  const SINGLE_RE = /^(\d+)$/;
  const OPEN_RE = /^(\d+)\s*\+$/;

  let m = RANGE_RE.exec(t);
  if (m) {
    const min = Number(m[1]);
    const max = Number(m[2]);
    if (min >= 1 && max >= min && max <= 1000) return { min, max };
    return null;
  }
  m = SINGLE_RE.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 1000) return { min: n, max: n };
    return null;
  }
  m = OPEN_RE.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 1000) return { min: n, max: null };
    return null;
  }
  return null;
}

/**
 * Groups or ungroups exercises into a superset.
 * @param workoutExerciseIds Array of workout_exercises IDs to group together.
 * @param supersetId A client-generated UUID string, or null to ungroup.
 * All IDs must belong to the same workout and be live.
 * @throws RangeError if IDs span multiple workouts or any row is deleted.
 */
export async function setSupersetGroup(
  workoutExerciseIds: string[],
  supersetId: string | null,
): Promise<void> {
  if (workoutExerciseIds.length === 0) return;
  return withWriteLock(async () => {
    const rows = await db
      .select({ id: workoutExercises.id, workoutId: workoutExercises.workoutId })
      .from(workoutExercises)
      .where(and(inArray(workoutExercises.id, workoutExerciseIds), isNull(workoutExercises.deletedAt)));
    if (rows.length !== workoutExerciseIds.length) {
      throw new RangeError('one or more workout exercises not found or deleted');
    }
    const workoutIds = new Set(rows.map((r) => r.workoutId));
    if (workoutIds.size > 1) {
      throw new RangeError('all exercises must belong to the same workout');
    }
    await db
      .update(workoutExercises)
      .set({ supersetId })
      .where(and(inArray(workoutExercises.id, workoutExerciseIds), isNull(workoutExercises.deletedAt)));
  });
}

/**
 * Returns superset groups for a workout, in position order.
 * Each group contains the workout_exercises rows sharing a supersetId.
 * Exercises without a supersetId are not included.
 */
export async function getSupersetGroups(workoutId: string): Promise<WorkoutExercise[][]> {
  const rows = await db
    .select()
    .from(workoutExercises)
    .where(
      and(
        eq(workoutExercises.workoutId, workoutId),
        isNotNull(workoutExercises.supersetId),
        isNull(workoutExercises.deletedAt),
      ),
    )
    .orderBy(asc(workoutExercises.position));
  const groups = new Map<string, WorkoutExercise[]>();
  for (const row of rows) {
    const key = row.supersetId!;
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }
  return [...groups.values()];
}

/**
 * Adds exercises to a workout and groups them as a new superset — all-or-nothing.
 *
 * The new supersetId is generated client-side (newId()) and shared by every
 * inserted workout_exercises row. If any insert or the group call fails, the
 * partial inserts are rolled back (soft-deleted) so the caller never sees a
 * half-added superset.
 *
 * @param workoutId The workout to add to.
 * @param exerciseIds Exercise library IDs to add (order = superset order).
 * @throws RangeError if the workout or any exercise is deleted.
 */
export async function addExercisesAsSuperset(
  workoutId: string,
  exerciseIds: string[],
): Promise<{ supersetId: string; workoutExercises: WorkoutExercise[] }> {
  if (exerciseIds.length === 0) {
    throw new RangeError('cannot create a superset from zero exercises');
  }
  const supersetId = newId();
  const inserted: WorkoutExercise[] = [];
  try {
    for (const exerciseId of exerciseIds) {
      const weId = await addExerciseToWorkout({ workoutId, exerciseId });
      const [row] = await db
        .select()
        .from(workoutExercises)
        .where(and(eq(workoutExercises.id, weId), isNull(workoutExercises.deletedAt)))
        .limit(1);
      if (row) inserted.push(row);
    }
    await setSupersetGroup(inserted.map((r) => r.id), supersetId);
  } catch (e) {
    // Roll back: soft-delete any partial inserts so the caller sees nothing.
    const now = new Date();
    for (const row of inserted) {
      await db
        .update(workoutExercises)
        .set({ deletedAt: now })
        .where(and(eq(workoutExercises.id, row.id), isNull(workoutExercises.deletedAt)));
    }
    throw e;
  }
  return { supersetId, workoutExercises: inserted };
}

/* ------------------------------------------------------------------ */
/* sets                                                                */
/* ------------------------------------------------------------------ */

export async function logSet(input: {
  workoutExerciseId: string;
  reps?: number;
  weightKg?: number;
  rpe?: number;
  rir?: number;
  durationSeconds?: number;
  distanceM?: number;
  completed?: boolean;
  notes?: string;
  setNumber?: number;
  /** true = warmup set: excluded from working volume and PR detection. */
  isWarmup?: boolean;
}): Promise<string> {
  assertRpeRir(input.rpe, input.rir);
  assertIntNonNegative(input.reps, 'reps');
  assertNonNegative(input.weightKg, 'weightKg');
  assertIntNonNegative(input.durationSeconds, 'durationSeconds');
  assertNonNegative(input.distanceM, 'distanceM');
  return withWriteLock(async () => {
    // The parent must be live: a set logged during a concurrent delete would
    // otherwise end up as live data under a tombstoned workout_exercise.
    const [parent] = await db
      .select({
        weDeletedAt: workoutExercises.deletedAt,
        wDeletedAt: workouts.deletedAt,
        exerciseId: workoutExercises.exerciseId,
        workoutId: workoutExercises.workoutId,
      })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
      .where(eq(workoutExercises.id, input.workoutExerciseId))
      .limit(1);
    if (!parent || parent.weDeletedAt !== null || parent.wDeletedAt !== null) {
      throw new RangeError('cannot log a set for a deleted workout exercise');
    }
    let setNumber = input.setNumber;
    if (setNumber === undefined) {
      const existing = await db
        .select({ setNumber: sets.setNumber })
        .from(sets)
        .where(and(eq(sets.workoutExerciseId, input.workoutExerciseId), isNull(sets.deletedAt)))
        .orderBy(desc(sets.setNumber))
        .limit(1);
      setNumber = existing.length > 0 ? existing[0].setNumber + 1 : 1;
    } else {
      const [collision] = await db
        .select({ id: sets.id })
        .from(sets)
        .where(
          and(
            eq(sets.workoutExerciseId, input.workoutExerciseId),
            eq(sets.setNumber, setNumber),
            isNull(sets.deletedAt),
          ),
        )
        .limit(1);
      if (collision) {
        throw new RangeError(`set number ${setNumber} is already taken for this exercise`);
      }
    }
    const values: NewLoggedSet = {
      workoutExerciseId: input.workoutExerciseId,
      setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      rpe: input.rpe,
      rir: input.rir,
      durationSeconds: input.durationSeconds,
      distanceM: input.distanceM,
      completed: input.completed ?? true,
      isWarmup: input.isWarmup ?? false,
      notes: input.notes,
    };
    const [row] = await db.insert(sets).values(values).returning({ id: sets.id });
    // P1b #10 — PR auto-detection: a completed set can set max_weight / est_1rm
    // records. Raw queries only here: withWriteLock must never be called
    // re-entrantly (deadlock — see its doc comment). Detection is best-effort:
    // a PR write must never break set logging (the set is primary data, the
    // PR is derived and can be recomputed).
    // Warmup sets (isWarmup = true) are excluded from PR detection.
    if (values.completed && !values.isWarmup) {
      const weightKg = values.weightKg ?? 0;
      const reps = values.reps ?? 0;
      if (weightKg > 0) {
        try {
          await maybeRecordPR({
            exerciseId: parent.exerciseId,
            workoutId: parent.workoutId,
            setId: row.id,
            kind: 'max_weight',
            value: weightKg,
            unit: 'kg',
          });
          if (reps > 0) {
            const epley = Math.round(weightKg * (1 + reps / 30) * 100) / 100;
            await maybeRecordPR({
              exerciseId: parent.exerciseId,
              workoutId: parent.workoutId,
              setId: row.id,
              kind: 'est_1rm',
              value: epley,
              unit: 'kg',
            });
          }
        } catch (e) {
          console.warn('[prs] auto-detection failed for set', row.id, e);
        }
      }
    }
    return row.id;
  });
}

/** Whitelisted patch — sync-identity columns (id, createdAt, …) can't be rewritten. */
export type SetPatch = Partial<
  Pick<
    LoggedSet,
    'reps' | 'weightKg' | 'rpe' | 'rir' | 'durationSeconds' | 'distanceM' | 'completed' | 'notes' | 'setNumber' | 'isWarmup'
  >
>;

/** Returns true for sets that count toward working volume and PR detection. */
export function isWorkingSet(s: { isWarmup?: boolean | null }): boolean {
  return s.isWarmup !== true;
}

/** Returns the updated row, or null if the set doesn't exist / is deleted. */
export async function updateSet(id: string, patch: SetPatch): Promise<LoggedSet | null> {
  assertRpeRir(patch.rpe, patch.rir);
  assertIntNonNegative(patch.reps, 'reps');
  assertNonNegative(patch.weightKg, 'weightKg');
  assertIntNonNegative(patch.durationSeconds, 'durationSeconds');
  assertNonNegative(patch.distanceM, 'distanceM');
  // Runtime pick: the SetPatch whitelist is compile-time only.
  const clean = pickSetPatch(patch);
  return withWriteLock(async () => {
    if (clean.setNumber !== undefined) {
      // Pre-check so callers get a domain error, not a raw UNIQUE failure.
      const [row] = await db
        .select({ workoutExerciseId: sets.workoutExerciseId })
        .from(sets)
        .where(eq(sets.id, id))
        .limit(1);
      if (row) {
        const [collision] = await db
          .select({ id: sets.id })
          .from(sets)
          .where(
            and(
              eq(sets.workoutExerciseId, row.workoutExerciseId),
              eq(sets.setNumber, clean.setNumber),
              isNull(sets.deletedAt),
              ne(sets.id, id),
            ),
          )
          .limit(1);
        if (collision) {
          throw new RangeError(`set number ${clean.setNumber} is already taken for this exercise`);
        }
      }
    }
    const [updated] = await db
      .update(sets)
      .set(clean)
      .where(and(eq(sets.id, id), isNull(sets.deletedAt)))
      .returning();
    return updated ?? null;
  });
}

const SET_PATCH_KEYS = [
  'reps',
  'weightKg',
  'rpe',
  'rir',
  'durationSeconds',
  'distanceM',
  'completed',
  'notes',
  'setNumber',
  'isWarmup',
] as const;

/** Strips any non-whitelisted keys a JS caller might pass. */
function pickSetPatch(patch: SetPatch): SetPatch {
  const clean: Record<string, unknown> = {};
  for (const key of SET_PATCH_KEYS) {
    if (patch[key] !== undefined) clean[key] = patch[key];
  }
  return clean as SetPatch;
}

export async function softDeleteSet(id: string): Promise<void> {
  return withWriteLock(async () => {
    const [target] = await db
      .select({ workoutExerciseId: sets.workoutExerciseId })
      .from(sets)
      .where(and(eq(sets.id, id), isNull(sets.deletedAt)))
      .limit(1);
    await db
      .update(sets)
      .set({ deletedAt: new Date() })
      .where(and(eq(sets.id, id), isNull(sets.deletedAt)));
    // Keep set numbers contiguous (1..n) so the list always reads
    // "Set 1, Set 2, …" after a delete. Walking in ascending order only ever
    // moves a number DOWN into a slot that was just vacated, so the partial
    // unique index (workout_exercise_id, set_number) is never violated.
    if (target) {
      const live = await db
        .select({ id: sets.id, setNumber: sets.setNumber })
        .from(sets)
        .where(and(eq(sets.workoutExerciseId, target.workoutExerciseId), isNull(sets.deletedAt)))
        .orderBy(asc(sets.setNumber));
      for (let i = 0; i < live.length; i++) {
        if (live[i].setNumber !== i + 1) {
          await db.update(sets).set({ setNumber: i + 1 }).where(eq(sets.id, live[i].id));
        }
      }
    }
    // PRs derived from this set die with it (e.g. a mistyped 500 kg PR).
    await db
      .update(personalRecords)
      .set({ deletedAt: new Date() })
      .where(and(eq(personalRecords.setId, id), isNull(personalRecords.deletedAt)));
  });
}

export interface PreviousPerformance {
  workoutExercise: WorkoutExercise;
  workout: Workout;
  sets: LoggedSet[];
}

/**
 * "Last time" for an exercise: the most recent OTHER workout's entry for this
 * exercise that has at least one live set, with its sets. The logging UI
 * always passes the current workout id so it never compares against itself.
 * Deterministic: newest workout first, then lowest position within it.
 */
export async function getPreviousPerformance(
  exerciseId: string,
  excludeWorkoutId: string,
): Promise<PreviousPerformance | null> {
  // Page through candidates newest-first until one with live sets is found.
  // (The newest entries may belong to abandoned/emptied workouts.)
  const pageSize = 10;
  for (let offset = 0; ; offset += pageSize) {
    const candidates = await db
      .select({ we: workoutExercises, w: workouts })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
      .where(
        and(
          eq(workoutExercises.exerciseId, exerciseId),
          ne(workoutExercises.workoutId, excludeWorkoutId),
          isNull(workoutExercises.deletedAt),
          isNull(workouts.deletedAt),
        ),
      )
      .orderBy(desc(workouts.startedAt), asc(workoutExercises.position))
      .limit(pageSize)
      .offset(offset);
    if (candidates.length === 0) return null;
    for (const row of candidates) {
      const setRows = await db
        .select()
        .from(sets)
        .where(and(eq(sets.workoutExerciseId, row.we.id), isNull(sets.deletedAt)))
        .orderBy(asc(sets.setNumber));
      if (setRows.length > 0) {
        return { workoutExercise: row.we, workout: row.w, sets: setRows };
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* exercises                                                           */
/* ------------------------------------------------------------------ */

export async function createCustomExercise(input: {
  name: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipment?: string[];
  category?: ExerciseCategory;
  instructions?: string;
  longevityPillars?: LongevityPillar[];
}): Promise<string> {
  if (input.category !== undefined) assertCategory(input.category);
  return withWriteLock(async () => {
    const [row] = await db
      .insert(exercises)
      .values({
        name: input.name,
        primaryMuscles: JSON.stringify(input.primaryMuscles ?? []),
        secondaryMuscles: JSON.stringify(input.secondaryMuscles ?? []),
        equipment: JSON.stringify(input.equipment ?? []),
        category: input.category ?? 'strength',
        instructions: input.instructions,
        longevityPillars: encodePillars(input.longevityPillars ?? []),
        isCustom: true,
      })
      .returning({ id: exercises.id });
    return row.id;
  });
}

/**
 * Insert-or-update for KB snapshot imports (P2). Matches on the permanent
 * kb_id; never duplicates a seeded exercise. Never resurrects a user-deleted
 * exercise, and skips the write entirely when the KB version is unchanged
 * (avoids churning updated_at on every sync).
 */
export async function upsertKbExercise(input: {
  kbId: string;
  kbVersion: string;
  name: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipment?: string[];
  category?: ExerciseCategory;
  instructions?: string;
  mediaImageUrl?: string;
  mediaVideoUrl?: string;
  longevityPillars?: LongevityPillar[];
  kbCategory?: string;
  kbDetailJson?: string;
}): Promise<string> {
  if (input.category !== undefined) assertCategory(input.category);
  assertKbMediaUrl(input.mediaImageUrl, 'mediaImageUrl');
  assertKbMediaUrl(input.mediaVideoUrl, 'mediaVideoUrl');
  return withWriteLock(async () => {
    const [existing] = await db.select().from(exercises).where(eq(exercises.kbId, input.kbId));
    // drizzle .set() drops undefined keys, so nullable fields use ?? null:
    // a KB update that removes instructions/media must clear the stale value.
    const values = {
      name: input.name,
      primaryMuscles: JSON.stringify(input.primaryMuscles ?? []),
      secondaryMuscles: JSON.stringify(input.secondaryMuscles ?? []),
      equipment: JSON.stringify(input.equipment ?? []),
      category: input.category ?? 'strength',
      kbCategory: input.kbCategory ?? null,
      instructions: input.instructions ?? null,
      mediaImageUrl: input.mediaImageUrl ?? null,
      mediaVideoUrl: input.mediaVideoUrl ?? null,
      longevityPillars: encodePillars(input.longevityPillars ?? []),
      kbVersion: input.kbVersion,
      kbDetailJson: input.kbDetailJson ?? null,
      isCustom: false,
    };
    if (existing) {
      // Full content comparison: only write when something actually changed,
      // so a bundle bump doesn't churn updated_at on every seeded row (which
      // a future sync layer would read as "locally modified").
      const unchanged = (Object.keys(values) as (keyof typeof values)[]).every(
        (k) => (existing as unknown as Record<string, unknown>)[k] === values[k],
      );
      if (unchanged) return existing.id;
      // Never rewrite tombstones: a user-deleted exercise stays deleted.
      await db
        .update(exercises)
        .set(values)
        .where(and(eq(exercises.id, existing.id), isNull(exercises.deletedAt)));
      return existing.id;
    }
    // Deterministic PK: the permanent kb_id IS the row id for seeded rows.
    // A random UUID per device would force FK remapping when a future sync
    // layer merges two devices — this is the key migration the sync-ready
    // rule exists to prevent. Custom rows keep UUIDv4 (see newId()).
    const [row] = await db
      .insert(exercises)
      .values({ id: input.kbId, kbId: input.kbId, ...values })
      .returning({ id: exercises.id });
    return row.id;
  });
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const [row] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, id), isNull(exercises.deletedAt)));
  return row ?? null;
}

/** Name search for the exercise picker; LIKE metacharacters are escaped. */
export async function searchExercises(query: string, limit = 50): Promise<Exercise[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const escaped = trimmed.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return db
    .select()
    .from(exercises)
    .where(and(sql`${exercises.name} LIKE ${`%${escaped}%`} ESCAPE '\\'`, isNull(exercises.deletedAt)))
    .orderBy(asc(exercises.name))
    .limit(limit);
}

export async function listExercises(filter?: {
  category?: ExerciseCategory;
  customOnly?: boolean;
  /** Caps the rows returned (the exercise picker pages the library). */
  limit?: number;
}): Promise<Exercise[]> {
  assertIntNonNegative(filter?.limit, 'limit');
  const conditions = [isNull(exercises.deletedAt)];
  if (filter?.category) conditions.push(eq(exercises.category, filter.category));
  if (filter?.customOnly) conditions.push(eq(exercises.isCustom, true));
  const base = db
    .select()
    .from(exercises)
    .where(and(...conditions))
    .orderBy(asc(exercises.name));
  if (filter?.limit != null) return base.limit(filter.limit);
  return base;
}

/* ------------------------------------------------------------------ */
/* routines                                                            */
/* ------------------------------------------------------------------ */

export interface RoutineDetail {
  routine: Routine;
  items: Array<{ routineExercise: RoutineExercise; exercise: Exercise }>;
}

export async function createRoutine(input: {
  name: string;
  notes?: string;
  estimatedMinutes?: number;
  longevityPillars?: LongevityPillar[];
}): Promise<string> {
  assertIntNonNegative(input.estimatedMinutes, 'estimatedMinutes');
  return withWriteLock(async () => {
    const values: NewRoutine = {
      name: input.name,
      notes: input.notes,
      estimatedMinutes: input.estimatedMinutes,
      longevityPillars: encodePillars(input.longevityPillars ?? []),
    };
    const [row] = await db.insert(routines).values(values).returning({ id: routines.id });
    return row.id;
  });
}

export async function getRoutine(id: string): Promise<RoutineDetail | null> {
  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, id), isNull(routines.deletedAt)));
  if (!routine) return null;

  const items = await db
    .select()
    .from(routineExercises)
    .where(and(eq(routineExercises.routineId, id), isNull(routineExercises.deletedAt)))
    .orderBy(asc(routineExercises.position));
  if (items.length === 0) return { routine, items: [] };

  const exerciseIds = [...new Set(items.map((i) => i.exerciseId))];
  // Include soft-deleted exercises so templates stay complete and honest.
  const exerciseRows = await db.select().from(exercises).where(inArray(exercises.id, exerciseIds));
  const byId = new Map(exerciseRows.map((e) => [e.id, e]));

  return {
    routine,
    items: items.map((re) => ({
      routineExercise: re,
      exercise: byId.get(re.exerciseId) ?? deletedExercisePlaceholder(re.exerciseId),
    })),
  };
}

export async function listRoutines(): Promise<Routine[]> {
  return db
    .select()
    .from(routines)
    .where(isNull(routines.deletedAt))
    .orderBy(asc(routines.name));
}

export async function addRoutineExercise(input: {
  routineId: string;
  exerciseId: string;
  position?: number;
  targetSets?: number;
  targetReps?: string;
  targetWeightKg?: number;
  targetRpe?: number;
  targetRestSeconds?: number;
  notes?: string;
}): Promise<string> {
  if (input.targetRpe !== undefined) assertRpeRir(input.targetRpe, null);
  assertIntNonNegative(input.targetSets, 'targetSets');
  assertNonNegative(input.targetWeightKg, 'targetWeightKg');
  assertIntNonNegative(input.targetRestSeconds, 'targetRestSeconds');
  assertIntNonNegative(input.position, 'position');
  return withWriteLock(async () => {
    // The routine and the exercise must both be live.
    const [routine] = await db
      .select({ id: routines.id })
      .from(routines)
      .where(and(eq(routines.id, input.routineId), isNull(routines.deletedAt)))
      .limit(1);
    if (!routine) {
      throw new RangeError('cannot add an exercise to a deleted routine');
    }
    const [exercise] = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.id, input.exerciseId), isNull(exercises.deletedAt)))
      .limit(1);
    if (!exercise) {
      throw new RangeError('cannot add a deleted exercise to a routine');
    }
    let position = input.position;
    if (position === undefined) {
      const existing = await db
        .select({ position: routineExercises.position })
        .from(routineExercises)
        .where(and(eq(routineExercises.routineId, input.routineId), isNull(routineExercises.deletedAt)))
        .orderBy(desc(routineExercises.position))
        .limit(1);
      position = existing.length > 0 ? existing[0].position + 1 : 0;
    } else {
      const [collision] = await db
        .select({ id: routineExercises.id })
        .from(routineExercises)
        .where(
          and(
            eq(routineExercises.routineId, input.routineId),
            eq(routineExercises.position, position),
            isNull(routineExercises.deletedAt),
          ),
        )
        .limit(1);
      if (collision) {
        throw new RangeError(`position ${position} is already taken in this routine`);
      }
    }
    const values: NewRoutineExercise = {
      routineId: input.routineId,
      exerciseId: input.exerciseId,
      position,
      targetSets: input.targetSets,
      targetReps: input.targetReps,
      targetWeightKg: input.targetWeightKg,
      targetRpe: input.targetRpe,
      targetRestSeconds: input.targetRestSeconds,
      notes: input.notes,
    };
    const [row] = await db.insert(routineExercises).values(values).returning({ id: routineExercises.id });
    return row.id;
  });
}

/** Soft-deletes the routine and its template items. */
export async function softDeleteRoutine(id: string): Promise<void> {
  return withWriteLock(async () => {
    const now = new Date();
    await runInTransaction(async () => {
      await db
        .update(routineExercises)
        .set({ deletedAt: now })
        .where(and(eq(routineExercises.routineId, id), isNull(routineExercises.deletedAt)));
      await db
        .update(routines)
        .set({ deletedAt: now })
        .where(and(eq(routines.id, id), isNull(routines.deletedAt)));
    });
  });
}

/**
 * Starts a workout from a routine template: copies the template items into
 * workout_exercises (targets become the rest-timer defaults; sets are
 * logged fresh by the user). Template items pointing at soft-deleted
 * exercises are skipped — starting a workout must never resurrect them.
 * Returns null when the routine doesn't exist or has no live exercises.
 */
export async function startWorkoutFromRoutine(routineId: string, name?: string): Promise<string | null> {
  return withWriteLock(async () => {
    // Double-tap guard: starting the same routine twice within 60 seconds
    // returns the first workout instead of creating a duplicate.
    // gt() (not a sql template) so the column's timestamp_ms encoder applies.
    const [recent] = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(
        and(
          eq(workouts.routineId, routineId),
          isNull(workouts.endedAt),
          isNull(workouts.deletedAt),
          gt(workouts.startedAt, new Date(Date.now() - 60_000)),
        ),
      )
      .orderBy(desc(workouts.startedAt))
      .limit(1);
    if (recent) return recent.id;

    const detail = await getRoutine(routineId);
    if (!detail) return null;
    const liveItems = detail.items.filter((i) => i.exercise.deletedAt === null);
    if (liveItems.length === 0) return null;
    return runInTransaction(async () => {
      const [workout] = await db
        .insert(workouts)
        .values({
          name: name ?? detail.routine.name,
          startedAt: new Date(),
          routineId,
          longevityPillars: detail.routine.longevityPillars,
        })
        .returning({ id: workouts.id });
      for (const item of liveItems) {
        await db.insert(workoutExercises).values({
          workoutId: workout.id,
          exerciseId: item.exercise.id,
          position: item.routineExercise.position,
          restSeconds: item.routineExercise.targetRestSeconds,
          notes: item.routineExercise.notes,
        });
      }
      return workout.id;
    });
  });
}

/**
 * Swap the exercise for a workout exercise: creates a new row with the new
 * exercise at the same position, re-parents all live sets, copies settings,
 * and soft-deletes the old row. All inside a transaction.
 */
export async function swapWorkoutExercise(
  workoutExerciseId: string,
  newExerciseId: string,
): Promise<string> {
  return withWriteLock(async () => {
    return runInTransaction(async () => {
      const [oldRow] = await db
        .select({
          id: workoutExercises.id,
          workoutId: workoutExercises.workoutId,
          position: workoutExercises.position,
          notes: workoutExercises.notes,
          restSeconds: workoutExercises.restSeconds,
          unitPreference: workoutExercises.unitPreference,
          supersetId: workoutExercises.supersetId,
          autoProgression: workoutExercises.autoProgression,
          exerciseId: workoutExercises.exerciseId,
        })
        .from(workoutExercises)
        .where(and(eq(workoutExercises.id, workoutExerciseId), isNull(workoutExercises.deletedAt)))
        .limit(1);
      if (!oldRow) {
        throw new RangeError('workout exercise not found');
      }
      if (oldRow.exerciseId === newExerciseId) {
        throw new RangeError('cannot swap to the same exercise');
      }
      const [newExercise] = await db
        .select({ id: exercises.id })
        .from(exercises)
        .where(and(eq(exercises.id, newExerciseId), isNull(exercises.deletedAt)))
        .limit(1);
      if (!newExercise) {
        throw new RangeError('new exercise not found');
      }
      // Soft-delete old row first to free the position (partial unique index).
      const now = new Date();
      await db
        .update(workoutExercises)
        .set({ deletedAt: now })
        .where(and(eq(workoutExercises.id, oldRow.id), isNull(workoutExercises.deletedAt)));
      // Create new row at same position.
      const [newRow] = await db
        .insert(workoutExercises)
        .values({
          workoutId: oldRow.workoutId,
          exerciseId: newExerciseId,
          position: oldRow.position,
          notes: oldRow.notes,
          restSeconds: oldRow.restSeconds,
          unitPreference: oldRow.unitPreference,
          supersetId: oldRow.supersetId,
          autoProgression: oldRow.autoProgression,
        })
        .returning({ id: workoutExercises.id });
      const newWorkoutExerciseId = newRow.id;
      // Re-parent all live sets from old row to new row.
      await db
        .update(sets)
        .set({ workoutExerciseId: newWorkoutExerciseId })
        .where(
          and(
            eq(sets.workoutExerciseId, oldRow.id),
            isNull(sets.deletedAt),
          ),
        );
      return newWorkoutExerciseId;
    });
  });
}

/**
 * Pure helper: build the insert values for the new workout_exercises row
 * during a swap. Exercised by tests without a DB.
 */
export function buildSwapWorkoutExerciseValues(input: {
  workoutId: string;
  exerciseId: string;
  position: number;
  notes: string | null;
  restSeconds: number | null;
  unitPreference: string | null;
  supersetId: string | null;
  autoProgression: boolean | null;
}) {
  return {
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    position: input.position,
    notes: input.notes,
    restSeconds: input.restSeconds,
    unitPreference: input.unitPreference,
    supersetId: input.supersetId,
    autoProgression: input.autoProgression,
  };
}

/* ------------------------------------------------------------------ */
/* measurements                                                        */

export async function logMeasurement(input: {
  type: string;
  value: number;
  unit: string;
  measuredAt?: Date;
  notes?: string;
}): Promise<string> {
  assertFinite(input.value, 'value');
  assertValidDate(input.measuredAt, 'measuredAt');
  return withWriteLock(async () => {
    const values: NewMeasurement = {
      type: input.type,
      value: input.value,
      unit: input.unit,
      measuredAt: input.measuredAt ?? new Date(),
      notes: input.notes,
    };
    const [row] = await db.insert(measurements).values(values).returning({ id: measurements.id });
    return row.id;
  });
}

export async function getLatestMeasurement(type: string): Promise<Measurement | null> {
  const [row] = await db
    .select()
    .from(measurements)
    .where(and(eq(measurements.type, type), isNull(measurements.deletedAt)))
    .orderBy(desc(measurements.measuredAt))
    .limit(1);
  return row ?? null;
}

export async function listMeasurements(type: string, limit = 100): Promise<Measurement[]> {
  return db
    .select()
    .from(measurements)
    .where(and(eq(measurements.type, type), isNull(measurements.deletedAt)))
    .orderBy(desc(measurements.measuredAt))
    .limit(limit);
}

export async function softDeleteMeasurement(id: string): Promise<void> {
  return withWriteLock(async () => {
    await db
      .update(measurements)
      .set({ deletedAt: new Date() })
      .where(and(eq(measurements.id, id), isNull(measurements.deletedAt)));
  });
}

/* ------------------------------------------------------------------ */
/* personal_records                                                    */
/* ------------------------------------------------------------------ */

export async function recordPR(input: {
  exerciseId: string;
  kind: string;
  value: number;
  unit: string;
  achievedAt?: Date;
  workoutId?: string;
  setId?: string;
  previousValue?: number;
}): Promise<string> {
  assertFinite(input.value, 'value');
  assertFinite(input.previousValue, 'previousValue');
  assertValidDate(input.achievedAt, 'achievedAt');
  return withWriteLock(async () => {
    const values: NewPersonalRecord = {
      exerciseId: input.exerciseId,
      kind: input.kind,
      value: input.value,
      unit: input.unit,
      achievedAt: input.achievedAt ?? new Date(),
      workoutId: input.workoutId,
      setId: input.setId,
      previousValue: input.previousValue,
    };
    const [row] = await db.insert(personalRecords).values(values).returning({ id: personalRecords.id });
    return row.id;
  });
}

/**
 * P1b #10 — records a PR row when `value` beats the standing best for
 * (exerciseId, kind). Compares against MAX(value): PR rows are only written
 * when beaten, so the max is the record regardless of tombstone history.
 *
 * Raw queries only — MUST be called from inside an existing withWriteLock
 * (e.g. logSet's auto-detection). Calling the withWriteLock-wrapped
 * recordPR/getLatestPR here would deadlock.
 */
async function maybeRecordPR(input: {
  exerciseId: string;
  workoutId?: string;
  setId?: string;
  kind: string;
  value: number;
  unit: string;
}): Promise<void> {
  const [best] = await db
    .select({ value: personalRecords.value })
    .from(personalRecords)
    .where(
      and(
        eq(personalRecords.exerciseId, input.exerciseId),
        eq(personalRecords.kind, input.kind),
        isNull(personalRecords.deletedAt),
      ),
    )
    .orderBy(desc(personalRecords.value))
    .limit(1);
  const prev = best?.value;
  if (prev !== undefined && input.value <= prev) return;
  await db.insert(personalRecords).values({
    exerciseId: input.exerciseId,
    kind: input.kind,
    value: input.value,
    unit: input.unit,
    achievedAt: new Date(),
    workoutId: input.workoutId,
    setId: input.setId,
    previousValue: prev,
  });
}

export interface PRWithExercise extends PersonalRecord {
  exerciseName: string;
}

/**
 * P1b #10 — every live PR with its exercise name, newest first.
 * Read-only; no write lock needed.
 */
export async function listPRsWithExercises(): Promise<PRWithExercise[]> {
  const rows = await db
    .select({ pr: personalRecords, exerciseName: exercises.name })
    .from(personalRecords)
    .innerJoin(exercises, eq(personalRecords.exerciseId, exercises.id))
    .where(isNull(personalRecords.deletedAt))
    .orderBy(desc(personalRecords.achievedAt));
  return rows.map((r) => ({ ...r.pr, exerciseName: r.exerciseName }));
}

export async function getPRsForExercise(exerciseId: string): Promise<PersonalRecord[]> {
  return db
    .select()
    .from(personalRecords)
    .where(and(eq(personalRecords.exerciseId, exerciseId), isNull(personalRecords.deletedAt)))
    .orderBy(desc(personalRecords.achievedAt));
}

export async function getLatestPR(exerciseId: string, kind: string): Promise<PersonalRecord | null> {
  const [row] = await db
    .select()
    .from(personalRecords)
    .where(
      and(
        eq(personalRecords.exerciseId, exerciseId),
        eq(personalRecords.kind, kind),
        isNull(personalRecords.deletedAt),
      ),
    )
    .orderBy(desc(personalRecords.achievedAt))
    .limit(1);
  return row ?? null;
}

export async function softDeletePR(id: string): Promise<void> {
  return withWriteLock(async () => {
    await db
      .update(personalRecords)
      .set({ deletedAt: new Date() })
      .where(and(eq(personalRecords.id, id), isNull(personalRecords.deletedAt)));
  });
}
