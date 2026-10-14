/** Pure filter predicate for the exercise picker. */

export interface ExerciseLike {
  id: string;
  name: string;
  primaryMuscles: string | null;
  secondaryMuscles: string | null;
  equipment: string | null;
}

/** Safely decode a JSON string array of plain strings (never throws). */
function decodeStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether an exercise matches the selected muscle/equipment filters plus search text. */
export function exerciseMatchesFilters(
  exercise: ExerciseLike,
  muscleIds: string[],
  equipmentIds: string[],
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (query && !exercise.name.toLowerCase().includes(query)) {
    return false;
  }
  if (muscleIds.length > 0) {
    const primary = decodeStringArray(exercise.primaryMuscles);
    const secondary = decodeStringArray(exercise.secondaryMuscles);
    const allMuscles = new Set([...primary, ...secondary]);
    const hasMatch = muscleIds.some((id) => allMuscles.has(id));
    if (!hasMatch) return false;
  }
  if (equipmentIds.length > 0) {
    const eqList = decodeStringArray(exercise.equipment);
    const eqSet = new Set(eqList);
    const hasMatch = equipmentIds.some((id) => eqSet.has(id));
    if (!hasMatch) return false;
  }
  return true;
}