export function resolveAutoProgression(
  override: boolean | null,
  available: boolean,
): { label: string; effective: boolean } {
  if (override === true) return { label: 'On', effective: true };
  if (override === false) return { label: 'Off', effective: false };
  if (available) return { label: 'Auto (On)', effective: true };
  return { label: 'Auto (Off)', effective: false };
}

export { aggregateMuscles } from '../src/lib/aggregateMuscles';
export { exerciseMatchesFilters } from '../src/lib/filterExercises';
