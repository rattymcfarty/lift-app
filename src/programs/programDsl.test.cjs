/**
 * Program DSL unit tests (P3 #12) — zero dependencies beyond the app's own
 * tsc. Exercises validateProgramDefinition, compileKbProgram, freeze/parse
 * snapshot round-trips, and the pure helpers. The DB-backed enrollment
 * operations are typechecked but not unit-tested here (they need
 * expo-sqlite); their pure inputs are validated before any write.
 */
const assert = require('node:assert');
const {
  validateProgramDefinition,
  compileKbProgram,
  freezeSnapshot,
  parseSnapshot,
  programRoutineKbIds,
  phaseForWeek,
  ProgramError,
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

/* ---------------- validation ---------------- */

check('valid definition passes', validateProgramDefinition(validDef()).length === 0);

check(
  'non-object rejected',
  validateProgramDefinition(null).length > 0 &&
    validateProgramDefinition('x').length > 0,
);

check(
  'wrong schemaVersion rejected',
  validateProgramDefinition(validDef({ schemaVersion: 2 })).some((e) =>
    e.includes('schemaVersion'),
  ),
);

check(
  'empty name rejected',
  validateProgramDefinition(validDef({ name: '  ' })).some((e) => e.includes('name')),
);

check(
  'weeks out of range rejected',
  validateProgramDefinition(validDef({ weeks: 0 })).length > 0 &&
    validateProgramDefinition(validDef({ weeks: 53 })).length > 0,
);

check(
  'phase gap rejected',
  validateProgramDefinition(
    validDef({
      weeks: 4,
      phases: [
        { name: 'A', startWeek: 1, endWeek: 2, sessions: [{ day: 1, routineKbId: 'x' }] },
        { name: 'B', startWeek: 4, endWeek: 4, sessions: [{ day: 1, routineKbId: 'y' }] },
      ],
    }),
  ).some((e) => e.includes('partition')),
);

check(
  'phase overlap rejected',
  validateProgramDefinition(
    validDef({
      weeks: 4,
      phases: [
        { name: 'A', startWeek: 1, endWeek: 3, sessions: [{ day: 1, routineKbId: 'x' }] },
        { name: 'B', startWeek: 3, endWeek: 4, sessions: [{ day: 1, routineKbId: 'y' }] },
      ],
    }),
  ).some((e) => e.includes('partition')),
);

check(
  'two valid phases partition cleanly',
  validateProgramDefinition(
    validDef({
      weeks: 4,
      phases: [
        { name: 'A', startWeek: 1, endWeek: 2, sessions: [{ day: 1, routineKbId: 'x' }] },
        { name: 'B', startWeek: 3, endWeek: 4, sessions: [{ day: 1, routineKbId: 'y' }] },
      ],
    }),
  ).length === 0,
);

check(
  'duplicate session day rejected',
  validateProgramDefinition(
    validDef({
      phases: [
        {
          name: 'T',
          startWeek: 1,
          endWeek: 4,
          sessions: [
            { day: 1, routineKbId: 'x' },
            { day: 1, routineKbId: 'y' },
          ],
        },
      ],
    }),
  ).some((e) => e.includes('duplicated')),
);

check(
  'more sessions than daysPerWeek rejected',
  validateProgramDefinition(validDef({ daysPerWeek: 2 })).some((e) =>
    e.includes('daysPerWeek'),
  ),
);

check(
  'deload week out of range rejected',
  validateProgramDefinition(validDef({ deload: { week: 5, volumeFactor: 0.6 } })).some(
    (e) => e.includes('deload.week'),
  ),
);

check(
  'deload volumeFactor > 1 rejected',
  validateProgramDefinition(validDef({ deload: { week: 4, volumeFactor: 1.5 } })).some(
    (e) => e.includes('volumeFactor'),
  ),
);

check(
  'non-linear progression rejected (v1 scope)',
  validateProgramDefinition(validDef({ progression: { kind: 'undulating' } })).some(
    (e) => e.includes('linear'),
  ),
);

check(
  'unknown pillar rejected',
  validateProgramDefinition(validDef({ pillars: ['strength', 'telepathy'] })).some(
    (e) => e.includes('pillar'),
  ),
);

check(
  'kb source without kbId rejected',
  validateProgramDefinition(
    validDef({ source: { kind: 'kb', kbId: '', kbVersion: '0.2.0' } }),
  ).some((e) => e.includes('kbId')),
);

check(
  'local source valid',
  validateProgramDefinition(validDef({ source: { kind: 'local' } })).length === 0,
);

/* ---------------- compilation ---------------- */

const kbProgram = {
  id: 'starter-strength',
  schemaVersion: 1,
  name: 'Starter Strength',
  goal: 'Build a base.',
  weeks: 4,
  daysPerWeek: 3,
  sessions: [
    { day: 1, name: 'A', blocks: [{ exerciseId: 'squat', sets: 3 }] },
    { day: 3, name: 'B', blocks: [{ exerciseId: 'bench', sets: 3 }] },
  ],
  deload: { week: 4, volumeFactor: 0.6 },
};

const compiled = compileKbProgram(kbProgram, '0.2.0');
check('compile produces valid DSL', validateProgramDefinition(compiled).length === 0);
check(
  'compile maps sessions to routine kbIds',
  JSON.stringify(programRoutineKbIds(compiled)) ===
    JSON.stringify(['starter-strength--session-1', 'starter-strength--session-3']),
);
check(
  'compile stamps kb source',
  compiled.source.kind === 'kb' &&
    compiled.source.kbId === 'starter-strength' &&
    compiled.source.kbVersion === '0.2.0',
);
check('compile forces linear progression', compiled.progression.kind === 'linear');

let threw = false;
try {
  compileKbProgram({ ...kbProgram, weeks: 0 }, '0.2.0');
} catch (e) {
  threw = e instanceof ProgramError;
}
check('compile throws ProgramError on invalid KB input', threw);

/* ---------------- snapshots ---------------- */

const frozen = freezeSnapshot(validDef());
check('freeze is deterministic', freezeSnapshot(validDef()) === frozen);
function reverseKeysDeep(v) {
  if (Array.isArray(v)) return v.map(reverseKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).reverse()) out[k] = reverseKeysDeep(v[k]);
    return out;
  }
  return v;
}
check(
  'freeze is key-order canonical',
  freezeSnapshot(reverseKeysDeep(validDef())) === frozen,
);
check('parse round-trips', parseSnapshot(frozen).id === 'starter-strength');

let threwParse = false;
try {
  parseSnapshot('not json{');
} catch (e) {
  threwParse = e instanceof ProgramError;
}
check('parse throws ProgramError on corrupt JSON', threwParse);

let threwInvalid = false;
try {
  parseSnapshot(JSON.stringify(validDef({ weeks: 99 })));
} catch (e) {
  threwInvalid = e instanceof ProgramError;
}
check('parse throws ProgramError on invalid snapshot', threwInvalid);

let threwFreeze = false;
try {
  freezeSnapshot(validDef({ progression: { kind: 'undulating' } }));
} catch (e) {
  threwFreeze = e instanceof ProgramError;
}
check('freeze refuses invalid definitions', threwFreeze);

/* ---------------- helpers ---------------- */

check('phaseForWeek finds the phase', phaseForWeek(validDef(), 2)?.name === 'Training');
check('phaseForWeek null out of range', phaseForWeek(validDef(), 5) === null);
check('phaseForWeek null week 0', phaseForWeek(validDef(), 0) === null);

console.log(`\n${passed} tests passed`);
