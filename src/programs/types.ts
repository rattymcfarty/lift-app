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
 *
 * incrementKg / maxWeightKg are optional for backward compatibility with
 * snapshots frozen before #13 (which carry only { kind: 'linear' }) — the
 * engine (#13) applies DEFAULT_INCREMENT_KG when incrementKg is absent.
 */
export interface ProgramProgression {
  kind: 'linear';
  /**
   * kg added to an exercise's working weight when all its sets hit the top
   * of the target rep range. Default 2.5 when absent.
   */
  incrementKg?: number;
  /**
   * Hard ceiling (R2 longevity guardrail): progression never raises an
   * exercise's working weight above this. Absent = uncapped.
   */
  maxWeightKg?: number;
}

export type ProgramSource =
  | { kind: 'kb'; kbId: string; kbVersion: string }
  | { kind: 'local' };

/**
 * Safety rails (P3 #14) — longevity-first guardrails, frozen into the
 * enrollment snapshot like everything else.
 *
 * Both fields are OPTIONAL for backward compatibility with snapshots
 * frozen before #14 (which carry no safety section — the engine treats
 * absent caps as "no cap"). When present, the set-logging flow warns
 * (never blocks) on violation: longevity-first means never pushing to
 * failure.
 */
export interface ProgramSafetyCaps {
  /**
   * Hard ceiling on Rate of Perceived Exertion (1–10). A logged set with
   * RPE above this triggers an explicit warning in the logging flow.
   */
  maxRpe?: number;
  /**
   * Floor on Reps In Reserve (0–10). A logged set with RIR below this
   * triggers an explicit warning in the logging flow.
   */
  minRir?: number;
}

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
  /**
   * Safety rails (#14). Optional — when absent, the longevity-first
   * defaults apply (RPE 9, RIR 1); see getSafetyCaps in safety.ts.
   * Pre-#14 snapshots carry no safety section and get the defaults.
   */
  safety?: ProgramSafetyCaps;
}

/** Enrollment lifecycle. Rows are never hard-deleted — history is kept. */
export const ENROLLMENT_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
