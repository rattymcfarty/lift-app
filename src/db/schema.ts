import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { isNull, sql } from 'drizzle-orm';
import { newId } from './id';

/**
 * Sync-ready base columns. EVERY user-data table gets these from day one so a
 * future sync layer never needs a key migration:
 * - id:        UUID v4 text PK, generated client-side via crypto.getRandomValues (see ./id.ts)
 * - createdAt / updatedAt: millisecond epoch timestamps, auto-populated
 * - deletedAt: soft delete; NULL = live row. Sync tombstones, never drops.
 */
const syncBase = () => ({
  id: text('id')
    .primaryKey()
    .$defaultFn(() => newId()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

/* ------------------------------------------------------------------ */
/* Longevity pillars (R2)                                              */
/*                                                                     */
/* The v1 pillar model is strength + cardio (manual cardio minutes),   */
/* with mobility and balance reserved for the full pillar model (R14). */
/* Stored as JSON-encoded string arrays so pillars can grow without    */
/* schema migrations.                                                  */
/* ------------------------------------------------------------------ */

export const LONGEVITY_PILLARS = ['strength', 'cardio', 'mobility', 'balance'] as const;
export type LongevityPillar = (typeof LONGEVITY_PILLARS)[number];

/** Safely decode a JSON string array of pillar tags (never throws). */
export function decodePillars(json: string | null | undefined): LongevityPillar[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is LongevityPillar =>
      typeof p === 'string' && (LONGEVITY_PILLARS as readonly string[]).includes(p),
    );
  } catch {
    return [];
  }
}

export function encodePillars(pillars: LongevityPillar[]): string {
  return JSON.stringify(pillars);
}

/* ------------------------------------------------------------------ */
/* Exercise categories (KB taxonomy)                                   */
/* ------------------------------------------------------------------ */

export const EXERCISE_CATEGORIES = [
  'strength',
  'cardio',
  'mobility',
  'balance',
  'other',
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

/** Safely decode a JSON string array of plain strings (never throws). */
export function decodeStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* workouts — one training session                                     */
/* ------------------------------------------------------------------ */

export const workouts = sqliteTable(
  'workouts',
  {
    ...syncBase(),
    name: text('name').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    notes: text('notes'),
    /** R2: longevity pillar tags for this session, JSON-encoded. */
    longevityPillars: text('longevity_pillars').notNull().default('[]'),
    /** The routine template this workout was started from, if any. */
    routineId: text('routine_id').references(() => routines.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('workouts_updated_at_idx').on(t.updatedAt),
    index('workouts_deleted_at_idx').on(t.deletedAt),
    index('workouts_started_at_idx').on(t.startedAt),
  ],
);

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

/* ------------------------------------------------------------------ */
/* workout_exercises — join: which exercises were done in a workout    */
/* ------------------------------------------------------------------ */

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    ...syncBase(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    /** Order of the exercise within the workout (0-based). */
    position: integer('position').notNull(),
    notes: text('notes'),
    /** Per-exercise rest override in seconds (rest timer reads this). */
    restSeconds: integer('rest_seconds'),
  },
  (t) => [
    index('workout_exercises_workout_id_idx').on(t.workoutId),
    index('workout_exercises_workout_position_idx').on(t.workoutId, t.position),
    index('workout_exercises_exercise_id_idx').on(t.exerciseId),
    index('workout_exercises_updated_at_idx').on(t.updatedAt),
    index('workout_exercises_deleted_at_idx').on(t.deletedAt),
    // Partial: live rows can't share a position; tombstones don't collide.
    uniqueIndex('workout_exercises_workout_position_unique')
      .on(t.workoutId, t.position)
      .where(isNull(t.deletedAt)),
  ],
);

export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;

/* ------------------------------------------------------------------ */
/* sets — one logged set. Canonical units: kg, reps, seconds, meters.  */
/* RPE (1–10) and RIR (0–10) are the longevity-aware intensity fields  */
/* the programs engine (P3) caps for safe progression.                */
/* ------------------------------------------------------------------ */

export const sets = sqliteTable(
  'sets',
  {
    ...syncBase(),
    workoutExerciseId: text('workout_exercise_id')
      .notNull()
      .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    /** 1-based set number within the exercise. */
    setNumber: integer('set_number').notNull(),
    /** NULL for timed holds / cardio intervals. */
    reps: integer('reps'),
    /** Canonical kilograms; kg/lb display conversion happens in the UI. */
    weightKg: real('weight_kg'),
    /** Rate of Perceived Exertion, 1–10. */
    rpe: real('rpe'),
    /** Reps In Reserve, 0–10. */
    rir: integer('rir'),
    /** Timed sets / cardio intervals. */
    durationSeconds: integer('duration_seconds'),
    /** Cardio distance. */
    distanceM: real('distance_m'),
    /** false = planned but skipped (kept for program adherence tracking). */
    completed: integer('completed', { mode: 'boolean' }).notNull().default(true),
    notes: text('notes'),
  },
  (t) => [
    index('sets_workout_exercise_id_idx').on(t.workoutExerciseId),
    index('sets_workout_exercise_set_idx').on(t.workoutExerciseId, t.setNumber),
    index('sets_updated_at_idx').on(t.updatedAt),
    index('sets_deleted_at_idx').on(t.deletedAt),
    // Partial: live rows can't share a set number; tombstones don't collide.
    uniqueIndex('sets_workout_exercise_set_unique')
      .on(t.workoutExerciseId, t.setNumber)
      .where(isNull(t.deletedAt)),
  ],
);

export type LoggedSet = typeof sets.$inferSelect;
export type NewLoggedSet = typeof sets.$inferInsert;

/* ------------------------------------------------------------------ */
/* exercises — local cache of KB content + user-created exercises.     */
/* kb_id is the permanent KB identifier (never renamed); kb_version    */
/* records which bundle version seeded/updated the row (P2 snapshot    */
/* swap logic). Custom rows have kb_id NULL and is_custom = true.      */
/* ------------------------------------------------------------------ */

export const exercises = sqliteTable(
  'exercises',
  {
    ...syncBase(),
    name: text('name').notNull(),
    primaryMuscles: text('primary_muscles').notNull().default('[]'),
    secondaryMuscles: text('secondary_muscles').notNull().default('[]'),
    equipment: text('equipment').notNull().default('[]'),
    category: text('category').notNull().default('strength').$type<ExerciseCategory>(),
    /** KB prose cache (instructions / coaching cues). */
    instructions: text('instructions'),
    /** KB longevity lens prose (why this movement matters for healthspan). */
    longevityNotes: text('longevity_notes'),
    /** KB media URLs (lazy-loaded; cache the refs, not the bytes).
     * Privacy: media MUST come from the KB bundle's own hosting (same trust
     * domain as channel.json). Arbitrary per-exercise hosts would leak which
     * exercises the user opens, plus IP/timing, to a third party. */
    mediaImageUrl: text('media_image_url'),
    mediaVideoUrl: text('media_video_url'),
    /** R2: which longevity pillars this exercise serves, JSON-encoded. */
    longevityPillars: text('longevity_pillars').notNull().default('[]'),
    /** true = user-created; false = seeded from the KB snapshot. */
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
    /** Permanent KB exercise ID when seeded from lift-kb (never renamed). */
    kbId: text('kb_id').unique(),
    /** KB bundle version that seeded/updated this row. */
    kbVersion: text('kb_version'),
  },
  (t) => [
    index('exercises_updated_at_idx').on(t.updatedAt),
    index('exercises_deleted_at_idx').on(t.deletedAt),
    index('exercises_category_idx').on(t.category),
    index('exercises_is_custom_idx').on(t.isCustom),
  ],
);

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

/* ------------------------------------------------------------------ */
/* routines — saved workout templates (P1b schedules these)           */
/* ------------------------------------------------------------------ */

export const routines = sqliteTable(
  'routines',
  {
    ...syncBase(),
    name: text('name').notNull(),
    notes: text('notes'),
    estimatedMinutes: integer('estimated_minutes'),
    /** R2: pillar tags this routine targets, JSON-encoded. */
    longevityPillars: text('longevity_pillars').notNull().default('[]'),
    /** Permanent KB program-session ID when seeded from lift-kb (P2).
     * Format: "<program-id>--session-<day>". NULL = user-created. */
    kbId: text('kb_id').unique(),
    /** KB bundle version that seeded/updated this row. */
    kbVersion: text('kb_version'),
  },
  (t) => [
    index('routines_updated_at_idx').on(t.updatedAt),
    index('routines_deleted_at_idx').on(t.deletedAt),
  ],
);

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;

/* ------------------------------------------------------------------ */
/* routine_exercises — join: template items inside a routine           */
/* ------------------------------------------------------------------ */

export const routineExercises = sqliteTable(
  'routine_exercises',
  {
    ...syncBase(),
    routineId: text('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    position: integer('position').notNull(),
    targetSets: integer('target_sets'),
    /** Text to allow ranges like "8-12". */
    targetReps: text('target_reps'),
    targetWeightKg: real('target_weight_kg'),
    targetRpe: real('target_rpe'),
    targetRestSeconds: integer('target_rest_seconds'),
    notes: text('notes'),
  },
  (t) => [
    index('routine_exercises_routine_id_idx').on(t.routineId),
    index('routine_exercises_routine_position_idx').on(t.routineId, t.position),
    index('routine_exercises_updated_at_idx').on(t.updatedAt),
    index('routine_exercises_deleted_at_idx').on(t.deletedAt),
    // Partial: live rows can't share a position; tombstones don't collide.
    uniqueIndex('routine_exercises_routine_position_unique')
      .on(t.routineId, t.position)
      .where(isNull(t.deletedAt)),
  ],
);

export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;

/* ------------------------------------------------------------------ */
/* measurements — body metrics over time (P1b charts)                 */
/* type examples: body_weight, waist, body_fat_pct, resting_hr.        */
/* ------------------------------------------------------------------ */

export const measurements = sqliteTable(
  'measurements',
  {
    ...syncBase(),
    type: text('type').notNull(),
    value: real('value').notNull(),
    unit: text('unit').notNull(),
    measuredAt: integer('measured_at', { mode: 'timestamp_ms' }).notNull(),
    notes: text('notes'),
  },
  (t) => [
    index('measurements_type_measured_at_idx').on(t.type, t.measuredAt),
    index('measurements_updated_at_idx').on(t.updatedAt),
    index('measurements_deleted_at_idx').on(t.deletedAt),
  ],
);

export type Measurement = typeof measurements.$inferSelect;
export type NewMeasurement = typeof measurements.$inferInsert;

/* ------------------------------------------------------------------ */
/* personal_records — PRs per exercise (P1b). kind examples:           */
/* est_1rm, max_weight, max_reps, max_volume, longest_distance,        */
/* fastest_time. value is in canonical units for the kind.             */
/* ------------------------------------------------------------------ */

export const personalRecords = sqliteTable(
  'personal_records',
  {
    ...syncBase(),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    kind: text('kind').notNull(),
    value: real('value').notNull(),
    unit: text('unit').notNull(),
    achievedAt: integer('achieved_at', { mode: 'timestamp_ms' }).notNull(),
    /** Where it happened (nullable — PRs can be logged manually). */
    workoutId: text('workout_id').references(() => workouts.id, { onDelete: 'set null' }),
    setId: text('set_id').references(() => sets.id, { onDelete: 'set null' }),
    /** Previous best, for "+2.5 kg" messaging. */
    previousValue: real('previous_value'),
  },
  (t) => [
    index('personal_records_exercise_kind_idx').on(t.exerciseId, t.kind),
    index('personal_records_exercise_achieved_idx').on(t.exerciseId, t.achievedAt),
    index('personal_records_updated_at_idx').on(t.updatedAt),
    index('personal_records_deleted_at_idx').on(t.deletedAt),
  ],
);

export type PersonalRecord = typeof personalRecords.$inferSelect;
export type NewPersonalRecord = typeof personalRecords.$inferInsert;

/* ------------------------------------------------------------------ */
/* kb_sync_state — KB channel/bundle sync bookkeeping (P2).            */
/* Single row (id = 'kb'). Tracks which bundle version was imported    */
/* and when the channel was last checked, so the app can surface       */
/* "update available" without re-fetching. Not user data — excluded    */
/* from export (see backupDb.ts).                                      */
/* ------------------------------------------------------------------ */

export const kbSyncState = sqliteTable('kb_sync_state', {
  /** Always 'kb' — single-row table. */
  id: text('id').primaryKey(),
  /** Channel URL the state was fetched from. */
  channelUrl: text('channel_url'),
  /** Bundle version last successfully imported (channel.json `latest`). */
  bundleVersion: text('bundle_version'),
  /** Bundle sha256 last verified (channel.json `sha256`). */
  bundleSha256: text('bundle_sha256'),
  /** Epoch ms of the last channel check (success or fail). */
  checkedAt: integer('checked_at'),
  /** Epoch ms of the last successful import. */
  importedAt: integer('imported_at'),
});

export type KbSyncState = typeof kbSyncState.$inferSelect;
export type NewKbSyncState = typeof kbSyncState.$inferInsert;

/* ------------------------------------------------------------------ */
/* program_enrollments — P3 programs engine                            */
/*                                                                     */
/* One row per user enrollment in a training program. The `snapshot`   */
/* column freezes the full ProgramDefinition JSON at enroll time:      */
/* later edits to the program (KB bundle updates, local edits) NEVER   */
/* affect an in-flight enrollment — the snapshot is the source of      */
/* truth the progression engine (#13) reads.                           */
/*                                                                     */
/* Lifecycle: active → completed | abandoned. Rows are never           */
/* hard-deleted; history is kept. The partial unique index enforces    */
/* at most one ACTIVE enrollment per program (completed/abandoned      */
/* rows don't collide, so re-enrolling after finishing works).         */
/* ------------------------------------------------------------------ */

export const programEnrollments = sqliteTable(
  'program_enrollments',
  {
    ...syncBase(),
    /** DSL program id (KB program id, or local UUID). */
    programId: text('program_id').notNull(),
    /** KB program id when kb-sourced; NULL for local programs. */
    programKbId: text('program_kb_id'),
    /** KB bundle version frozen at enroll time (informational). */
    kbVersion: text('kb_version'),
    /** Frozen ProgramDefinition JSON — see src/programs/snapshot.ts. */
    snapshot: text('snapshot').notNull(),
    enrolledAt: integer('enrolled_at', { mode: 'timestamp_ms' }).notNull(),
    /** active | completed | abandoned. */
    status: text('status').notNull().default('active'),
    /** 1-based position pointer; advanced by the progression engine (#13). */
    currentWeek: integer('current_week').notNull().default(1),
    /** 1-based day-of-week pointer within the current week. */
    currentDay: integer('current_day').notNull().default(1),
    /** R2: pillar tags resolved from the program's routines at enroll. */
    longevityPillars: text('longevity_pillars').notNull().default('[]'),
    /**
     * #13: per-exercise working weights, JSON-encoded:
     * `{ "<exerciseId>": { "weightKg": number } }`.
     * Updated by advanceEnrollment() from logged performance; read by
     * getCurrentSessionTargets(). Deload weeks never write here.
     */
    progressionState: text('progression_state').notNull().default('{}'),
    /**
     * #13: idempotency key for advanceEnrollment(). Records the workout
     * that last advanced the pointer — a retry/double-tap with the same
     * workout id is a safe no-op instead of double-progressing.
     */
    lastAdvancedWorkoutId: text('last_advanced_workout_id'),
  },
  (t) => [
    index('program_enrollments_status_idx').on(t.status),
    index('program_enrollments_program_id_idx').on(t.programId),
    index('program_enrollments_updated_at_idx').on(t.updatedAt),
    index('program_enrollments_deleted_at_idx').on(t.deletedAt),
    // Partial: one active enrollment per program; finished rows don't collide.
    uniqueIndex('program_enrollments_active_program_unique')
      .on(t.programId)
      .where(sql`${t.status} = 'active' and ${t.deletedAt} is null`),
  ],
);

export type ProgramEnrollment = typeof programEnrollments.$inferSelect;
export type NewProgramEnrollment = typeof programEnrollments.$inferInsert;
