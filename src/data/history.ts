/**
 * History + analytics queries for P1b #8 (workout history, progress charts).
 *
 * Screens never touch Drizzle directly — everything here. Reads only; no
 * write lock needed. Soft-deleted rows are excluded everywhere except
 * exercise names in historical joins (same convention as repositories.ts).
 *
 * Canonical units: kg for weight. Estimated 1RM uses the Epley formula
 * (w × (1 + r/30)) — the standard the programs engine (P3) will also use.
 */

import { and, asc, desc, eq, getTableColumns, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  exercises,
  sets,
  workouts,
  workoutExercises,
  type Exercise,
  type LoggedSet,
  type Workout,
} from '../db/schema';

/* ------------------------------------------------------------------ */
/* finished workouts with per-workout stats                            */
/* ------------------------------------------------------------------ */

export interface WorkoutHistoryRow {
  workout: Workout;
  /** Null when the workout has no end timestamp (shouldn't happen here). */
  durationMs: number | null;
  /** Sum of reps × weightKg across completed sets. */
  volumeKg: number;
  exerciseCount: number;
  setCount: number;
}

/**
 * Finished workouts, newest first, with aggregate stats in ONE query.
 * Excludes soft-deleted workouts/sets; the active (unfinished) workout
 * never appears here.
 */
export async function listFinishedWorkouts(
  limit = 20,
  offset = 0,
): Promise<WorkoutHistoryRow[]> {
  const cols = getTableColumns(workouts);
  const rows = await db
    .select({
      ...cols,
      exerciseCount: sql<number>`count(distinct ${workoutExercises.id})`.as('exercise_count'),
      setCount: sql<number>`count(${sets.id})`.as('set_count'),
      volumeKg: sql<number>`
        coalesce(sum(
          case when ${sets.reps} is not null and ${sets.weightKg} is not null
            then ${sets.reps} * ${sets.weightKg}
            else 0 end
        ), 0)`.as('volume_kg'),
    })
    .from(workouts)
    .leftJoin(
      workoutExercises,
      and(
        eq(workoutExercises.workoutId, workouts.id),
        isNull(workoutExercises.deletedAt),
      ),
    )
    .leftJoin(
      sets,
      and(
        eq(sets.workoutExerciseId, workoutExercises.id),
        isNull(sets.deletedAt),
        eq(sets.completed, true),
      ),
    )
    .where(and(isNull(workouts.deletedAt), sql`${workouts.endedAt} is not null`))
    .groupBy(workouts.id)
    .orderBy(desc(workouts.startedAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => {
    const { exerciseCount, setCount, volumeKg, ...workout } = r;
    return {
      workout: workout as Workout,
      durationMs:
        workout.endedAt != null
          ? Math.max(0, workout.endedAt.getTime() - workout.startedAt.getTime())
          : null,
      volumeKg,
      exerciseCount,
      setCount,
    };
  });
}

/* ------------------------------------------------------------------ */
/* weekly volume                                                       */
/* ------------------------------------------------------------------ */

export interface WeeklyVolumePoint {
  /** Monday 00:00 local of that week. */
  weekStart: Date;
  volumeKg: number;
  workoutCount: number;
}

/** Monday 00:00 local for the week containing `d`. */
export function startOfWeekMonday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Mon=0 … Sun=6
  out.setDate(out.getDate() - dow);
  return out;
}

/**
 * Total volume per week for the last `weeks` weeks (including the current
 * partial week), oldest first. Weeks with no training appear with 0 volume
 * so the chart never has gaps.
 */
export async function getWeeklyVolume(weeks = 12): Promise<WeeklyVolumePoint[]> {
  const now = new Date();
  const currentWeekStart = startOfWeekMonday(now);
  const rangeStart = new Date(currentWeekStart);
  rangeStart.setDate(rangeStart.getDate() - (weeks - 1) * 7);

  // Seed every week in range so empty weeks render as zero bars.
  const points: WeeklyVolumePoint[] = [];
  const indexByKey = new Map<number, WeeklyVolumePoint>();
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(rangeStart);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const p: WeeklyVolumePoint = { weekStart, volumeKg: 0, workoutCount: 0 };
    points.push(p);
    indexByKey.set(weekStart.getTime(), p);
  }

  // One aggregate query for the whole range; bucket into weeks in JS
  // (SQLite week math is fiddly and locale-hostile — JS is honest here).
  const cols = getTableColumns(workouts);
  const rows = await db
    .select({
      startedAt: cols.startedAt,
      volumeKg: sql<number>`
        coalesce(sum(
          case when ${sets.reps} is not null and ${sets.weightKg} is not null
            then ${sets.reps} * ${sets.weightKg}
            else 0 end
        ), 0)`.as('volume_kg'),
    })
    .from(workouts)
    .leftJoin(
      workoutExercises,
      and(
        eq(workoutExercises.workoutId, workouts.id),
        isNull(workoutExercises.deletedAt),
      ),
    )
    .leftJoin(
      sets,
      and(
        eq(sets.workoutExerciseId, workoutExercises.id),
        isNull(sets.deletedAt),
        eq(sets.completed, true),
      ),
    )
    .where(
      and(
        isNull(workouts.deletedAt),
        sql`${workouts.endedAt} is not null`,
        gte(workouts.startedAt, rangeStart),
      ),
    )
    .groupBy(workouts.id);

  for (const r of rows) {
    const key = startOfWeekMonday(new Date(r.startedAt)).getTime();
    const p = indexByKey.get(key);
    if (p) {
      p.volumeKg += r.volumeKg;
      p.workoutCount += 1;
    }
  }
  return points;
}

/* ------------------------------------------------------------------ */
/* per-exercise progression                                            */
/* ------------------------------------------------------------------ */

export interface ExerciseHistoryOption {
  exercise: Exercise;
  /** Most recent finished workout this exercise appeared in. */
  lastUsed: Date;
}

/** Exercises with logged history, most recently used first (for the picker). */
export async function listExercisesWithHistory(limit = 50): Promise<ExerciseHistoryOption[]> {
  const rows = await db
    .select({
      exercise: exercises,
      lastUsed: sql<Date>`max(${workouts.startedAt})`.as('last_used'),
    })
    .from(exercises)
    .innerJoin(workoutExercises, eq(workoutExercises.exerciseId, exercises.id))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .innerJoin(
      sets,
      and(
        eq(sets.workoutExerciseId, workoutExercises.id),
        isNull(sets.deletedAt),
        eq(sets.completed, true),
      ),
    )
    .where(
      and(
        isNull(exercises.deletedAt),
        isNull(workoutExercises.deletedAt),
        isNull(workouts.deletedAt),
        sql`${workouts.endedAt} is not null`,
      ),
    )
    .groupBy(exercises.id)
    .orderBy(sql`last_used desc`)
    .limit(limit);

  return rows.map((r) => ({
    exercise: r.exercise,
    // max(started_at) comes back as raw integer ms (timestamp_ms mode only
    // applies to mapped columns) — Number() guards against string coercion.
    lastUsed: new Date(Number(r.lastUsed)),
  }));
}

export interface ProgressionPoint {
  /** Finished workout date. */
  date: Date;
  workoutId: string;
  /** Heaviest completed set's weight (kg), if any. */
  topWeightKg: number | null;
  /** Reps on that top set, if any. */
  topReps: number | null;
  /** Epley estimate from the top set; null for bodyweight-only work. */
  estimated1RMKg: number | null;
}

/** Epley formula: w × (1 + r/30). Null when the set has no weight. */
export function estimated1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || reps <= 0) return null;
  return weightKg * (1 + reps / 30);
}

/**
 * One point per finished workout containing the exercise: the best
 * completed set (heaviest weight, tie-broken by reps) plus its Epley 1RM.
 * Oldest first — chart-ready. When an exercise appears twice in one
 * workout, only the better instance is kept.
 *
 * Note: sets are grouped in JS, not via SQLite json_group_array — the
 * JSON1 extension's availability in expo-sqlite's bundled SQLite is not
 * something this app should depend on at runtime.
 */
export async function getExerciseProgression(
  exerciseId: string,
  limit = 60,
): Promise<ProgressionPoint[]> {
  // Newest first so the limit keeps recent training; reversed at the end.
  const items = await db
    .select({
      id: workoutExercises.id,
      workoutId: workouts.id,
      startedAt: workouts.startedAt,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        isNull(workoutExercises.deletedAt),
        isNull(workouts.deletedAt),
        sql`${workouts.endedAt} is not null`,
      ),
    )
    .orderBy(desc(workouts.startedAt))
    .limit(limit);
  if (items.length === 0) return [];

  const setRows = await db
    .select()
    .from(sets)
    .where(
      and(
        inArray(
          sets.workoutExerciseId,
          items.map((i) => i.id),
        ),
        isNull(sets.deletedAt),
        eq(sets.completed, true),
      ),
    )
    .orderBy(asc(sets.setNumber));

  const setsByItem = new Map<string, LoggedSet[]>();
  for (const s of setRows) {
    const list = setsByItem.get(s.workoutExerciseId) ?? [];
    list.push(s);
    setsByItem.set(s.workoutExerciseId, list);
  }

  // Score prefers 1RM, then raw weight, then reps (bodyweight work).
  const score = (p: ProgressionPoint) => p.estimated1RMKg ?? p.topWeightKg ?? p.topReps ?? 0;
  const bestByWorkout = new Map<string, ProgressionPoint>();
  for (const item of items) {
    const itemSets = setsByItem.get(item.id) ?? [];
    // Best set: heaviest weight first, then most reps. Null weights sort last.
    const best = itemSets
      .filter((s) => s.weightKg != null || s.reps != null)
      .sort((a, b) => (b.weightKg ?? -1) - (a.weightKg ?? -1) || (b.reps ?? 0) - (a.reps ?? 0))[0];
    if (!best) continue;
    const point: ProgressionPoint = {
      date: new Date(item.startedAt),
      workoutId: item.workoutId,
      topWeightKg: best.weightKg,
      topReps: best.reps,
      estimated1RMKg: estimated1RM(best.weightKg, best.reps),
    };
    const prev = bestByWorkout.get(item.workoutId);
    if (!prev || score(point) > score(prev)) {
      bestByWorkout.set(item.workoutId, point);
    }
  }
  // Back to oldest-first for the chart.
  return [...bestByWorkout.values()].reverse();
}
