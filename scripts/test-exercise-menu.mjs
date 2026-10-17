// Unit tests for the in-workout exercise menu's pure logic (src/lib/exerciseMenu.ts):
// the reorder move function, the warmup ramp calculator, the warmup preview builder,
// the superset next-action logic, and the rest presets.
// Bundled with esbuild like the other pure-logic tests \u2014 no DB, no React.
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

// --- buildWarmupPreview ---------------------------------------------------
// Weighted exercise, kg mode
{
  const preview = M.buildWarmupPreview({
    firstWorkingWeightKg: 100,
    unit: 'kg',
  });
  eq(preview.length, 3, 'three ramp rows for known weight (kg)');
  eq(preview[0], { reps: '5', weightKg: 50, isBodyweight: false }, '50% x5');
  eq(preview[1], { reps: '3', weightKg: 70, isBodyweight: false }, '70% x3');
  eq(preview[2], { reps: '2', weightKg: 85, isBodyweight: false }, '85% x2');
}

// Weighted exercise, lb mode (rounds to 5lb steps)
{
  const preview = M.buildWarmupPreview({
    firstWorkingWeightKg: 100, // ~220.5 lb
    unit: 'lb',
  });
  eq(preview.length, 3, 'three ramp rows for known weight (lb)');
  // 50% of 100kg = 50kg = 110.25lb -> rounded to 110lb = 49.9kg
  ok(preview[0].weightKg !== null && preview[0].weightKg > 0, 'lb ramp weight positive');
  eq(preview[0].reps, '5', 'first row reps 5');
  eq(preview[0].isBodyweight, false, 'not bodyweight');
}

// Duplicate collapse: 60kg -> 30, 42, 51 (all distinct); 61kg -> 30.5, 42.5, 51.5 (all distinct)
// Test a case where rounding creates duplicates
{
  const preview = M.buildWarmupPreview({
    firstWorkingWeightKg: 10, // small weight where rounding might collapse
    unit: 'kg',
  });
  // 50% = 5kg, 70% = 7kg, 85% = 8.5kg -> rounds to 5, 7, 8.5 (distinct)
  eq(preview.length, 3, 'small weight still distinct after rounding');
}

// Bodyweight exercise (equipment includes Bodyweight)
{
  const preview = M.buildWarmupPreview({
    firstWorkingWeightKg: 100,
    unit: 'kg',
    equipment: ['Bodyweight'],
  });
  eq(preview.length, 2, 'bodyweight -> two reps-only rows');
  eq(preview[0], { reps: '5', weightKg: null, isBodyweight: true }, 'bodyweight row 1');
  eq(preview[1], { reps: '3', weightKg: null, isBodyweight: true }, 'bodyweight row 2');
  ok(preview.every((r) => r.isBodyweight === true), 'all rows marked bodyweight');
}

// Force bodyweight via flag (No weight toggle)
{
  const preview = M.buildWarmupPreview({
    firstWorkingWeightKg: 100,
    unit: 'kg',
    forceBodyweight: true,
  });
  eq(preview.length, 2, 'forceBodyweight -> two reps-only rows');
  ok(preview.every((r) => r.isBodyweight === true), 'all rows marked bodyweight');
}

// No weight known, not bodyweight -> two empty rows
{
  const preview = M.buildWarmupPreview({
    unit: 'kg',
  });
  eq(preview.length, 2, 'no weight -> two empty rows');
  eq(preview[0], { reps: '', weightKg: null, isBodyweight: false }, 'empty row 1');
  eq(preview[1], { reps: '', weightKg: null, isBodyweight: false }, 'empty row 2');
  ok(preview.every((r) => r.isBodyweight === false), 'not marked bodyweight');
}

// Priority: firstWorkingWeightKg > previousPerformanceWeightKg > routineTargetWeightKg
{
  const preview = M.buildWarmupPreview({
    firstWorkingWeightKg: 80,
    previousPerformanceWeightKg: 100,
    routineTargetWeightKg: 120,
    unit: 'kg',
  });
  eq(preview[0].weightKg, 40, 'uses firstWorkingWeightKg (80 * 0.5 = 40)');
}

// Previous performance used when first working not set
{
  const preview = M.buildWarmupPreview({
    previousPerformanceWeightKg: 100,
    routineTargetWeightKg: 120,
    unit: 'kg',
  });
  eq(preview[0].weightKg, 50, 'uses previousPerformanceWeightKg (100 * 0.5 = 50)');
}

// Routine target used when neither first working nor previous
{
  const preview = M.buildWarmupPreview({
    routineTargetWeightKg: 120,
    unit: 'kg',
  });
  eq(preview[0].weightKg, 60, 'uses routineTargetWeightKg (120 * 0.5 = 60)');
}

// Zero/negative/NaN weights treated as unknown
{
  eq(M.buildWarmupPreview({ firstWorkingWeightKg: 0, unit: 'kg' }).length, 2, 'zero weight -> empty');
  eq(M.buildWarmupPreview({ firstWorkingWeightKg: -10, unit: 'kg' }).length, 2, 'negative weight -> empty');
  eq(M.buildWarmupPreview({ firstWorkingWeightKg: Number.NaN, unit: 'kg' }).length, 2, 'NaN weight -> empty');
}

// --- getSupersetNextAction ------------------------------------------------
{
  const members = ['a', 'b', 'c'];
  const counts = new Map([['a', 1], ['b', 0], ['c', 0]]);
  const res = M.getSupersetNextAction(members, counts);
  eq(res.nextMemberId, 'b', 'next is first member behind the leader');
  eq(res.startRest, false, 'no rest until round complete');
}

{
  const members = ['a', 'b', 'c'];
  const counts = new Map([['a', 1], ['b', 1], ['c', 1]]);
  const res = M.getSupersetNextAction(members, counts);
  eq(res.nextMemberId, 'a', 'round complete -> next round starts at first member');
  eq(res.startRest, true, 'rest timer starts after last member');
}

{
  const members = ['a', 'b'];
  const counts = new Map([['a', 2], ['b', 1]]);
  const res = M.getSupersetNextAction(members, counts);
  eq(res.nextMemberId, 'b', 'b needs to catch up');
  eq(res.startRest, false, 'no rest');
}

{
  const members = ['a'];
  const counts = new Map([['a', 3]]);
  const res = M.getSupersetNextAction(members, counts);
  eq(res.nextMemberId, null, 'single member -> no superset logic');
  eq(res.startRest, false, 'no rest from superset logic');
}

{
  const members = ['a', 'b', 'c'];
  const counts = new Map();
  const res = M.getSupersetNextAction(members, counts);
  eq(res.nextMemberId, 'a', 'all zero -> first member');
  eq(res.startRest, false, 'no rest');
}

// --- nextSupersetMember ----------------------------------------------------
{
  const members = ['a', 'b', 'c'];
  const counts = new Map([['a', 1], ['b', 0], ['c', 0]]);
  eq(M.nextSupersetMember(members, counts, 'a'), 'b', 'after a (leader), next behind is b');
  eq(M.nextSupersetMember(members, counts, 'b'), 'c', 'after b (behind), next behind is c');
  eq(M.nextSupersetMember(members, counts, 'c'), 'b', 'after c, wraps to b (behind)');
}

{
  const members = ['a', 'b', 'c'];
  const counts = new Map([['a', 1], ['b', 1], ['c', 0]]);
  eq(M.nextSupersetMember(members, counts, 'a'), 'c', 'after a, next behind leader is c');
  eq(M.nextSupersetMember(members, counts, 'b'), 'c', 'after b (caught up), next behind is c');
  eq(M.nextSupersetMember(members, counts, 'c'), 'c', 'after c (behind), c still needs to catch up');
}

{
  const members = ['a', 'b', 'c'];
  const counts = new Map([['a', 1], ['b', 1], ['c', 1]]);
  eq(M.nextSupersetMember(members, counts, 'a'), 'a', 'round complete, next round starts at a');
  eq(M.nextSupersetMember(members, counts, 'b'), 'a', 'round complete, next round starts at a');
  eq(M.nextSupersetMember(members, counts, 'c'), 'a', 'round complete, next round starts at a');
}

{
  const members = ['a', 'b'];
  const counts = new Map([['a', 2], ['b', 1]]);
  eq(M.nextSupersetMember(members, counts, 'a'), 'b', 'after a, b needs to catch up');
  eq(M.nextSupersetMember(members, counts, 'b'), 'b', 'after b (behind), b still needs to catch up');
}

{
  const members = ['a'];
  const counts = new Map([['a', 3]]);
  eq(M.nextSupersetMember(members, counts, 'a'), null, 'single member -> null');
}

{
  const members = ['a', 'b', 'c'];
  const counts = new Map();
  eq(M.nextSupersetMember(members, counts, 'a'), 'a', 'all zero -> first member');
  eq(M.nextSupersetMember(members, counts, 'b'), 'a', 'all zero, after b wraps to a');
  eq(M.nextSupersetMember(members, counts, 'c'), 'a', 'all zero, after c wraps to a');
}

// --- shouldStartRest -------------------------------------------------------
{
  const members = ['a', 'b', 'c'];
  const counts = new Map([['a', 1], ['b', 0], ['c', 0]]);
  eq(M.shouldStartRest(members, counts, 'a'), false, 'not last member');
  eq(M.shouldStartRest(members, counts, 'b'), false, 'not last member');
  eq(M.shouldStartRest(members, counts, 'c'), false, 'last member but round not complete');
}

{
  const members = ['a', 'b', 'c'];
  const counts = new Map([['a', 1], ['b', 1], ['c', 0]]);
  eq(M.shouldStartRest(members, counts, 'c'), false, 'last member but round not complete');
}

{
  const members = ['a', 'b', 'c'];
  const counts = new Map([['a', 1], ['b', 1], ['c', 1]]);
  eq(M.shouldStartRest(members, counts, 'a'), false, 'not last member even if round complete');
  eq(M.shouldStartRest(members, counts, 'b'), false, 'not last member even if round complete');
  eq(M.shouldStartRest(members, counts, 'c'), true, 'last member AND round complete -> rest starts');
}

{
  const members = ['a', 'b'];
  const counts = new Map([['a', 2], ['b', 2]]);
  eq(M.shouldStartRest(members, counts, 'a'), false, 'not last member');
  eq(M.shouldStartRest(members, counts, 'b'), true, 'last member and round complete');
}

{
  const members = ['a'];
  const counts = new Map([['a', 3]]);
  eq(M.shouldStartRest(members, counts, 'a'), false, 'single member -> false (ungrouped handled by caller)');
}

{
  const members = ['a', 'b', 'c'];
  const counts = new Map();
  eq(M.shouldStartRest(members, counts, 'c'), false, 'all zero -> no rest');
}

// --- REST_PRESETS / formatRestLabel --------------------------------------
eq(M.REST_PRESETS, [30, 45, 60, 90, 120, 180, 300], 'rest presets are the seven requested');
eq(M.formatRestLabel(120), '2:00', '2m');
eq(M.formatRestLabel(45), '0:45', '45s');
eq(M.formatRestLabel(90), '1:30', '90s');
eq(M.formatRestLabel(300), '5:00', '5m');
eq(M.formatRestLabel(30), '0:30', '30s');
eq(M.formatRestLabel(null), '\u2014', 'null rest shows a dash');
eq(M.formatRestLabel(undefined), '\u2014', 'undefined rest shows a dash');

console.log(`exercise menu logic: ${n} assertions passed`);