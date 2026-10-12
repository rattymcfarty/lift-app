/**
 * Program DSL (P3 #12) + progression engine (P3 #13).
 *
 * Pure program model: types, validation, KB compilation, snapshots,
 * linear progression + deloads. Database operations (enrollment lifecycle
 * in ./enrollments, progression advancement in ./engine) live outside this
 * barrel — they import expo-sqlite, which plain Node can't load. Unit
 * tests require the pure modules directly.
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
export {
  DEFAULT_INCREMENT_KG,
  applyDeloadVolume,
  nextSessionPosition,
  parseRepRange,
  progressExercise,
  resolveProgressionConfig,
} from './progression';
export type {
  LoggedSetSummary,
  ProgressExerciseInput,
  ProgressExerciseResult,
  RepRange,
  ResolvedProgressionConfig,
  SessionExerciseTargets,
} from './progression';
// Pure safety rules only — DB-backed operations (./safety, ./sessions,
// ./enrollments) are imported directly, mirroring the enrollments pattern.
export {
  PARQ_QUESTIONS,
  PARQ_QUESTION_COUNT,
  PARQ_FRESHNESS_MS,
  checkRpeCaps,
  MISSED_GRACE_MS,
  WORKOUT_LINK_WINDOW_MS,
  startOfDay,
  scheduledDateFor,
  programSessions,
} from './safetyRules';
export type { RpeCapViolation } from './safetyRules';
