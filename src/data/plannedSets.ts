/**
 * Plan/program targets → the initial, unlogged set rows a workout opens with.
 *
 * Starting a workout from a plan used to drop the user into empty cards
 * ("+ Add set" only), because nothing carried the plan's target sets/reps
 * through to the logging screen. `startWorkoutFromRoutine` copies the rest
 * override and notes into workout_exercises, but a workout_exercise has no
 * set/reps columns — sets are ordinary rows. So the screen seeds the plan's
 * planned rows itself, from the item's targets.
 *
 * The seeded rows are ordinary pending (editable) rows: nothing is written
 * until the user logs a set, so history stays exactly what was done.
 *
 * Kept pure (only imports the shared rep-range parser) so the mapping is
 * unit-tested in scripts/test-planned-sets.mjs.
 */
import { parseRepRange } from '../programs/progression';

export interface PlannedSetRow {
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
}

/** The subset of a routine_exercises row the mapping reads. */
export interface RoutineItemTargets {
  /**
   * Routine position. Together with `exerciseId` it identifies the
   * workout_exercises row `startWorkoutFromRoutine` copied this item to
   * (positions are carried over verbatim). Needed only by
   * `plannedSetsBySlot`; the same exercise can appear twice in a routine
   * with different targets, so exerciseId alone is not enough.
   */
  position?: number | null;
  exerciseId?: string | null;
  targetSets?: number | null;
  /** Free text: "8", "8-12", "8+". */
  targetReps?: string | null;
  targetWeightKg?: number | null;
  targetRpe?: number | null;
}

/**
 * Defensive cap on the seeds. A typo in a target (e.g. 300 sets) must not
 * freeze the workout screen with hundreds of input rows; the user can always
 * add more with "+ Add set".
 */
export const MAX_PLANNED_SETS = 20;

/**
 * One row per planned set, all carrying the same targets. Reps use the low
 * end of a range ("8-12" → 8, "8+" → 8) — the same conservative floor the
 * progression engine uses. Returns [] when the item declares no sets.
 */
export function plannedSetRows(item: RoutineItemTargets): PlannedSetRow[] {
  const declared = item.targetSets ?? 0;
  if (!Number.isFinite(declared) || declared <= 0) return [];
  const count = Math.min(Math.floor(declared), MAX_PLANNED_SETS);
  const reps = parseRepRange(item.targetReps)?.min ?? null;
  const weightKg =
    item.targetWeightKg != null && Number.isFinite(item.targetWeightKg) ? item.targetWeightKg : null;
  const rpe = item.targetRpe != null && Number.isFinite(item.targetRpe) ? item.targetRpe : null;
  return Array.from({ length: count }, () => ({ reps, weightKg, rpe }));
}

/**
 * Slot identity for a routine item / workout exercise pair. Positions are
 * unique within a routine and are copied to the workout unchanged, so
 * position + exerciseId picks out exactly the rows that came from this
 * template item.
 */
export function plannedSetSlotKey(position: number, exerciseId: string): string {
  return `${position}\u0000${exerciseId}`;
}

/**
 * Index a routine's items by slot for the logging screen: one lookup per
 * workout exercise instead of a scan. Items that declare no sets are left
 * out — a workout started from a template that never had targets opens
 * exactly as it did before (empty card, "+ Add set").
 */
export function plannedSetsBySlot(items: RoutineItemTargets[]): Map<string, PlannedSetRow[]> {
  const map = new Map<string, PlannedSetRow[]>();
  for (const item of items) {
    if (item.position == null || !item.exerciseId) continue;
    const rows = plannedSetRows(item);
    if (rows.length > 0) map.set(plannedSetSlotKey(item.position, item.exerciseId), rows);
  }
  return map;
}
