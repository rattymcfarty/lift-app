/**
 * Strength trends — estimated 1RM via Epley, best sets, per-workout peaks (P4a).
 * Pure functions.
 *
 * Epley: 1RM = weight × (1 + reps/30). Valid for reps ≥ 1; the formula
 * degrades past ~12 reps, so trends are directionally useful, not lab-grade.
 * Only completed sets with reps and weight count.
 */
import type { StatSet, StatWorkout } from './types';

/** Epley estimated 1RM in kg, or null when the set can't produce one. */
export function epley1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null) return null;
  if (weightKg <= 0 || reps < 1 || !Number.isFinite(weightKg) || !Number.isFinite(reps)) {
    return null;
  }
  return weightKg * (1 + reps / 30);
}

export interface BestSet {
  set: StatSet;
  oneRM: number;
}

/** The set with the highest estimated 1RM, or null when none qualifies. */
export function bestSetBy1RM(sets: StatSet[]): BestSet | null {
  let best: BestSet | null = null;
  for (const s of sets) {
    if (!s.completed) continue;
    const oneRM = epley1RM(s.weightKg, s.reps);
    if (oneRM == null) continue;
    if (best == null || oneRM > best.oneRM) {
      best = { set: s, oneRM };
    }
  }
  return best;
}

export interface StrengthPoint {
  date: Date;
  workoutId: string;
  oneRM: number;
  weightKg: number;
  reps: number;
}

/**
 * Per-workout best estimated 1RM for one exercise, chronological.
 * One point per workout that contains a qualifying set.
 */
export function strengthTrend(workouts: StatWorkout[], exerciseId: string): StrengthPoint[] {
  const points: StrengthPoint[] = [];
  const sorted = [...workouts].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  for (const w of sorted) {
    const sets = w.sets.filter((s) => s.exerciseId === exerciseId);
    const best = bestSetBy1RM(sets);
    if (best && best.set.weightKg != null && best.set.reps != null) {
      points.push({
        date: w.startedAt,
        workoutId: w.id,
        oneRM: Math.round(best.oneRM * 10) / 10,
        weightKg: best.set.weightKg,
        reps: best.set.reps,
      });
    }
  }
  return points;
}
