/**
 * Sizing for the taxonomy filters (the muscle/equipment chips and the 2-column
 * grid they open).
 *
 * The rule the owner asked for: **one size for every label on screen, adapted to
 * the width of the device — never per-label shrinking.**
 *
 * `adjustsFontSizeToFit` was the old approach and it was wrong for a pair of
 * side-by-side controls or a 2-column grid: each label shrank only as far as its
 * own width demanded, so “All Muscles” sat at 12 pt beside “All Equipment” at
 * 9 pt, and “Middle Delts” shrank while “Chest” did not. Instead, compute ONE
 * label size from the grid's measured width and the longest label the filters
 * contain (“Smith Machine”), then hand that size to every cell in both grids.
 * The result is uniform at any zoom level and any width, the way the set table
 * already works (`setGrid.ts` / `gridMetrics`).
 *
 * Sizes are whole points between the type scale's caption (12) and row (16), so
 * a narrow phone (iOS Display Zoom is ~320 pt wide) drops to 12–13 instead of
 * wrapping or clipping. The icon scales with the text so the cell keeps the same
 * balance at every width.
 */
import { fitTextSize } from '../../theme/adaptive';

/** Grid width the design was drawn at: a 390 pt iPhone minus the screen padding. */
const BASE_GRID_WIDTH = 360;
/** Longest label in either taxonomy — the one the fit is computed for. */
const LONGEST_LABEL = 'Smith Machine';
/** Type-scale bounds the result must stay inside. */
const MIN_LABEL = 12;
const MAX_LABEL = 16;
const BASE_ICON = 40;
const MIN_ICON = 28;

export interface FilterMetrics {
  /** Font size shared by every cell label in both grids. */
  label: number;
  /** Icon tile edge, scaled with the label so the cell keeps its proportions. */
  icon: number;
  /** Cell padding. */
  pad: number;
  /** Gap between the icon and the label. */
  gap: number;
}

/** Grid height per row stays roughly constant, so rows line up across widths. */
export function filterMetrics(gridWidth: number): FilterMetrics {
  const width = gridWidth > 0 ? gridWidth : BASE_GRID_WIDTH;
  const icon = Math.max(MIN_ICON, Math.min(BASE_ICON, Math.round((BASE_ICON * width) / BASE_GRID_WIDTH)));
  const pad = width < 340 ? 6 : 8;
  const gap = pad;
  // Half the grid per cell, less the cell's own chrome. That is the width the
  // label may occupy before it would have to wrap.
  const cellText = width / 2 - pad * 2 - icon - gap;
  const label = fitTextSize(cellText, { longest: LONGEST_LABEL, base: MAX_LABEL, min: MIN_LABEL });
  return { label, icon, pad, gap };
}
