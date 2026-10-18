/**
 * The left panel's "More" section, as data.
 *
 * Keeping the list here (rather than inline JSX) lets `scripts/test-panel.mjs`
 * check that every destination is a real route, so a rename in `app/` cannot
 * leave a dead menu item behind.
 */
import type { ActionIconName } from '../components/icons';

/** Destinations offered under "More" in the left panel. */
export type PanelHref = '/history' | '/prs' | '/balance' | '/calculators' | '/measure';

/** One "More" row. */
export interface PanelLink {
  /** Stable id (also the Maestro test id suffix). */
  key: string;
  /** Row label. */
  label: string;
  /** Screen to open. */
  href: PanelHref;
  /** Leading glyph, from the shared action-icon set. */
  icon: ActionIconName;
}

/** The "More" rows, in the order shown. */
export const PANEL_MORE_LINKS: ReadonlyArray<PanelLink> = [
  { key: 'history', label: 'History', href: '/history', icon: 'history' },
  { key: 'records', label: 'Records', href: '/prs', icon: 'progression' },
  { key: 'balance', label: 'Balance', href: '/balance', icon: 'scale' },
  { key: 'calculators', label: 'Calculators', href: '/calculators', icon: 'note' },
  { key: 'body-weight', label: 'Body weight', href: '/measure', icon: 'progression' },
];
