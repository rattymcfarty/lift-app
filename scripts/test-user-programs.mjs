// Unit tests for the user-program model + DSL compiler (pure TS via esbuild).
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'uprog-'));
const entry = join(dir, 'entry.ts');
(await import('node:fs')).writeFileSync(
  entry,
  `export * from '${join(root, 'src/programs/userProgramDef.ts')}';\nexport { validateProgramDefinition } from '${join(root, 'src/programs/validate.ts')}';\nexport { programRoutineKbIds } from '${join(root, 'src/programs/compile.ts')}';\n`,
);
const out = join(dir, 'm.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const M = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const mk = (over = {}) => ({
  id: 'p1', name: 'Longevity 4-7-8', weeks: 12, schedule: 'repeating',
  weekDays: [['r1', 'r2', 'r3']], deloadWeek: null, createdAt: 1, updatedAt: 1, ...over,
});

// repeating -> one phase spanning every week, validated by the real DSL validator
let def = M.buildDefinition(mk());
eq(M.validateProgramDefinition(def), [], 'repeating program is a valid DSL definition');
eq([def.phases.length, def.phases[0].startWeek, def.phases[0].endWeek], [1, 1, 12], 'single phase 1..12');
eq(def.phases[0].sessions.map((s) => s.day), [1, 3, 5], '3 days spread Mon/Wed/Fri-style');
eq(def.phases[0].sessions.map((s) => s.routineKbId), ['uprog:p1:w1:d1', 'uprog:p1:w1:d2', 'uprog:p1:w1:d3'], 'stable routine keys');
eq(def.source, { kind: 'local' }, 'local source');
eq([def.deload.week, def.deload.volumeFactor], [12, 1], 'no deload = factor 1 on the last week');
eq(M.programRoutineKbIds(def).length, 3, 'distinct routine keys');

// custom weeks -> one phase per week; each week can differ
def = M.buildDefinition(mk({ weeks: 3, schedule: 'custom', weekDays: [['a', 'b'], ['c', 'd', 'e'], ['f']] }));
eq(M.validateProgramDefinition(def), [], 'custom program valid');
eq(def.phases.map((p) => p.sessions.length), [2, 3, 1], 'per-week day counts');
eq(def.daysPerWeek, 3, 'daysPerWeek = widest week');
eq(def.phases[0].sessions.map((s) => s.day), [1, 4], '2 days spread');
eq(M.programRoutineKbIds(def).length, 6, 'unique key per (week, day)');

// deload
def = M.buildDefinition(mk({ deloadWeek: 4 }));
eq([def.deload.week, def.deload.volumeFactor], [4, 0.5], 'deload week at half volume');
eq(M.validateProgramDefinition(def), [], 'deload valid');

// day names label sessions
def = M.buildDefinition(mk(), new Map([['r1', 'Genesis']]));
eq(def.phases[0].sessions[0].name, 'Genesis', 'session labelled');

// issues
ok(M.programIssues(mk({ name: '  ' })).length > 0, 'blank name rejected');
ok(M.programIssues(mk({ weeks: 0 })).length > 0, '0 weeks rejected');
ok(M.programIssues(mk({ weeks: 53 })).length > 0, '53 weeks rejected');
ok(M.programIssues(mk({ weekDays: [[]] })).some((s) => /no days/.test(s)), 'empty week rejected');
ok(M.programIssues(mk({ schedule: 'custom', weeks: 3, weekDays: [['a']] })).length > 0, 'custom needs a list per week');
ok(M.programIssues(mk({ weekDays: [Array(8).fill('x')] })).some((s) => /more than 7/.test(s)), '>7 days rejected');
ok(M.programIssues(mk({ deloadWeek: 13 })).length > 0, 'deload outside program rejected');
assert.throws(() => M.buildDefinition(mk({ weekDays: [[]] })), RangeError); n++;

// helpers
eq(M.userRoutineKbId('x', 2, 0), 'uprog:x:w3:d1', 'kbId 0-based -> 1-based');
ok(M.isUserProgramRoutine('uprog:x:w1:d1') && !M.isUserProgramRoutine('longevity-foundations--session-1') && !M.isUserProgramRoutine(null), 'prefix test');
eq([M.defaultDayName(0), M.defaultDayName(2)], ['Workout A', 'Workout C'], 'default names');
eq(M.totalDays(mk()), 36, '3 days x 12 weeks');
eq(M.totalDays(mk({ weeks: 3, schedule: 'custom', weekDays: [['a', 'b'], ['c'], ['d', 'e', 'f']] })), 6, 'custom total');
for (let k = 1; k <= 7; k++) ok(M.SESSION_DAYS[k].length === k && new Set(M.SESSION_DAYS[k]).size === k, `session days for ${k}`);

console.log(`user programs: ${n} assertions passed`);
