/**
 * Unit tests for src/components/workout/filterMetrics.ts — the sizing behind the
 * muscle/equipment filter grid.
 *
 * The owner's requirement: one label size for every cell on a given screen, but
 * that size must shrink on narrow devices (iOS Display Zoom is ~320 pt) instead
 * of wrapping or clipping. These assertions pin the three properties that make
 * that true:
 *
 *   1. every cell gets the SAME size (it is a function of the grid width only);
 *   2. the chosen size fits the longest label ("Smith Machine") in one line;
 *   3. the size stays inside the type scale — never above 16, never below 12.
 *
 * Usage: node scripts/test-filters.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'filters-')), 'filterMetrics.mjs');
await build({
  entryPoints: [join(root, 'src/components/workout/filterMetrics.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const { filterMetrics } = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/** Longest label in the two taxonomies, and the model used to pick the size. */
const LONGEST = 'Smith Machine';
const CHAR_EM = 0.56;

/** The grid widths that matter: 288 px Display Zoom, 320, 360, 390, 430 pt. */
const WIDTHS = [240, 288, 300, 320, 328, 343, 358, 390, 430, 512, 768];

// The design width: a 390 pt iPhone minus the screen's 16 pt padding each side.
eq(filterMetrics(360), { label: 15, icon: 40, pad: 8, gap: 8 }, 'design width: 15 pt labels, 40 pt icons');

// Every cell on a screen shares one size — that is what "uniform" means here.
for (const w of WIDTHS) {
  const a = filterMetrics(w);
  const b = filterMetrics(w);
  eq(a, b, `width ${w}: size is a pure function of the grid width`);
  ok(Number.isInteger(a.label), `width ${w}: label size is a whole point (${a.label})`);
}

// Bounds: never bigger than the type scale allows, never smaller than caption.
for (const w of WIDTHS) {
  const { label } = filterMetrics(w);
  ok(label >= 12, `width ${w}: ${label} pt is at least caption (12)`);
  ok(label <= 16, `width ${w}: ${label} pt is at most row (16)`);
}

// Fit: the longest label must fit the cell's text column at the chosen size.
// 240 pt is below the supported minimum (288 dp screens); there the 12 pt
// readability floor wins and the label truncates rather than shrinking further.
for (const w of WIDTHS.filter((w) => w >= 280)) {
  const m = filterMetrics(w);
  const cellText = w / 2 - m.pad * 2 - m.icon - m.gap;
  const needed = LONGEST.length * CHAR_EM * m.label;
  ok(needed <= cellText + 0.5, `width ${w}: "${LONGEST}" fits (${needed.toFixed(1)} <= ${cellText.toFixed(1)}) at ${m.label} pt`);
}

// Narrow devices must actually get smaller text, not the same 16 pt.
ok(filterMetrics(288).label < filterMetrics(358).label, 'Display Zoom (288) uses smaller text than a 390 pt phone');
ok(filterMetrics(288).label <= 13, 'Display Zoom (288) drops to 13 pt or less');

// Below the floor: stop at caption, do not keep shrinking into unreadable text.
eq(filterMetrics(240).label, 12, 'a 240 pt grid refuses to go below caption (12)');

// Bigger screens never need more than the design size.
eq(filterMetrics(512).label, 16, 'a tablet-ish grid does not inflate past 16 pt');

// Monotonic: a wider grid never produces smaller text.
let prev = 0;
for (const w of WIDTHS) {
  const { label } = filterMetrics(w);
  ok(label >= prev, `width ${w}: ${label} pt is not smaller than the previous width (${prev})`);
  prev = label;
}

// Defensive default: no measurement yet (0) behaves like the design width.
eq(filterMetrics(0), filterMetrics(360), 'unmeasured grid falls back to the design width');

console.log(`filters: ${n} assertions passed`);
