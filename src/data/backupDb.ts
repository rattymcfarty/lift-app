/**
 * Maps backup table names to their Drizzle table objects.
 *
 * Kept separate from backupFormat.ts (which must stay dependency-free for
 * unit testing) and from export.ts/import.ts (which both need it).
 */
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import {
  exercises,
  measurements,
  personalRecords,
  routineExercises,
  routines,
  sets,
  workoutExercises,
  workouts,
} from '../db/schema';
import type { BackupTableName } from './backupFormat';

export const BACKUP_DB_TABLES: Record<BackupTableName, SQLiteTable> = {
  workouts,
  workout_exercises: workoutExercises,
  sets,
  exercises,
  routines,
  routine_exercises: routineExercises,
  measurements,
  personal_records: personalRecords,
};
