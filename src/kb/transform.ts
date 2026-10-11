/**
 * Pure transforms: KB bundle JSON → repository inputs.
 *
 * Everything here is side-effect free and dependency-free (no expo-sqlite,
 * no network) so it runs identically in node (unit tests) and Hermes.
 * The thin DB-write wrappers live in import.ts.
 */
import type { ExerciseCategory, LongevityPillar } from '../db/schema';
import type { KbExerciseJson, KbProgramBlock, KbProgramJson } from './types';

/** KB movementPattern → app exercise category. */
export function categoryForPattern(
  pattern: KbExerciseJson['movementPattern'],
): ExerciseCategory {
  switch (pattern) {
    case 'cardio':
      return 'cardio';
    case 'mobility':
      return 'mobility';
    default:
      return 'strength'; // squat, hinge, push, pull, carry, lunge, core
  }
}

/** KB movementPattern → longevity pillars (v1 model: strength + cardio). */
export function pillarsForPattern(
  pattern: KbExerciseJson['movementPattern'],
): LongevityPillar[] {
  switch (pattern) {
    case 'cardio':
      return ['cardio'];
    case 'mobility':
      return ['mobility'];
    case 'lunge':
    case 'carry':
      return ['strength', 'balance']; // single-leg / loaded-carry balance demand
    default:
      return ['strength'];
  }
}

/**
 * Format KB prose for the app's instructions column:
 * numbered steps, then coaching cues, then safety. Human-readable in the UI.
 */
export function formatInstructions(ex: KbExerciseJson): string {
  const parts: string[] = [];
  ex.instructions.forEach((step, i) => parts.push(`${i + 1}. ${step}`));
  if (ex.cues && ex.cues.length > 0) {
    parts.push('', 'Cues:');
    ex.cues.forEach((c) => parts.push(`• ${c}`));
  }
  if (ex.commonMistakes && ex.commonMistakes.length > 0) {
    parts.push('', 'Watch out for:');
    ex.commonMistakes.forEach((m) => parts.push(`• ${m}`));
  }
  if (ex.safetyNotes) {
    parts.push('', `Safety: ${ex.safetyNotes}`);
  }
  return parts.join('\n');
}

/** Input shape for upsertKbExercise (mirrors its parameter type). */
export interface KbExerciseUpsertInput {
  kbId: string;
  kbVersion: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  category: ExerciseCategory;
  instructions: string;
  longevityNotes: string;
  mediaImageUrl?: string;
  mediaVideoUrl?: string;
  longevityPillars: LongevityPillar[];
}

/** Map a KB exercise to its repository upsert input. */
export function kbExerciseToUpsertInput(
  ex: KbExerciseJson,
  bundleVersion: string,
): KbExerciseUpsertInput {
  return {
    kbId: ex.id,
    kbVersion: bundleVersion,
    name: ex.name,
    primaryMuscles: ex.muscles.primary,
    secondaryMuscles: ex.muscles.secondary ?? [],
    equipment: ex.equipment,
    category: categoryForPattern(ex.movementPattern),
    instructions: formatInstructions(ex),
    longevityNotes: ex.longevityNotes,
    mediaImageUrl: ex.demoMedia?.images?.[0],
    mediaVideoUrl: ex.demoMedia?.video ?? undefined,
    longevityPillars: pillarsForPattern(ex.movementPattern),
  };
}

/** One routine to create/update from a KB program session. */
export interface KbRoutineUpsertInput {
  /** Deterministic: "<program-id>--session-<day>". */
  kbId: string;
  kbVersion: string;
  name: string;
  notes: string;
  longevityPillars: LongevityPillar[];
  items: Array<{
    exerciseKbId: string;
    position: number;
    targetSets?: number;
    targetReps?: string;
    targetRestSeconds?: number;
    targetRpe?: number;
    notes?: string;
  }>;
}

function sessionPillars(blocks: KbProgramBlock[], exercisePatterns: Map<string, KbExerciseJson['movementPattern']>): LongevityPillar[] {
  const pillars = new Set<LongevityPillar>();
  for (const b of blocks) {
    const pattern = exercisePatterns.get(b.exerciseId);
    if (pattern) {
      for (const p of pillarsForPattern(pattern)) pillars.add(p);
    }
  }
  return pillars.size > 0 ? [...pillars] : ['strength'];
}

/**
 * Map a KB program to routine upsert inputs — one routine per session.
 * The program-level envelope (weeks, deload) is P3's domain; P2 imports
 * sessions as startable routines, which is what the UI needs today.
 *
 * Throws if a block references an exercise not present in `exercises`
 * (fail the import loudly rather than hitting an FK violation mid-write).
 */
export function kbProgramToRoutineInputs(
  program: KbProgramJson,
  exercises: KbExerciseJson[],
  bundleVersion: string,
): KbRoutineUpsertInput[] {
  const patterns = new Map(exercises.map((e) => [e.id, e.movementPattern]));
  return program.sessions.map((session) => {
    for (const block of session.blocks) {
      if (!patterns.has(block.exerciseId)) {
        throw new Error(
          `program "${program.id}" session day ${session.day} references unknown exercise "${block.exerciseId}"`,
        );
      }
    }
    const sessionLabel = session.name ? ` — ${session.name}` : '';
    return {
      kbId: `${program.id}--session-${session.day}`,
      kbVersion: bundleVersion,
      name: `${program.name} — Day ${session.day}${sessionLabel}`,
      notes: [
        program.goal,
        `Week ${program.deload.week} is a deload week (volume ×${program.deload.volumeFactor}).`,
        `${program.weeks} weeks, ${program.daysPerWeek} days/week.`,
      ].join('\n'),
      longevityPillars: sessionPillars(session.blocks, patterns),
      items: session.blocks.map((block, i) => ({
        exerciseKbId: block.exerciseId,
        position: i,
        targetSets: block.sets,
        targetReps: block.reps,
        targetRestSeconds: block.restSeconds,
        targetRpe: block.rpeCap,
        notes: block.notes,
      })),
    };
  });
}
