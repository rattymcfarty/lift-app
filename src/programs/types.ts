/**
 * Program DSL (P3 #12) — app-side representation of a multi-week training program.
 *
 * v1 scope (per plan): linear progression + fixed deload weeks ONLY.
 * The DSL deliberately expresses nothing #13 won't implement — no
 * undulating schemes, no RPE-based autoregulation, no custom deload rules.
 * Anything beyond linear+fixed-deload fails validation (see ./validate.ts).
 *
 * Shape: ProgramDefinition → phases → weeks (via startWeek/endWeek) →
 * sessions, where each session references a routine template by its STABLE
 * KB session id ("<program-id>--session-<day>"). Routine row UUIDs are
 * import-local; the kbId is the stable cross-import key (see
 * kbProgramToRoutineInputs in src/kb/transform.ts).
 *
 * This module is runtime-dependency-free (type-only imports) so the DSL,
 * validation, compilation, and snapshots are unit-testable in plain Node.
 */

import type { LongevityPillar } from '../db/schema';

/** DSL schema version. Bump only with a migration path for stored snapshots. */
export const PROGRAM_DSL_VERSION = 1 as const;

/**
 * One training day inside a phase. References the routine template that
 * implements the session — resolved to a routine row at enrollment time.
 */
export interface ProgramSession {
  /** Day of the training week, 1–7. */
  day: number;
  /** Stable routine key: "<program-id>--session-<day>" for KB programs. */
  routineKbId: string;
  /** Optional label, e.g. "Upper A". */
  name?: string;
}

/**
 * A contiguous block of weeks sharing the same weekly session layout.
 * v1 programs compile to a single phase spanning all weeks.
 */
export interface ProgramPhase {
  name: string;
  /** 1-based inclusive. */
  startWeek: number;
  /** 1-based inclusive. */
  endWeek: number;
  sessions: ProgramSession[];
}

/**
 * Progression scheme. v1 implements linear progression only (#13);
 * the validator rejects any other kind so the DSL can't promise
 * what the engine won't honor.
 */
export interface ProgramProgression {
  kind: 'linear';
}

export type ProgramSource =
  | { kind: 'kb'; kbId: string; kbVersion: string }
  | { kind: 'local' };

export interface ProgramDefinition {
  schemaVersion: typeof PROGRAM_DSL_VERSION;
  /** Permanent id: KB program id, or a local UUID for hand-built programs. */
  id: string;
  name: string;
  goal: string;
  weeks: number;
  daysPerWeek: number;
  phases: ProgramPhase[];
  /** Fixed deload: on `week`, scale session volume by `volumeFactor`. */
  deload: { week: number; volumeFactor: number };
  progression: ProgramProgression;
  /**
   * R2 longevity lens. The KB compiler leaves this empty; enrollProgram()
   * resolves it from the referenced routines' pillar tags and freezes the
   * result into the enrollment snapshot.
   */
  pillars: LongevityPillar[];
  source: ProgramSource;
}

/** Enrollment lifecycle. Rows are never hard-deleted — history is kept. */
export const ENROLLMENT_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
