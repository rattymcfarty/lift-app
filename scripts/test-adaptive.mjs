/**
 * Unit tests for src/theme/adaptive.ts — the one-size-per-group rule.
 *
 * The rule the owner asked for: text sizes must be computed once per screen (or
 * per group of peers) from the width available, never per label. These tests pin
 * the properties that make that safe:
 *
 *   1. one size, pure — every peer gets the same number, always;
 *   2. it never exceeds the type-scale size, never falls below the floor;
 *   3. it grows with width and shrinks with longer labels/gaps/padding;
 *   4. it agrees with the filter grid's own sizing (one model app-wide).
 *
 * Usage: node scripts/test-adaptive.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'adaptive-'));
// A virtual entry re-exports only the pure helpers, so the hook (and its React
// import) is tree-shaken away — this test runs in plain node.
const entry = join(dir, 'entry.ts');
writeFileSync(
  entry,
  [
    `export { CHAR_EM, fitTextSize, fitGroupSize } from ${JSON.stringify(join(root, 'src/theme/adaptive'))};`,
    `export { filterMetrics } from ${JSON.stringify(join(root, 'src/components/workout/filterMetrics'))};`,
  ].join('\n'),
);
const out = join(dir, 'adaptive.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { CHAR_EM, fitTextSize, fitGroupSize, filterMetrics } = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/** Widths a phone actually reports (Display Zoom → tablet). */
const WIDTHS = [0, 200, 240, 288, 320, 360, 390, 430, 512, 768];

// ---- the primitive ----------------------------------------------------------

eq(CHAR_EM, 0.56, 'the glyph model is pinned (filterMetrics shares it)');

eq(fitTextSize(0, { longest: 'Smith Machine', base: 16, min: 12 }), 16, 'unmeasured text keeps the base size');

for (const w of WIDTHS) {
  const s = fitTextSize(w, { longest: 'Smith Machine', base: 16, min: 12 });
  ok(Number.isInteger(s), `width ${w}: ${s} is a whole point`);
  ok(s <= 16 && s >= 12, `width ${w}: ${s} stays inside 12–16`);
}

// "Smith Machine" (13 chars) at 100 pt of room: floor(100 / (13 * 0.56)).
eq(fitTextSize(100, { longest: 'Smith Machine', base: 16, min: 12 }), 13, '100 pt fits 13 pt labels');

// A floor wins over a mathematically-tiny result (readability beats clipping a hair).
eq(fitTextSize(20, { longest: 'Smith Machine', base: 16, min: 12 }), 12, 'a very narrow box refuses to drop below the floor');

// Monotonic in width.
let prev = 0;
for (const w of WIDTHS.slice(1)) {
  const s = fitTextSize(w, { longest: 'Smith Machine', base: 16, min: 12 });
  ok(s >= prev, `width ${w}: ${s} never shrinks as the box grows`);
  prev = s;
}

// Longer labels need a smaller size; empty labels are free.
ok(
  fitTextSize(100, { longest: 'Shoulders', base: 16, min: 12 }) >
    fitTextSize(100, { longest: 'Smith Machine', base: 16, min: 12 }),
  'a longer label gets a smaller size',
);
eq(fitTextSize(120, { longest: '', base: 16, min: 12 }), 16, 'an empty longest label costs nothing');

// ---- the group --------------------------------------------------------------

const base = { longest: '12,340', base: 34, min: 18 };

// Same inputs, same size: every peer in the group draws at `fitGroupSize(...)`.
eq(fitGroupSize(300, { ...base, count: 3 }), fitGroupSize(300, { ...base, count: 3 }), 'group size is pure');

// Splitting a row between three items is exactly like each having a third.
eq(
  fitGroupSize(300, { ...base, count: 3 }),
  fitTextSize(100, base),
  'count 3 splits the row into thirds',
);

// Gaps and padding eat into each item's room.
ok(
  fitGroupSize(300, { ...base, count: 3, gap: 16 }) < fitGroupSize(300, { ...base, count: 3 }),
  'gaps reduce the size',
);
ok(
  fitGroupSize(300, { ...base, count: 3, padding: 8 }) < fitGroupSize(300, { ...base, count: 3 }),
  'padding reduces the size',
);

// Unknown width → base (first frame); a collapsed item → floor.
eq(fitGroupSize(0, { ...base, count: 3 }), 34, 'unmeasured row uses the base size');
eq(fitGroupSize(4, { ...base, count: 3 }), 18, 'a collapsed row falls to the floor');

// Bigger screens never give a group a smaller size.
prev = 0;
for (const w of WIDTHS.slice(1)) {
  const s = fitGroupSize(w, { ...base, count: 3, gap: 16, padding: 4 });
  ok(s >= prev, `width ${w}: group size ${s} is monotonic`);
  prev = s;
}

// The design-width cases the app actually renders, frozen so a refactor that
// changes the look of a real screen fails here first.
eq(fitGroupSize(326, { longest: '12,340', base: 34, min: 18, count: 3 }), 32, '390 pt: workout summary numbers');
eq(fitGroupSize(326, { longest: 'Sessions', base: 20, min: 13, count: 3, padding: 4 }), 20, '390 pt: analytics tiles keep section size');
eq(
  fitGroupSize(358, { longest: 'History', base: 28, min: 18, count: 2, gap: 16 }),
  28,
  '390 pt: Train | History keeps screen size',
);
eq(
  fitGroupSize(288, { longest: 'History', base: 24, min: 18, count: 2, gap: 16 }),
  24,
  'Display Zoom: Train | History keeps its compact size',
);

// The filter grid builds on the same primitive, so grid and groups agree.
// (116 pt is the label's room in a 360 pt two-column grid: 180 − 16 pad − 40 icon − 8 gap.)
eq(filterMetrics(360).label, fitTextSize(116, { longest: 'Smith Machine', base: 16, min: 12 }), 'filter grid uses the shared model');

console.log(`adaptive: ${n} assertions passed`);
