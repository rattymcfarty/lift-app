// Unit tests for the in-workout exercise menu's pure logic (src/lib/exerciseMenu.ts):
// the reorder move function, the warmup ramp calculator and the rest presets.
// Bundled with esbuild like the other pure-logic tests — no DB, no React.
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'exercise-menu-')), 'exerciseMenu.mjs');
await build({
  entryPoints: [join(root, 'src/lib/exerciseMenu.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const M = await import(pathToFileURL(out).href);
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// --- moveItem: the reorder move function ----------------------------------
eq(M.moveItem([1, 2, 3], 0, 2), [2, 3, 1], 'move first to last');
eq(M.moveItem([1, 2, 3], 2, 0), [3, 1, 2], 'move last to first');
eq(M.moveItem([1, 2, 3], 1, 1), [1, 2, 3], 'same index is a no-op');
eq(M.moveItem([], 0, 0), [], 'empty array stays empty');
eq(M.moveItem([1, 2, 3], 5, 0), [1, 2, 3], 'out-of-range from is unchanged');
eq(M.moveItem([1, 2, 3], 0, 99), [2, 3, 1], 'out-of-range to clamps to the end');
eq(M.moveItem([1, 2, 3], 0, -5), [1, 2, 3], 'negative to clamps to the start');

const original = ['a', 'b', 'c'];
const moved = M.moveItem(original, 0, 2);
eq(original, ['a', 'b', 'c'], 'moveItem does not mutate the input');
ok(moved !== original, 'moveItem returns a new array');
eq(M.moveItem(original, 1, 1) !== original, true, 'even a no-op returns a copy');

// --- warmupRamp -----------------------------------------------------------
eq(
  M.warmupRamp(100, 'kg'),
  [
    { reps: '5', weightKg: 50 },
    { reps: '3', weightKg: 70 },
    { reps: '2', weightKg: 85 },
  ],
  'known weight -> 50/70/85% with reps 5/3/2',
);
eq(M.warmupRamp(60, 'kg').map((r) => r.weightKg), [30, 42, 51], 'kg ramp of 60kg');
eq(M.warmupRamp(61, 'kg')[0].weightKg, 30.5, 'kg ramp rounds to nearest 0.5kg');

const lb = M.warmupRamp(100, 'lb');
eq(lb.length, 3, 'lb ramp has three rows');
eq(lb[0].weightKg, 49.9, 'lb ramp rounds the displayed lb value (50kg -> 110lb) and stores back kg');
ok(lb.every((r) => r.weightKg > 0), 'lb ramp weights are positive');

eq(M.warmupRamp(null, 'kg'), [{ reps: '', weightKg: null }, { reps: '', weightKg: null }], 'no weight -> two empty rows');
eq(M.warmupRamp(undefined, 'kg').length, 2, 'undefined weight -> two empty rows');
eq(M.warmupRamp(0, 'kg').length, 2, 'zero weight -> two empty rows');
eq(M.warmupRamp(Number.NaN, 'kg').length, 2, 'NaN weight -> two empty rows');
eq(M.warmupRamp(-20, 'kg').length, 2, 'negative weight -> two empty rows');
eq(M.warmupRamp(Number.POSITIVE_INFINITY, 'kg').length, 2, 'infinite weight -> two empty rows');

const rows = M.warmupRamp(80, 'kg');
rows[0].weightKg = 1;
eq(rows[1].weightKg, 56, 'ramp rows are independent');
eq(M.warmupRamp(80, 'kg')[0].weightKg, 40, 'a fresh ramp is unaffected by a mutated copy');

// --- roundRampWeight ------------------------------------------------------
eq(M.roundRampWeight(30.4, 'kg'), 30.5, 'kg rounds to nearest 0.5');
eq(M.roundRampWeight(30.2, 'kg'), 30, 'kg rounds down');
eq(M.roundRampWeight(0, 'kg'), 0, 'zero weight stays zero');
eq(M.roundRampWeight(Number.NaN, 'kg'), 0, 'NaN weight clamps to zero');

// --- REST_PRESETS / formatRestLabel --------------------------------------
eq(M.REST_PRESETS, [30, 45, 60, 90, 120, 180, 300], 'rest presets are the seven requested');
eq(M.formatRestLabel(120), '2:00', '2m');
eq(M.formatRestLabel(45), '0:45', '45s');
eq(M.formatRestLabel(90), '1:30', '90s');
eq(M.formatRestLabel(300), '5:00', '5m');
eq(M.formatRestLabel(30), '0:30', '30s');
eq(M.formatRestLabel(null), '—', 'null rest shows a dash');
eq(M.formatRestLabel(undefined), '—', 'undefined rest shows a dash');

console.log(`exercise menu logic: ${n} assertions passed`);
