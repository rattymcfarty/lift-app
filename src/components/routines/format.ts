/**
 * Formatting helpers for the routine management UI.
 *
 * Pure functions only — no React, no theme, no DB. Unit-testable.
 * Canonical units everywhere: kg for weight, seconds for rest.
 */

import type { RoutineExercise } from '../../db/schema';
import { trimNumber } from '../workout/format';

/**
 * Compact one-line target summary for a template item:
 * "3 × 8-12 · 60 kg · RPE 8 · rest 90s". Returns "—" when nothing is set.
 */
export function formatTargets(re: Pick<
  RoutineExercise,
  'targetSets' | 'targetReps' | 'targetWeightKg' | 'targetRpe' | 'targetRestSeconds'
>): string {
  const parts: string[] = [];
  if (re.targetSets != null && re.targetReps) {
    parts.push(`${re.targetSets} × ${re.targetReps}`);
  } else if (re.targetSets != null) {
    parts.push(`${re.targetSets} set${re.targetSets === 1 ? '' : 's'}`);
  } else if (re.targetReps) {
    parts.push(re.targetReps);
  }
  if (re.targetWeightKg != null) parts.push(`${trimNumber(re.targetWeightKg)} kg`);
  if (re.targetRpe != null) parts.push(`RPE ${trimNumber(re.targetRpe)}`);
  if (re.targetRestSeconds != null) parts.push(`rest ${re.targetRestSeconds}s`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}
