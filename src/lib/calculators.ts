/**
 * Strength calculators — pure functions, no React Native, no database.
 * Covered by scripts/test-calculators.mjs (npm run test:calculators).
 */

/* ------------------------------------------------------------------ */
/* 1RM estimation                                                      */
/* ------------------------------------------------------------------ */

export interface OneRepMaxEstimate {
  /** Epley formula: w × (1 + r/30). */
  epley: number;
  /** Brzycki formula: w × 36/(37−r). */
  brzycki: number;
}

/**
 * Estimate one-rep max from a submaximal set.
 *
 * Returns undefined for invalid input (non-finite/non-positive weight,
 * reps outside 1..36). Brzycki loses reliability past ~12 reps but stays
 * defined; the UI surfaces that caveat.
 */
export function estimateOneRepMax(
  weightKg: number,
  reps: number,
): OneRepMaxEstimate | undefined {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return undefined;
  if (!Number.isInteger(reps) || reps < 1 || reps > 36) return undefined;
  return {
    epley: weightKg * (1 + reps / 30),
    brzycki: (weightKg * 36) / (37 - reps),
  };
}

/* ------------------------------------------------------------------ */
/* Plate calculator                                                    */
/* ------------------------------------------------------------------ */

export type PlateUnit = 'kg' | 'lb';

export interface PlateLoad {
  /** Plate denomination, e.g. 25. */
  plate: number;
  /** How many of this plate go on EACH side. */
  count: number;
}

export interface PlateResult {
  unit: PlateUnit;
  barWeight: number;
  targetWeight: number;
  /** Plates per side, largest first. */
  perSide: PlateLoad[];
  /** Loaded weight per side (excluding the bar). */
  loadedPerSide: number;
  /** Total actually achieved (bar + both sides). */
  achievedTotal: number;
  /**
   * Un-loadable leftover per side, in the chosen unit. Zero means the
   * target is exactly reachable; positive means `achievedTotal` is the
   * closest load below the target.
   */
  remainder: number;
}

export type PlateOutcome =
  | { ok: true; result: PlateResult }
  | { ok: false; reason: 'invalid-input' | 'below-bar' };

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Work out plates per side for a target barbell weight.
 *
 * Greedy largest-first against standard denominations. Integer math
 * (quarter-kg / half-lb units) avoids float dust. `barWeight` defaults
 * to 20 kg / 45 lb when omitted.
 */
export function calculatePlates(
  target: number,
  unit: PlateUnit,
  barWeight?: number,
): PlateOutcome {
  const bar = barWeight ?? (unit === 'kg' ? 20 : 45);
  if (!Number.isFinite(target) || target <= 0) return { ok: false, reason: 'invalid-input' };
  if (!Number.isFinite(bar) || bar < 0) return { ok: false, reason: 'invalid-input' };
  if (target < bar) return { ok: false, reason: 'below-bar' };

  const plates = unit === 'kg' ? KG_PLATES : LB_PLATES;
  // kg plates bottom out at 1.25 (quarter-kg units); lb at 2.5 (half-lb units).
  const factor = unit === 'kg' ? 4 : 2;
  let remaining = Math.round(((target - bar) / 2) * factor);

  const perSide: PlateLoad[] = [];
  for (const p of plates) {
    const units = Math.round(p * factor);
    const count = Math.floor(remaining / units);
    if (count > 0) {
      perSide.push({ plate: p, count });
      remaining -= count * units;
    }
  }

  const loadedPerSide = (target - bar) / 2 - remaining / factor;
  return {
    ok: true,
    result: {
      unit,
      barWeight: bar,
      targetWeight: target,
      perSide,
      loadedPerSide: round2(loadedPerSide),
      achievedTotal: round2(bar + loadedPerSide * 2),
      remainder: round2(remaining / factor),
    },
  };
}
