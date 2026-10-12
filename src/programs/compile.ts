/**
 * KB → DSL compiler (P3 #12).
 *
 * A KB program (weeks × day-sessions with exercise blocks) compiles to one
 * ProgramDefinition: a single phase spanning all weeks, each session
 * pointing at the routine template the KB import created for that day
 * (kbId "<program-id>--session-<day>", see kbProgramToRoutineInputs).
 *
 * The compiler asserts its own output through the validator — KB content
 * must never produce DSL the engine can't honor. Throws ProgramError.
 */

import type { KbProgramJson } from '../kb/types';
import { PROGRAM_DSL_VERSION, type ProgramDefinition } from './types';
import { validateProgramDefinition } from './validate';

export class ProgramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgramError';
  }
}

/**
 * Compile a KB program JSON document into a validated ProgramDefinition.
 * Pillars are left empty here — enrollProgram() resolves them from the
 * referenced routines' tags and freezes the result into the snapshot.
 */
export function compileKbProgram(
  program: KbProgramJson,
  bundleVersion: string,
): ProgramDefinition {
  if (!program || typeof program !== 'object') {
    throw new ProgramError('KB program must be an object');
  }
  if (!bundleVersion || typeof bundleVersion !== 'string') {
    throw new ProgramError('bundleVersion must be a non-empty string');
  }

  const def: ProgramDefinition = {
    schemaVersion: PROGRAM_DSL_VERSION,
    id: program.id,
    name: program.name,
    goal: program.goal,
    weeks: program.weeks,
    daysPerWeek: program.daysPerWeek,
    phases: [
      {
        // v1: one phase; per-phase layouts arrive only if the KB schema
        // ever gains them (and only if #13 implements them).
        name: 'Training',
        startWeek: 1,
        endWeek: program.weeks,
        sessions: program.sessions.map((s) => ({
          day: s.day,
          routineKbId: `${program.id}--session-${s.day}`,
          ...(s.name ? { name: s.name } : {}),
        })),
      },
    ],
    deload: { week: program.deload.week, volumeFactor: program.deload.volumeFactor },
    progression: { kind: 'linear' },
    pillars: [],
    source: { kind: 'kb', kbId: program.id, kbVersion: bundleVersion },
  };

  const errors = validateProgramDefinition(def);
  if (errors.length > 0) {
    throw new ProgramError(
      `KB program "${program.id}" compiled to invalid DSL: ${errors.join('; ')}`,
    );
  }
  return def;
}

/** All stable routine keys referenced by a definition (deduped, in order). */
export function programRoutineKbIds(def: ProgramDefinition): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phase of def.phases) {
    for (const session of phase.sessions) {
      if (!seen.has(session.routineKbId)) {
        seen.add(session.routineKbId);
        out.push(session.routineKbId);
      }
    }
  }
  return out;
}

/** Find the phase covering a 1-based week number (null when out of range). */
export function phaseForWeek(
  def: ProgramDefinition,
  week: number,
): ProgramDefinition['phases'][number] | null {
  if (!Number.isInteger(week) || week < 1 || week > def.weeks) return null;
  return def.phases.find((p) => week >= p.startWeek && week <= p.endWeek) ?? null;
}
