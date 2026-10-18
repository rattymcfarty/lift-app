/**
 * Side-panel model — the pure half of the left/right glass panels.
 *
 * No React and no native imports, so it is unit-testable on plain Node
 * (`scripts/test-panel.mjs`). `src/chrome/panels.tsx` wraps `panelsReducer`
 * in a context; `src/components/chrome/TabOrderList.tsx` uses the drag maths.
 */

/** Which side panel is showing, if any. */
export type PanelSide = 'left' | 'right' | null;

/** A side that can actually be opened (never null). */
export type OpenPanelSide = Exclude<PanelSide, null>;

/** Everything the panel state can do. */
export type PanelAction =
  | { type: 'open'; side: OpenPanelSide }
  | { type: 'close' }
  | { type: 'toggle'; side: OpenPanelSide };

/**
 * Panel transitions. Opening one side closes the other; toggling an already
 * open side closes it. Kept pure so the behaviour is testable without a
 * renderer.
 */
export function panelsReducer(current: PanelSide, action: PanelAction): PanelSide {
  switch (action.type) {
    case 'open':
      return action.side;
    case 'close':
      return null;
    case 'toggle':
      return current === action.side ? null : action.side;
  }
}

/** Clamp a row index into `[0, count - 1]`; an empty list yields 0. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  const n = Math.trunc(Number.isFinite(index) ? index : 0);
  return Math.max(0, Math.min(count - 1, n));
}

/**
 * Slot a dragged row lands in: where it started, plus how many whole rows the
 * finger has moved (rounded, so crossing the halfway line commits the swap).
 */
export function dragTargetIndex(from: number, dy: number, rowHeight: number, count: number): number {
  if (rowHeight <= 0 || !Number.isFinite(dy)) return clampIndex(from, count);
  return clampIndex(from + Math.round(dy / rowHeight), count);
}

/**
 * Vertical offset, in rows, for a row that is NOT the one being dragged:
 * the rows between the origin and the target shuffle up or down by one to
 * open the gap the dragged row will drop into.
 */
export function shiftForIndex(index: number, from: number, to: number): number {
  if (from === to) return 0;
  if (from < to && index > from && index <= to) return -1;
  if (from > to && index >= to && index < from) return 1;
  return 0;
}
