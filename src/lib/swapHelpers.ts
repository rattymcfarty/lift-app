/**
 * Pure swap helpers — extracted so they can be unit-tested without the
 * expo-sqlite native dependency. The DB-touching `swapWorkoutExercise`
 * lives in repositories.ts and is exercised by E2E.
 */

export interface SwapWorkoutExerciseValues {
  workoutId: string;
  exerciseId: string;
  position: number;
  notes: string | null;
  restSeconds: number | null;
  unitPreference: string | null;
  supersetId: string | null;
  autoProgression: boolean | null;
}

/**
 * Builds the insert values for the new workout_exercises row during a swap.
 * Mirrors what swapWorkoutExercise() passes to db.insert(workoutExercises).
 */
export function buildSwapWorkoutExerciseValues(input: SwapWorkoutExerciseValues): SwapWorkoutExerciseValues {
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