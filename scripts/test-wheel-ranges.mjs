/**
 * Unit tests for the non-set-row wheel ranges (`src/components/ui/wheelRanges.ts`).
 *
 * Every numeric surface now shares these builders, so the only thing that can go
 * wrong centrally is a range that excludes a real value: a 0 kg plate, a 10-minute
 * session, a 400 kg deadlift, an RPE half-point, a body-fat decimal.
 *
 * Usage: node scripts/test-wheel-ranges.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'wheel-ranges-')), 'wheelRanges.mjs');
await build({
  entryPoints: [join(root, 'src/components/ui/wheelRanges.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const ranges = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const values = (items) => items.map((i) => i.value);
const first = (items) => items[0]?.value;
const last = (items) => items[items.length - 1]?.value;

/* ---- every range is usable ------------------------------------------------ */

const cases = [
  ['rest', ranges.restItems(), '0', '600'],
  ['sets', ranges.countItems(1, 10), '1', '10'],
  ['weight kg', ranges.weightItems('kg'), '0', '400'],
  ['weight lb', ranges.weightItems('lb'), '0', '880'],
  ['rpe', ranges.rpeItems(), '1', '10'],
  ['minutes', ranges.minutesItems(), '10', '180'],
  ['bar kg', ranges.barItems('kg'), '0', '60'],
  ['bar lb', ranges.barItems('lb'), '0', '130'],
  ['height', ranges.heightCmItems(), '120', '230'],
  ['measure length', ranges.measureItems('length', 'kg'), '20', '250'],
  ['measure body fat', ranges.measureItems('bodyFat', 'kg'), '2', '70'],
  ['measure heart rate', ranges.measureItems('heartRate', 'kg'), '30', '220'],
  ['measure custom', ranges.measureItems('custom', 'kg'), '0', '1000'],
];

for (const [name, items, low, high] of cases) {
  ok(items.length > 1, `${name}: has rows`);
  eq(first(items), low, `${name}: starts at ${low}`);
  eq(last(items), high, `${name}: ends at ${high}`);
  const vals = values(items);
  eq(new Set(vals).size, vals.length, `${name}: no duplicate rows`);
  ok(vals.every((v) => Number.isFinite(Number(v))), `${name}: every row parses as a number`);
}

/* ---- the steps are the ones the app promises ------------------------------ */

eq(values(ranges.restItems()).slice(0, 3), ['0', '15', '30'], 'rest steps by 15 s');
ok(values(ranges.rpeItems()).includes('8.5'), 'RPE has half points');
ok(values(ranges.weightItems('kg')).includes('62.5'), 'kg weight steps by 2.5');
ok(values(ranges.weightItems('lb')).includes('135'), 'lb weight steps by 5');
ok(values(ranges.measureItems('bodyFat', 'kg')).includes('18.5'), 'body fat has half points');
eq(values(ranges.countItems(3, 5)), ['3', '4', '5'], 'counts are inclusive');

/* ---- birth years ---------------------------------------------------------- */

const years = ranges.birthYearItems(new Date('2026-10-25T00:00:00Z'));
eq(first(years), '1920', 'birth years start at 1920');
eq(last(years), '2026', 'and end at the current year');
ok(years.length > 100, 'a century of choices');

console.log(`test:wheel-ranges — ${n} assertions passed`);
