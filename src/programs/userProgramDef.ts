/**
 * User-built programs — PURE model + compiler to the program DSL.
 *
 * A user program is: a name, a duration in weeks, a schedule mode, and an
 * ordered list of days per week. Each DAY is an ordinary plan (routine); the
 * program only stores which routine ids make up each week. That keeps the
 * exercises, sets/reps targets, history and backups on the existing,
 * well-tested paths.
 *
 *  - 'repeating': one week template, repeated for `weeks` weeks.
 *  - 'custom':    every week has its own list of days (weekDays.length === weeks).
 *
 * Compilation maps this onto ProgramDefinition (phases → sessions) so the
 * existing PAR-Q+ gate, enrollment, scheduling and progression engine apply
 * unchanged. No I/O here, so every rule is unit-tested.
 */
import {
  PROGRAM_DSL_VERSION,
  type ProgramDefinition,
  type ProgramPhase,
  type ProgramSession,
} from './types';

export type ProgramSchedule = 'repeating' | 'custom';

export interface UserProgram {
  id: string;
  name: string;
  weeks: number;
  schedule: ProgramSchedule;
  /** Routine ids. repeating → length 1; custom → length === weeks. */
  weekDays: string[][];
  /** 1-based deload week (50% volume), or null for none. */
  deloadWeek: number | null;
  createdAt: number;
  updatedAt: number;
}

export const MIN_WEEKS = 1;
export const MAX_WEEKS = 52;
export const MAX_DAYS_PER_WEEK = 7;
/** Offered in the duration picker (any 1–52 is accepted by the model). */
export const WEEK_CHOICES = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 36, 52] as const;

/** Prefix that marks a routine as belonging to a user program. */
export const USER_PROGRAM_KB_PREFIX = 'uprog:';

/**
 * Training days are spread across the 7-day cycle (rest days in between)
 * instead of stacked on consecutive dates: 3 days → Mon/Wed/Fri-style.
 */
export const SESSION_DAYS: Record<number, readonly number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

/** Stable, unique routine key. weekIdx and dayIdx are 0-based. */
export function userRoutineKbId(programId: string, weekIdx: number, dayIdx: number): string {
  return `${USER_PROGRAM_KB_PREFIX}${programId}:w${weekIdx + 1}:d${dayIdx + 1}`;
}

export function isUserProgramRoutine(kbId: string | null | undefined): boolean {
  return typeof kbId === 'string' && kbId.startsWith(USER_PROGRAM_KB_PREFIX);
}

/** Default day names: "Workout A", "Workout B", … */
export function defaultDayName(dayIdx: number): string {
  return `Workout ${String.fromCharCode(65 + (dayIdx % 26))}`;
}

/** Number of week templates the model actually stores. */
export function templateWeekCount(p: Pick<UserProgram, 'schedule' | 'weeks'>): number {
  return p.schedule === 'repeating' ? 1 : p.weeks;
}

export function daysPerWeekOf(p: Pick<UserProgram, 'weekDays'>): number {
  return p.weekDays.reduce((m, d) => Math.max(m, d.length), 0);
}

export function totalDays(p: Pick<UserProgram, 'weekDays' | 'schedule' | 'weeks'>): number {
  return p.schedule === 'repeating'
    ? p.weekDays[0]?.length * p.weeks || 0
    : p.weekDays.reduce((n, d) => n + d.length, 0);
}

/** Structural problems that stop a program from being started (empty → ok). */
export function programIssues(p: UserProgram): string[] {
  const issues: string[] = [];
  if (p.name.trim() === '') issues.push('Give the program a name.');
  if (!Number.isInteger(p.weeks) || p.weeks < MIN_WEEKS || p.weeks > MAX_WEEKS) {
    issues.push(`Duration must be ${MIN_WEEKS}–${MAX_WEEKS} weeks.`);
  }
  if (p.weekDays.length !== templateWeekCount(p)) issues.push('Weeks are out of sync — reopen the program.');
  p.weekDays.forEach((days, w) => {
    const label = p.schedule === 'repeating' ? 'The week' : `Week ${w + 1}`;
    if (days.length === 0) issues.push(`${label} has no days. Add at least one.`);
    if (days.length > MAX_DAYS_PER_WEEK) issues.push(`${label} has more than ${MAX_DAYS_PER_WEEK} days.`);
  });
  if (p.deloadWeek != null && (p.deloadWeek < 1 || p.deloadWeek > p.weeks)) {
    issues.push('Deload week is outside the program.');
  }
  return issues;
}

/**
 * Compiles to the DSL. `dayNames` (routineId → name) is optional and only
 * labels sessions. Throws when the structure is invalid (see programIssues).
 */
export function buildDefinition(p: UserProgram, dayNames?: ReadonlyMap<string, string>): ProgramDefinition {
  const issues = programIssues(p);
  if (issues.length > 0) throw new RangeError(issues[0]);

  const sessionsFor = (weekIdx: number, ids: readonly string[]): ProgramSession[] => {
    const slots = SESSION_DAYS[ids.length] ?? SESSION_DAYS[7];
    return ids.map((rid, i) => ({
      day: slots[i],
      routineKbId: userRoutineKbId(p.id, weekIdx, i),
      ...(dayNames?.get(rid) ? { name: dayNames.get(rid) as string } : {}),
    }));
  };

  const phases: ProgramPhase[] =
    p.schedule === 'repeating'
      ? [{ name: 'Training', startWeek: 1, endWeek: p.weeks, sessions: sessionsFor(0, p.weekDays[0]) }]
      : p.weekDays.map((ids, w) => ({
          name: `Week ${w + 1}`,
          startWeek: w + 1,
          endWeek: w + 1,
          sessions: sessionsFor(w, ids),
        }));

  return {
    schemaVersion: PROGRAM_DSL_VERSION,
    id: p.id,
    name: p.name.trim(),
    goal: 'Custom program',
    weeks: p.weeks,
    daysPerWeek: daysPerWeekOf(p),
    phases,
    // The DSL requires one deload entry; factor 1 means "no volume change".
    deload: p.deloadWeek != null ? { week: p.deloadWeek, volumeFactor: 0.5 } : { week: p.weeks, volumeFactor: 1 },
    progression: { kind: 'linear' },
    pillars: [],
    source: { kind: 'local' },
  };
}
