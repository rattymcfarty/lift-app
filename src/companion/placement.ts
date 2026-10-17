/**
 * Companion screen geometry — pure, no React and no native imports, so
 * `scripts/test-companion.mjs` can exercise it directly.
 *
 * The creature is dragged anywhere and snaps to the nearest of five anchors
 * (centre/left/right × the top and bottom bands). Its *default* — before the
 * user has ever dragged it, and whenever nothing is stored — is the LEFT edge
 * at `DEFAULT_V_FRACTION` of the window height: the old top-centre default sat
 * on top of screen titles ("Workout · 17 Oct"), while the left edge, where screens keep labels and thumbnails (controls sit on the right), about
 * three quarters of the way down, is clear of headers, the tab bar and bottom buttons.
 *
 * A stored anchor always wins, so every position the user dragged stays valid;
 * a saved `tc` (the old default) keeps the companion top-centre.
 */

/** The five snap anchors. */
export type CompanionCorner = 'tc' | 'tl' | 'tr' | 'bl' | 'br';

/** Every valid anchor — also the guard for the persisted value. */
export const COMPANION_CORNERS: readonly CompanionCorner[] = ['tc', 'tl', 'tr', 'bl', 'br'];

/** Anchor the snap search falls back to (nothing is ever farther than this). */
export const FALLBACK_CORNER: CompanionCorner = 'tc';

/** The draggable box the creature may occupy: one x/y in each safe direction. */
export interface CompanionBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Where the default position sits vertically, as a fraction of the window. */
export const DEFAULT_V_FRACTION = 0.72;

/** Routes the overlay is never drawn on. */
const HIDDEN_ROUTE_SEGMENTS: readonly string[] = ['onboarding', 'parq'];

export const clampPosition = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function cornerPosition(corner: CompanionCorner, b: CompanionBounds): { x: number; y: number } {
  const centerX = (b.left + b.right) / 2;
  switch (corner) {
    case 'tl':
      return { x: b.left, y: b.top };
    case 'tr':
      return { x: b.right, y: b.top };
    case 'bl':
      return { x: b.left, y: b.bottom };
    case 'br':
      return { x: b.right, y: b.bottom };
    case 'tc':
    default:
      return { x: centerX, y: b.top };
  }
}

export function nearestCorner(x: number, y: number, b: CompanionBounds): CompanionCorner {
  let best: CompanionCorner = FALLBACK_CORNER;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const corner of COMPANION_CORNERS) {
    const pos = cornerPosition(corner, b);
    const d = (pos.x - x) ** 2 + (pos.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = corner;
    }
  }
  return best;
}

/**
 * Default vertical position: `DEFAULT_V_FRACTION` down the window, clamped
 * into the safe-area bounds so a short window can never push the creature
 * under the status bar or over the tab bar.
 */
export function defaultCompanionY(windowHeight: number, b: CompanionBounds): number {
  return clampPosition(windowHeight * DEFAULT_V_FRACTION, b.top, b.bottom);
}

/** The default resting place: the left edge, `DEFAULT_V_FRACTION` down. */
export function defaultCompanionPosition(
  windowHeight: number,
  b: CompanionBounds,
): { x: number; y: number } {
  return { x: b.left, y: defaultCompanionY(windowHeight, b) };
}

export interface BubblePlacement {
  left: number;
  /**
   * True when the bubble was pushed to the creature's left — the creature sits
   * on the right half of the screen, so the bubble opens away from the edge and
   * its tail points back at the character.
   */
  opensLeft: boolean;
}

/**
 * Horizontal placement for the speech bubble. Centred on the creature when it
 * has room on both sides; pushed to the creature's left when it does not (the
 * default right-edge position), so the bubble never lies on top of the art.
 * Always clamped inside the window.
 */
export function placeBubble(
  creatureX: number,
  creatureSize: number,
  windowWidth: number,
  bubbleWidth: number,
  margin: number,
  gap: number,
): BubblePlacement {
  const minLeft = margin;
  const maxLeft = Math.max(minLeft, windowWidth - bubbleWidth - margin);
  if (creatureX + creatureSize / 2 > windowWidth / 2) {
    return { left: clampPosition(creatureX - gap - bubbleWidth, minLeft, maxLeft), opensLeft: true };
  }
  return {
    left: clampPosition(creatureX + creatureSize / 2 - bubbleWidth / 2, minLeft, maxLeft),
    opensLeft: false,
  };
}

/**
 * True on the routes the overlay must stay off: the onboarding / profile
 * wizard (its buttons and bottom action row sit exactly where the creature
 * floats, and it owns the whole first launch) and the PAR-Q+ screening
 * questionnaire (nothing floats over a safety question).
 *
 * `pathname` and `segments` are both accepted so the caller can pass whatever
 * expo-router reports; dynamic groups are covered because the pathname is
 * split on `/` before matching.
 */
export function isCompanionHiddenRoute(pathname: string, segments: readonly string[]): boolean {
  const parts = pathname.split('/').filter((p) => p.length > 0);
  return [...segments, ...parts].some((s) => HIDDEN_ROUTE_SEGMENTS.includes(s));
}