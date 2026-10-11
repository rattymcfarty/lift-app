#!/usr/bin/env node
/**
 * Runs the backup merge-logic unit tests (src/data/backupFormat.test.cjs).
 *
 * backupFormat.ts is dependency-free by design, so it compiles standalone
 * with the project's own tsc — no test runner dependency needed. The tests
 * never touch expo-sqlite; they exercise validateBackup/planImport against
 * fabricated documents and local indexes.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'lift-backup-test-'));
try {
  execFileSync(
    'npx',
    ['tsc', 'src/data/backupFormat.ts', '--ignoreConfig', '--outDir', tmp,
     '--module', 'commonjs', '--target', 'es2020', '--strict'],
    { cwd: root, stdio: 'pipe' },
  );
  copyFileSync(join(root, 'src/data/backupFormat.test.cjs'), join(tmp, 'backupFormat.test.cjs'));
  execFileSync('node', [join(tmp, 'backupFormat.test.cjs')], { stdio: 'inherit' });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
