#!/usr/bin/env node
/**
 * Regenerate the static demo registry in src/kb/exerciseDemo.ts from the MP4s
 * actually present in assets/exercises/demos/.
 *
 * Usage: node scripts/gen-exercise-demo-registry.mjs
 *
 * Naming: <kb-id>.mp4 is demo 1; <kb-id>__2.mp4, <kb-id>__3.mp4 are later
 * versions of the same exercise. An exercise can have several demos; the guide
 * lets the user switch between them. The file name must start with the
 * exercise's permanent KB id, because Metro cannot require a dynamic path.
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

const groups = new Map();
const bad = [];
for (const f of files) {
  const m = /^([a-z0-9]+(?:-[a-z0-9]+)*?)(?:__(\d+))?\.mp4$/.exec(f);
  if (!m) {
    bad.push(f);
    continue;
  }
  const version = m[2] ? Number(m[2]) : 1;
  if (version < 1 || (m[2] && version < 2)) {
    bad.push(`${f} (later versions start at __2; __1 is the base file)`);
    continue;
  }
  const base = m[1];
  if (!groups.has(base)) groups.set(base, []);
  groups.get(base).push({ version, file: f });
}
if (bad.length) {
  console.error(`Clip names must be a lowercase KB id, optionally with __N for a later demo:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}

for (const [base, versions] of groups) {
  versions.sort((a, b) => a.version - b.version);
  if (versions[0].version !== 1) {
    console.error(`"${base}" has no base file ${base}.mp4 (version 1)`);
    process.exit(1);
  }
  for (let i = 1; i < versions.length; i++) {
    if (versions[i].version !== versions[i - 1].version + 1) {
      console.error(`"${base}" versions skip a number: ${versions.map((v) => v.version).join(', ')}`);
      process.exit(1);
    }
  }
}

const entries = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
const lines = entries.map(([base, versions]) => {
  const reqs = versions.map(
    ({ version, file }) => `    require('../../assets/exercises/demos/${file}')`,
  );
  return `  '${base}': [\n${reqs.join(',\n')},\n  ],`;
});
const block = `// === BEGIN GENERATED REGISTRY ===\nconst REGISTRY: Record<string, number[]> = {\n${lines.join('\n')}\n};\n// === END GENERATED REGISTRY ===`;

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
  console.log(`demo registry already up to date: ${entries.length} exercise(s), ${files.length} clip(s)`);
  process.exit(0);
}
writeFileSync(target, next);
console.log(`demo registry regenerated: ${entries.length} exercise(s), ${files.length} clip(s)`);
