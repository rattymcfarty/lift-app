/**
 * Which exercise-filter grid is open, as a small pure unit.
 *
 * The owner found the caret lied: with the muscle grid open, the equipment chip
 * still showed an "open" chevron, because the two chips were independent
 * booleans and the glyph was inverted (`expanded ? '▾' : '▴'` — the composer
 * picker next door had it right). Two fixes, one state:
 *
 *   - only ONE grid can be open at a time (`toggleFilterPanel`), so a chevron can
 *     never describe a grid that is not there;
 *   - the caret says what the glyph means everywhere else in the app — ▲ while
 *     open (tap closes it), ▼ while closed (tap opens it).
 *
 * Pure so `scripts/test-filter-panel.mjs` can pin both rules without a device.
 */

/** A grid that can be expanded under the chips. */
export type FilterPanel = 'muscle' | 'equipment';

/** No grid, or exactly one. */
export type OpenFilterPanel = FilterPanel | null;

/**
 * Tapping a chip: opens its grid, closes the other one, or closes the same one
 * when it is already open. There is no way to end up with two open grids.
 */
export function toggleFilterPanel(current: OpenFilterPanel, panel: FilterPanel): OpenFilterPanel {
  return current === panel ? null : panel;
}

/** ▲ when the grid is open (the tap closes it), ▼ when it is closed. */
export function panelCaret(expanded: boolean): string {
  return expanded ? '▴' : '▾';
}
