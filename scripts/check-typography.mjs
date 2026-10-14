#!/usr/bin/env node
/**
 * UI consistency gate: every font size / weight must come from the theme
 * tokens (src/theme/tokens.ts). Fails on raw numeric `fontSize:` or string
 * `fontWeight:` in app/ and src/components/. SVG chart labels
 * (`fontSize={11}` JSX attrs) and the theme-less recovery screen are allowed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOW = new Set(['src/components/MigrationErrorBoundary.tsx']);
const bad = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'icons') continue;
      walk(p);
    } else if (/\.tsx$/.test(name)) {
      const rel = p.slice(root.length + 1);
      if (ALLOW.has(rel)) continue;
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/fontSize:\s*[0-9]/.test(line)) bad.push(`${rel}:${i + 1}: raw fontSize — use theme.typography.size.*`);
        if (/fontWeight:\s*['"]/.test(line)) bad.push(`${rel}:${i + 1}: raw fontWeight — use theme.typography.weight.* / FONT_WEIGHT`);
        if (/fontFamily:/.test(line)) bad.push(`${rel}:${i + 1}: fontFamily — set typography.family in tokens only`);
      });
    }
  }
}
walk(join(root, 'app'));
walk(join(root, 'src/components'));

if (bad.length) {
  console.error(bad.join('\n'));
  console.error(`typography check FAILED (${bad.length})`);
  process.exit(1);
}
console.log('typography check: ok');
