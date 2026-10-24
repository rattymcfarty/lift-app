/**
 * Adaptive type: ONE size for a group of peers, computed once from the width the
 * group has to fit.
 *
 * The problem this solves is real and was visible on the owner's phone: RN's
 * `adjustsFontSizeToFit` shrinks **each label by its own amount**. Put four stat
 * tiles in a row and "12,340" comes out smaller than "28"; put two chips side by
 * side and "All Equipment" is visibly smaller than "All Muscles"; split a title
 * into "Train | History" and one is 28 pt while the other is 24 pt. Every screen
 * that used it looked subtly uneven.
 *
 * The rule now: compute the size **once per group**, from the group's measured
 * width and its longest label, then give that one size to every item. The result
 * is identical on every device in the group (nothing can drift), shrinks as a
 * unit on narrow windows (iOS Display Zoom, split view), and never falls below a
 * readable floor from the type scale.
 *
 * This is the same model as `setGrid.ts` and `filterMetrics.ts`: a width-derived
 * size, not per-text shrinking. It is an approximation of text metrics (an
 * average glyph advance), deliberately conservative — it would rather give the
 * group one point less than let a label clip. The full rule (which widths to
 * use, which exceptions are allowed) is in `docs/design/TYPE.md`.
 */
import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Average glyph advance of the UI font per point, for mixed-case sentences.
 * Measured against "Smith Machine" in the filter grid; conservative for most
 * labels (which are shorter and use narrower characters).
 */
export const CHAR_EM = 0.56;

export interface GroupFitOptions {
  /** The longest label in the group — the one the size is computed for. */
  longest: string;
  /** Type-scale size the group uses when there is room. */
  base: number;
  /** Readability floor, from the type scale. */
  min: number;
  /** Horizontal padding inside one item, per side. Default 0. */
  padding?: number;
  /** Total gap between items (all gaps summed). Default 0. */
  gap?: number;
  /** Number of equal-width items. Default 1. */
  count?: number;
}

/**
 * The size that makes `longest` fit `textWidth`, clamped to the type scale.
 * Pure: same inputs, same size, always. This is the primitive both the group
 * helper and the filter grid use.
 */
export function fitTextSize(
  textWidth: number,
  o: Pick<GroupFitOptions, 'longest' | 'base' | 'min'>,
): number {
  if (!(textWidth > 0)) return o.base;
  const natural = o.longest.length * CHAR_EM * o.base;
  return Math.max(o.min, Math.min(o.base, Math.floor((textWidth / natural) * o.base)));
}

/**
 * One label size for the whole group. Pure: same inputs, same size, always.
 * Returns `base` until the row has been measured (avoids a resize flash on the
 * first frame).
 */
export function fitGroupSize(containerWidth: number, o: GroupFitOptions): number {
  if (!(containerWidth > 0)) return o.base;
  const count = Math.max(1, o.count ?? 1);
  const item = (containerWidth - (o.gap ?? 0)) / count - (o.padding ?? 0) * 2;
  if (!(item > 0)) return o.min;
  return fitTextSize(item, o);
}

/**
 * Measure a row and get one label size for all of its items.
 *
 *   const fit = useGroupFit({ longest, base: t.size.section, min: t.size.meta, count: 3 });
 *   <View onLayout={fit.onLayout} style={{ flexDirection: 'row' }}>
 *     {items.map((it) => <Text style={{ fontSize: fit.size }}>…</Text>)}
 *
 * Give the same `fit.size` to every peer. Never re-add `adjustsFontSizeToFit`
 * to those labels — that is the per-label drift this replaces.
 */
export function useGroupFit(o: GroupFitOptions): {
  onLayout: (e: LayoutChangeEvent) => void;
  size: number;
} {
  const [width, setWidth] = useState(0);
  return {
    onLayout: (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width)),
    size: fitGroupSize(width, o),
  };
}
