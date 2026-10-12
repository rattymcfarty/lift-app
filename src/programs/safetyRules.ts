/**
 * Safety rails — pure rules (P3 #14).
 *
 * DB-free subset of the safety system, kept in its own module so it is
 * unit-testable in plain Node (see safety.test.cjs): the PAR-Q+
 * questionnaire items, the RPE/RIR cap checker, and the program-session
 * calendar math. DB-backed operations live in ./safety.ts and
 * ./sessions.ts, which re-export from here.
 */

import type { ProgramDefinition, ProgramSafetyCaps } from './types';

/* ------------------------------------------------------------------ */
/* PAR-Q+ questionnaire                                                */
/*                                                                     */
/* The 7 general-health questions from the Physical Activity Readiness */
/* Questionnaire for Everyone (PAR-Q+), © the PAR-Q+ Collaboration     */
/* (parqplus.com). Reproduced here for its intended screening purpose  */
/* with attribution; not public domain. If you answered NO to all 7,   */
/* the official form clears you for physical activity; any YES routes  */
/* to "seek further advice from your doctor or a qualified exercise    */
/* professional" — which this app implements as the medical-clearance  */
/* acknowledgment gate.                                                */
/* ------------------------------------------------------------------ */

/** The 7 PAR-Q+ general-health questions, in canonical order. */
export const PARQ_QUESTIONS = [
  'Has your doctor ever said that you have a heart condition OR high blood pressure?',
  'Do you feel pain in your chest at rest, during your daily activities of living, OR when you do physical activity?',
  'Do you lose balance because of dizziness OR have you lost consciousness in the last 12 months? (Answer NO if your dizziness was associated with over-breathing, including during vigorous exercise.)',
  'Have you ever been diagnosed with another chronic medical condition (other than heart disease or high blood pressure)?',
  'Are you currently taking prescribed medications for a chronic medical condition?',
  'Do you currently have (or have had within the past 12 months) a bone, joint, or soft tissue (muscle, ligament, or tendon) problem that could be made worse by becoming more physically active? (Answer NO if you had a problem in the past, but it does not limit your current ability to be physically active.)',
  'Has your doctor ever said that you should only do medically supervised physical activity?',
] as const;

export const PARQ_QUESTION_COUNT = PARQ_QUESTIONS.length;

/** A screening is fresh for 12 months; older requires re-screening. */
export const PARQ_FRESHNESS_MS = 365 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* RPE / RIR caps — pure checker                                       */
/* ------------------------------------------------------------------ */

export interface RpeCapViolation {
  /** Which cap was exceeded. */
  type: 'rpe-exceeded' | 'rir-below-min';
  /** The cap value from the program. */
  cap: number;
  /** The logged value that violated it. */
  actual: number;
  /** Human-readable, UI-ready (never parsed). */
  message: string;
}

/**
 * Pure cap check: compare a logged set's RPE/RIR against the program's
 * caps. Returns violations (possibly empty). Never throws on missing
 * data — a set without RPE/RIR simply has nothing to check.
 *
 * Warnings are non-blocking by design: longevity-first means the app
 * flags pushing toward failure, never forbids logging the truth.
 */
export function checkRpeCaps(
  caps: ProgramSafetyCaps | null | undefined,
  rpe: number | null | undefined,
  rir: number | null | undefined,
): RpeCapViolation[] {
  const violations: RpeCapViolation[] = [];
  if (!caps) return violations;
  if (
    caps.maxRpe !== undefined &&
    typeof rpe === 'number' &&
    Number.isFinite(rpe) &&
    rpe > caps.maxRpe
  ) {
    violations.push({
      type: 'rpe-exceeded',
      cap: caps.maxRpe,
      actual: rpe,
      message: `RPE ${rpe} is above this program's cap of ${caps.maxRpe} — consider stopping a rep or two earlier next set.`,
    });
  }
  if (
    caps.minRir !== undefined &&
    typeof rir === 'number' &&
    Number.isFinite(rir) &&
    rir < caps.minRir
  ) {
    violations.push({
      type: 'rir-below-min',
      cap: caps.minRir,
      actual: rir,
      message: `RIR ${rir} is below this program's floor of ${caps.minRir} — leave more in the tank to stay in the longevity zone.`,
    });
  }
  return violations;
}

/* ------------------------------------------------------------------ */
/* Session calendar math — pure                                        */
/*                                                                     */
/* Scheduling model: program week 1 starts on the enrollment calendar  */
/* date. Session (week W, day D) is scheduled for                      */
/* startOfDay(enrolledAt) + (W-1)*7 + (D-1) days. Day numbers are       */
/* program-relative (day 1 = first training day), not calendar          */
/* weekdays — the DSL carries no weekday mapping.                       */
/* ------------------------------------------------------------------ */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Grace period after a scheduled date before a session counts as missed. */
export const MISSED_GRACE_MS = 24 * 60 * 60 * 1000;

/** How far past the scheduled date we still link a workout to its session. */
export const WORKOUT_LINK_WINDOW_MS = 48 * 60 * 60 * 1000;

/** How far BEFORE the scheduled date a workout still counts (trained early). */
export const EARLY_LINK_MS = 24 * 60 * 60 * 1000;

/** Start of the calendar day (local time) for a timestamp. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Pure: calendar date (start of day, ms) for program (week, day) given the
 * enrollment timestamp. DST-safe via calendar arithmetic (fixed 24h blocks
 * drift by an hour across DST transitions). Throws on invalid input —
 * callers validate before any write.
 */
export function scheduledDateFor(
  enrolledAtMs: number,
  week: number,
  day: number,
): number {
  if (!Number.isInteger(week) || week < 1) {
    throw new Error(`invalid program week: ${week}`);
  }
  if (!Number.isInteger(day) || day < 1 || day > 7) {
    throw new Error(`invalid program day: ${day}`);
  }
  const base = new Date(startOfDay(enrolledAtMs));
  base.setDate(base.getDate() + (week - 1) * 7 + (day - 1));
  return startOfDay(base.getTime());
}

/** Pure: all (week, day, routineKbId) triples in a program definition. */
export function programSessions(
  program: ProgramDefinition,
): Array<{ week: number; day: number; routineKbId: string }> {
  const out: Array<{ week: number; day: number; routineKbId: string }> = [];
  for (const phase of program.phases) {
    for (let w = phase.startWeek; w <= phase.endWeek; w++) {
      for (const s of phase.sessions) {
        out.push({ week: w, day: s.day, routineKbId: s.routineKbId });
      }
    }
  }
  return out;
}
