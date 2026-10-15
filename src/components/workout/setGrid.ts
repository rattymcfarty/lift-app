/**
 * Column geometry shared by the set-table header (ExerciseCard) and every
 * SetRow, so the labels always sit exactly over their cells — at any text
 * size. Widths are points, not flex bases: the cells hold at most 4-5
 * characters and their text is capped (maxFontSizeMultiplier) so a larger
 * Dynamic Type setting can never push the log/delete buttons onto a second
 * line.
 */
export const SET_GRID = {
  set: 26,
  weight: 62,
  reps: 54,
  rpe: 46,
  /** The log circle / logged check. */
  action: 32,
  /** The delete / cancel ×. */
  remove: 28,
  gap: 6,
  /** Below this window width the "Target" (previous) column is dropped. */
  hidePrevBelow: 350,
  /** Text scaling cap for set-table text — the table is dense by design. */
  maxFontScale: 1.1,
} as const;
