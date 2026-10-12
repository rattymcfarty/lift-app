/**
 * Safety rails (P3 #14) — PAR-Q+ gate and RPE/RIR cap enforcement.
 *
 * Longevity-first means the app never encourages pushing to failure.
 * These are guardrails, not medical advice: the PAR-Q+ gate blocks
 * enrollment until the questionnaire is fresh and any "yes" is met with
 * a recorded medical-clearance acknowledgment; the RPE/RIR caps warn
 * (never block) when a logged set exceeds the program's limits.
 *
 * All state stays on-device (R8). All writes go through the global write
 * lock inside runInTransaction, mirroring src/data conventions.
 */

import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { db, runInTransaction } from '../db/client';
import { parqScreenings, type ParqScreening } from '../db/schema';
import { withWriteLock } from '../data/repositories';
import { ProgramError } from './compile';
import type { ProgramDefinition, ProgramSafetyCaps } from './types';
import {
  PARQ_FRESHNESS_MS,
  PARQ_QUESTION_COUNT,
  checkRpeCaps,
  type RpeCapViolation,
} from './safetyRules';

export {
  PARQ_QUESTIONS,
  PARQ_QUESTION_COUNT,
  PARQ_FRESHNESS_MS,
  checkRpeCaps,
} from './safetyRules';
export type { RpeCapViolation } from './safetyRules';

/** Fetch the latest non-deleted screening, or null when never screened. */
export async function getLatestScreening(): Promise<ParqScreening | null> {
  const [row] = await db
    .select()
    .from(parqScreenings)
    .where(isNull(parqScreenings.deletedAt))
    .orderBy(desc(parqScreenings.completedAt))
    .limit(1);
  return row ?? null;
}

export type ParqGateStatus =
  | { open: true }
  | { open: false; reason: 'never-screened' | 'stale' | 'clearance-required' };

/**
 * The PAR-Q+ gate. Enrollment is allowed only when:
 * - a screening exists, AND
 * - the latest was completed within the last 12 months, AND
 * - no unacknowledged "yes" screening exists within the last 12 months.
 *
 * The last rule closes the retake loophole: answering "yes" then
 * immediately retaking with all "no" does NOT clear the gate — the
 * earlier "yes" still requires its medical-clearance acknowledgment.
 *
 * The gate BLOCKS — it never warns-and-continues. The UI must route a
 * closed gate to the questionnaire (or the clearance prompt).
 */
export async function getParqGateStatus(now = new Date()): Promise<ParqGateStatus> {
  const latest = await getLatestScreening();
  if (!latest) return { open: false, reason: 'never-screened' };
  if (now.getTime() - latest.completedAt.getTime() > PARQ_FRESHNESS_MS) {
    return { open: false, reason: 'stale' };
  }
  // Any "yes" screening in the freshness window that was never
  // acknowledged still blocks — retaking with all "no" is not a bypass.
  const cutoff = new Date(now.getTime() - PARQ_FRESHNESS_MS);
  const pending = await db
    .select({ id: parqScreenings.id })
    .from(parqScreenings)
    .where(
      and(
        eq(parqScreenings.anyYes, true),
        isNull(parqScreenings.clearanceAcknowledgedAt),
        isNull(parqScreenings.deletedAt),
        gte(parqScreenings.completedAt, cutoff),
      ),
    )
    .limit(1);
  if (pending.length > 0) {
    return { open: false, reason: 'clearance-required' };
  }
  return { open: true };
}

/**
 * Record a completed questionnaire. `answers` must be exactly 7 booleans
 * in PARQ_QUESTIONS order. Returns the stored screening.
 *
 * A fresh screening supersedes older ones for gate purposes (the gate
 * reads only the latest), but history is kept — rows are never deleted.
 */
export async function completeParqScreening(answers: boolean[]): Promise<ParqScreening> {
  if (!Array.isArray(answers) || answers.length !== PARQ_QUESTION_COUNT) {
    throw new ProgramError(
      `PAR-Q+ requires exactly ${PARQ_QUESTION_COUNT} answers`,
    );
  }
  if (!answers.every((a) => typeof a === 'boolean')) {
    throw new ProgramError('PAR-Q+ answers must be booleans');
  }
  const anyYes = answers.some(Boolean);
  const now = new Date();
  const [row] = await withWriteLock(() =>
    runInTransaction(() =>
      db
        .insert(parqScreenings)
        .values({
          completedAt: now,
          anyYes,
          answersJson: JSON.stringify(answers),
          clearanceAcknowledgedAt: null,
        })
        .returning(),
    ),
  );
  return row;
}

/**
 * Record the user's explicit medical-clearance acknowledgment after an
 * any-yes screening. This is a timestamped, stored acknowledgment — not
 * a bypass: the screening stays on record with its answers.
 *
 * Targets ALL unacknowledged any-yes screenings within the freshness
 * window (not just the latest): the gate blocks on any of them, so the
 * acknowledgment must clear all of them. This also fixes the retake
 * flow — answering "yes", then retaking with all "no", still leaves the
 * earlier "yes" acknowledgable instead of locking the user out.
 *
 * Throws when there is no any-yes screening awaiting acknowledgment.
 */
export async function acknowledgeMedicalClearance(now = new Date()): Promise<ParqScreening[]> {
  const cutoff = new Date(now.getTime() - PARQ_FRESHNESS_MS);
  // Read inside the write lock: the pending set can't change between the
  // check and the acknowledgment writes.
  return withWriteLock(() =>
    runInTransaction(async () => {
      const pending = await db
        .select()
        .from(parqScreenings)
        .where(
          and(
            eq(parqScreenings.anyYes, true),
            isNull(parqScreenings.clearanceAcknowledgedAt),
            isNull(parqScreenings.deletedAt),
            gte(parqScreenings.completedAt, cutoff),
          ),
        )
        .orderBy(desc(parqScreenings.completedAt));
      if (pending.length === 0) {
        throw new ProgramError('no PAR-Q+ "yes" answers awaiting clearance — no acknowledgment needed');
      }
      for (const row of pending) {
        await db
          .update(parqScreenings)
          .set({ clearanceAcknowledgedAt: now, updatedAt: now })
          .where(eq(parqScreenings.id, row.id));
      }
      // Return the acknowledged rows, latest first.
      return db
        .select()
        .from(parqScreenings)
        .where(
          and(
            eq(parqScreenings.anyYes, true),
            isNull(parqScreenings.deletedAt),
            gte(parqScreenings.completedAt, cutoff),
          ),
        )
        .orderBy(desc(parqScreenings.completedAt));
    }),
  );
}

/**
 * Enrollment guard: throws ProgramError when the PAR-Q+ gate is closed.
 * Call at the top of any program-enrollment flow, before enrollProgram().
 */
export async function requireParqGateOpen(now = new Date()): Promise<void> {
  const status = await getParqGateStatus(now);
  if (!status.open) {
    const why =
      status.reason === 'never-screened'
        ? 'complete the PAR-Q+ questionnaire first'
        : status.reason === 'stale'
          ? 'your PAR-Q+ screening is over 12 months old — please re-screen'
          : 'a medical-clearance acknowledgment is required before enrolling';
    throw new ProgramError(`PAR-Q+ gate: ${why}`);
  }
}

/* ------------------------------------------------------------------ */
/* RPE / RIR caps                                                      */
/* ------------------------------------------------------------------ */

/**
 * Default longevity-first caps applied when a program's DSL carries no
 * explicit safety section: RPE 9 (never to failure), RIR 1 (always at
 * least one rep in reserve). Explicit program config overrides these.
 */
export const DEFAULT_SAFETY_CAPS: Required<ProgramSafetyCaps> = {
  maxRpe: 9,
  minRir: 1,
};

/**
 * Effective safety caps for a program (typically from the frozen
 * enrollment snapshot). Explicit DSL config wins; otherwise the
 * longevity-first defaults apply — every program is therefore capped.
 *
 * NOTE for KB programs: the KB bundle carries per-block rpeCap values
 * (typically RPE 6–8, more conservative than the RPE 9 default). The
 * KB compiler (#12) should propagate the most restrictive block cap
 * into program.safety at compile time. Until it does, KB programs use
 * the defaults — safe, but less conservative than the KB intends.
 *
 * Pure — no DB.
 */
export function getSafetyCaps(program: ProgramDefinition): Required<ProgramSafetyCaps> {
  return {
    maxRpe: program.safety?.maxRpe ?? DEFAULT_SAFETY_CAPS.maxRpe,
    minRir: program.safety?.minRir ?? DEFAULT_SAFETY_CAPS.minRir,
  };
}

/**
 * Check a just-logged set against a program's caps. Returns violations
 * for the UI to surface as warnings. Pure — safe to call from the
 * logging flow without side effects.
 */
export function checkSetAgainstProgramCaps(
  program: ProgramDefinition,
  rpe: number | null | undefined,
  rir: number | null | undefined,
): RpeCapViolation[] {
  return checkRpeCaps(getSafetyCaps(program), rpe, rir);
}
