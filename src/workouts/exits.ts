/**
 * Workout exit flows — the copy and the choices behind the "finish or discard"
 * sheet and the discard confirmation. Pure data + wording, no React: the active
 * workout screen renders these and `scripts/test-workout-discard.mjs` pins them,
 * so the spec'd copy can't drift silently.
 *
 * The discard path is deliberately cheer-free: it leaves nothing behind (no
 * finished workout, no summary, no companion message). Only "finish" keeps the
 * workout and hands off to the summary screen, which is the single place the
 * companion cheers. See `src/companion/triggers.ts`.
 */

/** A choice in the finish sheet, in render order. */
export interface FinishChoice {
  id: 'finish' | 'discard' | 'cancel';
  label: string;
  /** Matches the Button variant used for the choice (see components/workout/ui). */
  variant: 'gold' | 'danger' | 'secondary';
  /** testID for the choice button, for Maestro. */
  testID: string;
}

/**
 * The three choices the header/bottom Finish button opens. Order and variants
 * are part of the spec: finish is the primary (accent) action, discard is
 * destructive, cancel is the quiet way out.
 */
export const FINISH_SHEET_CHOICES: readonly FinishChoice[] = [
  { id: 'finish', label: 'Finish workout', variant: 'gold', testID: 'finish-sheet-finish' },
  { id: 'discard', label: 'Discard workout', variant: 'danger', testID: 'finish-sheet-discard' },
  { id: 'cancel', label: 'Cancel', variant: 'secondary', testID: 'finish-sheet-cancel' },
];

/** Title of the finish sheet. */
export const FINISH_SHEET_TITLE = 'Finish workout?';

/** The line under the sheet title: how much is at stake in this workout. */
export function finishSheetSubtitle(setCount: number): string {
  if (setCount <= 0) return 'No sets logged yet.';
  return `${setCount} set${setCount === 1 ? '' : 's'} logged.`;
}

/**
 * The destructive confirmation shown before anything is deleted. The exact
 * title/message/buttons are spec'd; the message says plainly that the data is
 * gone for good.
 */
export interface DiscardConfirmCopy {
  title: string;
  message: string;
  /** Button that backs out. */
  cancelLabel: string;
  /** Destructive button that discards. */
  confirmLabel: string;
}

export const DISCARD_CONFIRM: DiscardConfirmCopy = {
  title: 'Discard this workout?',
  message: "Everything you logged in this workout will be deleted. This can't be undone.",
  cancelLabel: 'Keep workout',
  confirmLabel: 'Discard',
};
