/**
 * Longevity pillar status (P4b) — pure, no DB, no UI.
 *
 * v1 pillar model (per plan scope cut): strength (derived from training) +
 * cardio (manual minutes). Mobility and balance are reserved for the full
 * pillar model and shown as upcoming.
 *
 * Targets:
 * - Strength: ≥2 strength sessions/week (longevity minimum for muscle
 *   retention with age).
 * - Cardio: ≥150 min/week moderate activity (WHO guideline, the standard
 *   longevity reference).
 */
import type { StatWorkout } from './types';

export const CARDIO_WEEKLY_TARGET_MIN = 150;
export const STRENGTH_WEEKLY_TARGET = 2;

export type PillarState = 'met' | 'progress' | 'idle';

export interface PillarStatus {
  key: 'strength' | 'cardio';
  label: string;
  state: PillarState;
  /** e.g. "3 sessions", "45 / 150 min". */
  summary: string;
  /** 0–1 progress toward the weekly target. */
  progress: number;
}

/**
 * Strength sessions in the given workouts: finished workouts with at least
 * one completed strength-category set with reps > 0. Cardio, mobility,
 * balance, and other sessions don't count toward the strength pillar.
 * Blank sets (no reps) don't count.
 */
export function strengthSessions(workouts: StatWorkout[]): number {
  return workouts.filter((w) =>
    w.sets.some(
      (s) => s.completed && s.exerciseCategory === 'strength' && s.reps != null && s.reps > 0,
    ),
  ).length;
}

/**
 * Cardio minutes from logged cardio workouts: sum of completed
 * cardio-category set durations, rounded to whole minutes. Combined with
 * manually logged cardio minutes by the caller.
 */
export function cardioWorkoutMinutes(workouts: StatWorkout[]): number {
  let seconds = 0;
  for (const w of workouts) {
    for (const s of w.sets) {
      if (s.completed && s.exerciseCategory === 'cardio' && s.durationSeconds != null && s.durationSeconds > 0) {
        seconds += s.durationSeconds;
      }
    }
  }
  return Math.round(seconds / 60);
}

export function strengthPillar(sessionsThisWeek: number): PillarStatus {
  const p = Math.min(1, sessionsThisWeek / STRENGTH_WEEKLY_TARGET);
  return {
    key: 'strength',
    label: 'Strength',
    state: sessionsThisWeek >= STRENGTH_WEEKLY_TARGET ? 'met' : sessionsThisWeek > 0 ? 'progress' : 'idle',
    summary: `${sessionsThisWeek} / ${STRENGTH_WEEKLY_TARGET} sessions`,
    progress: p,
  };
}

export function cardioPillar(minutesThisWeek: number): PillarStatus {
  const p = Math.min(1, minutesThisWeek / CARDIO_WEEKLY_TARGET_MIN);
  return {
    key: 'cardio',
    label: 'Cardio',
    state:
      minutesThisWeek >= CARDIO_WEEKLY_TARGET_MIN ? 'met' : minutesThisWeek > 0 ? 'progress' : 'idle',
    summary: `${minutesThisWeek} / ${CARDIO_WEEKLY_TARGET_MIN} min`,
    progress: p,
  };
}
