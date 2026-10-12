/**
 * Program enrollment operations (P3 #12).
 *
 * The enrollment snapshot is the contract: enrollProgram() validates the
 * DSL, resolves every session's routine template, freezes the definition
 * (with resolved longevity pillars) into program_enrollments.snapshot, and
 * only then inserts. Nothing later — KB bundle updates, routine edits —
 * can change what an in-flight enrollment sees.
 *
 * Conventions mirror src/data: all writes through the global write lock
 * inside runInTransaction, tombstones kept, domain errors as ProgramError.
 */

import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, runInTransaction } from '../db/client';
import {
  decodePillars,
  encodePillars,
  programEnrollments,
  routines,
  type LongevityPillar,
  type ProgramEnrollment,
  type Routine,
} from '../db/schema';
import { withWriteLock } from '../data/repositories';
import { ProgramError, phaseForWeek, programRoutineKbIds } from './compile';
import { freezeSnapshot, parseSnapshot } from './snapshot';
import { requireParqGateOpen } from './safety';
import type { ProgramDefinition } from './types';
import { validateProgramDefinition } from './validate';

export type { ProgramEnrollment };

/** An enrollment row with its frozen program definition parsed. */
export interface EnrolledProgram {
  enrollment: ProgramEnrollment;
  program: ProgramDefinition;
}

function toEnrolledProgram(row: ProgramEnrollment): EnrolledProgram {
  return { enrollment: row, program: parseSnapshot(row.snapshot) };
}

/** Union of pillar tags across routines, deduplicated, in canonical order. */
function unionPillars(rows: Pick<Routine, 'longevityPillars'>[]): LongevityPillar[] {
  const seen = new Set<LongevityPillar>();
  for (const row of rows) {
    for (const p of decodePillars(row.longevityPillars)) seen.add(p);
  }
  return [...seen].sort();
}

/**
 * Enroll in a program. Validates the DSL, enforces the PAR-Q+ gate
 * (blocks when the gate is closed — see src/programs/safety.ts),
 * resolves every session's routine template (all must already be
 * imported — KB import creates them), freezes the snapshot, and inserts
 * a single active enrollment.
 *
 * Throws ProgramError when: the PAR-Q+ gate is closed, the DSL is
 * invalid, any referenced routine is missing, or an active enrollment
 * for the same program already exists.
 */
export async function enrollProgram(program: ProgramDefinition): Promise<EnrolledProgram> {
  const errors = validateProgramDefinition(program);
  if (errors.length > 0) {
    throw new ProgramError(`cannot enroll invalid program: ${errors.join('; ')}`);
  }

  // Safety rail (#14): the PAR-Q+ gate BLOCKS enrollment — it never
  // warns-and-continues. Enforced here (not just in the UI) so no
  // caller can accidentally bypass it. Checked before the lock for a
  // fast fail, then re-checked inside the transaction so a screening
  // written concurrently can't slip through the check-then-act gap.
  await requireParqGateOpen();

  return withWriteLock(() =>
    runInTransaction(async () => {
      await requireParqGateOpen();

      const kbIds = programRoutineKbIds(program);
      const routineRows = await db
        .select()
        .from(routines)
        .where(and(inArray(routines.kbId, kbIds), isNull(routines.deletedAt)));
      const byKbId = new Map(routineRows.map((r) => [r.kbId as string, r]));
      const missing = kbIds.filter((id) => !byKbId.has(id));
      if (missing.length > 0) {
        throw new ProgramError(
          `program "${program.name}" references routines not imported: ${missing.join(', ')}`,
        );
      }

      const [active] = await db
        .select({ id: programEnrollments.id })
        .from(programEnrollments)
        .where(
          and(
            eq(programEnrollments.programId, program.id),
            eq(programEnrollments.status, 'active'),
            isNull(programEnrollments.deletedAt),
          ),
        )
        .limit(1);
      if (active) {
        throw new ProgramError(`already enrolled in "${program.name}" — unenroll first`);
      }

      // R2: resolve pillars from the program's routines; union with any the
      // definition already carries (e.g. hand-built local programs).
      const resolved = unionPillars([
        ...routineRows,
        { longevityPillars: encodePillars(program.pillars) },
      ]);
      const snapshot = freezeSnapshot({ ...program, pillars: resolved });

      const [row] = await db
        .insert(programEnrollments)
        .values({
          programId: program.id,
          programKbId: program.source.kind === 'kb' ? program.source.kbId : null,
          kbVersion: program.source.kind === 'kb' ? program.source.kbVersion : null,
          snapshot,
          enrolledAt: new Date(),
          status: 'active',
          currentWeek: 1,
          currentDay: 1,
          longevityPillars: encodePillars(resolved),
        })
        .returning();
      const enrolled = toEnrolledProgram(row);
      // Generate the session calendar rows. Dynamic import avoids a
      // sessions↔enrollments module cycle; ensureSessionStates is
      // idempotent so a retry is safe.
      const { ensureSessionStates } = await import('./sessions');
      await ensureSessionStates(enrolled.enrollment.id);
      return enrolled;
    }),
  );
}

/** List enrollments, optionally filtered by status. Active first, then newest. */
export async function listEnrollments(
  status?: 'active' | 'completed' | 'abandoned',
): Promise<EnrolledProgram[]> {
  const base = and(isNull(programEnrollments.deletedAt));
  const rows = await db
    .select()
    .from(programEnrollments)
    .where(status ? and(base, eq(programEnrollments.status, status)) : base)
    .orderBy(desc(programEnrollments.enrolledAt));
  const enrolled = rows.map(toEnrolledProgram);
  enrolled.sort((a, b) => {
    const rank = (s: string) => (s === 'active' ? 0 : 1);
    return rank(a.enrollment.status) - rank(b.enrollment.status);
  });
  return enrolled;
}

/** Fetch one enrollment with its parsed snapshot. Throws when missing. */
export async function getEnrollment(id: string): Promise<EnrolledProgram> {
  const [row] = await db
    .select()
    .from(programEnrollments)
    .where(and(eq(programEnrollments.id, id), isNull(programEnrollments.deletedAt)))
    .limit(1);
  if (!row) throw new ProgramError(`enrollment not found: ${id}`);
  return toEnrolledProgram(row);
}

async function transitionStatus(
  id: string,
  from: 'active',
  to: 'completed' | 'abandoned',
): Promise<EnrolledProgram> {
  return withWriteLock(() =>
    runInTransaction(async () => {
      const { enrollment } = await getEnrollment(id);
      if (enrollment.status !== from) {
        throw new ProgramError(
          `enrollment ${id} is ${enrollment.status}, cannot move to ${to}`,
        );
      }
      const [row] = await db
        .update(programEnrollments)
        .set({ status: to, updatedAt: new Date() })
        .where(eq(programEnrollments.id, id))
        .returning();
      return toEnrolledProgram(row);
    }),
  );
}

/**
 * Leave a program. History is kept (status → abandoned); the frozen
 * snapshot stays queryable. Re-enrolling afterwards is allowed.
 */
export async function unenrollProgram(id: string): Promise<EnrolledProgram> {
  return transitionStatus(id, 'active', 'abandoned');
}

/** Mark an enrollment finished. Used by the progression engine (#13). */
export async function completeEnrollment(id: string): Promise<EnrolledProgram> {
  return transitionStatus(id, 'active', 'completed');
}

export interface ProgramSessionPointer {
  week: number;
  day: number;
  routineKbId: string;
  sessionName?: string;
  routine: Routine;
  isDeloadWeek: boolean;
}

/**
 * Resolve the routine template for an enrollment's current position
 * (or an explicit week/day). The bridge #13 and the UI use to turn
 * "week 3, day 2" into a startable routine.
 *
 * Returns null when the week/day has no programmed session (rest day).
 * Throws ProgramError when the enrollment or routine is missing.
 */
export async function resolveSessionRoutine(
  enrollmentId: string,
  week?: number,
  day?: number,
): Promise<ProgramSessionPointer | null> {
  const { enrollment, program } = await getEnrollment(enrollmentId);
  const w = week ?? enrollment.currentWeek;
  const d = day ?? enrollment.currentDay;
  const phase = phaseForWeek(program, w);
  if (!phase) return null;
  const session = phase.sessions.find((s) => s.day === d);
  if (!session) return null;

  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.kbId, session.routineKbId), isNull(routines.deletedAt)))
    .limit(1);
  if (!routine) {
    throw new ProgramError(
      `routine "${session.routineKbId}" for week ${w} day ${d} is missing — re-import the KB bundle`,
    );
  }
  return {
    week: w,
    day: d,
    routineKbId: session.routineKbId,
    sessionName: session.name,
    routine,
    isDeloadWeek: program.deload.week === w,
  };
}
