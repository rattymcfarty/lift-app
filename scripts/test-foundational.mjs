// Unit tests for the foundational (curated "Core & foundational") exercise
// list and the library sectioning. Pure TS, bundled with esbuild like
// test-planned-sets.mjs.
//
// Two things must hold, or the Exercises tab silently loses its first section:
//   1. every curated id exists AND is live in the shipped KB snapshot
//      (ids are permanent; a deprecated entry must be replaced deliberately);
//   2. filtering + sectioning puts the foundational group first, in the
//      owner's order, and never resurrects the rest of the library above it.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'foundational-')), 'foundational.mjs');
await build({
  entryPoints: [join(root, 'src/lib/exerciseSections.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const S = await import(pathToFileURL(out).href);
// exerciseSections does not re-export the ids, so load the data module too.
const outF = join(mkdtempSync(join(tmpdir(), 'foundational-ids-')), 'foundational.mjs');
await build({
  entryPoints: [join(root, 'src/lib/foundational.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outF,
  logLevel: 'error',
});
const FN = await import(pathToFileURL(outF).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const IDS = FN.FOUNDATIONAL_IDS;
const LIVE_SECTION = S.FOUNDATIONAL_SECTION_TITLE;
const ALL_SECTION = S.ALL_SECTION_TITLE;

/* ---- the snapshot must back every curated id --------------------------- */
const bundle = JSON.parse(readFileSync(join(root, 'assets/kb/snapshot/bundle.json'), 'utf8'));
const byId = new Map(bundle.exercises.map((e) => [e.id, e]));

ok(IDS.length > 0, 'the foundational list is not empty');
eq(new Set(IDS).size, IDS.length, 'no duplicate ids');
ok(IDS.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)), 'ids are valid KB slugs');
for (const id of IDS) {
  const ex = byId.get(id);
  ok(!!ex, `id exists in the snapshot: ${id}`);
  ok(ex && ex.deprecated !== true, `id is live (not deprecated): ${id}`);
}
// All 50 of the owner's names now have a live match: the four gaps (Bird Dog,
// Cable Woodchops, Outdoor Cycling, Rowing Machine) were written in lift-kb
// 0.6.0. Changing this number is a deliberate product decision, not a refactor
// side effect.
eq(IDS.length, 50, 'curated list length (all 50 of the owner\'s names matched)');
eq(FN.FOUNDATIONAL_COUNT, IDS.length, 'exposed count matches the array');

/* ---- rank helper ------------------------------------------------------- */
eq(IDS.map((id) => FN.foundationalRank(id)), IDS.map((_, i) => i), 'rank = position in the list');
eq(FN.foundationalRank('not-a-real-id'), -1, 'unknown id has no rank');
eq(FN.foundationalRank(null), -1, 'custom exercise (no kb id) has no rank');
eq(FN.foundationalRank(undefined), -1, 'missing id has no rank');
ok(FN.isFoundational(IDS[0]), 'isFoundational true for a curated id');
ok(!FN.isFoundational('not-a-real-id'), 'isFoundational false for anything else');

/* ---- synthetic rows (shape of an `exercises` DB row) ------------------- */
let seq = 0;
const row = (kbId, name, { muscles = [], equipment = [] } = {}) => ({
  id: `row-${seq++}`,
  name,
  kbId,
  primaryMuscles: JSON.stringify(muscles),
  secondaryMuscles: JSON.stringify([]),
  equipment: JSON.stringify(equipment),
});

const [firstId, secondId, thirdId] = IDS;
const other = row('some-other-exercise', 'Zercher Squats', { muscles: ['Quadriceps'], equipment: ['Barbell'] });
const custom = row(null, 'My Own Thing', { muscles: ['Abs'], equipment: ['Other'] });

/* ---- sectioning: foundational first, in list order, rest after -------- */
const shuffled = [
  other,
  row(thirdId, 'Third foundational'),
  custom,
  row(firstId, 'First foundational'),
  row(secondId, 'Second foundational'),
];
const sections = S.buildExerciseSections(shuffled, [], [], '');
eq(sections.length, 2, 'two sections when both groups have matches');
eq(sections[0].key, 'foundational', 'foundational comes first');
eq(sections[1].key, 'all', 'everything else second');
eq(sections[0].data.map((r) => r.kbId), [firstId, secondId, thirdId], 'foundational ordered by curated rank, not input order');
eq(sections[1].data.map((r) => r.kbId), ['some-other-exercise', null], 'non-foundational keeps input order (custom rows included)');
eq(sections[0].title, `${LIVE_SECTION} (3)`, 'foundational header carries its count');
eq(sections[1].title, `${ALL_SECTION} (2)`, 'all-exercises header carries its count');
eq(
  sections.reduce((sum, section) => sum + section.data.length, 0),
  shuffled.length,
  'sectioning loses no rows',
);
eq(
  shuffled.map((r) => r.name),
  ['Zercher Squats', 'Third foundational', 'My Own Thing', 'First foundational', 'Second foundational'],
  'input array is not mutated',
);

/* ---- an id outside the curated list never reaches the first section --- */
eq(S.buildExerciseSections([other], [], [], '').map((s) => s.key), ['all'], 'no foundational section when nothing is curated');
eq(S.buildExerciseSections([custom], [], [], ''), [{ key: 'all', title: `${ALL_SECTION} (1)`, data: [custom] }], 'custom-only list has one section');
eq(S.buildExerciseSections([], [], [], ''), [], 'empty input -> no sections (empty state shows)');

/* ---- filters apply to both groups ------------------------------------ */
const mixed = [
  row(firstId, 'First foundational', { muscles: ['Quadriceps'], equipment: ['Barbell'] }),
  row(secondId, 'Second foundational', { muscles: ['Chest'], equipment: ['Dumbbell'] }),
  row('other-barbell', 'Other Barbell Move', { muscles: ['Quadriceps'], equipment: ['Barbell'] }),
  row('other-chest', 'Other Chest Move', { muscles: ['Chest'], equipment: ['Machine'] }),
];
let s = S.buildExerciseSections(mixed, [], ['Dumbbell'], '');
eq(s.length, 1, 'equipment filter matching one curated row leaves one section');
eq(s[0].key, 'foundational', 'that section is the foundational one');
eq(s[0].data.map((r) => r.kbId), [secondId], 'equipment filter narrowed the curated row');

s = S.buildExerciseSections(mixed, [], ['Barbell'], '');
eq(s.map((section) => section.key), ['foundational', 'all'], 'equipment filter keeps both sections when both match');
eq(s[0].data.map((r) => r.kbId), [firstId], 'foundational still first after filtering');
eq(s[1].data.map((r) => r.name), ['Other Barbell Move'], 'rest filtered too');

s = S.buildExerciseSections(mixed, ['Chest'], ['Machine'], '');
eq(s.map((section) => section.key), ['all'], 'muscle+equipment filter that excludes all curated rows hides the foundational header');
eq(s[0].data.map((r) => r.name), ['Other Chest Move'], 'and still returns the matching library row');

s = S.buildExerciseSections(mixed, ['Abs'], [], '');
eq(s, [], 'filter with no matches -> no sections at all');
eq(S.buildExerciseSections(mixed, ['Quadriceps'], ['Dumbbell'], ''), [], 'muscle and equipment must both match (AND between filters, OR within)');

/* ---- search narrows both groups -------------------------------------- */
s = S.buildExerciseSections(mixed, [], [], 'second');
eq(s.map((section) => section.key), ['foundational'], 'search matching only a curated exercise hides the "all" header');
eq(s[0].data.map((r) => r.kbId), [secondId], 'search kept the right row');

s = S.buildExerciseSections(mixed, [], [], 'other');
eq(s.map((section) => section.key), ['all'], 'search matching only library rows hides the foundational header');
eq(s[0].data.length, 2, 'both matching library rows kept');

s = S.buildExerciseSections(mixed, [], [], 'nothing-matches-this');
eq(s, [], 'search with no matches -> no sections');

s = S.buildExerciseSections(mixed, [], [], '  FIRST  ');
eq(s.length, 1, 'search text is trimmed and case-insensitive');
eq(s[0].data.map((r) => r.kbId), [firstId], 'and matches the curated row');

/* ---- every curated id survives the real catalogue path --------------- */
// The snapshot is what gets seeded into the DB; a curated id that is missing
// from it would produce a permanent empty section on a fresh install.
const liveIds = new Set(bundle.exercises.filter((e) => !e.deprecated).map((e) => e.id));
for (const id of IDS) ok(liveIds.has(id), `live in the seeded catalogue: ${id}`);

console.log(`foundational: ${n} assertions passed`);
