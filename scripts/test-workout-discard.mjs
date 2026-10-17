// Unit tests for the workout exit flows (pure TS, bundled with esbuild):
// the finish/discard sheet's choices and the discard confirmation copy, plus a
// guard that the active workout screen never reaches the companion cheer on its
// own — only the summary screen (reached after *finishing*) may cheer.
//
// Why pin copy here: the finish/discard wording is spec'd and user-facing, and
// the discard path is silent by design. A stray edit that routes discard
// through the summary (and its `companionWorkoutFinished()` cheer) must fail
// this test rather than ship.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'workout-exits-')), 'exits.mjs');
await build({
  entryPoints: [join(root, 'src/workouts/exits.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const E = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* ---- the finish sheet: three choices, in order, with the right weights --- */
const choices = E.FINISH_SHEET_CHOICES;
eq(choices.map((c) => c.id), ['finish', 'discard', 'cancel'], 'choice ids and order');
eq(
  choices.map((c) => c.label),
  ['Finish workout', 'Discard workout', 'Cancel'],
  'choice labels (spec copy)',
);
eq(
  choices.map((c) => c.variant),
  ['gold', 'danger', 'secondary'],
  'finish = primary/accent, discard = danger, cancel = quiet',
);
eq(
  choices.map((c) => c.testID),
  ['finish-sheet-finish', 'finish-sheet-discard', 'finish-sheet-cancel'],
  'choice testIDs for Maestro',
);
eq(new Set(choices.map((c) => c.testID)).size, choices.length, 'testIDs unique');
ok(
  choices.every((c) => c.testID.startsWith('finish-sheet-')),
  'every choice carries the finish-sheet- testID prefix',
);

/* ---- the sheet heading + subtitle ---------------------------------------- */
eq(E.FINISH_SHEET_TITLE, 'Finish workout?', 'sheet title');
eq(E.finishSheetSubtitle(0), 'No sets logged yet.', 'empty workout wording');
eq(E.finishSheetSubtitle(1), '1 set logged.', 'singular set count');
eq(E.finishSheetSubtitle(3), '3 sets logged.', 'plural set count');
eq(E.finishSheetSubtitle(-1), 'No sets logged yet.', 'negative count reads as empty');

/* ---- the destructive confirmation: exact spec copy ----------------------- */
eq(
  E.DISCARD_CONFIRM,
  {
    title: 'Discard this workout?',
    message: "Everything you logged in this workout will be deleted. This can't be undone.",
    cancelLabel: 'Keep workout',
    confirmLabel: 'Discard',
  },
  'discard confirmation copy',
);

/* ---- the screen is wired to this module, and stays cheer-free ------------- */
const screen = readFileSync(join(root, 'app/workout/[id].tsx'), 'utf8');
ok(screen.includes('FINISH_SHEET_CHOICES'), 'screen renders the shared choices');
ok(screen.includes('DISCARD_CONFIRM'), 'screen uses the shared discard copy');
ok(screen.includes('finishSheetSubtitle'), 'screen uses the shared subtitle');
// The active workout screen must never cheer: the companion is driven only from
// the summary screen, which the discard path deliberately never opens.
ok(
  !screen.includes('companionWorkoutFinished') && !screen.includes('companion/triggers'),
  'active workout screen never calls the companion (discard is silent)',
);

console.log(`test-workout-discard: ${n} assertions passed`);
