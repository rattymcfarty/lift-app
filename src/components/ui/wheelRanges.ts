/**
 * The ranges the app's numeric wheels use outside the set row.
 *
 * Set rows get their three drums from `workout/wheelFields.ts`; everything else
 * (rest seconds, plan targets, plate loads, measurements, body stats) needs a
 * range that matches what the number *means*. Keeping the ranges here — next to
 * each other, in one unit-tested module — is what stops two screens inventing
 * different limits for the same quantity.
 */
import { buildWheel, type WheelItem } from './wheelModel';

export type Unit = 'kg' | 'lb';

/** Rest between sets: 0–10 minutes in 15 s steps (0 s = no timer). */
export function restItems(): WheelItem[] {
  return buildWheel({ min: 0, max: 600, step: 15 });
}

/** A plain count, e.g. sets 1–10. */
export function countItems(min = 1, max = 10): WheelItem[] {
  return buildWheel({ min, max, step: 1 });
}

/** Weight in the display unit, the same limits as the set row's drum. */
export function weightItems(unit: Unit): WheelItem[] {
  return unit === 'kg'
    ? buildWheel({ min: 0, max: 400, step: 2.5, decimals: 1 })
    : buildWheel({ min: 0, max: 880, step: 5 });
}

/** RPE 1–10 in half points. */
export function rpeItems(): WheelItem[] {
  return buildWheel({ min: 1, max: 10, step: 0.5, decimals: 1 });
}

/** A session length: 10–180 minutes in 5-minute steps. */
export function minutesItems(): WheelItem[] {
  return buildWheel({ min: 10, max: 180, step: 5 });
}

/** Bar weight: 0–60 kg (0–130 lb) in 0.5/1 steps, for the plate calculator. */
export function barItems(unit: Unit): WheelItem[] {
  return unit === 'kg'
    ? buildWheel({ min: 0, max: 60, step: 0.5, decimals: 1 })
    : buildWheel({ min: 0, max: 130, step: 1 });
}

/** Height in centimetres (120–230) — onboarding and body stats. */
export function heightCmItems(): WheelItem[] {
  return buildWheel({ min: 120, max: 230, step: 1 });
}

/** Birth year, oldest first; the drum opens on the current value. */
export function birthYearItems(now = new Date()): WheelItem[] {
  return buildWheel({ min: 1920, max: now.getFullYear(), step: 1 });
}

/** Body measurements: waist/chest in cm, body fat in %, resting HR in bpm. */
export type MeasureKind = 'weight' | 'length' | 'bodyFat' | 'heartRate' | 'custom';

export function measureItems(kind: MeasureKind, unit: Unit): WheelItem[] {
  switch (kind) {
    case 'weight':
      return weightItems(unit);
    case 'length':
      return buildWheel({ min: 20, max: 250, step: 0.5, decimals: 1 });
    case 'bodyFat':
      return buildWheel({ min: 2, max: 70, step: 0.5, decimals: 1 });
    case 'heartRate':
      return buildWheel({ min: 30, max: 220, step: 1 });
    default:
      return buildWheel({ min: 0, max: 1000, step: 0.5, decimals: 1 });
  }
}
