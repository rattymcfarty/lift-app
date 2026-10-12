/**
 * Progression engine operations (P3 #13) — DB-backed.
 *
 * How it works:
 * - Each enrollment carries `progression_state`: per-exercise working
 *   weights, e.g. `{ "<exerciseId>": { "weightKg": 100 } }`.
 * - `advanceEnrollment(enrollmentId, workoutId)` runs after a session's
 *   workout is logged: it feeds the logged sets through the pure
 *   progressExercise() rule (v1 linear), persists the new working weights,
 *   and moves the (week, day) pointer. Deload weeks never progress —
 *   recovery weeks don't set new baselines.
 * - `getCurrentSessionTargets(enrollmentId)` resolves "today's" session:
 *   routine template + working weights from state, with the deload
 *   volumeFactor applied on deload weeks (mandatory unless the caller
 *   explicitly overrides — the override is flagged for the UI to log).
 *
 * Conventions mirror src/programs/enrollments.ts: all writes through the
 * global write lock inside runInTransaction, domain errors as ProgramError.
 *
 * KNOWN LIMITATION (#13 follow-up): exercise targets (sets/reps/weight)
 * are read from the LIVE routine_exercises templates, not frozen into the
 * enrollment snapshot. The snapshot freezes the program STRUCTURE (which
 * sessions on which days, deload week, progression kind); routine edits or
 * KB re-imports mid-program will change the targets an in-flight
 * enrollment sees. Freezing targets properly belongs at enrollment time
 * (a #12-scope DSL/snapshot change) — v1 accepts live templates so user
 * routine edits take effect.
 *
 * NOTE: this module imports expo-sqlite (via db/client), so like
 * enrollments.ts it is intentionally NOT re-exported from ./index.ts —
 * the barrel stays runnable in plain Node for unit tests.
 */

import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db, runInTransaction } from '../db/client';
import {
  exercises,
  programEnrollments,
  routineExercises,
  sets,
  workoutExercises,
  workouts,
} from '../db/schema';
import { withWriteLock } from '../data/repositories';
import { ProgramError } from './compile';
import {
  getEnrollment,
  resolveSessionRoutine,
  type EnrolledProgram,
} from './enrollments';
import {
  applyDeloadVolume,
  nextSessionPosition,
  parseRepRange,
  progressExercise,
  resolveProgressionConfig,
  type SessionExerciseTargets,
} from './progression';

/** Default planned sets when a routine template doesn't declare them. */
const DEFAULT_TARGET_SETS = 3;

/** Stored per-exercise working weights. Defensive parse: garbage → {}. */
function parseProgressionState(json: string | null | undefined): Record<string, { weightKg: number }> {
  if (!json) return {};
  try {
    const v: unknown = JSON.parse(json);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
    const out: Record<string, { weightKg: number }> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (
        typeof val === 'object' &&
        val !== null &&
        typeof (val as { weightKg?: unknown }).weightKg === 'number' &&
        Number.isFinite((val as { weightKg: number }).weightKg) &&
        (val as { weightKg: number }).weightKg >= 0
      ) {
        out[k] = { weightKg: (val as { weightKg: number }).weightKg };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export interface AdvanceEnrollmentResult {
  enrollment: EnrolledProgram;
  /** Null when the program just completed (no next session). */
  advancedTo: { week: number; day: number } | null;
  completed: boolean;
  progressionApplied: boolean;
  /** Human-readable why — surfaced in UI/debug, never parsed. */
  progressionReason: string;
}

/**
 * Advance an enrollment after its session workout was logged.
 *
 * - Active enrollments only; anything else throws ProgramError.
 * - When `workoutId` is given and the current week is NOT a deload week,
 *   each exercised logged in that workout is run through the v1 linear
 *   progression rule and the working weights are persisted. The workout
 *   must belong to the current session's routine, otherwise progression
 *   is skipped (pointer still advances — the user did train).
 * - Deload weeks never update progression state.
 * - The pointer moves to the next programmed session; past the last
 *   session the enrollment completes (history kept, never deleted).
 */
export async function advanceEnrollment(
  enrollmentId: string,
  workoutId?: string,
): Promise<AdvanceEnrollmentResult> {
  return withWriteLock(() =>
    runInTransaction(async () => {
      const { enrollment, program } = await getEnrollment(enrollmentId);

      // Idempotency: a retry/double-tap with the same workout must not
      // double-apply progression or skip a session. Safe no-op — checked
      // before the status gate so a retry after completion is also safe.
      if (workoutId && enrollment.lastAdvancedWorkoutId === workoutId) {
        return {
          enrollment: { enrollment, program },
          advancedTo: { week: enrollment.currentWeek, day: enrollment.currentDay },
          completed: enrollment.status === 'completed',
          progressionApplied: false,
          progressionReason: 'already advanced for this workout (idempotent no-op)',
        };
      }

      if (enrollment.status !== 'active') {
        throw new ProgramError(
          `enrollment ${enrollmentId} is ${enrollment.status}, cannot advance`,
        );
      }

      const week = enrollment.currentWeek;
      const day = enrollment.currentDay;
      const isDeloadWeek = program.deload.week === week;
      const config = resolveProgressionConfig(program);
      const state = parseProgressionState(enrollment.progressionState);

      let progressionApplied = false;
      let progressionReason = 'no workout provided';

      if (workoutId) {
        if (isDeloadWeek) {
          progressionReason = 'deload week — progression paused';
        } else {
          const pointer = await resolveSessionRoutine(enrollmentId, week, day);
          const [workout] = await db
            .select()
            .from(workouts)
            .where(and(eq(workouts.id, workoutId), isNull(workouts.deletedAt)))
            .limit(1);
          if (!workout) {
            throw new ProgramError(`workout not found: ${workoutId}`);
          }
          if (!pointer || workout.routineId !== pointer.routine.id) {
            progressionReason = 'workout is not the programmed session — progression skipped';
          } else {
            // Template targets for the session's exercises.
            const templateRows = await db
              .select()
              .from(routineExercises)
              .where(
                and(
                  eq(routineExercises.routineId, pointer.routine.id),
                  isNull(routineExercises.deletedAt),
                ),
              );
            const templateByExercise = new Map(templateRows.map((r) => [r.exerciseId, r]));

            // Logged sets, grouped by exercise.
            const weRows = await db
              .select()
              .from(workoutExercises)
              .where(
                and(
                  eq(workoutExercises.workoutId, workoutId),
                  isNull(workoutExercises.deletedAt),
                ),
              )
              .orderBy(asc(workoutExercises.position));
            const weIds = weRows.map((r) => r.id);
            const setRows =
              weIds.length > 0
                ? await db
                    .select()
                    .from(sets)
                    .where(and(inArray(sets.workoutExerciseId, weIds), isNull(sets.deletedAt)))
                    .orderBy(asc(sets.setNumber))
                : [];
            const setsByWe = new Map<string, typeof setRows>();
            for (const s of setRows) {
              const arr = setsByWe.get(s.workoutExerciseId) ?? [];
              arr.push(s);
              setsByWe.set(s.workoutExerciseId, arr);
            }

            let progressed = 0;
            for (const we of weRows) {
              const template = templateByExercise.get(we.exerciseId);
              if (!template) continue; // user-added exercise: no template, no progression
              const logged = (setsByWe.get(we.id) ?? []).map((s) => ({
                reps: s.reps,
                weightKg: s.weightKg,
                completed: s.completed,
              }));
              const currentWeight =
                state[we.exerciseId]?.weightKg ?? template.targetWeightKg ?? null;
              const result = progressExercise({
                currentWeightKg: currentWeight,
                targetSets: template.targetSets ?? DEFAULT_TARGET_SETS,
                repRange: parseRepRange(template.targetReps),
                lastSets: logged,
                config,
              });
              if (result.nextWeightKg != null) {
                state[we.exerciseId] = { weightKg: result.nextWeightKg };
              } else if (we.exerciseId in state) {
                delete state[we.exerciseId];
              }
              if (result.decision === 'increase') progressed++;
            }
            progressionApplied = true;
            progressionReason =
              progressed > 0
                ? `${progressed} exercise(s) earned +${config.incrementKg} kg`
                : 'no exercise hit the top of its range — weights repeat';
          }
        }
      }

      const next = nextSessionPosition(program, week, day);
      const completed = next === null;
      const [row] = await db
        .update(programEnrollments)
        .set({
          currentWeek: completed ? week : (next as { week: number }).week,
          currentDay: completed ? day : (next as { day: number }).day,
          status: completed ? 'completed' : 'active',
          progressionState: JSON.stringify(state),
          // Idempotency key: a retry with the same workoutId no-ops.
          lastAdvancedWorkoutId: workoutId ?? enrollment.lastAdvancedWorkoutId,
          updatedAt: new Date(),
        })
        .where(eq(programEnrollments.id, enrollmentId))
        .returning();

      return {
        enrollment: { enrollment: row, program },
        advancedTo: next,
        completed,
        progressionApplied,
        progressionReason,
      };
    }),
  );
}

export interface SessionExerciseTarget extends SessionExerciseTargets {
  exerciseId: string;
  exerciseName: string;
  /** 0-based order within the routine. */
  position: number;
  targetRestSeconds: number | null;
}

export interface CurrentSessionTargets {
  enrollmentId: string;
  week: number;
  day: number;
  sessionName?: string;
  routineId: string;
  routineName: string;
  isDeloadWeek: boolean;
  /** True when the deload volumeFactor was applied to these targets. */
  deloadApplied: boolean;
  /**
   * True when the caller explicitly overrode a deload week. R2: deloads
   * are mandatory — the UI must log this override (e.g. workout notes).
   */
  deloadOverridden: boolean;
  volumeFactor: number | null;
  exercises: SessionExerciseTarget[];
}

/**
 * Resolve "today's" session targets for an enrollment: the routine
 * template plus per-exercise working weights from progression state,
 * with the deload volumeFactor applied on deload weeks.
 *
 * Pass `{ overrideDeload: true }` only with explicit user intent to
 * train through a deload — the returned `deloadOverridden` flag tells
 * the UI to log it. Throws ProgramError for non-active enrollments or
 * positions with no programmed session.
 */
export async function getCurrentSessionTargets(
  enrollmentId: string,
  opts?: { overrideDeload?: boolean },
): Promise<CurrentSessionTargets> {
  const { enrollment, program } = await getEnrollment(enrollmentId);
  if (enrollment.status !== 'active') {
    throw new ProgramError(
      `enrollment ${enrollmentId} is ${enrollment.status} — no current session`,
    );
  }
  const pointer = await resolveSessionRoutine(enrollmentId);
  if (!pointer) {
    throw new ProgramError(
      `enrollment ${enrollmentId} points at week ${enrollment.currentWeek} ` +
        `day ${enrollment.currentDay} with no programmed session`,
    );
  }

  const rows = await db
    .select({ re: routineExercises, name: exercises.name })
    .from(routineExercises)
    .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(
      and(
        eq(routineExercises.routineId, pointer.routine.id),
        isNull(routineExercises.deletedAt),
      ),
    )
    .orderBy(asc(routineExercises.position));

  const state = parseProgressionState(enrollment.progressionState);
  const deloadWanted = pointer.isDeloadWeek && !opts?.overrideDeload;

  const targets: SessionExerciseTarget[] = rows.map(({ re, name }) => {
    const repRange = parseRepRange(re.targetReps);
    const base: SessionExerciseTargets = {
      sets: re.targetSets ?? DEFAULT_TARGET_SETS,
      repMin: repRange?.min ?? null,
      repMax: repRange?.max ?? null,
      weightKg: state[re.exerciseId]?.weightKg ?? re.targetWeightKg ?? null,
    };
    const final = deloadWanted ? applyDeloadVolume(base, program.deload.volumeFactor) : base;
    return {
      exerciseId: re.exerciseId,
      exerciseName: name,
      position: re.position,
      targetRestSeconds: re.targetRestSeconds ?? null,
      ...final,
    };
  });

  return {
    enrollmentId,
    week: pointer.week,
    day: pointer.day,
    sessionName: pointer.sessionName,
    routineId: pointer.routine.id,
    routineName: pointer.routine.name,
    isDeloadWeek: pointer.isDeloadWeek,
    deloadApplied: deloadWanted,
    deloadOverridden: pointer.isDeloadWeek && opts?.overrideDeload === true,
    volumeFactor: pointer.isDeloadWeek ? program.deload.volumeFactor : null,
    exercises: targets,
  };
}
