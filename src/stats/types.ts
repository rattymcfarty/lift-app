/**
 * Stats layer shared types (P4a) — pure, no DB, no UI.
 *
 * The stats pipeline is two stages:
 *   1. `queries.ts` fetches `StatWorkout[]` from SQLite (thin DB wrappers).
 *   2. The pure functions in volume.ts / frequency.ts / strength.ts /
 *      consistency.ts aggregate them. These are unit-tested without a DB.
 */

/** One logged set, flattened with its exercise context. */
export interface StatSet {
  exerciseId: string;
  exerciseName: string;
  /** Parsed from exercises.primary_muscles (JSON array). */
  primaryMuscles: string[];
  /** Exercise category, mirroring EXERCISE_CATEGORIES in db/schema.ts
   * (duplicated here so this pure module stays DB-free). */
  exerciseCategory: 'strength' | 'cardio' | 'mobility' | 'balance' | 'other';
  reps: number | null;
  weightKg: number | null;
  /** Cardio set duration in seconds (null when not tracked). */
  durationSeconds: number | null;
  /** false = planned but skipped — excluded from volume/strength. */
  completed: boolean;
  /** true = warmup set: excluded from working volume and PR detection. */
  isWarmup: boolean;
}

/** One finished workout with its sets. */
export interface StatWorkout {
  id: string;
  startedAt: Date;
  endedAt: Date;
  sets: StatSet[];
}

/** Weekly bucket used by volume/frequency series. */
export interface WeekBucket {
  /** Monday 00:00 local time starting the week. */
  weekStart: Date;
  volumeKg: number;
  workouts: number;
}
