/**
 * Enrollment snapshots (P3 #12).
 *
 * When a user enrolls, the program definition is frozen as canonical JSON
 * into program_enrollments.snapshot. Later edits to the program (KB bundle
 * updates, local edits) NEVER affect an in-flight enrollment — the snapshot
 * is the source of truth #13's engine reads.
 *
 * Canonicalization (recursively sorted keys) makes the frozen form
 * deterministic: the same definition always freezes to the same string.
 */

import { ProgramError } from './compile';
import { type ProgramDefinition } from './types';
import { validateProgramDefinition } from './validate';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value !== 'object') {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      return value;
    }
    throw new ProgramError('snapshot values must be JSON-serializable');
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const out: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return out;
}

/**
 * Freeze a validated definition into its canonical JSON snapshot string.
 * Throws ProgramError when the definition is invalid — never freeze
 * something the engine can't honor.
 */
export function freezeSnapshot(def: ProgramDefinition): string {
  const errors = validateProgramDefinition(def);
  if (errors.length > 0) {
    throw new ProgramError(`cannot freeze invalid program: ${errors.join('; ')}`);
  }
  return JSON.stringify(canonicalize(def));
}

/**
 * Parse a stored snapshot back into a ProgramDefinition.
 * Throws ProgramError on corrupt JSON or on a snapshot that no longer
 * validates (schema drift) — callers must treat this as data corruption,
 * not as a cue to "fix" the snapshot in place.
 */
export function parseSnapshot(json: string): ProgramDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ProgramError('enrollment snapshot is not valid JSON');
  }
  const errors = validateProgramDefinition(parsed);
  if (errors.length > 0) {
    throw new ProgramError(`enrollment snapshot failed validation: ${errors.join('; ')}`);
  }
  return parsed as ProgramDefinition;
}
