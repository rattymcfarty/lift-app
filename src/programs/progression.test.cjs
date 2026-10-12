/**
 * Progression + deload engine unit tests (P3 #13) — zero dependencies
 * beyond the app's own tsc. Exercises the pure engine: rep-range parsing,
 * config resolution, the v1 linear progression rule, deload scaling,
 * session-pointer advancement, and the new DSL progression fields.
 * The DB-backed operations in ./engine.ts are typechecked, not unit-tested
 * here (they need expo-sqlite); their pure inputs are validated first.
 */
const assert = require('node:assert');
const {
  DEFAULT_INCREMENT_KG,
  applyDeloadVolume,
  nextSessionPosition,
  parseRepRange,
  progressExercise,
  resolveProgressionConfig,
  validateProgramDefinition,
} = require('./programs/index.js');

let passed = 0;
function check(name, cond) {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`ok - ${name}`);
}

function validDef(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'starter-strength',
    name: 'Starter Strength',
    goal: 'Build a base of full-body strength.',
    weeks: 4,
    daysPerWeek: 3,
    phases: [
      {
        name: 'Training',
        startWeek: 1,
        endWeek: 4,
        sessions: [
          { day: 1, routineKbId: 'starter-strength--session-1', name: 'A' },
          { day: 3, routineKbId: 'starter-strength--session-3', name: 'B' },
          { day: 5, routineKbId: 'starter-strength--session-5', name: 'C' },
        ],
      },
    ],
    deload: { week: 4, volumeFactor: 0.6 },
    progression: { kind: 'linear' },
    pillars: ['strength'],
    source: { kind: 'kb', kbId: 'starter-strength', kbVersion: '0.2.0' },
    ...overrides,
  };
}

const cfg = (over = {}) => ({ incrementKg: 2.5, maxWeightKg: null, ...over });
const set = (reps, weightKg = 100, completed = true) => ({ reps, weightKg, completed });

/* ---------------- parseRepRange ---------------- */

check('range "8-12"', JSON.stringify(parseRepRange('8-12')) === JSON.stringify({ min: 8, max: 12 }));
check('range with spaces and en dash', JSON.stringify(parseRepRange(' 10 – 12 ')) === JSON.stringify({ min: 10, max: 12 }));
check('single "8"', JSON.stringify(parseRepRange('8')) === JSON.stringify({ min: 8, max: 8 }));
check('open-ended "8+"', JSON.stringify(parseRepRange('8+')) === JSON.stringify({ min: 8, max: null }));
check('null/empty/garbage → null', parseRepRange(null) === null && parseRepRange('') === null && parseRepRange('AMRAP') === null);
check('inverted "12-8" → null', parseRepRange('12-8') === null);
check('zero reps → null', parseRepRange('0-5') === null);

/* ---------------- resolveProgressionConfig ---------------- */

check('defaults when DSL omits fields', JSON.stringify(resolveProgressionConfig(validDef())) === JSON.stringify({ incrementKg: 2.5, maxWeightKg: null }));
check('DEFAULT_INCREMENT_KG is 2.5', DEFAULT_INCREMENT_KG === 2.5);
check(
  'explicit DSL values honored',
  JSON.stringify(
    resolveProgressionConfig(validDef({ progression: { kind: 'linear', incrementKg: 5, maxWeightKg: 200 } })),
  ) === JSON.stringify({ incrementKg: 5, maxWeightKg: 200 }),
);

/* ---------------- progressExercise: the v1 linear rule ---------------- */

function prog(over = {}) {
  return progressExercise({
    currentWeightKg: 100,
    targetSets: 3,
    repRange: { min: 8, max: 12 },
    lastSets: [set(12), set(12), set(12)],
    config: cfg(),
    ...over,
  });
}

{
  const r = prog();
  check('all sets hit top → increase', r.decision === 'increase' && r.nextWeightKg === 102.5);
}
{
  const r = prog({ lastSets: [set(12), set(11), set(12)] });
  check('one missed rep → repeat', r.decision === 'repeat' && r.nextWeightKg === 100);
}
{
  const r = prog({ lastSets: [set(12), set(12)] });
  check('short of target sets → repeat', r.decision === 'repeat' && r.nextWeightKg === 100);
}
{
  const r = prog({ lastSets: [] });
  check('no sets → repeat', r.decision === 'repeat' && r.nextWeightKg === 100);
}
{
  const r = prog({ lastSets: [set(null), set(null)] });
  check('no reps logged → repeat', r.decision === 'repeat');
}
{
  // Incomplete sets are ignored, not counted against the lifter.
  const r = prog({ lastSets: [set(12), set(12), set(12), set(5, 100, false)] });
  check('incomplete set ignored → increase', r.decision === 'increase' && r.nextWeightKg === 102.5);
}
{
  const r = prog({ currentWeightKg: null });
  check('bodyweight → repeat, stays null', r.decision === 'repeat' && r.nextWeightKg === null);
}
{
  const r = prog({ repRange: null });
  check('no rep range → repeat (never guesses)', r.decision === 'repeat' && r.nextWeightKg === 100);
}
{
  const r = prog({ repRange: { min: 8, max: null } });
  check('open-ended range → repeat', r.decision === 'repeat');
}
{
  const r = prog({ currentWeightKg: 198, config: cfg({ maxWeightKg: 200 }) });
  check('cap respected: 198 + 2.5 → 200', r.decision === 'increase' && r.nextWeightKg === 200);
}
{
  const r = prog({ currentWeightKg: 200, config: cfg({ maxWeightKg: 200 }) });
  check('at cap → repeat', r.decision === 'repeat' && r.nextWeightKg === 200);
}
{
  const r = prog({ currentWeightKg: 60 });
  check('no float dust: 60 + 2.5 = 62.5', r.nextWeightKg === 62.5);
}
{
  // Custom program increment flows through.
  const r = prog({ config: cfg({ incrementKg: 5 }) });
  check('custom increment honored', r.nextWeightKg === 105);
}

/* ---------------- applyDeloadVolume ---------------- */

{
  const d = applyDeloadVolume({ sets: 5, repMin: 8, repMax: 12, weightKg: 100 }, 0.6);
  check('deload scales sets and weight', d.sets === 3 && d.weightKg === 60 && d.repMin === 8 && d.repMax === 12);
}
{
  const d = applyDeloadVolume({ sets: 1, repMin: null, repMax: null, weightKg: 100 }, 0.5);
  check('deload sets never drop below 1', d.sets === 1);
}
{
  const d = applyDeloadVolume({ sets: 4, repMin: 8, repMax: 12, weightKg: null }, 0.6);
  check('deload keeps null weight null', d.weightKg === null);
}
{
  const d = applyDeloadVolume({ sets: 3, repMin: 5, repMax: 5, weightKg: 83 }, 0.6);
  check('deload weight rounds to 0.5 kg', d.weightKg === 50); // 49.8 → 50.0
}
{
  let threw = false;
  try {
    applyDeloadVolume({ sets: 3, repMin: 1, repMax: 5, weightKg: 10 }, 1.5);
  } catch {
    threw = true;
  }
  check('invalid volumeFactor throws', threw);
}

/* ---------------- nextSessionPosition ---------------- */

{
  const p = validDef();
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  check('mid-week advance skips rest days', eq(nextSessionPosition(p, 1, 1), { week: 1, day: 3 }));
  check('advance from rest day', eq(nextSessionPosition(p, 1, 2), { week: 1, day: 3 }));
  check('week rollover', eq(nextSessionPosition(p, 1, 5), { week: 2, day: 1 }));
  check('program complete → null', nextSessionPosition(p, 4, 5) === null);
  check('out-of-range week → null', nextSessionPosition(p, 9, 1) === null);
}

/* ---------------- DSL: new progression fields validate ---------------- */

check('old snapshot shape (no incrementKg) still valid', validateProgramDefinition(validDef()).length === 0);
check(
  'explicit incrementKg + maxWeightKg valid',
  validateProgramDefinition(
    validDef({ progression: { kind: 'linear', incrementKg: 5, maxWeightKg: 220 } }),
  ).length === 0,
);
for (const bad of [0, -2.5, 26, NaN, Infinity, '2.5']) {
  check(
    `incrementKg ${String(bad)} rejected`,
    validateProgramDefinition(validDef({ progression: { kind: 'linear', incrementKg: bad } })).length > 0,
  );
}
for (const bad of [0, -10, 1001, NaN]) {
  check(
    `maxWeightKg ${String(bad)} rejected`,
    validateProgramDefinition(validDef({ progression: { kind: 'linear', maxWeightKg: bad } })).length > 0,
  );
}

console.log(`\n${passed} checks passed`);
