/**
 * Unit tests for the mid-workout exercise info sheet's content
 * (`src/components/workout/exerciseInfo.ts`).
 *
 * The sheet is shown between sets, so the risks are all about degradation: a KB
 * entry with no cues must not produce an empty "Key cues" heading, a corrupt
 * JSON cache must not throw, and the longevity prose must not arrive as a
 * truncated fragment. Everything here is pure, so it is cheap to pin.
 *
 * Usage: node scripts/test-exercise-info.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'info-')), 'exerciseInfo.mjs');
await build({
  entryPoints: [join(root, 'src/components/workout/exerciseInfo.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const { exerciseInfo, firstParagraph } = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const KB = JSON.stringify({
  cues: ['Brace before you descend', 'Keep the bar over mid-foot', 'Drive the floor away', 'Knees track over toes', 'Exhale on the way up', 'Stay tight at the top'],
  commonMistakes: ['Knees caving in', 'Heels lifting', 'Rounding the lower back'],
  safetyNotes: 'Stop if you feel a sharp pain in the knee or lower back.',
});

/* ---- the happy path ------------------------------------------------------- */

const full = exerciseInfo({
  name: 'Barbell Squat',
  muscles: 'Quadriceps, Glutes',
  equipment: 'Barbell',
  kbDetailJson: KB,
  longevityNotes: '## Why this matters\nStrength in the squat pattern is what keeps you getting out of a chair unaided.',
  target: '3 × 8 reps · 60 kg · RPE 8',
  lastTime: '3 × 8 @ 60 kg',
});

eq(full.name, 'Barbell Squat', 'the name comes through');
eq(full.meta, ['Quadriceps, Glutes', 'Barbell'], 'muscles and equipment form the meta chips');
eq(full.cues.length, 4, 'cues are capped at four — a reminder, not a lesson');
eq(full.cues[0], 'Brace before you descend', 'cues keep their order');
eq(full.mistakes.length, 2, 'mistakes are capped at two');
eq(full.safety, 'Stop if you feel a sharp pain in the knee or lower back.', 'the safety line is kept whole');
eq(full.target, '3 × 8 reps · 60 kg · RPE 8', 'the plan target is passed through');
eq(full.lastTime, '3 × 8 @ 60 kg', 'last time is passed through');
ok(/getting out of a chair/.test(full.why), 'the longevity prose provides "why it matters"');

/* ---- caps and trimming ---------------------------------------------------- */

eq(exerciseInfo({ name: 'X', kbDetailJson: KB, cueLimit: 2 }).cues.length, 2, 'the cue cap is configurable');
eq(exerciseInfo({ name: 'X', kbDetailJson: KB, mistakeLimit: 1 }).mistakes.length, 1, 'so is the mistake cap');
eq(
  exerciseInfo({ name: 'X', kbDetailJson: JSON.stringify({ cues: ['  spaced  ', '', 42, null, 'ok'] }) }).cues,
  ['spaced', 'ok'],
  'blank and non-string cues are dropped',
);
eq(
  exerciseInfo({ name: 'X', kbDetailJson: JSON.stringify({ safetyNotes: '   ' }) }).safety,
  undefined,
  'a whitespace-only safety note is absent, not empty',
);
eq(exerciseInfo({ name: 'X', target: '   ', lastTime: '' }).target, undefined, 'blank target lines are absent');
eq(exerciseInfo({ name: 'X', target: '   ', lastTime: '' }).lastTime, undefined, 'and so are blank last-time lines');

/* ---- degradation ---------------------------------------------------------- */

const bare = exerciseInfo({ name: 'Push-Up' });
eq(bare.cues, [], 'no KB detail means no cues');
eq(bare.mistakes, [], 'and no mistakes');
eq(bare.safety, undefined, 'and no safety line');
eq(bare.meta, [], 'and no meta chips');
eq(bare.why, undefined, 'and no why');
eq(bare.name, 'Push-Up', 'but the name is still there — the sheet always has a title');

let threw = false;
let corrupt;
try {
  corrupt = exerciseInfo({ name: 'X', kbDetailJson: '{not json' });
} catch {
  threw = true;
}
ok(!threw, 'a corrupt JSON cache must not throw mid-workout');
eq(corrupt?.cues, [], 'and degrades to no cues');

eq(
  exerciseInfo({ name: 'X', kbDetailJson: JSON.stringify({ cues: 'not-an-array' }) }).cues,
  [],
  'a non-array cues field degrades too',
);
eq(
  exerciseInfo({ name: 'X', muscles: '  ', equipment: 'Dumbbell' }).meta,
  ['Dumbbell'],
  'a blank muscle label does not leave an empty chip',
);

/* ---- firstParagraph ------------------------------------------------------- */

eq(firstParagraph('## Heading\nReal prose here.'), 'Real prose here.', 'markdown headings are stripped');
eq(firstParagraph('- A bullet line'), 'A bullet line', 'list markers are stripped');
eq(firstParagraph(''), undefined, 'empty prose is absent');
eq(firstParagraph(undefined), undefined, 'missing prose is absent');
eq(firstParagraph('   \n  \n'), undefined, 'whitespace-only prose is absent');
eq(firstParagraph('Short.'), 'Short.', 'short prose is kept as-is');

const long = `${'word '.repeat(30)}end.`;
const cut = firstParagraph(long, 60);
ok(cut.length <= 61, 'long prose is trimmed to the limit');
ok(cut.endsWith('…') || cut.endsWith('.'), 'and ends at a boundary, never mid-word');
const sentences = 'First sentence is here. Second sentence follows and is long enough to matter.';
eq(
  firstParagraph(sentences, 40),
  'First sentence is here.',
  'when a sentence boundary is available, the cut lands on it',
);

console.log(`test:exercise-info — ${n} assertions passed`);
