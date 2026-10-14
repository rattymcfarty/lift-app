/**
 * Unit conversion + plate math — pure functions, no React, no DB.
 *
 * Canonical units everywhere: kg for weight, seconds for duration.
 * Display conversion happens in the UI layer.
 */

import { trimNumber } from '../components/workout/format';

/** Exact conversion factor: 1 kg = 2.20462 lb. */
export const KG_TO_LB = 2.20462;

/** Converts kilograms to pounds. */
export function kgToLb(kg: number): number {
  return kg * KG_TO_LB;
}

/** Converts pounds to kilograms. */
export function lbToKg(lb: number): number {
  return lb / KG_TO_LB;
}

/**
 * Formats a canonical-kg weight for display in the given unit.
 * Uses trimNumber to avoid trailing zeros (e.g., "60 kg", "132.3 lb").
 */
export function formatWeight(weightKg: number, unit: 'kg' | 'lb'): string {
  if (unit === 'kg') {
    return `${trimNumber(weightKg)} kg`;
  }
  const lb = kgToLb(weightKg);
  return `${trimNumber(lb)} lb`;
}

/**
 * Parses a user-typed weight input string into canonical kilograms.
 *
 * Rules (matching parseUserNumber from format.ts):
 * - Blank/whitespace-only → undefined (field left empty)
 * - Comma decimals allowed ("62,5" → 62.5)
 * - Strict decimal shape: /^(\d+(\.\d*)?|\.\d+)$/ after comma→dot
 * - Garbage (letters, hex, scientific, Infinity) → NaN
 * - Returns canonical kg regardless of the display unit.
 */
export function parseWeightInput(text: string, unit: 'kg' | 'lb'): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  // Strict decimal shape (".5" and "62." allowed).
  // Number() would also accept "0x10", "1e3", "Infinity" — never valid gym input.
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return NaN;
  const n = Number(t);
  if (!Number.isFinite(n)) return NaN;
  return unit === 'kg' ? n : lbToKg(n);
}

/**
 * Default standard plate set in kilograms (largest → smallest).
 * Change via the optional `plates` argument for non-standard gyms.
 */
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

/**
 * Greedy largest-first plate calculation.
 *
 * @param targetWeightKg  Desired total loaded weight (bar + plates) in kg.
 * @param barWeightKg     Bar weight in kg (e.g., 20 for a standard Olympic bar).
 * @param plates          Available plate denominations, largest first.
 * @returns               { perSide, loadedKg, remainderKg }
 *                        - perSide: plates per side, descending.
 *                        - loadedKg: bar + 2 × sum(perSide).
 *                        - remainderKg: target − loadedKg (≥ 0, unattainable remainder).
 * @throws RangeError     If targetWeightKg < barWeightKg.
 */
export function calcPlates(
  targetWeightKg: number,
  barWeightKg: number,
  plates: readonly number[] = DEFAULT_PLATES_KG,
): { perSide: number[]; loadedKg: number; remainderKg: number } {
  if (!Number.isFinite(targetWeightKg) || !Number.isFinite(barWeightKg)) {
    throw new RangeError('targetWeightKg and barWeightKg must be finite numbers');
  }
  if (targetWeightKg < barWeightKg) {
    throw new RangeError(`targetWeightKg (${targetWeightKg}) cannot be less than barWeightKg (${barWeightKg})`);
  }

  const platesNeeded = targetWeightKg - barWeightKg;
  const perSideTarget = platesNeeded / 2;
  const perSide: number[] = [];
  let remaining = perSideTarget;

  for (const plate of plates) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        perSide.push(plate);
      }
      remaining -= count * plate;
    }
  }

  const loadedKg = barWeightKg + 2 * perSide.reduce((sum, p) => sum + p, 0);
  const remainderKg = targetWeightKg - loadedKg;

  // Guard against floating-point drift (e.g., 0.30000000000000004).
  const cleanRemainder = Number.isFinite(remainderKg) && remainderKg > 1e-10 ? remainderKg : 0;

  return {
    perSide,
    loadedKg: Math.round(loadedKg * 100) / 100,
    remainderKg: Math.round(cleanRemainder * 100) / 100,
  };
}