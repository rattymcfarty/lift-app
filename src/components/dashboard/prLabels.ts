/**
 * Shared personal-record kind labels (P4a). Single source of truth —
 * app/prs.tsx keeps its own copy for now; new code imports from here.
 */
export const PR_KIND_LABELS: Record<string, string> = {
  max_weight: 'Max weight',
  est_1rm: 'Est. 1RM',
  max_reps: 'Max reps',
  max_volume: 'Max volume',
  longest_distance: 'Longest distance',
  fastest_time: 'Fastest time',
};

export function prKindLabel(kind: string): string {
  return PR_KIND_LABELS[kind] ?? kind;
}
