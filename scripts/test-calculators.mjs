/**
 * Unit tests for src/lib/calculators.ts — zero new dependencies.
 * Compiles the TS source with the project's own tsc into a temp dir,
 * then runs assertions against the emitted JS.
 *
 * Usage: npm run test:calculators
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'calc-test-'));
try {
  execFileSync(
    'npx',
    ['tsc', '-p', 'scripts/tsconfig.calculators.json', '--outDir', dir],
    { stdio: 'pipe' },
  );
  const calc = await import(join(dir, 'calculators.js'));

  let passed = 0;
  function check(name, cond) {
    if (!cond) {
      console.error(`FAIL: ${name}`);
      process.exitCode = 1;
    } else {
      passed++;
    }
  }
  function approx(a, b, eps = 1e-9) {
    return Math.abs(a - b) < eps;
  }

  /* ---- 1RM ---- */
  const r1 = calc.estimateOneRepMax(100, 5);
  check('epley 100x5 = 116.67', r1 !== undefined && approx(r1.epley, 100 * (1 + 5 / 30)));
  check('brzycki 100x5 = 112.5', r1 !== undefined && approx(r1.brzycki, (100 * 36) / 32));

  const r2 = calc.estimateOneRepMax(80, 1);
  check('reps=1: brzycki returns the weight itself', r2 !== undefined && r2.brzycki === 80);
  check('reps=1: epley = w x 31/30', r2 !== undefined && approx(r2.epley, (80 * 31) / 30));

  check('zero weight -> undefined', calc.estimateOneRepMax(0, 5) === undefined);
  check('negative weight -> undefined', calc.estimateOneRepMax(-50, 5) === undefined);
  check('NaN weight -> undefined', calc.estimateOneRepMax(NaN, 5) === undefined);
  check('0 reps -> undefined', calc.estimateOneRepMax(100, 0) === undefined);
  check('37 reps -> undefined (brzycki div-by-zero guard)', calc.estimateOneRepMax(100, 37) === undefined);
  check('fractional reps -> undefined', calc.estimateOneRepMax(100, 5.5) === undefined);

  /* ---- plates (kg) ---- */
  const p1 = calc.calculatePlates(100, 'kg');
  check('100kg target ok', p1.ok === true);
  if (p1.ok) {
    check('100kg -> 25+15 per side', JSON.stringify(p1.result.perSide) === JSON.stringify([{ plate: 25, count: 1 }, { plate: 15, count: 1 }]));
    check('100kg remainder 0', p1.result.remainder === 0);
    check('100kg achieved 100', p1.result.achievedTotal === 100);
  }

  const p2 = calc.calculatePlates(102.5, 'kg');
  check('102.5kg -> 25+15+1.25 per side, remainder 0',
    p2.ok === true && p2.result.remainder === 0 &&
    JSON.stringify(p2.result.perSide) === JSON.stringify([{ plate: 25, count: 1 }, { plate: 15, count: 1 }, { plate: 1.25, count: 1 }]));

  const p3 = calc.calculatePlates(101, 'kg');
  check('101kg not exactly reachable', p3.ok === true && p3.result.remainder === 0.5);
  if (p3.ok) check('101kg achieved 100', p3.result.achievedTotal === 100);

  const p4 = calc.calculatePlates(60, 'kg', 20);
  check('60kg -> 20 per side', p4.ok === true && JSON.stringify(p4.result.perSide) === JSON.stringify([{ plate: 20, count: 1 }]));

  const p5 = calc.calculatePlates(15, 'kg', 20);
  check('below bar -> below-bar', p5.ok === false && p5.reason === 'below-bar');

  const p6 = calc.calculatePlates(20, 'kg', 20);
  check('bar only -> empty per side, remainder 0',
    p6.ok === true && p6.result.perSide.length === 0 && p6.result.achievedTotal === 20);

  /* ---- plates (lb) ---- */
  const p7 = calc.calculatePlates(135, 'lb');
  check('135lb -> 45 per side', p7.ok === true && JSON.stringify(p7.result.perSide) === JSON.stringify([{ plate: 45, count: 1 }]));

  const p8 = calc.calculatePlates(225, 'lb');
  check('225lb -> 2x45 per side', p8.ok === true && JSON.stringify(p8.result.perSide) === JSON.stringify([{ plate: 45, count: 2 }]));

  const p9 = calc.calculatePlates(0, 'kg');
  check('zero target -> invalid-input', p9.ok === false && p9.reason === 'invalid-input');

  console.log(`test:calculators — ${passed} assertions passed`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
