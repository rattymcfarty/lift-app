#!/usr/bin/env node
/**
 * Progression + deload engine unit tests (P3 #13) — zero new dependencies.
 *
 * Compiles the pure program modules (types, validate, compile, snapshot,
 * progression + the barrel's pure surface) with the project's own tsc into
 * a temp dir, then runs src/programs/progression.test.cjs against the
 * compiled output. Never touches expo-sqlite — the DB-backed engine
 * operations (./engine.ts) are typechecked, not unit-tested here.
 *
 * Usage: npm run test:progression
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'lift-progression-test-'));
try {
  execFileSync(
    'npx',
    [
      'tsc',
      'src/programs/types.ts',
      'src/programs/validate.ts',
      'src/programs/compile.ts',
      'src/programs/snapshot.ts',
      'src/programs/progression.ts',
      'src/programs/index.ts',
      'src/db/schema.ts',
      'src/db/id.ts',
      'src/kb/types.ts',
      '--ignoreConfig',
      '--outDir', tmp,
      '--module', 'commonjs',
      '--target', 'es2020',
      '--strict',
      '--skipLibCheck',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  copyFileSync(
    join(root, 'src/programs/progression.test.cjs'),
    join(tmp, 'progression.test.cjs'),
  );
  execFileSync('node', [join(tmp, 'progression.test.cjs')], {
    cwd: tmp,
    stdio: 'inherit',
    // Compiled output lives in /tmp; point module resolution at the
    // project's node_modules for drizzle-orm (imported via db/schema).
    env: { ...process.env, NODE_PATH: join(root, 'node_modules') },
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
