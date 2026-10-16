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

import { and, asc, eq, isNotNull, isNull, or } from 'drizzle-orm';
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
  await withWriteLock(() =>
    runInTransaction(() => insertSessionStates(enrollment, program)),
  );
}

/**
 * The writes of ensureSessionStates, WITHOUT taking the write lock or opening
 * a transaction. For callers that already hold both (enrollProgram): asking
 * for the lock again from inside it would deadlock and hang every later write.
 */
export async function insertSessionStates(
  enrollment: { id: string; enrolledAt: Date },
  program: ProgramDefinition,
): Promise<void> {
  const enrolledAtMs = enrollment.enrolledAt.getTime();
  for (const s of programSessions(program)) {
    // scheduledDateFor validates week/day — invalid program data
    // fails loudly here instead of writing corrupt dates.
    const scheduledDate = new Date(scheduledDateFor(enrolledAtMs, s.week, s.day));
    // Bare ON CONFLICT DO NOTHING (no target): the partial unique
    // index carries WHERE deleted_at IS NULL, and SQLite rejects an
    // explicit conflict target that doesn't repeat the WHERE clause.
    // Bare DO NOTHING catches the conflict regardless.
    await db
      .insert(programSessionStates)
      .values({
        enrollmentId: enrollment.id,
        week: s.week,
        day: s.day,
        routineKbId: s.routineKbId,
        scheduledDate,
        status: 'scheduled',
      })
      .onConflictDoNothing();
  }
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
            // 'scheduled' rows are evaluated normally; 'missed' rows with a
            // linked workout are re-evaluated (P4a: user did it late via
            // the dashboard — the linked finished workout marks it done).
            or(
              eq(programSessionStates.status, 'scheduled'),
              and(
                eq(programSessionStates.status, 'missed'),
                isNotNull(programSessionStates.workoutId),
              ),
            ),
            isNull(programSessionStates.deletedAt),
          ),
        )
        // Deterministic order: earliest session first, so the closest
        // session claims a workout before a later one does.
        .orderBy(asc(programSessionStates.scheduledDate));

      for (const row of rows) {
        const schedMs = row.scheduledDate.getTime();
        // If this row already has a linked workout that's still in
        // progress, leave it alone — a finished workout must not steal
        // the link (P4a).
        if (row.workoutId) {
          const [linked] = await db
            .select({ endedAt: workouts.endedAt, deletedAt: workouts.deletedAt })
            .from(workouts)
            .where(eq(workouts.id, row.workoutId))
            .limit(1);
          if (linked && !linked.deletedAt && !linked.endedAt) continue;
          if (!linked || linked.deletedAt) {
            // Dead link (workout deleted or missing): clear it so the
            // row stops churning and can be re-linked or re-evaluated.
            await db
              .update(programSessionStates)
              .set({ workoutId: null, updatedAt: now })
              .where(eq(programSessionStates.id, row.id));
            if (row.status === 'missed') continue; // stays missed, no rewrite
            row.workoutId = null;
          }
        }
        // 1. Look for a logged workout for this session's routine.
        const [routine] = await db
          .select({ id: routines.id })
          .from(routines)
          .where(
            and(eq(routines.kbId, row.routineKbId), isNull(routines.deletedAt)),
          )
          .limit(1);
        if (routine) {
          // If this row already has a linked workout (P4a: set at session
          // start), it stays the match — a closer finished workout must not
          // steal the link from an in-progress one.
          const ownLinked = row.workoutId;
          // Workouts already linked to another session can't be reused —
          // otherwise one workout marks adjacent-day sessions done twice.
          // The row's OWN linked workout (set at session start, P4a) stays
          // eligible: it must still mark this row done when finished.
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
              and(
                eq(workouts.routineId, routine.id),
                isNull(workouts.deletedAt),
                // In-progress workouts (endedAt null) must not mark a
                // session done — the user might discard it. P4a fix.
                isNotNull(workouts.endedAt),
              ),
            );
          // Date-window filter in JS keeps the query index-friendly.
          // Training a day early still counts (EARLY_LINK_MS before the
          // scheduled date); the window after stays WORKOUT_LINK_WINDOW_MS.
          // Pick the CLOSEST workout to the scheduled date, not the first
          // in row order — adjacent sessions share the same routine.
          let match: (typeof candidates)[number] | undefined;
          let bestDelta = Infinity;
          // Prefer the row's own explicitly-linked workout over any
          // date-matched candidate (P4a).
          if (ownLinked) {
            match = candidates.find((w) => w.id === ownLinked);
          }
          if (!match) {
            for (const w of candidates) {
              // Skip workouts linked to a DIFFERENT session. The row's own
              // linked workout (P4a: set at session start) remains eligible.
              if (linkedIds.has(w.id) && w.id !== row.workoutId) continue;
              const started = w.startedAt.getTime();
              // The row's own explicitly-linked workout bypasses the date
              // window: the user started it via "Start this session", so it
              // IS the session's workout regardless of calendar drift (P4a).
              if (w.id !== row.workoutId) {
                if (started < schedMs - EARLY_LINK_MS || started > schedMs + WORKOUT_LINK_WINDOW_MS) {
                  continue;
                }
              }
              const delta = Math.abs(started - schedMs);
              if (delta < bestDelta) {
                bestDelta = delta;
                match = w;
              }
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
        // 2. Past due → missed. But not while its workout is still in
        // progress: a session started at hour 47 and finished at hour 49
        // must not be marked missed by a refresh in between (P4a fix).
        if (nowMs > schedMs + DAY_MS + MISSED_GRACE_MS) {
          let inProgress = false;
          if (row.workoutId) {
            const [w] = await db
              .select({ endedAt: workouts.endedAt })
              .from(workouts)
              .where(
                and(
                  eq(workouts.id, row.workoutId),
                  isNull(workouts.deletedAt),
                  isNull(workouts.endedAt),
                ),
              )
              .limit(1);
            inProgress = !!w;
          }
          if (!inProgress) {
            await db
              .update(programSessionStates)
              .set({ status: 'missed', resolvedAt: now, updatedAt: now })
              .where(eq(programSessionStates.id, row.id));
            newlyMissed++;
          }
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

/**
 * Link a workout to a program session at creation time (P4a). Sets the
 * workoutId without changing status — the session is still 'scheduled'
 * until the workout is finished and advanceEnrollment runs. Idempotent.
 */
export async function linkWorkoutToSession(
  enrollmentId: string,
  week: number,
  day: number,
  workoutId: string,
): Promise<void> {
  // Rows may not exist yet on a fresh enrollment — ensure them first
  // (same as markSessionDone).
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
      // 'missed' rows CAN be linked: starting a missed session late is the
      // "do it today" resolution. 'done' and 'skipped' rows reject: re-doing
      // a completed session would orphan the earlier link, and a skipped
      // session is an explicit user choice (un-skip it on the Program
      // screen first).
      if (row.status === 'done' || row.status === 'skipped') {
        throw new ProgramError(
          `cannot link workout: session week ${week} day ${day} is ${row.status}`,
        );
      }
      if (row.workoutId === workoutId) return; // Idempotent.
      // A workout linked to a different session can't be re-linked (P4a).
      if (row.workoutId != null) {
        throw new ProgramError(
          `session week ${week} day ${day} already has a workout in progress`,
        );
      }
      const [other] = await db
        .select({ id: programSessionStates.id })
        .from(programSessionStates)
        .where(
          and(
            eq(programSessionStates.workoutId, workoutId),
            isNull(programSessionStates.deletedAt),
          ),
        )
        .limit(1);
      if (other && other.id !== row.id) {
        throw new ProgramError(`workout is already linked to another session`);
      }
      await db
        .update(programSessionStates)
        .set({ workoutId, updatedAt: new Date() })
        .where(eq(programSessionStates.id, row.id));
    }),
  );
}

/**
 * Advance the program enrollment when a linked workout is finished (P4a).
 * Only advances when the linked session IS the enrollment's current
 * pointer (week, day) — otherwise a date-matched or out-of-order workout
 * would spuriously move the program. No-op otherwise. Idempotent.
 */
export async function advanceEnrollmentForWorkout(workoutId: string): Promise<void> {
  const { advanceEnrollment } = await import('./engine');
  const [row] = await db
    .select()
    .from(programSessionStates)
    .where(
      and(
        eq(programSessionStates.workoutId, workoutId),
        isNull(programSessionStates.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return;
  const { enrollment } = await getEnrollment(row.enrollmentId);
  if (enrollment.status !== 'active') return;
  if (row.week !== enrollment.currentWeek || row.day !== enrollment.currentDay) {
    // Not the pointer session — date-matched or out-of-order. The program
    // advances only through its own flow, not calendar coincidence.
    return;
  }
  await advanceEnrollment(row.enrollmentId, workoutId);
}

/**
 * Self-healing sweep (P4a): advance the enrollment for the pointer session
 * when it's linked to a finished workout but was never advanced (e.g. the
 * app was killed between finish and advance). Only the CURRENT pointer
 * session is eligible — historical sessions never move the program.
 *
 * The link may come from the dashboard's "Start this session" OR from
 * refreshSessionStates date-matching a freeform workout of the same
 * routine. Both mean the user did the session's work; in either case the
 * pointer advancing is the consistent behavior.
 */
export async function catchUpProgramAdvancement(enrollmentId: string): Promise<void> {
  const { advanceEnrollment } = await import('./engine');
  const { enrollment } = await getEnrollment(enrollmentId);
  if (enrollment.status !== 'active') return;
  const [row] = await db
    .select({
      workoutId: programSessionStates.workoutId,
    })
    .from(programSessionStates)
    .innerJoin(workouts, eq(workouts.id, programSessionStates.workoutId))
    .where(
      and(
        eq(programSessionStates.enrollmentId, enrollmentId),
        eq(programSessionStates.week, enrollment.currentWeek),
        eq(programSessionStates.day, enrollment.currentDay),
        isNull(programSessionStates.deletedAt),
        isNotNull(programSessionStates.workoutId),
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt),
      ),
    )
    .limit(1);
  if (!row?.workoutId) return;
  try {
    await advanceEnrollment(enrollmentId, row.workoutId);
  } catch (e) {
    // advanceEnrollment is idempotent; a throw here means genuinely
    // bad state (not "already advanced"). Log it.
    console.warn('[programs] catch-up advancement failed', e);
  }
}

/**
 * Check that a session can accept a workout link (P4a). Used by the
 * dashboard's "Start this session" flow BEFORE creating the workout, so
 * a link failure doesn't orphan an active workout.
 */
export async function assertSessionLinkable(
  enrollmentId: string,
  week: number,
  day: number,
): Promise<void> {
  await ensureSessionStates(enrollmentId);
  const [row] = await db
    .select({
      status: programSessionStates.status,
      workoutId: programSessionStates.workoutId,
    })
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
  // 'missed' is linkable (doing it late); 'done' and 'skipped' reject.
  if (row.status === 'done' || row.status === 'skipped') {
    throw new ProgramError(`session week ${week} day ${day} is ${row.status}, cannot start`);
  }
  // Mirror linkWorkoutToSession's guards so the pre-check's "no orphan"
  // promise holds: a row with any existing link (including a stale one
  // from a deleted workout) must not pass the check.
  if (row.workoutId != null) {
    throw new ProgramError(
      `session week ${week} day ${day} already has a workout linked`,
    );
  }
}
