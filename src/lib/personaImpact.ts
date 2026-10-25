/**
 * "What each answer changes" — the persona editor's honest explanation.
 *
 * The owner asked to review their bio at any time and *see what each answer
 * changes*. The only way that stays true is to read the generator's own tables
 * (exported from `planGenerator.ts`) instead of writing a second description that
 * drifts. So this module answers every profile question with the numbers the
 * generator will actually use: sets, reps and rest for a main lift; how many
 * exercises fit; which split the days come from; which equipment and which
 * limitation patterns are filtered out.
 *
 * Pure and deterministic, with no I/O and no catalogue: `scripts/test-persona.mjs`
 * pins it against the generator.
 */
import {
  ALLOWED_EQUIPMENT,
  AVOID,
  DAYS,
  EXPERIENCE_LOAD,
  MAX_ITEMS,
  mainLiftPrescription,
  type EquipmentAccess,
  type Experience,
  type GeneratorProfile,
  type Goal,
  type Limitation,
} from './planGenerator';

export type PersonaKey =
  | 'goal'
  | 'experience'
  | 'daysPerWeek'
  | 'minutes'
  | 'equipment'
  | 'limitations';

export interface PersonaImpact {
  key: PersonaKey;
  /** The question, as the editor asks it. */
  label: string;
  /** The answer, in the user's words. */
  answer: string;
  /** What that answer changes in the generated plans. */
  changes: string;
}

export const GOAL_ANSWER: Record<Goal, string> = {
  longevity: 'Longevity',
  strength: 'Strength',
  muscle: 'Muscle',
  fitness: 'General fitness',
};

export const EXPERIENCE_ANSWER: Record<Experience, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const EQUIPMENT_ANSWER: Record<EquipmentAccess, string> = {
  full: 'Full gym',
  dumbbells: 'Dumbbells only',
  bodyweight: 'Bodyweight only',
};

export const LIMITATION_ANSWER: Record<Limitation, string> = {
  knees: 'Knees',
  lowerBack: 'Lower back',
  shoulders: 'Shoulders',
};

/** Human phrases for the limitation filters, in the same order as the table. */
export const LIMITATION_AVOIDS: Record<Limitation, string> = {
  knees: 'jumps, lunges, split squats, box work, thrusters and burpees',
  lowerBack: 'deadlifts, good mornings, back extensions, swings, cleans and bent-over barbell rows',
  shoulders: 'overhead pressing, handstands, dips, upright rows and pull-ups',
};

const REST = (seconds: number): string => `${seconds} s rest`;

/**
 * The six answers, in the editor's order. Each line is derived from the tables at
 * call time, so a change to `prescription`, `MAX_ITEMS`, `DAYS`, `ALLOWED_EQUIPMENT`
 * or `AVOID` shows up here immediately.
 */
export function personaImpact(p: GeneratorProfile): PersonaImpact[] {
  const main = mainLiftPrescription(p);
  const dayNames = (DAYS[p.daysPerWeek] ?? DAYS[3]).map((d) => d.name);
  const loadFactor = EXPERIENCE_LOAD[p.experience];
  const allowed = ALLOWED_EQUIPMENT[p.equipment];

  return [
    {
      key: 'goal',
      label: 'Goal',
      answer: GOAL_ANSWER[p.goal],
      changes: `Main lifts ${main.sets} × ${main.reps} reps, ${REST(main.restSeconds)}. Core, carries and mobility keep their own lighter scheme.`,
    },
    {
      key: 'experience',
      label: 'Experience',
      answer: EXPERIENCE_ANSWER[p.experience],
      changes:
        `Sets on main lifts: ${main.sets}. Starting loads are estimated at ${loadFactor}× ` +
        `the bodyweight ratio${p.experience === 'beginner' ? '' : ', and loadable variants are chosen before bodyweight ones'}. ` +
        `Exercises above ${EXPERIENCE_ANSWER[p.experience].toLowerCase()} difficulty are excluded.`,
    },
    {
      key: 'daysPerWeek',
      label: 'Days per week',
      answer: `${p.daysPerWeek} days`,
      changes: `The split is ${dayNames.join(' · ')} — ${dayNames.length} editable plans, one per training day.`,
    },
    {
      key: 'minutes',
      label: 'Session length',
      answer: `${p.minutes} minutes`,
      changes: `Up to ${MAX_ITEMS[p.minutes] ?? 5} exercises per workout. When a day has more, the middle accessories are dropped first and mobility stays.`,
    },
    {
      key: 'equipment',
      label: 'Equipment',
      answer: EQUIPMENT_ANSWER[p.equipment],
      changes: allowed
        ? `Only ${allowed.map((e) => e.toLowerCase()).join(', ')} movements are used.`
        : 'The whole library is available.',
    },
    {
      key: 'limitations',
      label: 'Limitations',
      answer: p.limitations.length > 0 ? p.limitations.map((l) => LIMITATION_ANSWER[l]).join(', ') : 'None',
      changes:
        p.limitations.length > 0
          ? `Movements matching ${p.limitations.map((l) => LIMITATION_AVOIDS[l]).join('; ')} are skipped.`
          : 'Nothing is filtered out. Add a limitation if a joint needs protecting.',
    },
  ];
}

/** How many exercise names each limitation removes from the catalogue. */
export function limitationExclusions(
  limitations: readonly Limitation[],
  catalogue: readonly { id: string; name: string }[],
): Record<Limitation, number> {
  const out = { knees: 0, lowerBack: 0, shoulders: 0 } as Record<Limitation, number>;
  for (const l of limitations) {
    const test = AVOID[l];
    out[l] = catalogue.filter((e) => test.test(`${e.id} ${e.name}`)).length;
  }
  return out;
}
