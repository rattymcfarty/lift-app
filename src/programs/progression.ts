/**
 * Linear progression + fixed deload engine (P3 #13) — PURE functions.
 *
 * v1 rules only (per plan):
 * - When every completed set of an exercise hits the TOP of its target rep
 *   range → working weight increases by the program's incrementKg
 *   (default 2.5kg), capped at the DSL's maxWeightKg (R2 guardrail).
 * - Anything else (missed reps, short sets, no assessable sets) → repeat
 *   the weight. Repeating is always safe; the engine never guesses.
 * - Deload weeks scale sets × weight by the snapshot's volumeFactor.
 *   Deloads are mandatory: skipping one requires an explicit override at
 *   the call site (see engine.ts), which the caller must log.
 *
 * This module is runtime-dependency-free (type-only imports) so it is
 * unit-testable in plain Node. DB-backed operations live in ./engine.ts.
 */

import { phaseForWeek } from './compile';
import type { ProgramDefinition } from './types';

/** Default increment when the DSL doesn't declare one (pre-#13 snapshots). */
export const DEFAULT_INCREMENT_KG = 2.5 as const;

/** Resolved linear-progression parameters for one program. */
export interface ResolvedProgressionConfig {
  incrementKg: number;
  /** Null = uncapped. */
  maxWeightKg: number | null;
}

/**
 * Resolve the effective progression config: explicit DSL values win,
 * absent values fall back to v1 defaults. Never throws on valid programs.
 */
export function resolveProgressionConfig(
  program: ProgramDefinition,
): ResolvedProgressionConfig {
  const p = program.progression;
  return {
    incrementKg:
      typeof p.incrementKg === 'number' && Number.isFinite(p.incrementKg) && p.incrementKg > 0
        ? p.incrementKg
        : DEFAULT_INCREMENT_KG,
    maxWeightKg:
      typeof p.maxWeightKg === 'number' && Number.isFinite(p.maxWeightKg) && p.maxWeightKg > 0
        ? p.maxWeightKg
        : null,
  };
}

/** Parsed target rep range. max === null means open-ended ("8+"). */
export interface RepRange {
  min: number;
  max: number | null;
}

const RANGE_RE = /^(\d+)\s*[-–—]\s*(\d+)$/;
const SINGLE_RE = /^(\d+)$/;
const OPEN_RE = /^(\d+)\s*\+$/;

/**
 * Parse a routine template's targetReps text ("8-12", "8", "8+").
 * Returns null when absent or unparseable — the engine then repeats
 * rather than guessing (safe default).
 */
export function parseRepRange(targetReps: string | null | undefined): RepRange | null {
  if (targetReps == null) return null;
  const t = targetReps.trim();
  if (t.length === 0) return null;

  let m = RANGE_RE.exec(t);
  if (m) {
    const min = Number(m[1]);
    const max = Number(m[2]);
    if (min >= 1 && max >= min && max <= 1000) return { min, max };
    return null;
  }
  m = SINGLE_RE.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 1000) return { min: n, max: n };
    return null;
  }
  m = OPEN_RE.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 1000) return { min: n, max: null };
    return null;
  }
  return null;
}

/** Minimal shape of a logged set the progression rule reads. */
export interface LoggedSetSummary {
  reps: number | null;
  weightKg: number | null;
  completed: boolean;
}

export interface ProgressExerciseInput {
  /** Current working weight in kg. Null = bodyweight/unweighted. */
  currentWeightKg: number | null;
  /** Planned sets for the session (from the routine template). */
  targetSets: number;
  /** Parsed rep range, or null when the template has none. */
  repRange: RepRange | null;
  /** Sets from the last performed session (completed flag respected). */
  lastSets: LoggedSetSummary[];
  config: ResolvedProgressionConfig;
}

export interface ProgressExerciseResult {
  nextWeightKg: number | null;
  decision: 'increase' | 'repeat';
  /** Human-readable why — surfaced in UI/debug, never parsed. */
  reason: string;
}

/** Round to 2 decimals: kills float dust (62.50000001), keeps plate math sane. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * v1 linear progression for one exercise. Pure: same inputs → same outputs.
 *
 * Increase requires ALL of: at least targetSets completed sets with reps,
 * a closed rep range, every set at/above the range top, and a weighted
 * (non-bodyweight) exercise. The result never exceeds maxWeightKg.
 */
export function progressExercise(input: ProgressExerciseInput): ProgressExerciseResult {
  const { currentWeightKg, targetSets, repRange, lastSets, config } = input;

  const assessable = lastSets.filter((s) => s.completed && s.reps != null);
  if (assessable.length === 0) {
    return { nextWeightKg: currentWeightKg, decision: 'repeat', reason: 'no completed sets logged' };
  }
  if (repRange == null) {
    return { nextWeightKg: currentWeightKg, decision: 'repeat', reason: 'no rep range on template' };
  }
  if (repRange.max == null) {
    return {
      nextWeightKg: currentWeightKg,
      decision: 'repeat',
      reason: 'open-ended rep range has no top to hit',
    };
  }
  if (currentWeightKg == null) {
    return {
      nextWeightKg: null,
      decision: 'repeat',
      reason: 'bodyweight exercise — progress via reps',
    };
  }
  if (assessable.length < targetSets) {
    return {
      nextWeightKg: currentWeightKg,
      decision: 'repeat',
      reason: `only ${assessable.length}/${targetSets} sets completed`,
    };
  }
  const top = repRange.max;
  const allHitTop = assessable.every((s) => (s.reps as number) >= top);
  if (!allHitTop) {
    return {
      nextWeightKg: currentWeightKg,
      decision: 'repeat',
      reason: 'reps missed the top of the range',
    };
  }

  // All sets hit the top → earn the increment, respecting the cap.
  if (config.maxWeightKg != null && currentWeightKg >= config.maxWeightKg) {
    return {
      nextWeightKg: currentWeightKg,
      decision: 'repeat',
      reason: `at maxWeightKg cap (${config.maxWeightKg} kg)`,
    };
  }
  let next = round2(currentWeightKg + config.incrementKg);
  if (config.maxWeightKg != null && next > config.maxWeightKg) {
    next = config.maxWeightKg;
  }
  return {
    nextWeightKg: next,
    decision: 'increase',
    reason: `all sets hit ${top} reps → +${config.incrementKg} kg`,
  };
}

/** Per-exercise session targets (what the workout UI renders). */
export interface SessionExerciseTargets {
  sets: number;
  repMin: number | null;
  repMax: number | null;
  weightKg: number | null;
}

/**
 * Apply a deload week's volumeFactor: scale sets and weight down.
 * Reps are untouched (the task is recovery, not re-testing).
 * Sets never drop below 1; weight rounds to 0.5 kg granularity.
 */
export function applyDeloadVolume(
  targets: SessionExerciseTargets,
  volumeFactor: number,
): SessionExerciseTargets {
  if (!Number.isFinite(volumeFactor) || volumeFactor <= 0 || volumeFactor > 1) {
    throw new Error(`volumeFactor must be in (0, 1], got ${volumeFactor}`);
  }
  return {
    sets: Math.max(1, Math.round(targets.sets * volumeFactor)),
    repMin: targets.repMin,
    repMax: targets.repMax,
    weightKg:
      targets.weightKg == null
        ? null
        : Math.max(0, Math.round((targets.weightKg * volumeFactor) * 2) / 2),
  };
}

/**
 * Advance the (week, day) pointer to the next programmed session.
 * Skips rest days; rolls over to the next week's first session day.
 * Returns null when no sessions remain (program complete).
 * Pure — the DB write lives in engine.ts.
 */
export function nextSessionPosition(
  program: ProgramDefinition,
  week: number,
  day: number,
): { week: number; day: number } | null {
  const phase = phaseForWeek(program, week);
  if (!phase) return null;
  const days = phase.sessions.map((s) => s.day).sort((a, b) => a - b);
  const later = days.find((d) => d > day);
  if (later !== undefined) return { week, day: later };
  for (let w = week + 1; w <= program.weeks; w++) {
    const p = phaseForWeek(program, w);
    if (p && p.sessions.length > 0) {
      const first = Math.min(...p.sessions.map((s) => s.day));
      return { week: w, day: first };
    }
  }
  return null;
}
