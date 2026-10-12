/**
 * Program DSL validation (P3 #12).
 *
 * Pure function, never throws: returns the list of violations, empty when
 * valid. Used by compileKbProgram (KB data must always produce valid DSL),
 * enrollProgram (user-facing gate), and parseSnapshot (stored data guard).
 */

import { LONGEVITY_PILLARS } from '../db/schema';
import { PROGRAM_DSL_VERSION, type ProgramDefinition } from './types';

const KB_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_WEEKS = 52;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isIntIn(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/**
 * Validate a candidate program definition. Returns violations; [] = valid.
 * Accepts `unknown` so untrusted input (parsed snapshots, KB JSON) is safe.
 */
export function validateProgramDefinition(def: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(def)) return ['program must be an object'];

  if (def.schemaVersion !== PROGRAM_DSL_VERSION) {
    errors.push(`schemaVersion must be ${PROGRAM_DSL_VERSION}`);
  }
  if (!isNonEmptyString(def.id)) errors.push('id must be a non-empty string');
  if (!isNonEmptyString(def.name)) errors.push('name must be a non-empty string');
  if (!isNonEmptyString(def.goal)) errors.push('goal must be a non-empty string');
  if (!isIntIn(def.weeks, 1, MAX_WEEKS)) {
    errors.push(`weeks must be an integer 1–${MAX_WEEKS}`);
  }
  if (!isIntIn(def.daysPerWeek, 1, 7)) {
    errors.push('daysPerWeek must be an integer 1–7');
  }

  const weeks = typeof def.weeks === 'number' ? def.weeks : 0;

  // Phases must partition weeks 1..N exactly once (no gaps, no overlaps).
  if (!Array.isArray(def.phases) || def.phases.length === 0) {
    errors.push('phases must be a non-empty array');
  } else {
    const ranges: Array<{ start: number; end: number; i: number }> = [];
    def.phases.forEach((p: unknown, i: number) => {
      const label = `phases[${i}]`;
      if (!isRecord(p)) {
        errors.push(`${label} must be an object`);
        return;
      }
      if (!isNonEmptyString(p.name)) errors.push(`${label}.name must be a non-empty string`);
      if (!isIntIn(p.startWeek, 1, weeks) || !isIntIn(p.endWeek, 1, weeks)) {
        errors.push(`${label}.startWeek/endWeek must be integers within 1–${weeks}`);
        return;
      }
      if ((p.startWeek as number) > (p.endWeek as number)) {
        errors.push(`${label}.startWeek must not exceed endWeek`);
        return;
      }
      ranges.push({ start: p.startWeek as number, end: p.endWeek as number, i });

      // Sessions within the phase.
      if (!Array.isArray(p.sessions) || p.sessions.length === 0) {
        errors.push(`${label}.sessions must be a non-empty array`);
      } else {
        const days = new Set<number>();
        p.sessions.forEach((s: unknown, j: number) => {
          const slabel = `${label}.sessions[${j}]`;
          if (!isRecord(s)) {
            errors.push(`${slabel} must be an object`);
            return;
          }
          if (!isIntIn(s.day, 1, 7)) {
            errors.push(`${slabel}.day must be an integer 1–7`);
          } else if (days.has(s.day as number)) {
            errors.push(`${slabel}.day ${s.day} is duplicated within the phase`);
          } else {
            days.add(s.day as number);
          }
          if (!isNonEmptyString(s.routineKbId)) {
            errors.push(`${slabel}.routineKbId must be a non-empty string`);
          }
          if (s.name !== undefined && typeof s.name !== 'string') {
            errors.push(`${slabel}.name must be a string when present`);
          }
        });
        if (typeof def.daysPerWeek === 'number' && days.size > def.daysPerWeek) {
          errors.push(
            `${label} has ${days.size} sessions but daysPerWeek is ${def.daysPerWeek}`,
          );
        }
      }
    });
    ranges.sort((a, b) => a.start - b.start);
    let covered = 0;
    for (const r of ranges) {
      if (r.start !== covered + 1) {
        errors.push(
          `phases must partition weeks 1–${weeks} exactly (gap or overlap at week ${covered + 1})`,
        );
        break;
      }
      covered = r.end;
    }
    if (errors.every((e) => !e.startsWith('phases must partition')) && covered !== weeks) {
      errors.push(`phases cover weeks 1–${covered} but the program has ${weeks} weeks`);
    }
  }

  // Deload: fixed week, volume scaled by (0, 1].
  if (!isRecord(def.deload)) {
    errors.push('deload must be an object');
  } else {
    if (!isIntIn(def.deload.week, 1, weeks)) {
      errors.push(`deload.week must be an integer within 1–${weeks}`);
    }
    const vf = def.deload.volumeFactor;
    if (typeof vf !== 'number' || !Number.isFinite(vf) || vf <= 0 || vf > 1) {
      errors.push('deload.volumeFactor must be a number in (0, 1]');
    }
  }

  // v1 scope enforcement: only linear progression exists.
  // incrementKg / maxWeightKg are optional (#13 engine defaults);
  // when present they must be sane (R2: no absurd jumps, no absurd caps).
  if (!isRecord(def.progression) || def.progression.kind !== 'linear') {
    errors.push("progression.kind must be 'linear' (v1 scope)");
  } else {
    const inc = def.progression.incrementKg;
    if (inc !== undefined) {
      if (typeof inc !== 'number' || !Number.isFinite(inc) || inc <= 0 || inc > 25) {
        errors.push('progression.incrementKg must be a finite number in (0, 25] when present');
      }
    }
    const max = def.progression.maxWeightKg;
    if (max !== undefined) {
      if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0 || max > 1000) {
        errors.push('progression.maxWeightKg must be a finite number in (0, 1000] when present');
      }
    }
  }

  // Safety rails (#14): optional; when present, caps must be sane.
  // Absent = longevity-first defaults (RPE 9, RIR 1) via getSafetyCaps.
  if (def.safety !== undefined) {
    if (!isRecord(def.safety)) {
      errors.push('safety must be an object');
    } else {
      const s = def.safety as Record<string, unknown>;
      if (s.maxRpe !== undefined && !(typeof s.maxRpe === 'number' && s.maxRpe >= 1 && s.maxRpe <= 10)) {
        errors.push('safety.maxRpe must be a number 1–10');
      }
      if (s.minRir !== undefined && !(typeof s.minRir === 'number' && s.minRir >= 0 && s.minRir <= 10)) {
        errors.push('safety.minRir must be a number 0–10');
      }
    }
  }

  if (!Array.isArray(def.pillars)) {
    errors.push('pillars must be an array');
  } else {
    for (const p of def.pillars) {
      if (typeof p !== 'string' || !(LONGEVITY_PILLARS as readonly string[]).includes(p)) {
        errors.push(`pillars contains unknown pillar: ${JSON.stringify(p)}`);
        break;
      }
    }
  }

  if (!isRecord(def.source)) {
    errors.push('source must be an object');
  } else if (def.source.kind === 'kb') {
    if (!isNonEmptyString(def.source.kbId) || !KB_ID_PATTERN.test(def.source.kbId as string)) {
      errors.push('source.kbId must be a valid KB id');
    }
    if (!isNonEmptyString(def.source.kbVersion)) {
      errors.push('source.kbVersion must be a non-empty string');
    }
  } else if (def.source.kind !== 'local') {
    errors.push("source.kind must be 'kb' or 'local'");
  }

  return errors;
}

/** Type guard: narrows unknown to ProgramDefinition when valid. */
export function isValidProgramDefinition(def: unknown): def is ProgramDefinition {
  return validateProgramDefinition(def).length === 0;
}
