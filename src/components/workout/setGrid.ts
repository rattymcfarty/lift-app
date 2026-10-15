/**
 * Proportional column layout shared by the set-table header (ExerciseCard)
 * and every SetRow.
 *
 * Why proportions instead of points: iOS "Display Zoom" (and every phone
 * width) changes the window width in points. Fixed-point columns then
 * overflow or wrap; proportional columns always add up to exactly 100% of the
 * row, so the table can never overflow and looks the same at any zoom. Text
 * and control sizes are derived from the same width via `gridMetrics`.
 */
export const GRID_FLEX = {
  set: 9,
  prev: 23,
  weight: 17,
  reps: 15,
  rpe: 13,
  check: 12,
  remove: 11,
} as const;

/** Width the design was drawn at (a standard 6.1" iPhone). */
const BASE_WIDTH = 390;

export interface GridMetrics {
  /** 0.84 – 1.1: how much to scale text/controls relative to the design width. */
  scale: number;
  fontBody: number;
  fontMeta: number;
  fontHeader: number;
  rowHeight: number;
  circle: number;
}

export function gridMetrics(windowWidth: number): GridMetrics {
  const scale = Math.min(1.1, Math.max(0.84, windowWidth / BASE_WIDTH));
  const r = (n: number): number => Math.round(n * scale * 2) / 2;
  return {
    scale,
    fontBody: r(16),
    fontMeta: r(13),
    fontHeader: r(12),
    rowHeight: Math.round(46 * scale),
    circle: Math.round(30 * scale),
  };
}

/** Text scaling cap for set-table text — the table is dense by design. */
export const GRID_MAX_FONT_SCALE = 1.1;
