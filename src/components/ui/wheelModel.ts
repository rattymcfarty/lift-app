/**
 * Pure model for the scroll wheels (`WheelPicker.tsx`).
 *
 * The set table's numbers are entered with the OS keyboard today: a numeric pad
 * covers the bottom half of the screen mid-workout, you type a weight, and a
 * typo is a backspace-and-retry. The wheel replaces that with the interaction
 * the platform already uses everywhere else — the iOS timer's drums: the value
 * sits in a highlighted band with its unit beside it, and you flick through
 * numbers until the right one lands in the band.
 *
 * Everything that can be reasoned about without a screen lives here, so
 * `scripts/test-wheel.mjs` can pin it: how a range becomes rows, how a scroll
 * offset becomes a row, how a value is found among the rows (or the nearest
 * one), and how a looping wheel stays centred without drifting.
 */

export interface WheelItem {
  /** The value handed back to the caller (a string, e.g. "62.5"). */
  value: string;
  /** What the drum row shows (e.g. "62.5"); defaults to the value. */
  label: string;
}

export interface WheelSpec {
  min: number;
  max: number;
  /** Distance between rows. 1 for reps, 2.5 kg, 0.5 RPE. */
  step: number;
  /** Decimal places kept (0 = integers). */
  decimals?: number;
  /** Optional row label; defaults to the value itself. */
  label?: (value: number) => string;
}

/** Float-safe round to a number of decimals (2.5 steps must not yield 62.50001). */
function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Every row between `min` and `max`, inclusive, stepping by `step`.
 * `max` is included only when it lands exactly on a step.
 *
 * The value string is JavaScript's shortest form of the number (`20`, `2.5`),
 * not a fixed-decimal string: these values are written straight into the set
 * row, where "20.0 kg" would read as a bug.
 */
export function buildWheel(spec: WheelSpec): WheelItem[] {
  const decimals = spec.decimals ?? 0;
  const itemCount = Math.floor((spec.max - spec.min) / spec.step + 1e-9);
  const items: WheelItem[] = [];
  for (let i = 0; i <= itemCount; i += 1) {
    const n = roundTo(spec.min + i * spec.step, decimals);
    const value = String(n);
    items.push({ value, label: spec.label ? spec.label(n) : value });
  }
  return items;
}

/** The row at `index`, wrapping — the wheel loops, so any integer is valid. */
export function itemAt(items: readonly WheelItem[], index: number): WheelItem {
  const n = items.length;
  if (n === 0) return { value: '', label: '' };
  return items[((index % n) + n) % n];
}

/**
 * Index of `value` among the items. Falls back to `fallback` when the value is
 * absent (a typed 63 kg on a 2.5 kg wheel), and to the numerically nearest row
 * when `nearest` is set — a wheel that opens on a value it does not contain
 * would otherwise jump to row 0.
 */
export function indexOfValue(
  items: readonly WheelItem[],
  value: string,
  fallback = 0,
  nearest = true,
): number {
  const exact = items.findIndex((it) => it.value === value);
  if (exact >= 0) return exact;
  if (!nearest || items.length === 0) return fallback;
  const target = Number(value);
  if (!Number.isFinite(target)) return fallback;
  let best = fallback;
  let bestDistance = Infinity;
  items.forEach((it, i) => {
    const distance = Math.abs(Number(it.value) - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

/** The row a scroll offset has settled on. */
export function snapIndex(offsetY: number, itemHeight: number): number {
  if (!(itemHeight > 0)) return 0;
  return Math.round(offsetY / itemHeight);
}

/**
 * The index, in the middle copy of a looping wheel, that shows the same row as
 * `index`. Recentring to this keeps the drum endless: the user never reaches an
 * end, and a silent jump is invisible because the row under the band is the
 * same one.
 */
export function loopIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return count + (((index - count) % count) + count) % count;
}

/** How many copies of the items a looping wheel scrolls through. */
export const LOOP_COPIES = 3;
