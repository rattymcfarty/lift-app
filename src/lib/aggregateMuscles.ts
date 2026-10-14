/**
 * Pure aggregation of muscle groups from workout items.
 * Used by the muscle-group bottom sheet and tested independently.
 * No React, no DB — decodeStringArray is inlined to keep this pure.
 */

export interface WorkoutItemLike {
  exercise: {
    primaryMuscles: string | null;
    secondaryMuscles: string | null;
  };
  sets: Array<{ completed?: boolean; isWarmup?: boolean }>;
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

/**
 * Aggregate per-muscle set counts for a session.
 * Only counts completed, non-warmup sets. Returns sorted by set count desc.
 */
export function aggregateMuscles(items: WorkoutItemLike[]): Array<{ muscle: string; sets: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const liveSets = item.sets.filter(
      (s) => s.completed !== false && s.isWarmup !== true
    ).length;
    if (liveSets === 0) continue;
    const muscles = [
      ...decodeStringArray(item.exercise.primaryMuscles),
      ...decodeStringArray(item.exercise.secondaryMuscles),
    ];
    for (const m of new Set(muscles)) {
      counts.set(m, (counts.get(m) ?? 0) + liveSets);
    }
  }
  return Array.from(counts.entries())
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}