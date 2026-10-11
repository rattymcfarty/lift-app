/**
 * Routine-template management (P1b #7).
 *
 * The core routine CRUD lives in ./repositories (createRoutine, getRoutine,
 * listRoutines, addRoutineExercise, softDeleteRoutine, startWorkoutFromRoutine).
 * This module adds the management operations the routine builder needs:
 * rename/update, target editing, item removal, reorder, and list stats.
 *
 * Deliberately a separate module rather than appended to repositories.ts:
 * parallel workstreams push whole files, so sharing that file would let one
 * push clobber the other's additions. The small assertion helpers are
 * duplicated here for the same reason.
 *
 * Conventions mirror repositories.ts: soft deletes (tombstones kept),
 * all writes through the global write lock, canonical units (kg, seconds).
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, runInTransaction } from '../db/client';
import {
  encodePillars,
  routineExercises,
  routines,
  workouts,
  type LongevityPillar,
  type Routine,
  type RoutineExercise,
} from '../db/schema';
import { getRoutine, listRoutines, withWriteLock } from './repositories';

/* ------------------------------------------------------------------ */
/* internal assertions (duplicated from repositories.ts — see above)   */
/* ------------------------------------------------------------------ */

function assertRpe(rpe?: number | null): void {
  if (rpe !== undefined && rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) {
    throw new RangeError(`rpe out of range 1–10: ${rpe}`);
  }
}

function assertNonNegative(value: number | null | undefined, field: string): void {
  if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new RangeError(`${field} must be a finite non-negative number: ${value}`);
  }
}

function assertIntNonNegative(value: number | null | undefined, field: string): void {
  if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new RangeError(`${field} must be a non-negative integer: ${value}`);
  }
}

/* ------------------------------------------------------------------ */
/* update                                                              */
/* ------------------------------------------------------------------ */

export type RoutinePatch = Partial<Pick<Routine, 'name' | 'notes' | 'estimatedMinutes'>> & {
  longevityPillars?: LongevityPillar[];
};

/** Returns the updated row, or null if the routine doesn't exist / is deleted. */
export async function updateRoutine(id: string, patch: RoutinePatch): Promise<Routine | null> {
  if (patch.name !== undefined && patch.name.trim() === '') {
    throw new RangeError('routine name cannot be empty');
  }
  assertIntNonNegative(patch.estimatedMinutes, 'estimatedMinutes');
  // Runtime pick: the whitelist is compile-time only, so strip anything
  // extra a JS caller might smuggle in (id, createdAt, …).
  const { name, notes, estimatedMinutes, longevityPillars } = patch;
  return withWriteLock(async () => {
    const [row] = await db
      .update(routines)
      .set({
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
        ...(longevityPillars !== undefined
          ? { longevityPillars: encodePillars(longevityPillars) }
          : {}),
      })
      .where(and(eq(routines.id, id), isNull(routines.deletedAt)))
      .returning();
    return row ?? null;
  });
}

export type RoutineExercisePatch = Partial<
  Pick<
    RoutineExercise,
    'targetSets' | 'targetReps' | 'targetWeightKg' | 'targetRpe' | 'targetRestSeconds' | 'notes'
  >
>;

/** Returns the updated template item, or null if it doesn't exist / is deleted. */
export async function updateRoutineExercise(
  id: string,
  patch: RoutineExercisePatch,
): Promise<RoutineExercise | null> {
  assertIntNonNegative(patch.targetSets, 'targetSets');
  assertNonNegative(patch.targetWeightKg, 'targetWeightKg');
  assertRpe(patch.targetRpe);
  assertIntNonNegative(patch.targetRestSeconds, 'targetRestSeconds');
  const { targetSets, targetReps, targetWeightKg, targetRpe, targetRestSeconds, notes } = patch;
  return withWriteLock(async () => {
    const [row] = await db
      .update(routineExercises)
      .set({
        ...(targetSets !== undefined ? { targetSets } : {}),
        // Free text ("8-12"); trim so " 8-12 " doesn't accumulate whitespace.
        ...(targetReps !== undefined
          ? { targetReps: targetReps === null ? null : targetReps.trim() || null }
          : {}),
        ...(targetWeightKg !== undefined ? { targetWeightKg } : {}),
        ...(targetRpe !== undefined ? { targetRpe } : {}),
        ...(targetRestSeconds !== undefined ? { targetRestSeconds } : {}),
        ...(notes !== undefined ? { notes } : {}),
      })
      .where(and(eq(routineExercises.id, id), isNull(routineExercises.deletedAt)))
      .returning();
    return row ?? null;
  });
}

/** Soft-deletes a single template item (the routine itself is untouched). */
export async function removeRoutineExercise(id: string): Promise<void> {
  return withWriteLock(async () => {
    await db
      .update(routineExercises)
      .set({ deletedAt: new Date() })
      .where(and(eq(routineExercises.id, id), isNull(routineExercises.deletedAt)));
  });
}

/**
 * Reorders a routine's template items. orderedIds must contain exactly the
 * live item ids for this routine. Two-pass negative-position update (same
 * trick as reorderWorkoutExercises) so no transient position collision can
 * violate ordering while the rows are being rewritten.
 */
export async function reorderRoutineExercises(
  routineId: string,
  orderedIds: string[],
): Promise<void> {
  return withWriteLock(async () => {
    const live = await db
      .select({ id: routineExercises.id })
      .from(routineExercises)
      .where(and(eq(routineExercises.routineId, routineId), isNull(routineExercises.deletedAt)));
    const liveIds = new Set(live.map((r) => r.id));
    if (orderedIds.length !== liveIds.size || !orderedIds.every((id) => liveIds.has(id))) {
      throw new RangeError('orderedIds must contain exactly the live routine-exercise ids for this routine');
    }
    await runInTransaction(async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(routineExercises)
          .set({ position: -(i + 1) })
          .where(and(eq(routineExercises.id, orderedIds[i]), eq(routineExercises.routineId, routineId)));
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(routineExercises)
          .set({ position: i })
          .where(and(eq(routineExercises.id, orderedIds[i]), eq(routineExercises.routineId, routineId)));
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* list stats                                                           */
/* ------------------------------------------------------------------ */

export interface RoutineListItem {
  routine: Routine;
  exerciseCount: number;
  /** Most recent workout started from this routine, or null when never used. */
  lastUsedAt: Date | null;
}

/**
 * Routines for the list screen, each with its live exercise count and the
 * most recent workout started from it. Small-N fan-out (a template list is
 * dozens of rows at most) keeps this free of raw-SQL timestamp pitfalls.
 */
export async function listRoutinesWithStats(): Promise<RoutineListItem[]> {
  const all = await listRoutines();
  return Promise.all(
    all.map(async (routine) => {
      const detail = await getRoutine(routine.id);
      const [last] = await db
        .select({ startedAt: workouts.startedAt })
        .from(workouts)
        .where(and(eq(workouts.routineId, routine.id), isNull(workouts.deletedAt)))
        .orderBy(desc(workouts.startedAt))
        .limit(1);
      return {
        routine,
        exerciseCount: detail?.items.length ?? 0,
        lastUsedAt: last?.startedAt ?? null,
      };
    }),
  );
}
