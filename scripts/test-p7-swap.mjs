#!/usr/bin/env node
/** P7 Slice 4 — swap exercise tests. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = join(process.cwd());
const tmp = mkdtempSync(join(tmpdir(), 'p7-swap-'));
let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL:', name); }
}

try {
  const outDir = join(tmp, 'out');
  execFileSync('npx', ['tsc', 'src/lib/swapHelpers.ts', '--ignoreConfig', '--outDir', outDir,
    '--module', 'commonjs', '--target', 'es2020', '--strict', '--esModuleInterop'],
    { cwd: root, stdio: 'pipe' });
  const require = createRequire(import.meta.url);
  const { buildSwapWorkoutExerciseValues } = require(join(outDir, 'swapHelpers.js'));

  // ---- buildSwapWorkoutExerciseValues ----
  const v = buildSwapWorkoutExerciseValues({
    workoutId: 'w1', exerciseId: 'e2', position: 0,
    notes: 'note', restSeconds: 90, unitPreference: 'kg',
    supersetId: null, autoProgression: true,
  });
  ok(v.workoutId === 'w1' && v.exerciseId === 'e2' && v.position === 0, 'buildSwap: identity fields');
  ok(v.notes === 'note' && v.restSeconds === 90 && v.unitPreference === 'kg', 'buildSwap: settings copied');
  ok(v.supersetId === null && v.autoProgression === true, 'buildSwap: nullable fields');

  // null notes preserved
  const v2 = buildSwapWorkoutExerciseValues({
    workoutId: 'w1', exerciseId: 'e2', position: 1,
    notes: null, restSeconds: null, unitPreference: null,
    supersetId: 'sup1', autoProgression: null,
  });
  ok(v2.notes === null && v2.restSeconds === null && v2.unitPreference === null, 'buildSwap: nulls preserved');
  ok(v2.supersetId === 'sup1' && v2.autoProgression === null, 'buildSwap: nullable fields 2');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}