#!/usr/bin/env node
/**
 * Regenerate the static demo registry in src/kb/exerciseDemo.ts from the MP4s
 * actually present in assets/exercises/demos/.
 *
 * Usage: node scripts/gen-exercise-demo-registry.mjs
 *
 * Two kinds of files live in that folder:
 *
 *  - BUNDLED clips named by permanent KB id: <kb-id>.mp4, <kb-id>__2.mp4.
 *    Metro cannot require a dynamic path, so these are registered statically
 *    and ship inside the app (offline fallback).
 *  - PUBLISHED clips named by the exercise display name, e.g.
 *    "Dumbbell Bench Press - Dumbbell-2.mp4". The video agent adds these and
 *    syncs the repo; the app discovers them at runtime from GitHub and matches
 *    them by name. They are deliberately NOT bundled (Metro excludes them via
 *    metro.config.js) and are not part of the contract test.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const demosDir = join(root, 'assets', 'exercises', 'demos');
const target = join(root, 'src', 'kb', 'exerciseDemo.ts');

const BUNDLED_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:__[2-9]\d*)?\.mp4$/;

let allFiles = [];
try {
  allFiles = readdirSync(demosDir)
    .filter((f) => f.toLowerCase().endsWith('.mp4'))
    .sort();
} catch {
  allFiles = [];
}

const published = allFiles.filter((f) => !BUNDLED_RE.test(f));
const files = allFiles.filter((f) => BUNDLED_RE.test(f));
if (published.length) {
  console.log(`published for runtime (${published.length}): ${published.join(', ')}`);
}

const bad = files.filter((f) => /__1\.mp4$/.test(f));
if (bad.length) {
  console.error(`Later versions start at __2; __1 is the base file:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}

const groups = new Map();
for (const f of files) {
  const m = /^([a-z0-9]+(?:-[a-z0-9]+)*?)(?:__(\d+))?\.mp4$/.exec(f);
  if (!m) {
    console.error(`Unexpected bundled file name: ${f}`);
    process.exit(1);
  }
  const version = m[2] ? Number(m[2]) : 1;
  const base = m[1];
  if (!groups.has(base)) groups.set(base, []);
  groups.get(base).push({ version, file: f });
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
const registryLines = entries.map(([base, versions]) => {
  const reqs = versions.map(
    ({ file }) => `    require('../../assets/exercises/demos/${file}')`,
  );
  return `  '${base}': [\n${reqs.join(',\n')},\n  ],`;
});
const fileLines = files.map((f) => `  '${f}',`);
const block = `// === BEGIN GENERATED REGISTRY ===
const REGISTRY: Record<string, number[]> = {
${registryLines.join('\n')}
};
const BUNDLED_FILES: readonly string[] = [
${fileLines.join('\n')}
];
// === END GENERATED REGISTRY ===`;

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
  console.log(`demo registry already up to date: ${entries.length} exercise(s), ${files.length} bundled, ${published.length} published`);
  process.exit(0);
}
writeFileSync(target, next);
console.log(`demo registry regenerated: ${entries.length} exercise(s), ${files.length} bundled, ${published.length} published`);
