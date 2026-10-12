#!/usr/bin/env node
/**
 * Program DSL unit tests (P3 #12) — zero new dependencies.
 *
 * Compiles src/programs/*.ts (+ the type/runtime files it touches:
 * db/schema, db/id, kb/types) with the project's own tsc into a temp dir,
 * then runs src/programs/programDsl.test.cjs against the compiled output.
 * Exercises validation, KB compilation, snapshot freeze/parse round-trips,
 * and the pure helpers. Never touches expo-sqlite — the DB-backed
 * enrollment operations are typechecked, not unit-tested here.
 *
 * Usage: npm run test:programs
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'lift-programs-test-'));
try {
  execFileSync(
    'npx',
    [
      'tsc',
      'src/programs/types.ts',
      'src/programs/validate.ts',
      'src/programs/compile.ts',
      'src/programs/snapshot.ts',
      'src/programs/safetyRules.ts',
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
    join(root, 'src/programs/programDsl.test.cjs'),
    join(tmp, 'programDsl.test.cjs'),
  );
  copyFileSync(
    join(root, 'src/programs/safety.test.cjs'),
    join(tmp, 'safety.test.cjs'),
  );
  execFileSync('node', [join(tmp, 'programDsl.test.cjs')], {
    cwd: tmp,
    stdio: 'inherit',
    // Compiled output lives in /tmp; point module resolution at the
    // project's node_modules for drizzle-orm (imported via db/schema).
    env: { ...process.env, NODE_PATH: join(root, 'node_modules') },
  });
  execFileSync('node', [join(tmp, 'safety.test.cjs')], {
    cwd: tmp,
    stdio: 'inherit',
    env: { ...process.env, NODE_PATH: join(root, 'node_modules') },
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
