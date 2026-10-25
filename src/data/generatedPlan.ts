/**
 * Turns a profile into real, editable plans in the user's library.
 * Generation is pure (src/lib/planGenerator.ts); this file only maps the
 * knowledge-base ids onto local exercise rows and writes the routines.
 */
import { loadSnapshot } from '../kb/snapshot';
import {
  addRoutineExercise,
  createRoutine,
  listExercises,
  listRoutines,
  softDeleteRoutine,
} from './repositories';
import type { Profile } from './profile';
import { generatePlan, type CatalogueExercise } from '../lib/planGenerator';
import type { LongevityPillar } from '../db/schema';

/** Name prefix that marks plans built from the profile (so they can be refreshed). */
export const GENERATED_PREFIX = 'My Plan · ';

export const GOAL_LABEL: Record<Profile['goal'], string> = {
  longevity: 'Longevity',
  strength: 'Strength',
  muscle: 'Muscle',
  fitness: 'General fitness',
};

export interface BuildResult {
  planIds: string[];
  skippedItems: number;
}

/**
 * Builds the user's plan set. When `replaceExisting` is true, previous
 * generated plans (and only those) are removed first, so regenerating after
 * a profile change never piles up copies. Plans the user created or
 * duplicated themselves are never touched.
 */
function kbCatalogue(): CatalogueExercise[] {
  const { bundle } = loadSnapshot();
  return bundle.exercises
    .filter((e) => !e.deprecated)
    .map((e) => ({
      id: e.id,
      name: e.name,
      equipment: e.equipment,
      movementPattern: e.movementPattern,
      category: e.category,
      difficulty: e.difficulty,
    }));
}

/**
 * What the generator would build for this profile — names resolved, nothing
 * written. The guided interview's review step reads this, so the user sees the
 * exact days and prescriptions *before* anything is saved, and "Build" then
 * writes that same set (`buildPlansFromProfile` uses the same generator input).
 */
export interface PreviewItem {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  weightKg?: number;
}
export interface PreviewDay {
  name: string;
  items: PreviewItem[];
}
export function previewPlans(profile: Profile): PreviewDay[] {
  const { bundle } = loadSnapshot();
  const names = new Map(bundle.exercises.map((e) => [e.id, e.name]));
  return generatePlan(
    {
      experience: profile.experience,
      goal: profile.goal,
      daysPerWeek: profile.daysPerWeek,
      minutes: profile.minutes,
      equipment: profile.equipment,
      limitations: profile.limitations,
      weightKg: profile.weightKg,
    },
    kbCatalogue(),
  ).map((day) => ({
    name: day.name,
    items: day.items.map((item) => ({
      name: names.get(item.exerciseId) ?? item.exerciseId,
      sets: item.sets,
      reps: item.reps,
      restSeconds: item.restSeconds,
      ...(item.weightKg !== undefined ? { weightKg: item.weightKg } : {}),
    })),
  }));
}

export async function buildPlansFromProfile(
  profile: Profile,
  opts: { replaceExisting?: boolean } = {},
): Promise<BuildResult> {
  const { bundle } = loadSnapshot();
  const catalogue = kbCatalogue();

  const days = generatePlan(
    {
      experience: profile.experience,
      goal: profile.goal,
      daysPerWeek: profile.daysPerWeek,
      minutes: profile.minutes,
      equipment: profile.equipment,
      limitations: profile.limitations,
      weightKg: profile.weightKg,
    },
    catalogue,
  );

  const rows = await listExercises();
  const localByKbId = new Map<string, string>();
  for (const r of rows) if (r.kbId) localByKbId.set(r.kbId, r.id);

  if (opts.replaceExisting) {
    const existing = await listRoutines();
    for (const r of existing) {
      if (r.name.startsWith(GENERATED_PREFIX)) await softDeleteRoutine(r.id);
    }
  }

  const planIds: string[] = [];
  let skipped = 0;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const pillars: LongevityPillar[] = ['strength'];
    if (day.items.some((it) => /stretch|flow|cat-cow|openers/.test(it.exerciseId))) pillars.push('mobility');
    const planId = await createRoutine({
      name: `${GENERATED_PREFIX}Day ${i + 1} · ${day.name}`,
      notes: `Built for you — ${GOAL_LABEL[profile.goal]}, ${profile.daysPerWeek} days a week. Change anything you like.`,
      estimatedMinutes: profile.minutes,
      longevityPillars: pillars,
    });
    let position = 0;
    for (const item of day.items) {
      const localId = localByKbId.get(item.exerciseId);
      if (!localId) {
        skipped++;
        continue;
      }
      await addRoutineExercise({
        routineId: planId,
        exerciseId: localId,
        position: position++,
        targetSets: item.sets,
        targetReps: item.reps,
        targetWeightKg: item.weightKg,
        targetRestSeconds: item.restSeconds,
        notes: item.notes,
      });
    }
    planIds.push(planId);
  }
  return { planIds, skippedItems: skipped };
}
