/**
 * The three wheels a set row offers, and how a typed value maps onto them.
 *
 * Ranges are the ones a workout actually uses:
 * - **Weight** in the display unit — 0–400 kg in 2.5 kg steps (the smallest
 *   plate pair in most gyms), 0–880 lb in 5 lb steps. Stored in kg as always.
 * - **Reps** 0–100, one at a time.
 * - **RPE** 1–10 in half points (8.5 is a real answer).
 *
 * `wheelIndex` finds the row for a value that was typed: 63 kg opens the wheel
 * on the nearest row (62.5) rather than jumping to 0.
 */
import { buildWheel, indexOfValue, type WheelItem } from '../ui/wheelModel';

export type WheelField = 'weight' | 'reps' | 'rpe';

export const WHEEL_FIELDS: readonly WheelField[] = ['weight', 'reps', 'rpe'];

export function wheelFieldLabel(field: WheelField): string {
  return field === 'weight' ? 'Weight' : field === 'reps' ? 'Reps' : 'RPE';
}

/** Unit shown in the band; RPE is a number, not a measure. */
export function wheelFieldUnit(field: WheelField, displayUnit: 'kg' | 'lb'): string | undefined {
  return field === 'weight' ? displayUnit : field === 'reps' ? 'reps' : undefined;
}

export function wheelItems(field: WheelField, displayUnit: 'kg' | 'lb'): WheelItem[] {
  if (field === 'weight') {
    return displayUnit === 'kg'
      ? buildWheel({ min: 0, max: 400, step: 2.5, decimals: 1 })
      : buildWheel({ min: 0, max: 880, step: 5 });
  }
  if (field === 'reps') return buildWheel({ min: 0, max: 100, step: 1 });
  return buildWheel({ min: 1, max: 10, step: 0.5, decimals: 1 });
}

/** Row for the current value (nearest row when it is between steps). */
export function wheelIndex(items: readonly WheelItem[], raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  return indexOfValue(items, trimmed, 0, true);
}
