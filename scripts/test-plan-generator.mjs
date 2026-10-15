// Unit tests for the rule-based plan generator (pure TS, bundled with esbuild).
import { build } from 'esbuild';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'plangen-')), 'gen.mjs');
await build({
  entryPoints: [join(root, 'src/lib/planGenerator.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { generatePlan } = await import(pathToFileURL(out).href);

const bundle = JSON.parse(readFileSync(join(root, 'assets/kb/snapshot/bundle.json'), 'utf8'));
const cat = bundle.exercises.filter((e) => !e.deprecated).map((e) => ({
  id: e.id, name: e.name, equipment: e.equipment, movementPattern: e.movementPattern,
  category: e.category, difficulty: e.difficulty,
}));
const byId = new Map(cat.map((c) => [c.id, c]));
const base = { experience: 'beginner', goal: 'longevity', daysPerWeek: 3, minutes: 45, equipment: 'full', limitations: [], weightKg: 75 };

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

for (const days of [2, 3, 4, 5]) {
  const plan = generatePlan({ ...base, daysPerWeek: days }, cat);
  ok(plan.length === days, `${days} days -> ${plan.length}`);
  for (const d of plan) {
    ok(d.items.length >= 3, `${d.name} has real content`);
    ok(d.items.length <= 5, `${d.name} respects 45 min cap`);
    ok(new Set(d.items.map((i) => i.exerciseId)).size === d.items.length, 'no duplicate in a day');
    for (const it of d.items) ok(byId.has(it.exerciseId), `known id ${it.exerciseId}`);
  }
}

// Bodyweight-only: nothing with equipment.
for (const d of generatePlan({ ...base, equipment: 'bodyweight' }, cat))
  for (const it of d.items)
    ok(byId.get(it.exerciseId).equipment.includes('Bodyweight'), `bodyweight only: ${it.exerciseId}`);

// Limitations are honoured.
for (const d of generatePlan({ ...base, experience: 'advanced', limitations: ['knees', 'lowerBack', 'shoulders'] }, cat))
  for (const it of d.items)
    ok(!/jump|lunge|split-squat|deadlift|swing|overhead|shoulder-press|dip/.test(it.exerciseId), `avoided ${it.exerciseId}`);

// Experience gate: beginners never get advanced work.
for (const d of generatePlan(base, cat))
  for (const it of d.items) ok(byId.get(it.exerciseId).difficulty === 'beginner', `beginner-safe ${it.exerciseId}`);

// Session length scales.
const long = generatePlan({ ...base, minutes: 75 }, cat)[0].items.length;
const short = generatePlan({ ...base, minutes: 30 }, cat)[0].items.length;
ok(long > short, `75 min (${long}) > 30 min (${short})`);

// Longevity always ends with mobility and carries loads only with known weight.
for (const d of generatePlan(base, cat)) ok(byId.get(d.items.at(-1).exerciseId).category === 'Mobility', 'ends with mobility');
const noWeight = generatePlan({ ...base, weightKg: null }, cat);
ok(noWeight.every((d) => d.items.every((i) => i.weightKg === undefined)), 'no weights without bodyweight');
const withW = generatePlan({ ...base, weightKg: 100, experience: 'intermediate' }, cat);
ok(withW.flatMap((d) => d.items).some((i) => i.weightKg && i.weightKg >= 10), 'loads scale with bodyweight');

// Strength goal gives low reps + long rest on compounds.
const st = generatePlan({ ...base, goal: 'strength', experience: 'intermediate' }, cat)[0].items[0];
ok(st.reps === '4-6' && st.restSeconds >= 150, 'strength prescription');

console.log(`plan generator: ${n} assertions passed`);
