/**
 * Program DSL (P3 #12).
 *
 * Pure program model: types, validation, KB compilation, snapshots.
 * Database operations (enrollment lifecycle) live in ./enrollments.
 */
export * from './types';
export { validateProgramDefinition, isValidProgramDefinition } from './validate';
export {
  ProgramError,
  compileKbProgram,
  programRoutineKbIds,
  phaseForWeek,
} from './compile';
export { freezeSnapshot, parseSnapshot } from './snapshot';
