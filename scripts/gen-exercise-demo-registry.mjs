#!/usr/bin/env node
/**
 * Regenerate the static demo registry in src/kb/exerciseDemo.ts from the MP4s
 * actually present in assets/exercises/demos/.
 *
 * Usage: node scripts/gen-exercise-demo-registry.mjs
 *
 * Run this after adding a clip. The file name must be the exercise's permanent
 * KB id (e.g. bench-press-powerlifting.mp4), because Metro cannot require a
 * dynamic path and the guide looks the clip up by that id.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const demosDir = join(root, 'assets', 'exercises', 'demos');
const target = join(root, 'src', 'kb', 'exerciseDemo.ts');

let files = [];
try {
  files = readdirSync(demosDir)
    .filter((f) => f.toLowerCase().endsWith('.mp4'))
    .sort();
} catch {
  files = [];
}

const bad = files.filter((f) => !/^[a-z0-9]+(?:-[a-z0-9]+)*\.mp4$/.test(f));
if (bad.length) {
  console.error(`Clip names must be lowercase KB ids (letters, digits, dashes):\n  ${bad.join('\n  ')}`);
  process.exit(1);
}

const lines = files.map(
  (f) => `  '${f.slice(0, -4)}': require('../../assets/exercises/demos/${f}'),`,
);
const block = `// === BEGIN GENERATED REGISTRY ===\nconst REGISTRY: Record<string, number> = {\n${lines.join('\n')}\n};\n// === END GENERATED REGISTRY ===`;

const src = readFileSync(target, 'utf8');
if (!src.includes('// === BEGIN GENERATED REGISTRY ===') || !src.includes('// === END GENERATED REGISTRY ===')) {
  console.error('registry markers not found in src/kb/exerciseDemo.ts');
  process.exit(1);
}
const next = src.replace(
  /\/\/ === BEGIN GENERATED REGISTRY ===[\s\S]*?\/\/ === END GENERATED REGISTRY ===/,
  block,
);
if (next === src) {
  console.log(`demo registry already up to date: ${files.length} clip(s)`);
  process.exit(0);
}
writeFileSync(target, next);
console.log(`demo registry regenerated: ${files.length} clip(s)`);
