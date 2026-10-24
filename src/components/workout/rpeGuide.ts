/**
 * The words behind the RPE explainer (`RpeSheet.tsx`).
 *
 * RPE is the one field in the set table whose meaning is not obvious from its
 * label. The copy lives here, out of the component, so the scale and the
 * example stay in one place and can be checked by `scripts/test-rpe.mjs`
 * (levels 6–10, reps left counting down, the 7–9 growth target).
 *
 * The companion (Pip) speaks the intro when it is enabled; when it is off the
 * sheet uses the neutral intro. The body copy is identical either way.
 */

/** Long name, shown as the sheet subtitle. */
export const RPE_TITLE = 'Rate of Perceived Exertion';

/** One line that frames the whole idea, in two voices. */
export const RPE_INTRO_COMPANION =
  'RPE is your effort dial: how hard the set felt, and how many good reps you had left.';
export const RPE_INTRO_SOLO =
  'Pick the number that matches how hard the set felt \u2014 not the weight on the bar.';

export interface RpeLevel {
  level: number;
  /** How the set should feel. */
  feel: string;
  /** Reps you could still perform with good form. */
  left: string;
}

/**
 * The working range of the scale. 1–5 exists, but a working set never lands
 * there; showing it would add five rows nobody reads. 6–10 is where the
 * decision is, and where every program's target sits.
 */
export const RPE_LEVELS: readonly RpeLevel[] = [
  { level: 6, feel: 'Fairly easy', left: '~4 more reps' },
  { level: 7, feel: 'Moderate effort', left: '~3 more reps' },
  { level: 8, feel: 'Challenging', left: '~2 more reps' },
  { level: 9, feel: 'Very difficult', left: '1 more rep' },
  { level: 10, feel: 'Maximum effort', left: 'none left' },
];

/** A program line worked through, because the notation is half the confusion. */
export const RPE_EXAMPLE = {
  lift: 'Bench Press',
  prescription: '3 sets \u00d7 10 reps @ RPE 8',
  body: 'Choose a weight that makes the tenth rep challenging, but leaves you able to do about two more.',
  note: 'Three sets at that effort \u2014 not three sets to failure.',
};

/** Why the number is worth entering at all. */
export const RPE_WHY: readonly string[] = [
  'It adjusts to the day: tired or under-recovered, use a lighter weight and keep the same RPE.',
  'It measures effort, not load. Two people lifting different weights can both train at RPE 8.',
];

/** The practical takeaway for muscle growth. */
export const RPE_TARGET =
  'Most programs target RPE 7\u20139: hard enough to grow, without reaching failure on every set.';

/** Caption under the reps-left column. */
export const RPE_LEFT_LABEL = 'Reps left';
