/**
 * Shared sheet geometry and test ids — the small contract every bottom sheet
 * obeys, kept pure so `scripts/test-sheet.mjs` can check it without rendering
 * anything (the glass itself is verified on the emulator).
 *
 * A sheet is anchored to the bottom of the screen: its top corners are rounded
 * and its bottom corners stay square, and its header close button is
 * `<surface id>-close`, which is what the Maestro flows tap.
 */

/** Downward drag (dp) before the header claims the gesture from a list. */
export const SHEET_DRAG_START = 8;

/** Downward drag (dp) that dismisses the sheet when the finger lifts. */
export const SHEET_DRAG_DISMISS = 90;

export interface SheetCorners {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomLeftRadius: number;
  borderBottomRightRadius: number;
}

/** Corner radii for a sheet sitting on the bottom edge of the screen. */
export function sheetCorners(radius: number): SheetCorners {
  return {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  };
}

export interface SheetIds {
  /** testID for the sheet surface; undefined when the caller passed none. */
  surface: string | undefined;
  /** testID for the header close button. */
  close: string;
}

/** The surface and header-close test ids for a sheet. */
export function sheetIds(testID?: string): SheetIds {
  return { surface: testID, close: `${testID ?? 'sheet'}-close` };
}

/** True when a downward pull is far enough to be a sheet drag, not a list scroll. */
export function shouldStartDrag(dx: number, dy: number): boolean {
  return dy > SHEET_DRAG_START && dy > Math.abs(dx);
}

/** True when releasing the drag at `dy` should dismiss the sheet. */
export function dragDismisses(dy: number, threshold: number = SHEET_DRAG_DISMISS): boolean {
  return dy > threshold;
}
