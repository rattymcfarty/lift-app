/**
 * KB pipeline exit test (P2 #11) — zero new dependencies.
 * Compiles src/kb/*.ts with the project's own tsc into a temp dir, then:
 *   1. validates the REAL built bundle (dist/kb-bundle-0.2.0.json,
 *      10 exercises + 1 program) against the vendored draft-07 schemas
 *      using the app's own hand-rolled validator;
 *   2. verifies the sha256 contract: sha256(canonical bundle) must equal
 *      channel.json's sha256 (same canonicalization as src/kb/bundle.ts,
 *      hashed with node:crypto — the algorithm, not the expo wrapper,
 *      is what's under test);
 *   3. exercises the pure transforms (exercise → upsert input,
 *      program → routine inputs);
 *   4. negative tests: invalid exercise rejected, bad hash detected,
 *      unknown exercise reference throws, channel version compare.
 *
 * Usage: npm run test:kb
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kbRoot = join(root, '..', 'lift-kb');

let passed = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    passed++;
  }
}

/* ---- compile the KB module ---- */
const dir = mkdtempSync(join(tmpdir(), 'kb-test-'));
try {
  execFileSync('npx', ['tsc', '-p', 'scripts/tsconfig.kb.json', '--outDir', dir], {
    cwd: root,
    stdio: 'pipe',
  });
} catch (e) {
  console.error('FAIL: tsc compilation of src/kb failed');
  console.error(e.stdout?.toString() ?? e.message);
  process.exit(1);
}
const validate = await import(join(dir, 'kb', 'validate.js'));
// schemas are required at runtime — copy them next to the compiled output
// (Metro bundles JSON requires in the app; node needs the files on disk).
execFileSync('cp', ['-r', join(root, 'src/kb/schemas'), join(dir, 'kb', 'schemas')]);
const transform = await import(join(dir, 'kb', 'transform.js'));
const channel = await import(join(dir, 'kb', 'channel.js'));
const bundle = await import(join(dir, 'kb', 'bundle.js'));

const exerciseSchema = JSON.parse(readFileSync(join(root, 'src/kb/schemas/exercise.schema.json'), 'utf8'));
const programSchema = JSON.parse(readFileSync(join(root, 'src/kb/schemas/program.schema.json'), 'utf8'));
const channelSchema = JSON.parse(readFileSync(join(root, 'src/kb/schemas/channel.schema.json'), 'utf8'));

/* ---- load the real built bundle + channel ---- */
const kbVersion = JSON.parse(readFileSync(join(kbRoot, 'kb-version.json'), 'utf8')).version;
const bundlePath = join(kbRoot, 'dist', `kb-bundle-${kbVersion}.json`);
if (!existsSync(bundlePath)) {
  console.error(`FAIL: built bundle not found: ${bundlePath} (run build-bundle.mjs in lift-kb first)`);
  process.exit(1);
}
const built = JSON.parse(readFileSync(bundlePath, 'utf8'));
const channelJson = JSON.parse(readFileSync(join(kbRoot, 'channel.json'), 'utf8'));

/* ---- 1. schema validation with the app's own validator ---- */
check('bundle has 627 exercises', built.exercises.length === 627);
check('bundle has 1 program', built.programs.length === 1);
let allValid = true;
for (const ex of built.exercises) {
  const r = validate.validateSchema(exerciseSchema, ex);
  if (!r.valid) {
    console.error(`  invalid exercise ${ex.id}: ${validate.formatIssues(r.issues)}`);
    allValid = false;
  }
}
check('all 627 exercises pass the app validator', allValid);
for (const p of built.programs) {
  const r = validate.validateSchema(programSchema, p);
  check(`program ${p.id} passes the app validator`, r.valid);
}
const chR = validate.validateSchema(channelSchema, channelJson);
check('channel.json passes the app validator', chR.valid);

/* ---- 2. sha256 contract ---- */
const canonical = bundle.canonicalBundleJson(built);
const hash = createHash('sha256').update(canonical).digest('hex');
check('sha256(canonical bundle) matches channel.json', hash === channelJson.sha256);
check(
  'tampered bundle fails the hash check',
  (() => {
    const tampered = JSON.parse(canonical);
    tampered.exercises[0] = { ...tampered.exercises[0], name: 'EVIL' };
    const h2 = createHash('sha256').update(JSON.stringify(tampered)).digest('hex');
    return h2 !== channelJson.sha256;
  })(),
);

/* ---- 3. transforms ---- */
const exInputs = built.exercises.map((e) => transform.kbExerciseToUpsertInput(e, kbVersion));
check('627 exercise upsert inputs produced', exInputs.length === 627);
check('kbId preserved as permanent id', exInputs.every((i, n) => i.kbId === built.exercises[n].id));
check('kbVersion stamped', exInputs.every((i) => i.kbVersion === kbVersion));
check(
  'brisk-walk maps to cardio',
  exInputs.find((i) => i.kbId === 'brisk-walk').category === 'cardio',
);
check(
  'goblet-squat maps to strength',
  exInputs.find((i) => i.kbId === 'goblet-squat').category === 'strength',
);
check(
  'split-squat gets balance pillar',
  exInputs.find((i) => i.kbId === 'split-squat').longevityPillars.includes('balance'),
);
check(
  'instructions formatted with numbered steps',
  exInputs[0].instructions.includes('1. '),
);
check(
  'longevity notes carried through',
  exInputs.every((i) => typeof i.longevityNotes === 'string' && i.longevityNotes.length > 0),
);

const routineInputs = transform.kbProgramToRoutineInputs(built.programs[0], built.exercises, kbVersion);
check('program yields 3 routine inputs (one per session)', routineInputs.length === 3);
check(
  'routine kbIds are deterministic',
  routineInputs[0].kbId === 'longevity-foundations--session-1',
);
check(
  'blocks mapped to items with targets',
  routineInputs[0].items.length === 3 &&
    routineInputs[0].items[0].targetSets === 3 &&
    routineInputs[0].items[0].targetReps === '8-12',
);
check(
  'rpeCap mapped to targetRpe',
  routineInputs[0].items.every((it) => it.targetRpe === undefined || (it.targetRpe >= 1 && it.targetRpe <= 10)),
);

/* ---- 4. negative tests ---- */
const bad = { ...built.exercises[0] };
delete bad.name;
check('exercise missing required name is rejected', !validate.validateSchema(exerciseSchema, bad).valid);
const badDiff = { ...built.exercises[0], difficulty: 'expert' };
check('exercise with bad enum is rejected', !validate.validateSchema(exerciseSchema, badDiff).valid);
const badExtra = { ...built.exercises[0], evil: 1 };
check('exercise with additional property is rejected', !validate.validateSchema(exerciseSchema, badExtra).valid);
check(
  'unknown exercise reference throws',
  (() => {
    try {
      transform.kbProgramToRoutineInputs(
        { ...built.programs[0], sessions: [{ day: 1, blocks: [{ exerciseId: 'nope', sets: 3 }] }] },
        built.exercises,
        kbVersion,
      );
      return false;
    } catch {
      return true;
    }
  })(),
);
check('semver: 0.2.0 > 0.1.0', channel.compareSemver('0.2.0', '0.1.0') === 1);
check('semver: equal', channel.compareSemver('0.1.0', '0.1.0') === 0);
check('update available when channel is newer', channel.isUpdateAvailable({ latest: '0.2.0' }, '0.1.0') === true);
check('no update when current', channel.isUpdateAvailable({ latest: '0.2.0' }, '0.2.0') === false);
check('revoked version detected', channel.isVersionRevoked({ revoked: ['0.1.0'] }, '0.1.0') === true);
check(
  'bundle URL derived from channel URL',
  channel.bundleUrlFor('https://rattymcfarty.github.io/lift-kb/channel.json', '0.2.0') ===
    'https://rattymcfarty.github.io/lift-kb/kb-bundle-0.2.0.json',
);

rmSync(dir, { recursive: true, force: true });
console.log(`kb tests: ${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
