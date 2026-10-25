/**
 * Unit tests for the guided interview's model (`src/lib/quiz.ts`).
 *
 * The interview is deliberately thin — six questions over the generator's own
 * inputs — so the things worth pinning are the ones that would quietly rot:
 *
 *   - every step asks a question and says why it is asked;
 *   - the step keys are exactly the persona editor's keys, so each question can
 *     show the generator's own explanation (`personaImpact`);
 *   - the summary and the plan names match what the writer really produces.
 *
 * The preview itself (`previewPlans`) needs the KB bundle and is verified on a
 * device by `.maestro/quiz.yaml`.
 *
 * Usage: node scripts/test-quiz.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(join(tmpdir(), 'quiz-'));
await build({
  entryPoints: [join(root, 'src/lib/quiz.ts'), join(root, 'src/lib/personaImpact.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: outDir,
  logLevel: 'error',
});
const { QUIZ_STEPS, stepIndex, progressAfter, personaSummary, planName } = await import(
  pathToFileURL(join(outDir, 'quiz.js')).href
);
const { personaImpact } = await import(pathToFileURL(join(outDir, 'personaImpact.js')).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* ---- the six questions ---------------------------------------------------- */

eq(QUIZ_STEPS.length, 6, 'six questions');
eq(
  QUIZ_STEPS.map((s) => s.key),
  ['goal', 'experience', 'daysPerWeek', 'minutes', 'equipment', 'limitations'],
  'asked in the generator\'s order',
);
for (const step of QUIZ_STEPS) {
  ok(step.question.trim().endsWith('?'), `${step.key}: the prompt is a question`);
  ok(step.question.length <= 48, `${step.key}: the prompt fits one line on a phone`);
  ok(step.why.length >= 60, `${step.key}: it says why it is asked`);
  ok(!/\b(?:AI|algorithm|we will|smart)\b/i.test(step.why), `${step.key}: no black-box language`);
}

/* ---- the keys line up with the explanations ------------------------------- */

const impactKeys = personaImpact({
  experience: 'beginner',
  goal: 'longevity',
  daysPerWeek: 3,
  minutes: 45,
  equipment: 'full',
  limitations: [],
  weightKg: null,
}).map((i) => i.key);
eq(QUIZ_STEPS.map((s) => s.key), impactKeys, 'every question has a generator explanation to show');

/* ---- navigation ----------------------------------------------------------- */

eq(stepIndex('goal'), 0, 'goal is first');
eq(stepIndex('limitations'), 5, 'limitations is last');
eq(stepIndex('nope'), -1, 'an unknown key is -1');

ok(Math.abs(progressAfter(0) - 1 / 6) < 1e-9, 'after the first answer: 1/6');
eq(progressAfter(5), 1, 'after the last answer: 1');
eq(progressAfter(-3), 0, 'progress never goes negative');
eq(progressAfter(99), 1, 'progress never exceeds 1');

/* ---- the summary ---------------------------------------------------------- */

const full = personaSummary({
  goal: 'strength',
  experience: 'intermediate',
  daysPerWeek: 4,
  minutes: 60,
  equipment: 'dumbbells',
  limitations: ['knees'],
});
eq(full, 'Strength · Intermediate · 4 days a week · 60 min · Dumbbells only · Knees protected', 'the summary reads as one line');

const noLimits = personaSummary({
  goal: 'longevity',
  experience: 'beginner',
  daysPerWeek: 3,
  minutes: 45,
  equipment: 'full',
  limitations: [],
});
ok(!/protected/.test(noLimits), 'no limitation clause when nothing is selected');
ok(/Longevity · Beginner · 3 days a week · 45 min · Full gym/.test(noLimits), 'the rest of the summary is intact');

const several = personaSummary({
  goal: 'muscle',
  experience: 'advanced',
  daysPerWeek: 5,
  minutes: 75,
  equipment: 'bodyweight',
  limitations: ['knees', 'shoulders'],
});
ok(/Knees \+ Shoulders protected/.test(several), 'several limitations are joined');

/* ---- the names the writer produces --------------------------------------- */

eq(planName(1, 'Upper A'), 'My Plan · Day 1 · Upper A', 'the review promises the name the builder writes');
eq(planName(12, 'Full body'), 'My Plan · Day 12 · Full body', 'day numbers are not zero-padded');

console.log(`test:quiz — ${n} assertions passed`);
