/**
 * Bake-off acceptance test — parseDuration (16 cases).
 *
 *   node docs/ops/bakeoff/parseDuration/test.mjs
 *
 * Prints "ALL PASS" and exits 0 when every case matches, otherwise prints each
 * failure and exits 1. The candidate implements `./duration.mjs`; this file is
 * never modified by the candidate.
 */
import { parseDuration } from './duration.mjs';

/** [input, expected seconds or null] */
const CASES = [
  ['45', 45],
  ['45s', 45],
  ['2m', 120],
  ['2m30s', 150],
  ['1h', 3600],
  ['1h5m', 3900],
  ['1h5m10s', 3910],
  [' 2m ', 120],
  ['2M', 120],
  ['90s', 90],
  ['0s', 0],
  ['', null],
  ['abc', null],
  ['2x', null],
  ['1h30', null],
  ['1h 5m', null],
];

let failed = 0;
for (const [input, expected] of CASES) {
  let actual;
  try {
    actual = parseDuration(input);
  } catch (err) {
    actual = `threw ${err && err.message}`;
  }
  if (actual !== expected) {
    failed += 1;
    console.error(`FAIL parseDuration(${JSON.stringify(input)}) → ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

console.log(failed === 0 ? 'ALL PASS' : `${failed} of ${CASES.length} cases failed`);
process.exit(failed === 0 ? 0 : 1);
