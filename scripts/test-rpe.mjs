/**
 * Unit tests for the RPE explainer (src/components/workout/rpeGuide.ts and the
 * sheet that renders it).
 *
 * RPE is explained in exactly one place in the app, and it is reached by
 * tapping the RPE column header. Two things can rot silently:
 *
 *   1. the copy (levels out of order, a missing level, a target that no longer
 *      matches the 7–9 range the programs use);
 *   2. the wiring (the header loses its testID, the sheet stops being mounted,
 *      the companion branch disappears).
 *
 * Usage: node scripts/test-rpe.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'rpe-')), 'rpeGuide.mjs');
await build({
  entryPoints: [join(root, 'src/components/workout/rpeGuide.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const guide = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* ---- 1. the scale ---- */
eq(guide.RPE_LEVELS.map((l) => l.level), [6, 7, 8, 9, 10], 'the scale runs 6 to 10, in order');

for (const row of guide.RPE_LEVELS) {
  ok(typeof row.feel === 'string' && row.feel.length > 3, `level ${row.level} describes the effort`);
  ok(typeof row.left === 'string' && row.left.length > 0, `level ${row.level} says how many reps are left`);
}

// Reps in reserve counts down as effort goes up: 4, 3, 2, 1, none.
eq(
  guide.RPE_LEVELS.map((l) => l.left),
  ['~4 more reps', '~3 more reps', '~2 more reps', '1 more rep', 'none left'],
  'reps left counts down to nothing at RPE 10',
);
eq(guide.RPE_LEVELS[4].feel, 'Maximum effort', 'RPE 10 is the maximum-effort row');
// RPE 8 is the worked example; it must exist and be "about two more".
ok(/2 more reps/.test(guide.RPE_LEVELS[2].left), 'RPE 8 leaves about two reps, matching the example');

/* ---- 2. the framing copy ---- */
ok(/Rate of Perceived Exertion/.test(guide.RPE_TITLE), 'the title spells the acronym out');
ok(guide.RPE_INTRO_COMPANION.length > 20, 'the companion intro exists');
ok(guide.RPE_INTRO_SOLO.length > 20, 'the companion-off intro exists');
ok(guide.RPE_INTRO_COMPANION !== guide.RPE_INTRO_SOLO, 'the two voices are actually different');
ok(/7\u20139|7-9/.test(guide.RPE_TARGET), 'the growth target stays 7–9');
ok(guide.RPE_WHY.length >= 2, 'at least two reasons are given');
ok(guide.RPE_EXAMPLE.lift && guide.RPE_EXAMPLE.prescription.includes('RPE 8'),
  'the example works a real program line at RPE 8');

/* ---- 3. the wiring that keeps it reachable ---- */
const sheet = readFileSync(join(root, 'src/components/workout/RpeSheet.tsx'), 'utf8');
ok(/testID="rpe-sheet"/.test(sheet), 'the sheet has a testID for Maestro');
ok(/useCompanionEnabled/.test(sheet), 'the sheet branches on the companion setting');
ok(/useCompanionStyle/.test(sheet), 'the sheet draws the chosen companion skin');
ok(/ImageSkin[\s\S]*Creature|Creature[\s\S]*ImageSkin/.test(sheet), 'both skins are rendered');
ok(/RPE_INTRO_COMPANION/.test(sheet) && /RPE_INTRO_SOLO/.test(sheet),
  'both intros are used, so the sheet works with the companion off');
ok(/rpe-level-\$\{row\.level\}/.test(sheet), 'every level row is addressable in a flow');

const card = readFileSync(join(root, 'src/components/workout/ExerciseCard.tsx'), 'utf8');
ok(/testID="rpe-help"/.test(card), 'the set-table RPE header is the trigger');
ok(/onRpeHelp/.test(card), 'the trigger calls the callback the screen passes');

const screen = readFileSync(join(root, 'app/workout/[id].tsx'), 'utf8');
ok(/<RpeSheet/.test(screen), 'the workout screen mounts the sheet');
ok(/onRpeHelp=\{/.test(screen), 'the workout screen passes the opener to the cards');

// The plan target editor is the other place a person picks an RPE.
const planEdit = readFileSync(join(root, 'app/plans/[id]/edit.tsx'), 'utf8');
ok(/labelTestID="plan-rpe-help"/.test(planEdit), 'the plan target RPE label opens the explainer');
ok(/<RpeSheet/.test(planEdit), 'the plan editor mounts the sheet');

/* ---- 4. the flows cover it ---- */
const flow = readFileSync(join(root, '.maestro/workout-flow.yaml'), 'utf8');
ok(/id: "rpe-help"/.test(flow), 'the workout flow opens the explainer');
ok(/id: "rpe-sheet"/.test(flow), 'the workout flow waits for the sheet');
ok(/Rate of Perceived Exertion/.test(flow), 'the flow asserts the explanation is on screen');

const planFlow = readFileSync(join(root, '.maestro/plan-picker.yaml'), 'utf8');
ok(/id: "plan-rpe-help"/.test(planFlow), 'the plan flow opens the explainer from the target field');

const numInput = readFileSync(join(root, 'src/components/workout/ui.tsx'), 'utf8');
ok(/onLabelPress/.test(numInput) && /labelTestID/.test(numInput), 'NumberInput supports a label that explains itself');

console.log(`test:rpe — ${n} assertions passed`);
