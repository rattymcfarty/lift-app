/**
 * Pure logic for the in-workout exercise actions menu.
 *
 * Three small pieces, all IO-free so they can be unit-tested in
 * scripts/test-exercise-menu.mjs and reused by the sheets/cards:
 * - `moveItem`        the reorder sheet's move function (buttons + drag).
 * - `warmupRamp`      the warmup-set ramp (50/70/85% of the first working
 *                     set, reps 5/3/2; two empty rows when no weight is known).
 * - `REST_PRESETS`    the rest-timer choices shown in the actions sheet.
 *
 * Weights are canonical kilograms; `warmupRamp` rounds for the *display*
 * unit so a lb user sees clean lb numbers and a kg user clean 0.5kg steps.
 */

import { kgToLb, lbToKg } from './units';

/** Rest-timer presets offered in the actions sheet, in seconds. */
export const REST_PRESETS: readonly number[] = [30, 45, 60, 90, 120, 180, 300];

/** Formats seconds as a timer label: 120 -> "2:00", 45 -> "0:45". */
export function formatRestLabel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Moves one item in an array, returning a new array. `from`/`to` are clamped
 * to the array bounds; an out-of-range or no-op move returns a copy unchanged.
 * Used by the reorder sheet so the pure ordering is unit-tested and the DB
 * write stays a dumb "persist this id order".
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const n = items.length;
  if (n === 0) return [];
  if (!Number.isInteger(from) || from < 0 || from >= n) return [...items];
  const dest = Math.max(0, Math.min(n - 1, Number.isInteger(to) ? to : from));
  if (dest === from) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(dest, 0, moved);
  return next;
}

export interface WarmupRow {
  reps: string;
  /** Canonical kilograms, or null for an empty row. */
  weightKg: number | null;
}

/** Ramp percentages of the first working set's weight, ascending. */
export const WARMUP_PERCENTS: readonly number[] = [0.5, 0.7, 0.85];
/** Reps paired with each ramp percentage. */
export const WARMUP_REPS: readonly number[] = [5, 3, 2];

/**
 * Rounds a canonical-kg ramp weight to a clean number for the display unit:
 * kg → nearest 0.5kg; lb → nearest 5lb, stored back as canonical kg.
 */
export function roundRampWeight(weightKg: number, unit: 'kg' | 'lb'): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (unit === 'lb') {
    const lb = Math.round(kgToLb(weightKg) / 5) * 5;
    return Math.round(lbToKg(Math.max(5, lb)) * 100) / 100;
  }
  return Math.round(weightKg * 2) / 2;
}

/**
 * Builds the warmup ramp ahead of the working sets.
 *
 * - Known working weight (kg > 0): three rows at 50/70/85%, reps 5/3/2,
 *   each rounded for the display unit.
 * - Unknown weight: two empty rows for the user to fill in themselves.
 *
 * Returns plain rows in canonical kg; the card converts the weight to the
 * display unit when it prefills the inputs. Never touches logged sets.
 */
export function warmupRamp(
  workingWeightKg: number | null | undefined,
  unit: 'kg' | 'lb',
): WarmupRow[] {
  if (workingWeightKg == null || !Number.isFinite(workingWeightKg) || workingWeightKg <= 0) {
    return [
      { reps: '', weightKg: null },
      { reps: '', weightKg: null },
    ];
  }
  return WARMUP_PERCENTS.map((pct, i) => ({
    reps: String(WARMUP_REPS[i]),
    weightKg: roundRampWeight(workingWeightKg * pct, unit),
  }));
}
