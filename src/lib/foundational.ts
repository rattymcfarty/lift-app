/**
 * "Core & foundational" — the owner's ordered shortlist of the movements a
 * longevity-first program should cover, pinned to permanent KB ids.
 *
 * The list is a *curation* of the catalogue, never a second copy of it: every
 * id below must exist and be live in the shipped KB snapshot (asserted by
 * scripts/test-foundational.mjs). Ids are permanent (lift-kb rule: deprecate,
 * never rename), so this file only ever gains or drops ids — never edits them.
 *
 * The Exercises tab shows these first, in this order, under a
 * "Core & foundational" header. Ranking is here; the sectioning itself is in
 * src/lib/exerciseSections.ts.
 *
 * Comments carry the owner's display name and the owner's list position, which
 * is where the order comes from — the ids below are already in that order.
 */

export const FOUNDATIONAL_IDS: readonly string[] = [
  'barbell-squat', // 1  Barbell Back Squat
  'front-barbell-squat', // 2  Front Squat
  'barbell-deadlift', // 3  Deadlift
  'romanian-deadlift', // 4  Romanian Deadlift
  'bench-press-powerlifting', // 5  Bench Press
  'incline-dumbbell-press', // 6  Incline Dumbbell Press
  'overhead-press', // 7  Overhead Shoulder Press
  'pull-up-bodyweight', // 8  Pull-Ups
  'chin-up', // 9  Chin-Ups
  'bent-over-barbell-row', // 10 Barbell Bent-Over Row
  'goblet-squat', // 11 Goblet Squat
  'barbell-walking-lunge', // 12 Walking Lunges
  'bulgarian-split-squat-bw', // 13 Bulgarian Split Squat
  'leg-press', // 14 Leg Press
  'leg-curl', // 15 Leg Curl
  'leg-extensions', // 16 Leg Extension
  'barbell-hip-thrust', // 17 Hip Thrust
  'glute-bridge-bw', // 18 Glute Bridge
  'standing-calf-raises', // 19 Standing Calf Raises
  'weighted-step-up', // 20 Step-Ups
  'push-up', // 21 Push-Ups
  'wide-grip-lat-pulldown', // 22 Lat Pulldown
  'seated-cable-rows', // 23 Seated Cable Row
  'dumbbell-bench-press', // 24 Dumbbell Chest Press
  'side-lateral-raise', // 25 Dumbbell Lateral Raises
  'face-pull', // 26 Face Pulls
  'barbell-curl', // 27 Biceps Curls
  'triceps-pushdown', // 28 Triceps Pushdowns
  'dips-triceps-version', // 29 Dips
  'reverse-flyes', // 30 Reverse Flyes
  'plank', // 31 Plank
  'side-plank', // 32 Side Plank
  'dead-bug', // 33 Dead Bug
  // 34 Bird Dog — no live match in the catalogue (untracked gap)
  'hanging-knee-raise', // 35 Hanging Knee Raises
  // 36 Cable Woodchops — no live match in the catalogue (untracked gap)
  'pallof-press', // 37 Pallof Press
  'back-extension', // 38 Back Extensions
  'farmer-carry', // 39 Farmer's Carry
  'kettlebell-swing', // 40 Kettlebell Swings
  'treadmill', // 41 Treadmill Walking
  'run', // 42 Running or Jogging
  'cycling', // 43 Stationary Cycling
  // 44 Outdoor Cycling — the catalogue has a single `cycling` entry (used above)
  // 45 Rowing Machine — no live match in the catalogue (untracked gap)
  'elliptical', // 46 Elliptical Trainer
  'stair-climber', // 47 Stair Climber
  'jump-rope', // 48 Jump Rope
  'burpee', // 49 Burpees
  'mountain-climbers', // 50 Mountain Climbers
];

/** Number of foundational movements that have a live catalogue entry. */
export const FOUNDATIONAL_COUNT = FOUNDATIONAL_IDS.length;

const RANK_BY_KB_ID = new Map<string, number>(FOUNDATIONAL_IDS.map((id, i) => [id, i]));

/**
 * 0-based position of a KB exercise in the foundational list, or -1 when it is
 * not foundational (includes custom exercises, which have no kb id).
 */
export function foundationalRank(kbId: string | null | undefined): number {
  if (!kbId) return -1;
  return RANK_BY_KB_ID.get(kbId) ?? -1;
}

/** Whether a KB exercise belongs in the foundational group. */
export function isFoundational(kbId: string | null | undefined): boolean {
  return foundationalRank(kbId) >= 0;
}
