#!/usr/bin/env node
/**
 * Regenerate the static image registry in src/kb/exerciseImage.ts from the
 * PNG files actually present in assets/exercises/.
 *
 * Usage: node scripts/gen-exercise-image-registry.mjs
 *
 * Run this after adding real per-exercise images (the AI-generated set).
 * Files are matched to KB entries by the `assets/exercises/<slug>.png`
 * convention. The placeholder is always included.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets', 'exercises');
const target = join(root, 'src', 'kb', 'exerciseImage.ts');

const files = readdirSync(assetsDir)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .sort();
if (!files.includes('placeholder.png')) {
  console.error('assets/exercises/placeholder.png is missing — aborting');
  process.exit(1);
}

const lines = files.map(
  (f) => `  'assets/exercises/${f}': require('../../assets/exercises/${f}'),`
);
const block = `// === BEGIN GENERATED REGISTRY ===\nconst REGISTRY: Record<string, unknown> = {\n${lines.join('\n')}\n};\n// === END GENERATED REGISTRY ===`;

const src = readFileSync(target, 'utf8');
const next = src.replace(
  /\/\/ === BEGIN GENERATED REGISTRY ===[\s\S]*?\/\/ === END GENERATED REGISTRY ===/,
  block
);
if (next === src) {
  console.error('registry markers not found in src/kb/exerciseImage.ts');
  process.exit(1);
}
writeFileSync(target, next);
console.log(`registry regenerated: ${files.length} image(s)`);
