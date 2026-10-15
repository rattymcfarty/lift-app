/**
 * User-created exercises: edit and delete. (Creation lives in
 * repositories.createCustomExercise so the in-workout composer and the
 * standalone form share one code path.)
 *
 * Only rows with isCustom = true are ever touched — catalogue exercises
 * are owned by the knowledge base and are replaced on sync.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { exercises, routineExercises, type ExerciseCategory, EXERCISE_CATEGORIES } from '../db/schema';
import { withWriteLock } from './repositories';

export interface CustomExercisePatch {
  name?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipment?: string[];
  category?: ExerciseCategory;
  instructions?: string;
}

export async function updateCustomExercise(id: string, patch: CustomExercisePatch): Promise<void> {
  if (patch.name !== undefined && patch.name.trim() === '') {
    throw new RangeError('Exercise name cannot be empty.');
  }
  if (patch.category !== undefined && !EXERCISE_CATEGORIES.includes(patch.category)) {
    throw new RangeError(`Unknown category: ${patch.category}`);
  }
  await withWriteLock(async () => {
    const rows = await db
      .update(exercises)
      .set({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.primaryMuscles !== undefined ? { primaryMuscles: JSON.stringify(patch.primaryMuscles) } : {}),
        ...(patch.secondaryMuscles !== undefined ? { secondaryMuscles: JSON.stringify(patch.secondaryMuscles) } : {}),
        ...(patch.equipment !== undefined ? { equipment: JSON.stringify(patch.equipment) } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.instructions !== undefined ? { instructions: patch.instructions } : {}),
      })
      .where(and(eq(exercises.id, id), eq(exercises.isCustom, true), isNull(exercises.deletedAt)))
      .returning({ id: exercises.id });
    if (rows.length === 0) throw new RangeError('Only your own exercises can be edited.');
  });
}

/** Number of live plan entries that use this exercise. */
export async function countPlanUses(exerciseId: string): Promise<number> {
  const rows = await db
    .select({ id: routineExercises.id })
    .from(routineExercises)
    .where(and(eq(routineExercises.exerciseId, exerciseId), isNull(routineExercises.deletedAt)));
  return rows.length;
}

/**
 * Soft-deletes a custom exercise. Refused while a plan still uses it, so a
 * plan never ends up with a hole in it; logged history keeps working
 * because the row is tombstoned, not removed.
 */
export async function deleteCustomExercise(id: string): Promise<void> {
  const uses = await countPlanUses(id);
  if (uses > 0) {
    throw new RangeError(
      `This exercise is used in ${uses} plan entr${uses === 1 ? 'y' : 'ies'}. Remove it from your plans first.`,
    );
  }
  await withWriteLock(async () => {
    const rows = await db
      .update(exercises)
      .set({ deletedAt: new Date() })
      .where(and(eq(exercises.id, id), eq(exercises.isCustom, true), isNull(exercises.deletedAt)))
      .returning({ id: exercises.id });
    if (rows.length === 0) throw new RangeError('Only your own exercises can be deleted.');
  });
}
