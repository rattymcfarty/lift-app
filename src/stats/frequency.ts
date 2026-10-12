/**
 * Training frequency — workouts per week, streaks, totals (P4a). Pure.
 *
 * Streak rule (documented, tested): consecutive Monday-start weeks with
 * ≥1 finished workout, counting back from the current week. A current
 * week with no workout yet does NOT break the streak — the week is still
 * in progress. (Judging Wednesday for not training "this week" yet would
 * be perverse.)
 */
import { startOfWeekMonday } from './volume';

/** Minimal shape for frequency computations (id + start only). */
export interface WorkoutStart {
  id: string;
  startedAt: Date;
}

/**
 * Monday 00:00 local, n weeks from the given Monday. Uses calendar
 * arithmetic (setDate), NOT fixed milliseconds — a week is 7 days ± 1h
 * across DST changes, and ms stepping breaks week-key matching.
 */
export function addWeeks(monday: Date, n: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + n * 7);
  return d;
}

/** Finished-workout counts per week for the last `weekCount` weeks, oldest first. */
export function workoutsPerWeek(
  workouts: WorkoutStart[],
  weekCount: number,
  now: Date = new Date(),
): number[] {
  if (weekCount <= 0) return [];
  const thisMonday = startOfWeekMonday(now);
  const indexByWeek = new Map<number, number>();
  for (let i = 0; i < weekCount; i++) {
    indexByWeek.set(addWeeks(thisMonday, -(weekCount - 1 - i)).getTime(), i);
  }
  const counts = new Array<number>(weekCount).fill(0);
  for (const w of workouts) {
    const idx = indexByWeek.get(startOfWeekMonday(w.startedAt).getTime());
    if (idx === undefined) continue;
    counts[idx] += 1;
  }
  return counts;
}

/**
 * Current streak: consecutive weeks with ≥1 workout.
 * The in-progress current week is forgiven when empty.
 */
export function currentStreak(workouts: WorkoutStart[], now: Date = new Date()): number {
  const thisMonday = startOfWeekMonday(now);
  const activeWeeks = new Set<number>();
  for (const w of workouts) {
    activeWeeks.add(startOfWeekMonday(w.startedAt).getTime());
  }
  let streak = 0;
  // If this week is empty, start counting from last week (week in progress).
  let cursor = thisMonday;
  if (!activeWeeks.has(cursor.getTime())) {
    cursor = addWeeks(cursor, -1);
  }
  while (activeWeeks.has(cursor.getTime())) {
    streak += 1;
    cursor = addWeeks(cursor, -1);
  }
  return streak;
}

/** Total finished workouts in the set. */
export function totalWorkouts(workouts: WorkoutStart[]): number {
  return new Set(workouts.map((w) => w.id)).size;
}
