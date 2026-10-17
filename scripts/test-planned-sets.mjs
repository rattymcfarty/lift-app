// Unit tests for the plan-targets → opening set rows mapping (pure TS, bundled
// with esbuild like test-lifecycle.mjs).
//
// Regression guard: starting a workout from a plan or a program day must open
// the exercise cards with the plan's set rows filled in, not an empty card.
// The mapping is pure, so it is tested here; the wiring into the workout screen
// (app/workout/[id].tsx + ExerciseCard) is typechecked but not covered by a
// Maestro flow yet — every existing flow starts a blank workout.
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'planned-sets-')), 'plannedSets.mjs');
await build({
  entryPoints: [join(root, 'src/data/plannedSets.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const P = await import(pathToFileURL(out).href);
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// --- one row per planned set, all carrying the same targets ----------------
eq(
  P.plannedSetRows({ targetSets: 3, targetReps: '8-12', targetWeightKg: 60, targetRpe: 8 }),
  [
    { reps: 8, weightKg: 60, rpe: 8 },
    { reps: 8, weightKg: 60, rpe: 8 },
    { reps: 8, weightKg: 60, rpe: 8 },
  ],
  'three sets of 8-12 @60kg RPE8',
);

// --- reps use the LOW end of the range, like the progression engine --------
eq(P.plannedSetRows({ targetSets: 1, targetReps: '8-12' })[0], { reps: 8, weightKg: null, rpe: null }, 'range low end');
eq(P.plannedSetRows({ targetSets: 1, targetReps: '5' })[0].reps, 5, 'single number');
eq(P.plannedSetRows({ targetSets: 1, targetReps: '8+' })[0].reps, 8, 'open-ended range low end');
eq(P.plannedSetRows({ targetSets: 1, targetReps: ' 10 - 12 ' })[0].reps, 10, 'surrounding whitespace tolerated');
eq(P.plannedSetRows({ targetSets: 1, targetReps: 'AMRAP' })[0], { reps: null, weightKg: null, rpe: null }, 'unparseable reps -> blank row, not a guess');

// --- absent / degenerate declarations produce no rows ---------------------
eq(P.plannedSetRows({}), [], 'no targets -> no rows');
eq(P.plannedSetRows({ targetSets: null, targetReps: '8' }), [], 'null sets -> no rows');
eq(P.plannedSetRows({ targetSets: 0 }), [], 'zero sets -> no rows');
eq(P.plannedSetRows({ targetSets: -3 }), [], 'negative sets -> no rows');
eq(P.plannedSetRows({ targetSets: Number.NaN }), [], 'NaN sets -> no rows');
eq(P.plannedSetRows({ targetSets: 3, targetReps: '' })[0].reps, null, 'empty reps text -> blank');

// --- fractional and absurd counts are contained ---------------------------
eq(P.plannedSetRows({ targetSets: 3.9 }).length, 3, 'fractional sets floor');
eq(P.plannedSetRows({ targetSets: 500 }).length, P.MAX_PLANNED_SETS, 'absurd count capped');
eq(P.plannedSetRows({ targetSets: 500 })[0], { reps: null, weightKg: null, rpe: null }, 'capped rows still blank-safe');

// --- non-finite numbers never leak into the inputs ------------------------
eq(P.plannedSetRows({ targetSets: 2, targetWeightKg: Number.NaN })[0].weightKg, null, 'NaN weight dropped');
eq(P.plannedSetRows({ targetSets: 2, targetWeightKg: Number.POSITIVE_INFINITY })[0].weightKg, null, 'infinite weight dropped');
eq(P.plannedSetRows({ targetSets: 2, targetWeightKg: 0 })[0].weightKg, 0, 'bodyweight 0kg is kept');
eq(P.plannedSetRows({ targetSets: 2, targetRpe: Number.NaN })[0].rpe, null, 'NaN rpe dropped');

// --- rows are independent objects (mutating one must not touch the rest) ---
const shared = P.plannedSetRows({ targetSets: 2, targetReps: '8' });
shared[0].reps = 99;
eq(shared[1].reps, 8, 'rows are copies, not shared references');

// --- slot keying: what the workout screen looks up -------------------------
eq(P.plannedSetSlotKey(0, 'ex-a'), P.plannedSetSlotKey(0, 'ex-a'), 'slot key stable');
ok(P.plannedSetSlotKey(0, 'ex-a') !== P.plannedSetSlotKey(1, 'ex-a'), 'position disambiguates the same exercise');
ok(P.plannedSetSlotKey(0, 'ex-a') !== P.plannedSetSlotKey(0, 'ex-b'), 'exercise disambiguates the same position');

const bySlot = P.plannedSetsBySlot([
  { position: 0, exerciseId: 'ex-a', targetSets: 3, targetReps: '8-12' },
  // Same exercise again, later in the routine, different targets.
  { position: 4, exerciseId: 'ex-a', targetSets: 2, targetReps: '5', targetWeightKg: 80 },
  // Declares no sets -> no entry (opens empty, as before).
  { position: 1, exerciseId: 'ex-b', targetReps: '10' },
  // Missing identity -> cannot be matched to a workout row.
  { exerciseId: 'ex-c', targetSets: 3 },
  { position: 2, targetSets: 3 },
]);
eq([...bySlot.keys()].sort(), [P.plannedSetSlotKey(0, 'ex-a'), P.plannedSetSlotKey(4, 'ex-a')].sort(), 'only keyed, planned slots indexed');
eq(bySlot.get(P.plannedSetSlotKey(0, 'ex-a')).length, 3, 'first slot keeps its own count');
eq(bySlot.get(P.plannedSetSlotKey(4, 'ex-a')), [
  { reps: 5, weightKg: 80, rpe: null },
  { reps: 5, weightKg: 80, rpe: null },
], 'duplicate exercise keeps its own targets');
eq(bySlot.get(P.plannedSetSlotKey(1, 'ex-b')), undefined, 'no sets -> not indexed');
eq(P.plannedSetsBySlot([]).size, 0, 'empty routine -> empty index');

console.log(`planned sets mapping: ${n} assertions passed`);
