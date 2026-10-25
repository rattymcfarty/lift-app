/**
 * Unit tests for the persona editor's explanations (`src/lib/personaImpact.ts`).
 *
 * The promise to the owner is that the editor shows **what each answer changes**.
 * That is only honest if the numbers come from the generator, so these tests hold
 * the editor to the generator's tables rather than to remembered copy: goal →
 * sets/reps/rest, experience → sets + load factor + difficulty ceiling, days →
 * the actual split names, minutes → the exercise cap, equipment and limitations →
 * what is filtered out.
 *
 * Usage: node scripts/test-persona.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'persona-')), 'personaImpact.mjs');
await build({
  entryPoints: [join(root, 'src/lib/personaImpact.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const { personaImpact, limitationExclusions, GOAL_ANSWER } = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const profile = (patch = {}) => ({
  experience: 'intermediate',
  goal: 'strength',
  daysPerWeek: 4,
  minutes: 60,
  equipment: 'full',
  limitations: [],
  weightKg: 80,
  ...patch,
});

const line = (lines, key) => lines.find((l) => l.key === key);

/* ---- shape ---------------------------------------------------------------- */

const base = personaImpact(profile());
eq(base.map((l) => l.key), ['goal', 'experience', 'daysPerWeek', 'minutes', 'equipment', 'limitations'], 'six answers, in the editor order');
for (const l of base) {
  ok(l.label.length > 2, `${l.key}: has a question`);
  ok(l.answer.length > 0, `${l.key}: has the chosen answer`);
  ok(l.changes.length > 10, `${l.key}: explains what it changes`);
}
ok(!base.some((l) => /\bundefined\b|\bNaN\b/.test(l.changes + l.answer)), 'no placeholder text leaks into the editor');

/* ---- goal → the prescription ---------------------------------------------- */

ok(/Main lifts 4 × 4-6 reps/.test(line(base, 'goal').changes), 'strength: 4 sets of 4-6');
ok(/150 s rest/.test(line(base, 'goal').changes), 'strength: long rests');

const muscle = personaImpact(profile({ goal: 'muscle' }));
ok(/3 × 8-12 reps/.test(line(muscle, 'goal').changes), 'muscle: 3 sets of 8-12');
ok(/75 s rest/.test(line(muscle, 'goal').changes), 'muscle: shorter rests');

const fitness = personaImpact(profile({ goal: 'fitness', experience: 'advanced' }));
ok(/3 × 10-15 reps/.test(line(fitness, 'goal').changes), 'fitness: higher reps');
ok(/60 s rest/.test(line(fitness, 'goal').changes), 'fitness: 60 s rests');

const longevity = personaImpact(profile({ goal: 'longevity' }));
ok(/8-12 reps/.test(line(longevity, 'goal').changes), 'longevity: 8-12');
ok(/90 s rest/.test(line(longevity, 'goal').changes), 'longevity: 90 s rests');

eq(GOAL_ANSWER.muscle, 'Muscle', 'goals have user-facing names');

/* ---- experience → sets, load factor, difficulty ceiling -------------------- */

const beginner = personaImpact(profile({ experience: 'beginner' }));
ok(/0\.6×/.test(line(beginner, 'experience').changes), 'beginners start at 0.6× the bodyweight ratio');
ok(/above beginner difficulty are excluded/.test(line(beginner, 'experience').changes), 'beginners never get advanced movements');
ok(!/loadable variants/.test(line(beginner, 'experience').changes), 'beginners are not pushed to loadable variants');
const advanced = personaImpact(profile({ experience: 'advanced' }));
ok(/1\.3×/.test(line(advanced, 'experience').changes), 'advanced lifters start at 1.3×');
ok(/loadable variants are chosen/.test(line(advanced, 'experience').changes), 'advanced lifters get loadable movements first');
ok(/above advanced difficulty are excluded/.test(line(advanced, 'experience').changes), 'the ceiling is stated');

/* ---- days → the split ----------------------------------------------------- */

const four = personaImpact(profile({ daysPerWeek: 4 }));
ok(/Upper A · Lower A · Upper B · Lower B/.test(line(four, 'daysPerWeek').changes), '4 days use the upper/lower split');
ok(/4 editable plans/.test(line(four, 'daysPerWeek').changes), 'one plan per training day');
const two = personaImpact(profile({ daysPerWeek: 2 }));
ok(/Full body A · Full body B/.test(line(two, 'daysPerWeek').changes), '2 days are two full-body days');
const five = personaImpact(profile({ daysPerWeek: 5 }));
ok(/Full body/.test(line(five, 'daysPerWeek').changes), '5 days include the full-body day');

/* ---- minutes → the cap ---------------------------------------------------- */

for (const [minutes, cap] of [[30, 4], [45, 5], [60, 6], [75, 7]]) {
  const l = personaImpact(profile({ minutes }));
  ok(new RegExp(`Up to ${cap} exercises`).test(line(l, 'minutes').changes), `${minutes} min → ${cap} exercises`);
}

/* ---- equipment and limitations -------------------------------------------- */

ok(/whole library/.test(line(base, 'equipment').changes), 'full gym: nothing excluded');
const db = personaImpact(profile({ equipment: 'dumbbells' }));
ok(/dumbbell, kettlebell, bodyweight/.test(line(db, 'equipment').changes), 'dumbbells: the allowed set is named');
const bw = personaImpact(profile({ equipment: 'bodyweight' }));
ok(/Only bodyweight movements/.test(line(bw, 'equipment').changes), 'bodyweight only');

const knees = personaImpact(profile({ limitations: ['knees'] }));
eq(line(knees, 'limitations').answer, 'Knees', 'the limitation is shown by name');
ok(/jumps, lunges, split squats/.test(line(knees, 'limitations').changes), 'and by the movements it removes');
const both = personaImpact(profile({ limitations: ['knees', 'shoulders'] }));
eq(line(both, 'limitations').answer, 'Knees, Shoulders', 'multiple limitations are listed');
ok(/overhead pressing/.test(line(both, 'limitations').changes), 'and all of their filters are explained');

/* ---- the catalogue counts -------------------------------------------------- */

const catalogue = [
  { id: 'box-jump', name: 'Box Jump' },
  { id: 'barbell-squat', name: 'Barbell Squat' },
  { id: 'overhead-press', name: 'Overhead Press' },
  { id: 'deadlift', name: 'Deadlift' },
];
const counts = limitationExclusions(['knees', 'lowerBack', 'shoulders'], catalogue);
eq(counts.knees, 1, 'knees matches the box jump only');
eq(counts.lowerBack, 1, 'lower back matches the deadlift only');
eq(counts.shoulders, 1, 'shoulders matches the overhead press only');
eq(limitationExclusions(['knees'], [{ id: 'barbell-squat', name: 'Barbell Squat' }]).knees, 0, 'a clean movement is counted as zero');

console.log(`test:persona — ${n} assertions passed`);
