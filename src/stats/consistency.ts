/**
 * Consistency score (P4a). Pure functions.
 *
 * Definition: completed planned sessions ÷ planned sessions, as a 0–100
 * integer. `null` when there is nothing planned yet (new user — show an
 * inviting empty state, not a 0).
 *
 * Session accounting (matches #14's program_session_states, as interpreted
 * by queries.ts):
 * - done → completed.
 * - missed → planned but not completed.
 * - scheduled → never counted (future sessions aren't due; past-due ones
 *   within the grace/link window can still be completed — the program
 *   marks them 'missed' when the window closes).
 * - skipped → excluded from BOTH sides (a deliberate skip is not a failure).
 */
import type { StatWorkout } from './types';
import { startOfWeekMonday } from './volume';
import { addWeeks } from './frequency';

/** 0–100, or null when planned === 0. */
export function consistencyScore(completed: number, planned: number): number | null {
  if (planned <= 0) return null;
  if (completed < 0) completed = 0;
  if (completed > planned) completed = planned;
  return Math.round((completed / planned) * 100);
}

/**
 * Fallback when the user has no program enrollment: share of the last
 * `weeks` weeks containing ≥1 finished workout. Null when there are no
 * workouts at all (new user — show the inviting empty state, not 0%).
 * The in-progress current week is forgiven when empty, matching the
 * streak rule in frequency.ts.
 */
export function weeklyActivityRate(
  workouts: StatWorkout[],
  weeks: number,
  now: Date = new Date(),
): number | null {
  if (weeks <= 0) return null;
  if (workouts.length === 0) return null;
  const thisMonday = startOfWeekMonday(now);
  const active = new Set<number>();
  for (const w of workouts) {
    active.add(startOfWeekMonday(w.startedAt).getTime());
  }
  // Forgive the in-progress week: start counting from last week when
  // this week is empty.
  const startOffset = active.has(thisMonday.getTime()) ? 0 : 1;
  let hit = 0;
  for (let i = 0; i < weeks; i++) {
    if (active.has(addWeeks(thisMonday, -(startOffset + i)).getTime())) hit += 1;
  }
  return Math.round((hit / weeks) * 100);
}
