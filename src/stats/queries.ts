/**
 * Stats DB wrappers (P4a) — thin queries over SQLite, no business logic.
 *
 * Screens never touch Drizzle directly; everything via repositories or
 * these stats queries. Pure aggregation lives in volume.ts / frequency.ts /
 * strength.ts / consistency.ts and is unit-tested without a DB.
 */
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { db } from '../db/client';
import {
  exercises,
  programSessionStates,
  sets,
  workoutExercises,
  workouts,
} from '../db/schema';
import { listEnrollments } from '../programs/enrollments';
import { refreshSessionStates } from '../programs/sessions';
import { consistencyScore, weeklyActivityRate } from './consistency';
import { currentStreak, totalWorkouts } from './frequency';
import type { StatSet, StatWorkout, WeekBucket } from './types';
import { startOfWeekMonday, volumeByWeek } from './volume';

function parseMuscles(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Finished workouts in [start, end) with all their live sets, flattened
 * with exercise context. Two queries (workouts, then their sets) to keep
 * the join logic simple and null-safe.
 */
export async function fetchStatWorkouts(start: Date, end: Date): Promise<StatWorkout[]> {
  const workoutRows = await db
    .select({ id: workouts.id, startedAt: workouts.startedAt, endedAt: workouts.endedAt })
    .from(workouts)
    .where(
      and(
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt),
        gte(workouts.startedAt, start),
        lt(workouts.startedAt, end),
      ),
    )
    .orderBy(asc(workouts.startedAt));

  const byId = new Map<string, StatWorkout>();
  for (const r of workoutRows) {
    byId.set(r.id, {
      id: r.id,
      startedAt: r.startedAt,
      endedAt: r.endedAt as Date,
      sets: [],
    });
  }
  if (byId.size === 0) return [];

  const ids = [...byId.keys()];
  const setRows = await db
    .select({
      workoutId: workoutExercises.workoutId,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      primaryMuscles: exercises.primaryMuscles,
      reps: sets.reps,
      weightKg: sets.weightKg,
      completed: sets.completed,
    })
    .from(sets)
    .innerJoin(
      workoutExercises,
      and(
        eq(workoutExercises.id, sets.workoutExerciseId),
        isNull(workoutExercises.deletedAt),
      ),
    )
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(and(isNull(sets.deletedAt), inArray(workoutExercises.workoutId, ids)));

  for (const r of setRows) {
    const w = byId.get(r.workoutId);
    if (!w) continue;
    const set: StatSet = {
      exerciseId: r.exerciseId,
      exerciseName: r.exerciseName,
      primaryMuscles: parseMuscles(r.primaryMuscles),
      reps: r.reps,
      weightKg: r.weightKg,
      completed: r.completed,
    };
    w.sets.push(set);
  }
  return [...byId.values()];
}

export interface DashboardStats {
  /** Volume (kg) lifted in the current Monday-start week. */
  thisWeekVolumeKg: number;
  /** Finished workouts in the current week. */
  thisWeekWorkouts: number;
  /** Consecutive active weeks (forgiving the in-progress week). */
  streakWeeks: number;
  /** Total finished workouts all time. */
  totalWorkouts: number;
  /** Last 8 weeks of volume, oldest first (for the sparkline). */
  weeklyVolume: WeekBucket[];
}

/**
 * Lightweight all-time list of finished workouts (id + start only).
 * Used for streaks and totals, which must not be capped at the 8-week
 * volume window. Rows are tiny; no inArray needed.
 */
export async function fetchWorkoutStarts(): Promise<{ id: string; startedAt: Date }[]> {
  const rows = await db
    .select({ id: workouts.id, startedAt: workouts.startedAt })
    .from(workouts)
    .where(and(isNull(workouts.deletedAt), isNotNull(workouts.endedAt)))
    .orderBy(asc(workouts.startedAt));
  return rows;
}

/**
 * Everything the dashboard home needs. Volume comes from one 8-week
 * detailed fetch; streak and total use the all-time lightweight list so
 * long streaks are never silently capped.
 */
export async function getDashboardStats(now: Date = new Date()): Promise<DashboardStats> {
  const start = new Date(now);
  start.setDate(start.getDate() - 7 * 8);
  start.setHours(0, 0, 0, 0);
  const [workouts8w, allStarts] = await Promise.all([
    fetchStatWorkouts(start, now),
    fetchWorkoutStarts(),
  ]);

  const weekly = volumeByWeek(workouts8w, 8, now);
  const thisWeek = weekly[weekly.length - 1] ?? { volumeKg: 0, workouts: 0 };
  return {
    thisWeekVolumeKg: thisWeek.volumeKg,
    thisWeekWorkouts: thisWeek.workouts,
    streakWeeks: currentStreak(allStarts, now),
    totalWorkouts: totalWorkouts(allStarts),
    weeklyVolume: weekly,
  };
}

export interface Consistency {
  /** 0–100, or null when there is nothing to measure yet. */
  score: number | null;
  /** Where the number came from: program sessions or weekly habit. */
  basis: 'program' | 'habit';
}

/**
 * Throttle for session refresh: refreshSessionStates runs a write
 * transaction with ~3 queries per scheduled session. On home focus we
 * refresh at most once per 5 minutes per enrollment — the data doesn't
 * change faster than the user can train. Keyed by enrollment so switching
 * programs refreshes immediately; set only after success so a throw
 * doesn't block retries.
 */
const lastRefreshByEnrollment = new Map<string, number>();
const REFRESH_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Invalidate the session-refresh throttle (P4a). Call after a workout
 * finishes so the dashboard shows the fresh consistency score instead
 * of the throttled one.
 */
export function invalidateConsistencyCache(enrollmentId?: string): void {
  if (enrollmentId) {
    lastRefreshByEnrollment.delete(enrollmentId);
  } else {
    lastRefreshByEnrollment.clear();
  }
}

/**
 * Consistency score. When the user has an active program enrollment, it
 * measures completed vs planned sessions (skips excluded, per #14's
 * accounting). Otherwise it falls back to share of active weeks.
 *
 * Pass `activeEnrollmentId` when the caller already resolved enrollments
 * (avoids a duplicate listEnrollments query per focus).
 */
export async function getConsistency(
  now: Date = new Date(),
  activeEnrollmentId?: string,
): Promise<Consistency> {
  const enrollmentId =
    activeEnrollmentId ?? (await listEnrollments('active'))[0]?.enrollment.id;
  if (enrollmentId) {
    // Session states must be refreshed on app open (sessions.ts): this
    // links recent workouts and marks missed sessions, otherwise done
    // stays 0 and the score is meaningless. Throttled — see above.
    const nowMs = Date.now();
    if (nowMs - (lastRefreshByEnrollment.get(enrollmentId) ?? 0) > REFRESH_THROTTLE_MS) {
      await refreshSessionStates(enrollmentId, now);
      lastRefreshByEnrollment.set(enrollmentId, Date.now());
    }
    const states = await db
      .select({ status: programSessionStates.status })
      .from(programSessionStates)
      .where(
        and(
          eq(programSessionStates.enrollmentId, enrollmentId),
          isNull(programSessionStates.deletedAt),
        ),
      );
    let done = 0;
    let planned = 0;
    for (const s of states) {
      if (s.status === 'done') {
        done += 1;
        planned += 1;
      } else if (s.status === 'missed') {
        planned += 1;
      }
      // 'scheduled' is never counted: future sessions aren't due yet, and
      // past-due sessions within the grace/link window (sessions.ts) can
      // still be completed. The program marks them 'missed' when the
      // window closes; the score follows the program's own rules.
      // 'skipped' is deliberately excluded from both sides.
    }
    return { score: consistencyScore(done, planned), basis: 'program' };
  }
  const start = startOfWeekMonday(now);
  start.setDate(start.getDate() - 7 * 8);
  const [workouts8w, allStarts] = await Promise.all([
    fetchStatWorkouts(start, now),
    fetchWorkoutStarts(),
  ]);
  // Null only for true new users (no workouts ever). Returning users with
  // an 8-week gap see 0%, not the new-user empty state.
  if (allStarts.length === 0) return { score: null, basis: 'habit' };
  return { score: weeklyActivityRate(workouts8w, 8, now) ?? 0, basis: 'habit' };
}

