/**
 * Unit tests for the scroll wheel (src/components/ui/wheelModel.ts and the
 * field ranges in src/components/workout/wheelFields.ts).
 *
 * The wheel is a touch surface, so most of it can only be judged on a device —
 * but everything that decides WHICH number a flick lands on is pure maths, and
 * that is what this file pins:
 *
 *   1. a range becomes the rows a workout actually needs (2.5 kg steps, half
 *      RPE points, 0–100 reps);
 *   2. a scroll offset becomes a row, and the row under the band is the one
 *      reported to the caller;
 *   3. a typed value opens the wheel on the nearest row instead of jumping to 0;
 *   4. the looping drum always recentres into the middle copy, so the user can
 *      keep flicking forever without drifting.
 *
 * Usage: node scripts/test-wheel.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function loadModule(relPath, name) {
  const out = join(mkdtempSync(join(tmpdir(), 'wheel-')), `${name}.mjs`);
  await build({
    entryPoints: [join(root, relPath)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    logLevel: 'error',
  });
  return import(pathToFileURL(out).href);
}

const model = await loadModule('src/components/ui/wheelModel.ts', 'wheelModel');
const fields = await loadModule('src/components/workout/wheelFields.ts', 'wheelFields');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* ---- 1. ranges become rows ---------------------------------------------- */

const reps = model.buildWheel({ min: 0, max: 100, step: 1 });
eq(reps.length, 101, 'reps run 0–100, inclusive');
eq(reps[0].value, '0', 'reps start at 0');
eq(reps[100].value, '100', 'reps end at 100');

const kg = model.buildWheel({ min: 0, max: 400, step: 2.5, decimals: 1 });
eq(kg.length, 161, 'kg runs 0–400 in 2.5 kg steps');
eq(kg[1].value, '2.5', 'a half-plate step is a real row');
eq(kg[8].value, '20', 'whole kilos print without a decimal point');
ok(kg.every((r) => Number.isFinite(Number(r.value))), 'every row is a number');

const rpe = model.buildWheel({ min: 1, max: 10, step: 0.5, decimals: 1 });
eq(rpe.length, 19, 'RPE runs 1–10 in half points');
eq(rpe.map((r) => r.value).slice(0, 3), ['1', '1.5', '2'], 'RPE steps by a half point');

// A max that does not land on a step is simply not a row (no rounding up).
eq(model.buildWheel({ min: 0, max: 100, step: 30 }).map((r) => r.value), ['0', '30', '60', '90'], 'the range stops at the last full step');

/* ---- 2. offsets and rows ------------------------------------------------- */

eq(model.snapIndex(0, 40), 0, 'the top of the drum is row 0');
eq(model.snapIndex(80, 40), 2, 'two rows down is row 2');
eq(model.snapIndex(99, 40), 2, 'a partial row snaps back to the row under the band');
eq(model.snapIndex(101, 40), 3, 'and forward past the midpoint');
eq(model.snapIndex(120, 0), 0, 'a zero row height cannot divide by zero');

eq(model.itemAt(reps, 5).value, '5', 'row 5 of the reps wheel is 5');
eq(model.itemAt(reps, -1).value, '100', 'the wheel wraps backwards, so the drum has no end');
eq(model.itemAt(reps, 101).value, '0', 'and forwards');
eq(model.itemAt([], 3).value, '', 'an empty wheel is not a crash');

/* ---- 3. a typed value finds its row -------------------------------------- */

eq(model.indexOfValue(kg, '62.5'), 25, 'an exact value finds its row');
eq(model.indexOfValue(kg, '63'), 25, '63 kg opens on the nearest row (62.5), not row 0');
eq(model.indexOfValue(kg, '64'), 26, 'and rounds the other way (65)');
eq(model.indexOfValue(kg, ''), 0, 'an empty value starts at the top');
eq(model.indexOfValue(kg, 'abc'), 0, 'garbage does not move the drum');
eq(model.indexOfValue(kg, '999'), 160, 'a value past the end lands on the last row');
eq(model.indexOfValue(kg, '63', 7, false), 7, 'without nearest, an absent value keeps the fallback');

/* ---- 4. the loop recentres ---------------------------------------------- */

eq(model.loopIndex(0, 10), 10, 'row 0 of a loop opens in the middle copy');
eq(model.loopIndex(9, 10), 19, 'the last row too');
eq(model.loopIndex(10, 10), 10, 'an index already in the middle copy is left alone');
eq(model.loopIndex(25, 10), 15, 'a far flick comes back to the middle copy');
eq(model.loopIndex(-1, 10), 19, 'and so does a backwards one');

// Recentring never changes which row is under the band — that is what makes the
// silent jump invisible.
for (const i of [0, 1, 7, 10, 11, 19, 25, -3]) {
  eq(
    model.itemAt(reps, i).value,
    model.itemAt(reps, model.loopIndex(i, reps.length)).value,
    `recentring keeps row ${i} under the band`,
  );
}
eq(model.LOOP_COPIES, 3, 'the drum is three copies, so a flick never shows an edge');

/* ---- 5. the set row's three fields --------------------------------------- */

eq(fields.WHEEL_FIELDS, ['weight', 'reps', 'rpe'], 'a set row offers exactly three wheels');
eq(fields.wheelFieldLabel('weight'), 'Weight', 'field labels are user-facing');
eq(fields.wheelFieldUnit('weight', 'kg'), 'kg', 'weight shows the chosen unit');
eq(fields.wheelFieldUnit('weight', 'lb'), 'lb', 'and follows kg/lb');
eq(fields.wheelFieldUnit('reps', 'kg'), 'reps', 'reps say so');
eq(fields.wheelFieldUnit('rpe', 'kg'), undefined, 'RPE is a number, not a measure');

const lb = fields.wheelItems('weight', 'lb');
eq(lb[1].value, '5', 'pounds step by 5');
eq(Number(lb[lb.length - 1].value), 880, 'and run to 880 lb');
eq(Number(fields.wheelItems('weight', 'kg').slice(-1)[0].value), 400, 'kg run to 400');

eq(fields.wheelIndex(fields.wheelItems('rpe', 'kg'), ''), 0, 'an empty RPE opens at 1');
eq(fields.wheelItems('rpe', 'kg')[fields.wheelIndex(fields.wheelItems('rpe', 'kg'), '8')].value, '8', 'a typed RPE 8 opens on 8');
eq(fields.wheelIndex(fields.wheelItems('reps', 'kg'), '12'), 12, 'reps index by value');
eq(
  fields.wheelItems('weight', 'kg')[fields.wheelIndex(fields.wheelItems('weight', 'kg'), '63')].value,
  '62.5',
  'a typed 63 kg opens the wheel on 62.5',
);

console.log(`test:wheel — ${n} assertions passed`);
