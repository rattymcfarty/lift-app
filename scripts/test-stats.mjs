#!/usr/bin/env node
/**
 * Stats layer unit tests (P4a) — zero new dependencies.
 *
 * Compiles the pure stats modules (types, volume, frequency, strength,
 * consistency, balance) with the project's own tsc into a temp dir, then runs
 * src/stats/stats.test.cjs and src/stats/balance.test.cjs against the
 * compiled output. The barrel (./index.ts) intentionally excludes ./queries
 * (expo-sqlite), so it is not compiled here. The DB-backed queries are
 * typechecked, not unit-tested — they need expo-sqlite, which doesn't run
 * under plain node.
 *
 * Usage: npm run test:stats
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'lift-stats-test-'));
try {
  // stdio: inherit — tsc diagnostics go to stdout, and execFileSync only
  // surfaces stderr on failure. Inherit keeps compile errors visible.
  execFileSync(
    'npx',
    [
      'tsc',
      'src/stats/types.ts',
      'src/stats/volume.ts',
      'src/stats/frequency.ts',
      'src/stats/strength.ts',
      'src/stats/consistency.ts',
      'src/stats/balance.ts',
      'src/stats/pillars.ts',
      '--ignoreConfig',
      '--outDir', tmp,
      '--module', 'commonjs',
      '--target', 'es2020',
      '--strict',
      '--skipLibCheck',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  copyFileSync(join(root, 'src/stats/stats.test.cjs'), join(tmp, 'stats.test.cjs'));
  copyFileSync(join(root, 'src/stats/balance.test.cjs'), join(tmp, 'balance.test.cjs'));
  for (const test of ['stats.test.cjs', 'balance.test.cjs']) {
    execFileSync('node', [join(tmp, test)], {
      cwd: tmp,
      stdio: 'inherit',
      // DST tests need a timezone with DST transitions; CI often runs UTC.
      env: { ...process.env, TZ: 'America/New_York' },
    });
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
