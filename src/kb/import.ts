/**
 * KB import orchestration: validated bundle → local database.
 *
 * Import is idempotent by design: exercises and routines upsert on their
 * permanent kb_ids, skip writes when content is unchanged, and never
 * resurrect user-deleted rows. Re-running an import is always safe.
 *
 * Exercises are imported before programs (routine_exercises FK).
 * A block referencing an unknown exercise fails the whole import loudly
 * rather than violating the FK mid-write.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { exercises, kbSyncState } from '../db/schema';
import { upsertKbExercise } from '../data/repositories';
import { upsertKbRoutine } from '../data/routines';
import type { KbBundleJson } from './types';
import { kbExerciseToUpsertInput, kbProgramToRoutineInputs } from './transform';

export interface KbImportStats {
  exercisesUpserted: number;
  routinesUpserted: number;
  bundleVersion: string;
}

/**
 * Import a validated bundle. The bundle MUST have passed fetchAndVerifyBundle
 * (hash + schema validation) before reaching here.
 */
export async function importBundle(bundle: KbBundleJson): Promise<KbImportStats> {
  let exercisesUpserted = 0;
  for (const ex of bundle.exercises) {
    if (ex.deprecated) continue; // deprecated content stays out of the local KB
    await upsertKbExercise(kbExerciseToUpsertInput(ex, bundle.bundleVersion));
    exercisesUpserted++;
  }

  let routinesUpserted = 0;
  for (const program of bundle.programs) {
    if (program.deprecated) continue;
    const routineInputs = kbProgramToRoutineInputs(program, bundle.exercises, bundle.bundleVersion);
    for (const input of routineInputs) {
      await upsertKbRoutine(input);
      routinesUpserted++;
    }
  }

  return { exercisesUpserted, routinesUpserted, bundleVersion: bundle.bundleVersion };
}

/** Read the KB sync state row (null when never synced). */
export async function getKbSyncState(): Promise<{
  channelUrl: string | null;
  bundleVersion: string | null;
  bundleSha256: string | null;
  checkedAt: number | null;
  importedAt: number | null;
} | null> {
  const [row] = await db.select().from(kbSyncState).where(eq(kbSyncState.id, 'kb')).limit(1);
  return row ?? null;
}

/** Upsert the KB sync state row. */
export async function setKbSyncState(patch: {
  channelUrl?: string;
  bundleVersion?: string;
  bundleSha256?: string;
  checkedAt?: number;
  importedAt?: number;
}): Promise<void> {
  const [existing] = await db.select().from(kbSyncState).where(eq(kbSyncState.id, 'kb')).limit(1);
  if (existing) {
    await db.update(kbSyncState).set(patch).where(eq(kbSyncState.id, 'kb'));
  } else {
    await db.insert(kbSyncState).values({ id: 'kb', ...patch });
  }
}

/** Count live KB-seeded exercises (sanity check for the UI). */
export async function countKbExercises(): Promise<number> {
  const rows = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.isCustom, false), isNull(exercises.deletedAt)));
  return rows.length;
}
