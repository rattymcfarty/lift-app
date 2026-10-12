/**
 * Missed-session tracking (P3 #14) — the calendar reality of a program.
 *
 * The progression engine (#13) owns the (week, day) program pointer; this
 * module owns the calendar: which scheduled sessions happened, which were
 * missed, which the user skipped. One row per scheduled session per
 * enrollment in `program_session_states`, generated idempotently from the
 * frozen snapshot.
 *
 * Scheduling model (documented, predictable): program week 1 starts on the
 * enrollment calendar date. Session (week W, day D) is scheduled for
 * startOfDay(enrolledAt) + (W-1)*7 + (D-1) days. Day numbers are
 * program-relative (day 1 = first training day), not calendar weekdays —
 * the DSL carries no weekday mapping.
 *
 * A session becomes "missed" when its scheduled day has fully passed
 * (end of scheduled date + 1 day grace) with no logged workout. Missed
 * is not failed: resolving offers do-it-today (shifts the session and all
 * later scheduled sessions by the same delta) or skip (no progression
 * penalty — the engine only acts on logged workouts). Copy is
 * deliberately guilt-free.
 *
 * All writes go through the global write lock inside runInTransaction.
 */

import { and, asc, eq, isNull } from 'drizzle-orm';
import { db, runInTransaction } from '../db/client';
import {
  programSessionStates,
  routines,
  workouts,
  type ProgramSessionState,
  type SessionStatus,
} from '../db/schema';
import { withWriteLock } from '../data/repositories';
import { ProgramError } from './compile';
import { getEnrollment } from './enrollments';
import type { ProgramDefinition } from './types';
import {
  DAY_MS,
  EARLY_LINK_MS,
  MISSED_GRACE_MS,
  WORKOUT_LINK_WINDOW_MS,
  programSessions,
  scheduledDateFor,
  startOfDay,
} from './safetyRules';

export type { ProgramSessionState, SessionStatus };
export {
  MISSED_GRACE_MS,
  WORKOUT_LINK_WINDOW_MS,
  startOfDay,
  scheduledDateFor,
  programSessions,
} from './safetyRules';

/**
 * Ensure session rows exist for every programmed session of an
 * enrollment. Idempotent — safe to call on every program view; the
 * partial unique index guarantees no duplicates even under races.
 */
export async function ensureSessionStates(enrollmentId: string): Promise<void> {
  const { enrollment, program } = await getEnrollment(enrollmentId);
  const sessions = programSessions(program);
  const enrolledAtMs = enrollment.enrolledAt.getTime();
  await withWriteLock(() =>
    runInTransaction(async () => {
      for (const s of sessions) {
        // scheduledDateFor validates week/day — invalid program data
        // fails loudly here instead of writing corrupt dates.
        const scheduledDate = new Date(
          scheduledDateFor(enrolledAtMs, s.week, s.day),
        );
        // Bare ON CONFLICT DO NOTHING (no target): the partial unique
        // index carries WHERE deleted_at IS NULL, and SQLite rejects an
        // explicit conflict target that doesn't repeat the WHERE clause.
        // Bare DO NOTHING catches the conflict regardless.
        await db
          .insert(programSessionStates)
          .values({
            enrollmentId,
            week: s.week,
            day: s.day,
            routineKbId: s.routineKbId,
            scheduledDate,
            status: 'scheduled',
          })
          .onConflictDoNothing();
      }
    }),
  );
}

/**
 * Reconcile session states with reality. For each 'scheduled' session:
 * - if a workout was logged for its routine within the link window after
 *   the scheduled date → 'done' (links the workout);
 * - else if the scheduled date + grace has passed → 'missed'.
 *
 * 'done', 'missed', and 'skipped' rows are terminal — refresh never moves
 * them (except via resolveMissedSession's do-today, which re-schedules).
 * Call on program view / app open.
 */
export async function refreshSessionStates(
  enrollmentId: string,
  now = new Date(),
): Promise<{ newlyMissed: number; newlyDone: number }> {
  await ensureSessionStates(enrollmentId);
  let newlyMissed = 0;
  let newlyDone = 0;
  const nowMs = now.getTime();

  await withWriteLock(() =>
    runInTransaction(async () => {
      const rows = await db
        .select()
        .from(programSessionStates)
        .where(
          and(
            eq(programSessionStates.enrollmentId, enrollmentId),
            eq(programSessionStates.status, 'scheduled'),
            isNull(programSessionStates.deletedAt),
          ),
        )
        // Deterministic order: earliest session first, so the closest
        // session claims a workout before a later one does.
        .orderBy(asc(programSessionStates.scheduledDate));

      for (const row of rows) {
        const schedMs = row.scheduledDate.getTime();
        // 1. Look for a logged workout for this session's routine.
        const [routine] = await db
          .select({ id: routines.id })
          .from(routines)
          .where(
            and(eq(routines.kbId, row.routineKbId), isNull(routines.deletedAt)),
          )
          .limit(1);
        if (routine) {
          // Workouts already linked to another session can't be reused —
          // otherwise one workout marks adjacent-day sessions done twice.
          const linked = await db
            .select({ workoutId: programSessionStates.workoutId })
            .from(programSessionStates)
            .where(
              and(
                eq(programSessionStates.enrollmentId, enrollmentId),
                isNull(programSessionStates.deletedAt),
              ),
            );
          const linkedIds = new Set(
            linked.map((l) => l.workoutId).filter((id): id is string => id != null),
          );
          const candidates = await db
            .select()
            .from(workouts)
            .where(
              and(eq(workouts.routineId, routine.id), isNull(workouts.deletedAt)),
            );
          // Date-window filter in JS keeps the query index-friendly.
          // Training a day early still counts (EARLY_LINK_MS before the
          // scheduled date); the window after stays WORKOUT_LINK_WINDOW_MS.
          // Pick the CLOSEST workout to the scheduled date, not the first
          // in row order — adjacent sessions share the same routine.
          let match: (typeof candidates)[number] | undefined;
          let bestDelta = Infinity;
          for (const w of candidates) {
            if (linkedIds.has(w.id)) continue;
            const started = w.startedAt.getTime();
            if (started < schedMs - EARLY_LINK_MS || started > schedMs + WORKOUT_LINK_WINDOW_MS) {
              continue;
            }
            const delta = Math.abs(started - schedMs);
            if (delta < bestDelta) {
              bestDelta = delta;
              match = w;
            }
          }
          if (match) {
            await db
              .update(programSessionStates)
              .set({
                status: 'done',
                workoutId: match.id,
                resolvedAt: now,
                updatedAt: now,
              })
              .where(eq(programSessionStates.id, row.id));
            newlyDone++;
            continue;
          }
        }
        // 2. Past due → missed.
        if (nowMs > schedMs + DAY_MS + MISSED_GRACE_MS) {
          await db
            .update(programSessionStates)
            .set({ status: 'missed', resolvedAt: now, updatedAt: now })
            .where(eq(programSessionStates.id, row.id));
          newlyMissed++;
        }
      }
    }),
  );
  return { newlyMissed, newlyDone };
}

/** List missed sessions for an enrollment, oldest first (UI resolution queue). */
export async function getMissedSessions(
  enrollmentId: string,
): Promise<ProgramSessionState[]> {
  await ensureSessionStates(enrollmentId);
  return db
    .select()
    .from(programSessionStates)
    .where(
      and(
        eq(programSessionStates.enrollmentId, enrollmentId),
        eq(programSessionStates.status, 'missed'),
        isNull(programSessionStates.deletedAt),
      ),
    )
    .orderBy(asc(programSessionStates.scheduledDate));
}

/** List all session states for an enrollment, in program order. */
export async function listSessionStates(
  enrollmentId: string,
): Promise<ProgramSessionState[]> {
  await ensureSessionStates(enrollmentId);
  return db
    .select()
    .from(programSessionStates)
    .where(
      and(
        eq(programSessionStates.enrollmentId, enrollmentId),
        isNull(programSessionStates.deletedAt),
      ),
    )
    .orderBy(asc(programSessionStates.week), asc(programSessionStates.day));
}

export type MissedResolution = 'do-today' | 'skip';

/**
 * Resolve a missed session. Neither option punishes progression — the
 * engine (#13) only applies progression to logged workouts.
 * - 'do-today': re-schedules this session to today and shifts every
 *   later 'scheduled' session by the same delta (the week shifts).
 * - 'skip': marks skipped; the program continues without it.
 */
export async function resolveMissedSession(
  enrollmentId: string,
  week: number,
  day: number,
  action: MissedResolution,
  now = new Date(),
): Promise<void> {
  await withWriteLock(() =>
    runInTransaction(async () => {
      const [row] = await db
        .select()
        .from(programSessionStates)
        .where(
          and(
            eq(programSessionStates.enrollmentId, enrollmentId),
            eq(programSessionStates.week, week),
            eq(programSessionStates.day, day),
            isNull(programSessionStates.deletedAt),
          ),
        )
        .limit(1);
      if (!row) throw new ProgramError(`no session state for week ${week} day ${day}`);
      if (row.status !== 'missed') {
        throw new ProgramError(
          `session week ${week} day ${day} is ${row.status}, not missed`,
        );
      }

      if (action === 'skip') {
        await db
          .update(programSessionStates)
          .set({ status: 'skipped', resolvedAt: now, updatedAt: now })
          .where(eq(programSessionStates.id, row.id));
        return;
      }

      // do-today: shift this session to today; shift all later scheduled
      // sessions by the same delta so the program's spacing is preserved.
      // DST-safe: the shift is computed in whole calendar days, not ms —
      // fixed-ms arithmetic lands at 23:00/01:00 across DST transitions.
      const todayStart = startOfDay(now.getTime());
      const oldStart = row.scheduledDate.getTime();
      const deltaDays = Math.round((todayStart - oldStart) / DAY_MS);
      if (deltaDays <= 0) {
        // Already today or future-dated (clock skew) — just re-schedule.
        await db
          .update(programSessionStates)
          .set({
            status: 'scheduled',
            scheduledDate: new Date(todayStart),
            resolvedAt: null,
            updatedAt: now,
          })
          .where(eq(programSessionStates.id, row.id));
        return;
      }
      const later = await db
        .select()
        .from(programSessionStates)
        .where(
          and(
            eq(programSessionStates.enrollmentId, enrollmentId),
            isNull(programSessionStates.deletedAt),
          ),
        );
      for (const s of later) {
        if (s.id === row.id) continue; // Resolved session goes to today (below).
        // Completed and skipped sessions are terminal — they never move.
        if (s.status === 'done' || s.status === 'skipped') continue;
        const sMs = s.scheduledDate.getTime();
        if (sMs >= oldStart) {
          // Calendar-day shift preserves the start-of-day invariant.
          // Includes other 'missed' sessions: they move forward with the
          // program instead of staying in the past and colliding later.
          const shifted = new Date(sMs);
          shifted.setDate(shifted.getDate() + deltaDays);
          const newDate = new Date(startOfDay(shifted.getTime()));
          // A missed session shifted to today-or-later is no longer in
          // the past — it's upcoming again.
          const newStatus =
            s.status === 'missed' && newDate.getTime() >= todayStart
              ? 'scheduled'
              : s.status;
          await db
            .update(programSessionStates)
            .set({
              scheduledDate: newDate,
              status: newStatus,
              // Clearing resolvedAt when a missed session becomes upcoming.
              resolvedAt: newStatus === 'scheduled' ? null : s.resolvedAt,
              updatedAt: now,
            })
            .where(eq(programSessionStates.id, s.id));
        }
      }
      await db
        .update(programSessionStates)
        .set({
          status: 'scheduled',
          scheduledDate: new Date(todayStart),
          resolvedAt: null,
          updatedAt: now,
        })
        .where(eq(programSessionStates.id, row.id));
    }),
  );
}

/**
 * Mark a session done when its workout is logged. The program UI calls
 * this alongside the progression engine's advanceEnrollment — the engine
 * owns the program pointer, this module owns the calendar. Idempotent:
 * re-marking an already-done session is a no-op.
 */
export async function markSessionDone(
  enrollmentId: string,
  week: number,
  day: number,
  workoutId: string,
  now = new Date(),
): Promise<void> {
  await ensureSessionStates(enrollmentId);
  await withWriteLock(() =>
    runInTransaction(async () => {
      const [row] = await db
        .select()
        .from(programSessionStates)
        .where(
          and(
            eq(programSessionStates.enrollmentId, enrollmentId),
            eq(programSessionStates.week, week),
            eq(programSessionStates.day, day),
            isNull(programSessionStates.deletedAt),
          ),
        )
        .limit(1);
      if (!row) throw new ProgramError(`no session state for week ${week} day ${day}`);
      if (row.status === 'done') return; // Idempotent.
      await db
        .update(programSessionStates)
        .set({
          status: 'done',
          workoutId,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(programSessionStates.id, row.id));
    }),
  );
}
