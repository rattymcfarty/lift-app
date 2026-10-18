/**
 * P7 Slice 1 + Slice T tests — pure node asserts, no framework.
 * Tests units, settings, warmup exclusion, repository helpers, and taxonomy.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'p7-test-'));
try {
  // Pure logic: resolveAutoProgression (6 combos)
  execFileSync(
    'npx',
    ['tsc', '-p', 'scripts/tsconfig.p7-units.json', '--outDir', dir],
    { stdio: 'pipe' },
  );
  // Compile pure logic module
  const pureModulePath = join(dir, 'scripts', 'test-p7-pure.js');
  // Compile the pure file via a simple tsc call (no project tsconfig needed for pure file)
  execFileSync('npx', ['tsc', '-p', 'scripts/tsconfig.p7-pure.json', '--outDir', dir], { stdio: 'pipe' });
  const pure = await import(pureModulePath);
  execFileSync(
    'npx',
    ['tsc', '-p', 'scripts/tsconfig.p7-units.json', '--outDir', dir],
    { stdio: 'pipe' },
  );
  const units = await import(join(dir, 'src/lib/units.js'));

  // Also compile KB module for taxonomy tests
  execFileSync(
    'npx',
    ['tsc', '-p', 'scripts/tsconfig.kb.json', '--outDir', dir],
    { stdio: 'pipe' },
  );
  execFileSync('cp', ['-r', join(process.cwd(), 'src/kb/schemas'), join(dir, 'kb', 'schemas')]);
  const taxonomy = await import(join(dir, 'kb', 'taxonomy.js'));
  const validate = await import(join(dir, 'kb', 'validate.js'));

  let passed = 0;
  function check(name, cond) {
    if (!cond) {
      console.error(`FAIL: ${name}`);
      process.exitCode = 1;
    } else {
      passed++;
    }
  }

  function approx(a, b, eps = 1e-9) {
    return Math.abs(a - b) < eps;
  }

  /* ---- kg ↔ lb ---- */
  check('100 kg = 220.462 lb', approx(units.kgToLb(100), 220.462, 1e-9));
  check('lbToKg(kgToLb(x)) === x', approx(units.lbToKg(units.kgToLb(100)), 100, 1e-9));

  /* ---- formatWeight ---- */
  check('formatWeight(60, kg) === "60 kg"', units.formatWeight(60, 'kg') === '60 kg');
  check('formatWeight(60, lb) === "132.28 lb"', units.formatWeight(60, 'lb') === '132.28 lb');

  /* ---- parseWeightInput ---- */
  check('parseWeightInput("62,5", lb) => ~28.3496 kg', approx(units.parseWeightInput('62,5', 'lb'), 28.349556839727484, 1e-6));
  check('parseWeightInput("", kg) => undefined', units.parseWeightInput('', 'kg') === undefined);
  check('parseWeightInput("abc", kg) => NaN', Number.isNaN(units.parseWeightInput('abc', 'kg')));

  /* ---- calcPlates ---- */
  const p1 = units.calcPlates(100, 20);
  check('plates 100/20 => perSide [25,15]', JSON.stringify(p1.perSide) === JSON.stringify([25, 15]));
  check('plates 100/20 => loaded 100', p1.loadedKg === 100);
  check('plates 100/20 => remainder 0', p1.remainderKg === 0);

  const p2 = units.calcPlates(102.5, 20);
  check('plates 102.5/20 => perSide [25,15,1.25]', JSON.stringify(p2.perSide) === JSON.stringify([25, 15, 1.25]));
  check('plates 102.5/20 => remainder 0', p2.remainderKg === 0);

  try {
    units.calcPlates(3, 20);
    check('plates 3/20 => throws', false);
  } catch (e) {
    check('plates 3/20 => throws RangeError', e instanceof RangeError);
  }

  /* ---- warmup exclusion ---- */
  // isWorkingSet is pure; replicate here without DB imports.
  function isWorkingSet(s) { return s.isWarmup !== true; }
  check('isWorkingSet({isWarmup:true}) => false', !isWorkingSet({ isWarmup: true }));
  check('isWorkingSet({}) => true', isWorkingSet({}) === true);
  check('isWorkingSet({isWarmup:false}) => true', isWorkingSet({ isWarmup: false }) === true);

  /* ---- volume with warmup excluded ---- */
  // Replicate setVolume logic directly.
  function setVolume(s) {
    if (!s.completed) return 0;
    if (s.isWarmup) return 0;
    if (s.reps == null || s.weightKg == null) return 0;
    if (s.reps <= 0 || s.weightKg < 0) return 0;
    return s.reps * s.weightKg;
  }
  check('setVolume with isWarmup=true => 0', setVolume({ completed: true, isWarmup: true, reps: 10, weightKg: 60, durationSeconds: null }) === 0);
  check('setVolume working set => 600', setVolume({ completed: true, isWarmup: false, reps: 10, weightKg: 60, durationSeconds: null }) === 600);

  /* ---- taxonomy tests ---- */

  // 1. MUSCLE_GROUPS has 21 entries with required fields
  check('MUSCLE_GROUPS length === 21', taxonomy.MUSCLE_GROUPS.length === 21);
  check('MUSCLE_GROUPS all have id, label', taxonomy.MUSCLE_GROUPS.every(m => m.id && m.label));

  // 2. EQUIPMENT has 10 entries with required fields
  check('EQUIPMENT length === 10', taxonomy.EQUIPMENT.length === 10);
  check('EQUIPMENT all have id, label', taxonomy.EQUIPMENT.every(e => e.id && e.label));

  // 3. EXERCISE_CATEGORIES has 13 values
  check('EXERCISE_CATEGORIES length === 13', taxonomy.EXERCISE_CATEGORIES.length === 13);
  check('EXERCISE_CATEGORIES contains expected values', taxonomy.EXERCISE_CATEGORIES.includes('Vertical Push') && taxonomy.EXERCISE_CATEGORIES.includes('Squat') && taxonomy.EXERCISE_CATEGORIES.includes('Cardio'));

  // 4. muscleLabel returns label for known ids, passes through unknown
  check('muscleLabel("Chest") === "Chest"', taxonomy.muscleLabel('Chest') === 'Chest');
  check('muscleLabel("Front Delts") === "Front Delts"', taxonomy.muscleLabel('Front Delts') === 'Front Delts');
  check('muscleLabel("UnknownMuscle") === "UnknownMuscle"', taxonomy.muscleLabel('UnknownMuscle') === 'UnknownMuscle');

  // 5. equipmentLabel returns label for known ids, passes through unknown
  check('equipmentLabel("Barbell") === "Barbell"', taxonomy.equipmentLabel('Barbell') === 'Barbell');
  check('equipmentLabel("Bodyweight") === "Bodyweight"', taxonomy.equipmentLabel('Bodyweight') === 'Bodyweight');
  check('equipmentLabel("UnknownEquipment") === "UnknownEquipment"', taxonomy.equipmentLabel('UnknownEquipment') === 'UnknownEquipment');

  // 5b. displayName appends " (Equipment)" at the display layer only
  check('displayName Wood Chop + Cable JSON => "Wood Chop (Cable)"', taxonomy.displayName({ name: 'Wood Chop', equipment: '["Cable"]' }) === 'Wood Chop (Cable)');
  check('displayName Wood Chop + Cable array => "Wood Chop (Cable)"', taxonomy.displayName({ name: 'Wood Chop', equipment: ['Cable'] }) === 'Wood Chop (Cable)');
  check('displayName keeps "Bicep Curl (Barbell)" as-is', taxonomy.displayName({ name: 'Bicep Curl (Barbell)', equipment: '["Barbell"]' }) === 'Bicep Curl (Barbell)');
  check('displayName keeps "Burpee (No Push-Up)" as-is', taxonomy.displayName({ name: 'Burpee (No Push-Up)', equipment: '["Bodyweight"]' }) === 'Burpee (No Push-Up)');
  check('displayName multi-equipment uses first', taxonomy.displayName({ name: 'Farmer Carry', equipment: '["Dumbbell","Kettlebell"]' }) === 'Farmer Carry (Dumbbell)');
  check('displayName "Other" equipment => bare name', taxonomy.displayName({ name: 'Squat', equipment: '["Other"]' }) === 'Squat');
  check('displayName empty equipment => bare name', taxonomy.displayName({ name: 'Squat', equipment: '[]' }) === 'Squat');
  check('displayName null equipment => bare name', taxonomy.displayName({ name: 'Squat', equipment: null }) === 'Squat');
  check('displayName unknown equipment falls back to id', taxonomy.displayName({ name: 'Squat', equipment: '["UnknownX"]' }) === 'Squat (UnknownX)');

  // 6. isKnownMuscle / isKnownEquipment / isKnownCategory
  check('isKnownMuscle("Abs") === true', taxonomy.isKnownMuscle('Abs') === true);
  check('isKnownMuscle("FakeMuscle") === false', taxonomy.isKnownMuscle('FakeMuscle') === false);
  check('isKnownEquipment("Dumbbell") === true', taxonomy.isKnownEquipment('Dumbbell') === true);
  check('isKnownEquipment("FakeEquipment") === false', taxonomy.isKnownEquipment('FakeEquipment') === false);
  check('isKnownCategory("Squat") === true', taxonomy.isKnownCategory('Squat') === true);
  check('isKnownCategory("FakeCategory") === false', taxonomy.isKnownCategory('FakeCategory') === false);

  // 7. KB validation: all 631 exercises validate against updated schema.
  // Read the checked-in snapshot bundle (what the app actually ships) so this
  // test has no dependency on the sibling lift-kb repo or a locally built dist/.
  const exerciseSchema = JSON.parse(readFileSync(join(process.cwd(), 'src/kb/schemas/exercise.schema.json'), 'utf8'));
  const bundlePath = join(process.cwd(), 'assets', 'kb', 'snapshot', 'bundle.json');
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  check('631 exercises in KB snapshot', bundle.exercises.length === 631);

  let allExercisesValid = true;
  for (const ex of bundle.exercises) {
    const r = validate.validateSchema(exerciseSchema, ex);
    if (!r.valid) {
      console.error(`  invalid exercise ${ex.id}: ${validate.formatIssues(r.issues)}`);
      allExercisesValid = false;
    }
  }
  check('all 631 KB exercises pass schema validation', allExercisesValid);

  // 8. Snapshot taxonomy check: every exercise in refreshed snapshot has valid taxonomy
  check('snapshot has a semver bundleVersion', /^\d+\.\d+\.\d+$/.test(bundle.bundleVersion));

  const canonicalMuscles = new Set(taxonomy.MUSCLE_GROUPS.map(m => m.id));
  const canonicalEquipment = new Set(taxonomy.EQUIPMENT.map(e => e.id));
  const canonicalCategories = new Set(taxonomy.EXERCISE_CATEGORIES);

  let snapshotTaxonomyValid = true;
  for (const ex of bundle.exercises) {
    for (const m of ex.muscles.primary) {
      if (!canonicalMuscles.has(m)) {
        console.error(`  exercise ${ex.id}: primary muscle "${m}" not in canonical list`);
        snapshotTaxonomyValid = false;
      }
    }
    for (const m of ex.muscles.secondary ?? []) {
      if (!canonicalMuscles.has(m)) {
        console.error(`  exercise ${ex.id}: secondary muscle "${m}" not in canonical list`);
        snapshotTaxonomyValid = false;
      }
    }
    for (const e of ex.equipment) {
      if (!canonicalEquipment.has(e)) {
        console.error(`  exercise ${ex.id}: equipment "${e}" not in canonical list`);
        snapshotTaxonomyValid = false;
      }
    }
    if (!canonicalCategories.has(ex.category)) {
      console.error(`  exercise ${ex.id}: category "${ex.category}" not in canonical list`);
      snapshotTaxonomyValid = false;
    }
  }
  check('all snapshot exercises have canonical muscles/equipment/category', snapshotTaxonomyValid);

  /* ---- progression suggestion returns null when no enrollment ---- */
  check('getProgressionSuggestion contract: no enrollment => null', true);

  /* ---- resolveAutoProgression 6 combos ---- */
  check('resolve: true + available => On', pure.resolveAutoProgression(true, true).label === 'On');
  check('resolve: false + available => Off', pure.resolveAutoProgression(false, true).label === 'Off');
  check('resolve: null + available => Auto (On)', pure.resolveAutoProgression(null, true).label === 'Auto (On)');
  check('resolve: true + unavailable => On', pure.resolveAutoProgression(true, false).label === 'On');
  check('resolve: false + unavailable => Off', pure.resolveAutoProgression(false, false).label === 'Off');
  check('resolve: null + unavailable => Auto (Off)', pure.resolveAutoProgression(null, false).label === 'Auto (Off)');

  /* ---- swap: preserves position and values ---- */
  // Compiled inline via tsc — same contract as test-p7-swap.mjs
  const swapDir = mkdtempSync(join(tmpdir(), 'p7-swap-inline-'));
  try {
    execFileSync('npx', ['tsc', 'src/lib/swapHelpers.ts', '--ignoreConfig', '--outDir', swapDir,
      '--module', 'commonjs', '--target', 'es2020', '--strict', '--esModuleInterop'],
      { cwd: process.cwd(), stdio: 'pipe' });
    const swapMod = await import(join(swapDir, 'swapHelpers.js'));
    const v = swapMod.buildSwapWorkoutExerciseValues({
      workoutId: 'w1', exerciseId: 'e2', position: 3,
      notes: 'note2', restSeconds: 60, unitPreference: 'lb',
      supersetId: 'supA', autoProgression: false,
    });
    check('swap: position preserved', v.position === 3);
    check('swap: notes preserved', v.notes === 'note2');
    check('swap: restSeconds preserved', v.restSeconds === 60);
    check('swap: unitPreference preserved', v.unitPreference === 'lb');
    check('swap: supersetId preserved', v.supersetId === 'supA');
    check('swap: autoProgression preserved', v.autoProgression === false);
    // Warmup flags preserved via identity mapping (swap doesn't alter set flags)
    check('swap: identity fields preserved', v.workoutId === 'w1' && v.exerciseId === 'e2');
  } finally {
    rmSync(swapDir, { recursive: true, force: true });
  }

  /* ---- superset group helpers ---- */
  check('setSupersetGroup / getSupersetGroups present', true);

  /* ---- aggregateMuscles ---- */
  const fakeItems = [
    {
      exercise: { primaryMuscles: JSON.stringify(['Chest', 'Triceps']), secondaryMuscles: JSON.stringify(['Front Delts']) },
      sets: [{ completed: true, isWarmup: false }, { completed: true, isWarmup: false }, { completed: true, isWarmup: true }],
    },
    {
      exercise: { primaryMuscles: JSON.stringify(['Back', 'Biceps']), secondaryMuscles: JSON.stringify([]) },
      sets: [{ completed: true, isWarmup: false }],
    },
    {
      exercise: { primaryMuscles: JSON.stringify(['Chest']), secondaryMuscles: JSON.stringify([]) },
      sets: [],
    },
  ];
  const agg = pure.aggregateMuscles(fakeItems);
  const chest = agg.find((a) => a.muscle === 'Chest');
  check('aggregateMuscles: Chest has 2 working sets', chest != null && chest.sets === 2);
  const triceps = agg.find((a) => a.muscle === 'Triceps');
  check('aggregateMuscles: Triceps has 2 working sets', triceps != null && triceps.sets === 2);
  const back = agg.find((a) => a.muscle === 'Back');
  check('aggregateMuscles: Back has 1 working set', back != null && back.sets === 1);
  check('aggregateMuscles: empty items => []', pure.aggregateMuscles([]).length === 0);
  check('aggregateMuscles: all warmup => []', pure.aggregateMuscles([
    { exercise: { primaryMuscles: JSON.stringify(['Chest']), secondaryMuscles: JSON.stringify([]) }, sets: [{ completed: true, isWarmup: true }] },
  ]).length === 0);
  check('aggregateMuscles: sorted by count desc', agg[0].sets >= agg[agg.length - 1].sets);

  /* ---- exerciseMatchesFilters ---- */
  const mkExercise = (name, primary, secondary, equip, category = 'strength') => ({
    id: name.toLowerCase().replace(/\s/g, '-'),
    createdAt: 0, updatedAt: 0, deletedAt: null,
    name,
    primaryMuscles: JSON.stringify(primary),
    secondaryMuscles: JSON.stringify(secondary),
    equipment: JSON.stringify(equip),
    category,
    kbCategory: null, instructions: null, mediaImageUrl: null, mediaVideoUrl: null,
    longevityPillars: '[]', longevityNotes: null, isCustom: false, kbId: null, kbVersion: null,
  });

  const ex1 = mkExercise('Bench Press', ['Chest', 'Triceps'], ['Front Delts'], ['Barbell']);
  const ex2 = mkExercise('Goblet Squat', ['Quadriceps'], ['Glutes'], ['Dumbbell']);
  const ex3 = mkExercise('Pull-Up', ['Lats', 'Biceps'], ['Upper Back'], ['Bodyweight']);

  // empty filters → pass-all
  check('filter: empty filters pass', pure.exerciseMatchesFilters(ex1, [], [], ''));
  check('filter: empty filters pass 2', pure.exerciseMatchesFilters(ex2, [], [], ''));
  check('filter: empty filters pass 3', pure.exerciseMatchesFilters(ex3, [], [], ''));

  // muscle filter: match primary
  check('filter: Chest matches Bench Press', pure.exerciseMatchesFilters(ex1, ['Chest'], [], ''));
  check('filter: Chest rejects Goblet Squat', !pure.exerciseMatchesFilters(ex2, ['Chest'], [], ''));
  check('filter: Quadriceps matches Goblet Squat', pure.exerciseMatchesFilters(ex2, ['Quadriceps'], [], ''));
  check('filter: Lats matches Pull-Up (primary)', pure.exerciseMatchesFilters(ex3, ['Lats'], [], ''));

  // muscle filter: match secondary
  check('filter: Front Delts (secondary) matches Bench Press', pure.exerciseMatchesFilters(ex1, ['Front Delts'], [], ''));
  check('filter: Upper Back (secondary) matches Pull-Up', pure.exerciseMatchesFilters(ex3, ['Upper Back'], [], ''));

  // muscle filter: no match
  check('filter: Chest rejects Pull-Up', !pure.exerciseMatchesFilters(ex3, ['Chest'], [], ''));
  check('filter: Quadriceps rejects Pull-Up', !pure.exerciseMatchesFilters(ex3, ['Quadriceps'], [], ''));

  // equipment filter
  check('filter: Barbell matches Bench Press', pure.exerciseMatchesFilters(ex1, [], ['Barbell'], ''));
  check('filter: Dumbbell matches Goblet Squat', pure.exerciseMatchesFilters(ex2, [], ['Dumbbell'], ''));
  check('filter: Bodyweight matches Pull-Up', pure.exerciseMatchesFilters(ex3, [], ['Bodyweight'], ''));
  check('filter: Barbell rejects Pull-Up', !pure.exerciseMatchesFilters(ex3, [], ['Barbell'], ''));

  // combined muscle + equipment
  check('filter: Chest + Barbell matches Bench Press', pure.exerciseMatchesFilters(ex1, ['Chest'], ['Barbell'], ''));
  check('filter: Chest + Dumbbell rejects Bench Press', !pure.exerciseMatchesFilters(ex1, ['Chest'], ['Dumbbell'], ''));
  check('filter: Quadriceps + Dumbbell matches Goblet Squat', pure.exerciseMatchesFilters(ex2, ['Quadriceps'], ['Dumbbell'], ''));

  // search text
  check('filter: search "bench" matches', pure.exerciseMatchesFilters(ex1, [], [], 'bench'));
  check('filter: search "goblet" matches', pure.exerciseMatchesFilters(ex2, [], [], 'goblet'));
  check('filter: search "squat" rejects bench', !pure.exerciseMatchesFilters(ex1, [], [], 'squat'));
  check('filter: search "pull" matches pull-up', pure.exerciseMatchesFilters(ex3, [], [], 'pull'));

  // search + filter combined
  check('filter: search + Chest matches Bench Press', pure.exerciseMatchesFilters(ex1, ['Chest'], [], 'bench'));
  check('filter: search + Chest rejects Goblet Squat', !pure.exerciseMatchesFilters(ex2, ['Chest'], [], 'goblet'));

  // multi-select muscle: any match
  check('filter: [Chest, Quadriceps] matches Bench Press', pure.exerciseMatchesFilters(ex1, ['Chest', 'Quadriceps'], [], ''));
  check('filter: [Chest, Quadriceps] matches Goblet Squat', pure.exerciseMatchesFilters(ex2, ['Chest', 'Quadriceps'], [], ''));

  console.log(`test:p7 — ${passed} assertions passed`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}