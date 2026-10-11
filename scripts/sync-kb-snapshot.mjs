#!/usr/bin/env node
/**
 * Refresh the app's in-binary KB snapshot from the lift-kb repo.
 *
 *   node scripts/sync-kb-snapshot.mjs [path-to-lift-kb-checkout]
 *
 * Copies the CI-built bundle (dist/kb-bundle-<version>.json) and channel.json
 * into assets/kb/snapshot/ as bundle.json + channel.json. The app imports the
 * snapshot on first launch so it works fully offline out of the box.
 *
 * The snapshot is re-validated at runtime (src/kb/snapshot.ts), so a stale or
 * corrupt asset can never poison the database — but keep it fresh: refresh
 * whenever lift-kb publishes a new bundle version.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const kbRoot = resolve(process.argv[2] ?? join(root, '..', 'p2-kb-content'));

const version = JSON.parse(
  (await import('node:fs')).readFileSync(join(kbRoot, 'kb-version.json'), 'utf8'),
).version;
const bundleSrc = join(kbRoot, 'dist', `kb-bundle-${version}.json`);
if (!existsSync(bundleSrc)) {
  console.error(`bundle not found: ${bundleSrc}`);
  console.error('Run `node scripts/build-bundle.mjs` in the lift-kb checkout first.');
  process.exit(1);
}

const outDir = join(root, 'assets', 'kb', 'snapshot');
mkdirSync(outDir, { recursive: true });
copyFileSync(bundleSrc, join(outDir, 'bundle.json'));
copyFileSync(join(kbRoot, 'channel.json'), join(outDir, 'channel.json'));
console.log(`snapshot refreshed: KB v${version} → assets/kb/snapshot/`);
