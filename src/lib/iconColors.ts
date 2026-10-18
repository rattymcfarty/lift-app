/**
 * Icon art color plumbing — pure functions, no React, no DB.
 *
 * Source SVGs (assets/icons-src, see docs/design/ICON_STYLE.md) are drawn in
 * four placeholder colors so they stay theme-agnostic. At render time those
 * four tokens are swapped for colors derived from the caller's props, which is
 * what makes one piece of artwork work in light and dark mode.
 */

/** The four colors an icon source file may use (authoring placeholders). */
export const ART_BODY = '#808080';
export const ART_LINE = '#bfbfbf';
export const ART_HI = '#ff7a1a';
export const ART_HI_LINE = '#b34700';

/** How far LINE travels toward white and how far HI_LINE darkens. */
export const LINE_LIGHTEN = 0.35;
export const HI_LINE_DARKEN = 0.35;

/** Resolved colors for one rendered icon. */
export interface IconPalette {
  /** Figure mass / structure. */
  body: string;
  /** Definition lines and edges. */
  line: string;
  /** Worked muscle / implement. */
  hi: string;
  /** Deeper edge on the highlight. */
  hiLine: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse "#rgb" or "#rrggbb". Returns undefined for anything else — the app
 * passes theme colors through, and an unparseable one is passed back untouched
 * rather than throwing.
 */
export function parseHexColor(color: string): Rgb | undefined {
  const hex = color.trim().toLowerCase();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(hex);
  if (!m) return undefined;
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  const part = (v: number) => clampChannel(v).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function clampChannel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Mix a color toward white by `amount` (0 = unchanged, 1 = white). */
export function lightenTowardWhite(color: string, amount = LINE_LIGHTEN): string {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  const t = Math.max(0, Math.min(1, amount));
  return toHex(
    rgb.r + (255 - rgb.r) * t,
    rgb.g + (255 - rgb.g) * t,
    rgb.b + (255 - rgb.b) * t,
  );
}

/** Darken a color by `amount` (0 = unchanged, 1 = black). */
export function darken(color: string, amount = HI_LINE_DARKEN): string {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  const t = Math.max(0, Math.min(1, amount));
  return toHex(rgb.r * (1 - t), rgb.g * (1 - t), rgb.b * (1 - t));
}

/** The palette a themed icon renders with, derived from the component props. */
export function themeIconPalette(silhouette: string, highlight: string): IconPalette {
  return {
    body: silhouette,
    line: lightenTowardWhite(silhouette, LINE_LIGHTEN),
    hi: highlight,
    hiLine: darken(highlight, HI_LINE_DARKEN),
  };
}

/**
 * Substitute the four authoring colors in SVG markup with palette colors.
 * One pass over a single alternation, so a substituted value can never be
 * re-substituted (the highlight is #ff7a1a in art *and* in the theme).
 * Markup without any authoring color comes back unchanged.
 */
export function applyIconPalette(markup: string, palette: IconPalette): string {
  const map: Record<string, string> = {
    [ART_BODY]: palette.body,
    [ART_LINE]: palette.line,
    [ART_HI]: palette.hi,
    [ART_HI_LINE]: palette.hiLine,
  };
  const tokens = Object.keys(map)
    .map((c) => c.slice(1))
    .join('|');
  return markup.replace(new RegExp(`#(${tokens})\\b`, 'gi'), (match) => map[match.toLowerCase()]);
}

/** Themed markup per id + color pair. Small and bounded: ids × theme combos. */
const artCache = new Map<string, string>();

/**
 * Theme-colored markup for one icon id, or undefined when the table has no art
 * for it (the caller then draws its own icon). Memoized because SvgXml
 * re-parses its XML on every render and this runs inside list rows.
 */
export function themedIconArt(
  table: Record<string, string>,
  id: string,
  silhouette: string,
  highlight: string,
): string | undefined {
  const markup = table[id];
  if (!markup) return undefined;
  const key = `${id}\u0000${silhouette}\u0000${highlight}`;
  const hit = artCache.get(key);
  if (hit !== undefined) return hit;
  const themed = applyIconPalette(markup, themeIconPalette(silhouette, highlight));
  artCache.set(key, themed);
  return themed;
}