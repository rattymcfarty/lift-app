/**
 * Sectioning for the exercise library: filter first, then split into the
 * foundational group and everything else. Pure — no IO, no React — so the
 * Exercises tab's list shape is unit-tested in scripts/test-foundational.mjs.
 *
 * Order contract (what the owner asked for):
 *   - the foundational group comes first, in the order of FOUNDATIONAL_IDS;
 *   - everything else follows as "All exercises", in the incoming order;
 *   - search and the muscle/equipment filters apply to both groups;
 *   - a group with no matches contributes no section (its header is hidden).
 */
import { exerciseMatchesFilters, type ExerciseLike } from './filterExercises';
import { foundationalRank } from './foundational';

export const FOUNDATIONAL_SECTION_TITLE = 'Core & foundational';
export const ALL_SECTION_TITLE = 'All exercises';

export interface SectionableExercise extends ExerciseLike {
  /** Permanent KB id; null for user-created exercises. */
  kbId: string | null;
}

export interface ExerciseSection<T> {
  key: 'foundational' | 'all';
  /** Header text, count included: "Core & foundational (12)". */
  title: string;
  data: T[];
}

/** Filter + section an exercise list for the library list. */
export function buildExerciseSections<T extends SectionableExercise>(
  rows: T[],
  muscleIds: string[],
  equipmentIds: string[],
  search: string,
): ExerciseSection<T>[] {
  const matching = rows.filter((e) => exerciseMatchesFilters(e, muscleIds, equipmentIds, search));

  const foundational: T[] = [];
  const rest: T[] = [];
  for (const row of matching) {
    if (foundationalRank(row.kbId) >= 0) foundational.push(row);
    else rest.push(row);
  }
  // Array.sort is stable, but ranks are unique anyway.
  foundational.sort((a, b) => foundationalRank(a.kbId) - foundationalRank(b.kbId));

  const sections: ExerciseSection<T>[] = [];
  if (foundational.length > 0) {
    sections.push({
      key: 'foundational',
      title: `${FOUNDATIONAL_SECTION_TITLE} (${foundational.length})`,
      data: foundational,
    });
  }
  if (rest.length > 0) {
    sections.push({
      key: 'all',
      title: `${ALL_SECTION_TITLE} (${rest.length})`,
      data: rest,
    });
  }
  return sections;
}
