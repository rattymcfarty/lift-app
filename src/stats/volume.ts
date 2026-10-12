/**
 * Training volume — sets × reps × weight (P4a). Pure functions.
 *
 * Rules (documented, tested):
 * - Only completed sets with non-null reps AND weightKg count.
 *   Timed holds (reps null) and bodyweight sets without a logged weight
 *   contribute 0 — they are real work, but "kg lifted" is undefined.
 * - Per-muscle attribution: a set's full volume is credited to EACH of the
 *   exercise's primary muscles. This double-counts across muscles by design
 *   (a bench press is both chest and triceps work); the muscle-balance view
 *   (later P4) interprets it as stimulus share, not additive tonnage.
 * - Weeks run Monday 00:00 → Sunday 23:59:59 in the device's local timezone.
 */
import type { StatSet, StatWorkout, WeekBucket } from './types';

/** Volume of a single set in kg. 0 for incomplete/unmeasurable sets. */
export function setVolume(set: StatSet): number {
  if (!set.completed) return 0;
  if (set.reps == null || set.weightKg == null) return 0;
  if (set.reps <= 0 || set.weightKg < 0) return 0;
  return set.reps * set.weightKg;
}

/** Total volume of a workout in kg. */
export function workoutVolume(workout: StatWorkout): number {
  return workout.sets.reduce((sum, s) => sum + setVolume(s), 0);
}

/** Monday 00:00 local time starting the week containing `d`. */
export function startOfWeekMonday(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  // getDay(): 0 = Sunday … 6 = Saturday. Monday-start offset:
  const offset = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - offset);
  return out;
}

/**
 * Volume + workout counts per week for the last `weekCount` weeks,
 * oldest first. `now` defaults to the current time (injectable for tests).
 */
export function volumeByWeek(
  workouts: StatWorkout[],
  weekCount: number,
  now: Date = new Date(),
): WeekBucket[] {
  if (weekCount <= 0) return [];
  const thisMonday = startOfWeekMonday(now);
  const buckets: WeekBucket[] = Array.from({ length: weekCount }, (_, i) => {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(weekStart.getDate() - 7 * (weekCount - 1 - i));
    return { weekStart, volumeKg: 0, workouts: 0 };
  });
  for (const w of workouts) {
    const monday = startOfWeekMonday(w.startedAt).getTime();
    const idx = buckets.findIndex((b) => b.weekStart.getTime() === monday);
    if (idx === -1) continue; // outside the window
    buckets[idx].volumeKg += workoutVolume(w);
    buckets[idx].workouts += 1;
  }
  // Round to whole kg for display stability.
  for (const b of buckets) b.volumeKg = Math.round(b.volumeKg);
  return buckets;
}

/**
 * Total volume per primary muscle across the given workouts.
 * Full set volume is credited to each primary muscle (see module doc).
 */
export function volumeByMuscle(workouts: StatWorkout[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of workouts) {
    for (const s of w.sets) {
      const v = setVolume(s);
      if (v === 0) continue;
      const muscles = s.primaryMuscles.length > 0 ? s.primaryMuscles : ['other'];
      for (const m of muscles) {
        out.set(m, (out.get(m) ?? 0) + v);
      }
    }
  }
  return out;
}

export interface ExerciseVolume {
  exerciseId: string;
  exerciseName: string;
  volumeKg: number;
  sets: number;
  workouts: number;
}

/** Volume per exercise, sorted by volume descending. */
export function volumeByExercise(workouts: StatWorkout[]): ExerciseVolume[] {
  const byId = new Map<string, ExerciseVolume & { workoutIds: Set<string> }>();
  for (const w of workouts) {
    for (const s of w.sets) {
      const v = setVolume(s);
      let e = byId.get(s.exerciseId);
      if (!e) {
        e = {
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          volumeKg: 0,
          sets: 0,
          workouts: 0,
          workoutIds: new Set(),
        };
        byId.set(s.exerciseId, e);
      }
      if (v > 0) {
        e.volumeKg += v;
        e.sets += 1;
      }
      e.workoutIds.add(w.id);
    }
  }
  return [...byId.values()]
    .map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      volumeKg: Math.round(e.volumeKg),
      sets: e.sets,
      workouts: e.workoutIds.size,
    }))
    .sort((a, b) => b.volumeKg - a.volumeKg);
}
