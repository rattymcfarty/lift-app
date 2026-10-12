/* Unit tests for src/data/backupFormat.ts (pure, no expo deps). */
const {
  validateBackup,
  planImport,
  summarizePlan,
  formatImportSummary,
  BACKUP_VERSION,
} = require('./backupFormat.js');

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL:', name); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)})`); }

const T0 = '2026-10-01T10:00:00.000Z';
const T1 = '2026-10-05T10:00:00.000Z'; // newer
const T2 = '2026-10-10T10:00:00.000Z'; // newest
const T9 = '2026-10-11T10:00:00.000Z'; // newest of all

function row(over = {}) {
  return {
    id: 'r1', createdAt: T0, updatedAt: T0, deletedAt: null,
    name: 'Push-up', primaryMuscles: '[]', secondaryMuscles: '[]',
    equipment: '[]', category: 'strength', longevityPillars: '[]',
    isCustom: true, ...over,
  };
}
function doc(over = {}) {
  return {
    format: 'lift-backup', version: BACKUP_VERSION, appVersion: '0.1.0', exportedAt: T2,
    tables: {
      workouts: [], workout_exercises: [], sets: [], exercises: [],
      routines: [], routine_exercises: [], measurements: [], personal_records: [],
      program_enrollments: [], parq_screenings: [], program_session_states: [],
      cardio_logs: [],
      ...over.tables,
    },
    ...over,
  };
}
function emptyIndex() {
  const m = () => new Map(); const s = () => new Set();
  const tables = ['workouts', 'workout_exercises', 'sets', 'exercises', 'routines', 'routine_exercises', 'measurements', 'personal_records', 'program_enrollments', 'parq_screenings', 'program_session_states', 'cardio_logs'];
  const rows = {}, liveIds = {};
  for (const t of tables) { rows[t] = m(); liveIds[t] = s(); }
  return { rows, liveIds, liveChildren: new Map() };
}
/** Registers a live local row. parents: { workout_exercises$workoutId: 'w1', ... } for cascade indexing. */
function addLocal(idx, table, id, over = {}) {
  const { parents = {}, ...refOver } = over;
  const ref = localRef(refOver);
  idx.rows[table].set(id, ref);
  if (ref.deletedAtMs === null) {
    idx.liveIds[table].add(id);
    for (const [key, pid] of Object.entries(parents)) {
      if (pid === null || pid === undefined) continue;
      let byParent = idx.liveChildren.get(key);
      if (!byParent) { byParent = new Map(); idx.liveChildren.set(key, byParent); }
      const list = byParent.get(pid) || [];
      list.push(id);
      byParent.set(pid, list);
    }
  }
}
const KC = (childTable, parentColumn) => `${childTable}:${parentColumn}`;
function localRef(over = {}) {
  return { updatedAtMs: Date.parse(T0), deletedAtMs: null, scopeKey: null, ...over };
}
const ms = (iso) => Date.parse(iso);

/* ---------- validation ---------- */
ok(validateBackup(doc({ tables: { ...doc().tables, exercises: [row()] } })).valid, 'valid doc passes');
ok(!validateBackup({ format: 'nope' }).valid, 'wrong format rejected');
{
  const r = validateBackup(doc({ version: 99 }));
  ok(!r.valid && r.errors[0].message.includes('update the app'), 'future version rejected with upgrade hint');
}
{
  const r = validateBackup(doc({ tables: { ...doc().tables } }));
  delete r; // tables present but empty arrays are fine
  ok(validateBackup(doc()).valid, 'empty tables valid');
}
{
  const bad = doc(); delete bad.tables.sets;
  ok(!validateBackup(bad).valid, 'missing table rejected');
}
{
  // Real v1 backup: version 1 AND no cardio_logs array (v1 predates it).
  // Must restore fine — cardio_logs is treated as empty.
  const old = doc({ version: 1 });
  delete old.tables.cardio_logs;
  const r = validateBackup(old);
  ok(r.valid, 'v1 backup without cardio_logs still valid');
  eq(r.backup.tables.cardio_logs.length, 0, 'missing cardio_logs becomes empty array');
  eq(r.backup.version, 1, 'v1 version preserved');
}
{
  // v2 backup missing cardio_logs is TRUNCATED and must fail loudly.
  // (v1 without cardio_logs is fine — it predates the table.)
  const v2 = doc(); delete v2.tables.cardio_logs;
  const r = validateBackup(v2);
  ok(!r.valid, 'v2 backup without cardio_logs rejected as truncated');
}
{
  const d = doc({ tables: { ...doc().tables, exercises: [row({ id: 'x' }), row({ id: 'x' })] } });
  const r = validateBackup(d);
  ok(!r.valid && r.errors.some(e => e.message.includes('duplicate id')), 'duplicate id rejected');
}
{
  // Cardio minutes out of range are rejected (matches logCardio's 1–1440).
  const clog = (over) => row({ loggedAt: T0, ...over });
  const badMin = doc({ tables: { ...doc().tables, cardio_logs: [clog({ id: 'c1', minutes: 0 })] } });
  ok(!validateBackup(badMin).valid, 'cardio 0 minutes rejected');
  const badNeg = doc({ tables: { ...doc().tables, cardio_logs: [clog({ id: 'c2', minutes: -30 })] } });
  ok(!validateBackup(badNeg).valid, 'cardio negative minutes rejected');
  const badBig = doc({ tables: { ...doc().tables, cardio_logs: [clog({ id: 'c3', minutes: 2000 })] } });
  ok(!validateBackup(badBig).valid, 'cardio >1440 minutes rejected');
  const good = doc({ tables: { ...doc().tables, cardio_logs: [clog({ id: 'c4', minutes: 30 })] } });
  ok(validateBackup(good).valid, 'cardio 30 minutes accepted');
}
{
  // Duplicate kbId within one table is rejected (UNIQUE constraint).
  const dup = doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1', kbId: 'kb-x' }), row({ id: 'e2', kbId: 'kb-x' })] } });
  const r = validateBackup(dup);
  ok(!r.valid && r.errors.some(e => e.message.includes('duplicate kbId')), 'duplicate kbId rejected');
  const okKb = doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1', kbId: 'kb-x' }), row({ id: 'e2', kbId: 'kb-y' })] } });
  ok(validateBackup(okKb).valid, 'distinct kbIds accepted');
}
{
  const d = doc({ tables: { ...doc().tables, exercises: [row({ updatedAt: 'not-a-date' })] } });
  ok(!validateBackup(d).valid, 'bad date rejected');
}
{
  const d = doc({ tables: { ...doc().tables, exercises: [row({ name: null })] } });
  ok(!validateBackup(d).valid, 'missing required field rejected');
}

/* ---------- plan: basic insert ---------- */
{
  const v = validateBackup(doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1' })] } }));
  const actions = planImport(v.backup, emptyIndex());
  eq(actions, [{ kind: 'insert', table: 'exercises', id: 'e1', row: actions[0].row }], 'new row inserts');
  ok(actions[0].kind === 'insert', 'insert kind');
}

/* ---------- plan: stale / newer ---------- */
{
  const idx = emptyIndex();
  idx.rows.exercises.set('e1', localRef({ updatedAtMs: ms(T2) })); // local newest
  idx.liveIds.exercises.add('e1');
  const v = validateBackup(doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1', updatedAt: T0 })] } }));
  const actions = planImport(v.backup, idx);
  eq(actions.map(a => a.kind), ['skip'], 'stale incoming skipped');
  eq(actions[0].reason, 'stale', 'stale reason');
}
{
  const idx = emptyIndex();
  idx.rows.exercises.set('e1', localRef({ updatedAtMs: ms(T0) }));
  idx.liveIds.exercises.add('e1');
  const v = validateBackup(doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1', updatedAt: T1, name: 'Pull-up' })] } }));
  const actions = planImport(v.backup, idx);
  eq(actions.map(a => a.kind), ['update'], 'newer incoming updates');
}

/* ---------- plan: tombstones ---------- */
{
  // local tombstone + incoming live => never resurrect
  const idx = emptyIndex();
  idx.rows.exercises.set('e1', localRef({ updatedAtMs: ms(T1), deletedAtMs: ms(T1) }));
  const v = validateBackup(doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1', updatedAt: T2 })] } }));
  const actions = planImport(v.backup, idx);
  eq(actions[0].reason, 'resurrected', 'tombstoned row never resurrected');
}
{
  // local live + incoming tombstone newer => tombstone applies
  const idx = emptyIndex();
  idx.rows.exercises.set('e1', localRef({ updatedAtMs: ms(T0) }));
  idx.liveIds.exercises.add('e1');
  const v = validateBackup(doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1', updatedAt: T2, deletedAt: T2 })] } }));
  const actions = planImport(v.backup, idx);
  eq(actions.map(a => a.kind), ['update'], 'newer incoming tombstone applies');
  ok(actions[0].row.deletedAt === T2, 'tombstone timestamp preserved');
}
{
  // local live (newer) + incoming tombstone older => stale, no delete
  const idx = emptyIndex();
  idx.rows.exercises.set('e1', localRef({ updatedAtMs: ms(T2) }));
  idx.liveIds.exercises.add('e1');
  const v = validateBackup(doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1', updatedAt: T0, deletedAt: T0 })] } }));
  const actions = planImport(v.backup, idx);
  eq(actions[0].reason, 'stale', 'stale tombstone does not delete');
}

/* ---------- plan: FK orphans ---------- */
function weRow(over = {}) {
  return { id: 'we1', createdAt: T0, updatedAt: T0, deletedAt: null, workoutId: 'w1', exerciseId: 'e1', position: 0, ...over };
}
function wRow(over = {}) {
  return { id: 'w1', createdAt: T0, updatedAt: T0, deletedAt: null, name: 'Day 1', startedAt: T0, longevityPillars: '[]', ...over };
}
{
  // child without parent anywhere => orphaned
  const v = validateBackup(doc({ tables: { ...doc().tables, workout_exercises: [weRow()] } }));
  const actions = planImport(v.backup, emptyIndex());
  eq(actions[0].reason, 'orphaned', 'orphaned child skipped');
}
{
  // parent + child both incoming => both inserted, parent first
  const v = validateBackup(doc({ tables: { ...doc().tables, workouts: [wRow()], exercises: [row({ id: 'e1' })], workout_exercises: [weRow()] } }));
  const actions = planImport(v.backup, emptyIndex());
  const kinds = actions.map(a => `${a.table}:${a.kind}`);
  ok(kinds.includes('workouts:insert') && kinds.includes('workout_exercises:insert'), 'parent+child both insert');
  ok(actions.findIndex(a => a.table === 'workouts') < actions.findIndex(a => a.table === 'workout_exercises'), 'parent planned before child');
}
{
  // child referencing tombstoned parent => orphaned (no dangling live child)
  const idx = emptyIndex();
  idx.rows.workouts.set('w1', localRef({ updatedAtMs: ms(T1), deletedAtMs: ms(T1) }));
  idx.rows.exercises.set('e1', localRef({ updatedAtMs: ms(T0) }));
  idx.liveIds.exercises.add('e1');
  const v = validateBackup(doc({ tables: { ...doc().tables, workout_exercises: [weRow({ updatedAt: T2 })] } }));
  const actions = planImport(v.backup, idx);
  eq(actions[0].reason, 'orphaned', 'child of tombstoned parent skipped');
}

/* ---------- plan: position conflicts ---------- */
{
  // local live at (w1,0) older; incoming newer at (w1,0) => incoming wins, local tombstoned
  const idx = emptyIndex();
  idx.rows.workouts.set('w1', localRef({})); idx.liveIds.workouts.add('w1');
  idx.rows.exercises.set('e1', localRef({})); idx.liveIds.exercises.add('e1');
  idx.rows.exercises.set('e2', localRef({})); idx.liveIds.exercises.add('e2');
  idx.rows.workout_exercises.set('we-old', localRef({ updatedAtMs: ms(T0), scopeKey: 'w1:0' }));
  idx.liveIds.workout_exercises.add('we-old');
  const v = validateBackup(doc({ tables: {
    ...doc().tables,
    workout_exercises: [weRow({ id: 'we-new', exerciseId: 'e2', updatedAt: T2 })],
  } }));
  const actions = planImport(v.backup, idx);
  const byKind = {};
  for (const a of actions) { (byKind[a.kind] = byKind[a.kind] || []).push(a.id); }
  ok(byKind.insert && byKind.insert.includes('we-new'), 'newer conflicting row inserted');
  ok(byKind.tombstone && byKind.tombstone.includes('we-old'), 'older local loser tombstoned');
}
{
  // incoming older than local occupant => incoming skipped, local untouched
  const idx = emptyIndex();
  idx.rows.workouts.set('w1', localRef({})); idx.liveIds.workouts.add('w1');
  idx.rows.exercises.set('e1', localRef({})); idx.liveIds.exercises.add('e1');
  idx.rows.exercises.set('e2', localRef({})); idx.liveIds.exercises.add('e2');
  idx.rows.workout_exercises.set('we-old', localRef({ updatedAtMs: ms(T2), scopeKey: 'w1:0' }));
  idx.liveIds.workout_exercises.add('we-old');
  const v = validateBackup(doc({ tables: {
    ...doc().tables,
    workout_exercises: [weRow({ id: 'we-new', exerciseId: 'e2', updatedAt: T0 })],
  } }));
  const actions = planImport(v.backup, idx);
  eq(actions.filter(a => a.kind === 'tombstone').length, 0, 'no tombstone when incoming loses');
  ok(actions.some(a => a.kind === 'skip' && a.reason === 'conflict'), 'older incoming skipped as conflict');
}
{
  // tie: existing wins
  const idx = emptyIndex();
  idx.rows.workouts.set('w1', localRef({})); idx.liveIds.workouts.add('w1');
  idx.rows.exercises.set('e1', localRef({})); idx.liveIds.exercises.add('e1');
  idx.rows.exercises.set('e2', localRef({})); idx.liveIds.exercises.add('e2');
  idx.rows.workout_exercises.set('we-old', localRef({ updatedAtMs: ms(T1), scopeKey: 'w1:0' }));
  idx.liveIds.workout_exercises.add('we-old');
  const v = validateBackup(doc({ tables: {
    ...doc().tables,
    workout_exercises: [weRow({ id: 'we-new', exerciseId: 'e2', updatedAt: T1 })],
  } }));
  const actions = planImport(v.backup, idx);
  ok(actions.some(a => a.kind === 'skip' && a.id === 'we-new'), 'tie goes to existing row');
}
{
  // two incoming rows contest the same key: newer wins, older skipped (no local)
  const idx = emptyIndex();
  idx.rows.workouts.set('w1', localRef({})); idx.liveIds.workouts.add('w1');
  idx.rows.exercises.set('e1', localRef({})); idx.liveIds.exercises.add('e1');
  idx.rows.exercises.set('e2', localRef({})); idx.liveIds.exercises.add('e2');
  const v = validateBackup(doc({ tables: {
    ...doc().tables,
    workout_exercises: [
      weRow({ id: 'we-a', exerciseId: 'e1', updatedAt: T0 }),
      weRow({ id: 'we-b', exerciseId: 'e2', updatedAt: T2 }),
    ],
  } }));
  const actions = planImport(v.backup, idx);
  const a = Object.fromEntries(actions.map(x => [x.id, x.kind]));
  eq(a['we-a'], 'skip', 'older incoming duplicate skipped');
  eq(a['we-b'], 'insert', 'newer incoming duplicate inserted');
}

/* ---------- FK: null optional parent does not skip remaining checks ---------- */
function prRow(over = {}) {
  return { id: 'pr1', createdAt: T0, updatedAt: T0, deletedAt: null, exerciseId: 'e1', kind: 'max_weight', value: 100, unit: 'kg', achievedAt: T0, workoutId: null, setId: null, ...over };
}
{
  // workoutId null (allowed) but setId dangling -> must be orphaned, not inserted
  const idx = emptyIndex();
  addLocal(idx, 'exercises', 'e1', {});
  const v = validateBackup(doc({ tables: { ...doc().tables, personal_records: [prRow({ setId: 'nope' })] } }));
  ok(v.valid, 'PR doc validates');
  const actions = planImport(v.backup, idx);
  eq(actions[0].reason, 'orphaned', 'null optional parent does not skip setId check');
}
{
  // workoutId null and setId null -> fine
  const idx = emptyIndex();
  addLocal(idx, 'exercises', 'e1', {});
  const v = validateBackup(doc({ tables: { ...doc().tables, personal_records: [prRow()] } }));
  const actions = planImport(v.backup, idx);
  eq(actions[0].kind, 'insert', 'fully-nullable PR inserts');
}

/* ---------- cascade tombstones ---------- */
function setRow(over = {}) {
  return { id: 's1', createdAt: T0, updatedAt: T0, deletedAt: null, workoutExerciseId: 'we1', setNumber: 1, completed: true, ...over };
}
{
  // incoming newer tombstone on workout -> live items, sets, PRs die with it
  const idx = emptyIndex();
  addLocal(idx, 'workouts', 'w1', {});
  addLocal(idx, 'workout_exercises', 'we1', { parents: { [KC('workout_exercises', 'workoutId')]: 'w1' } });
  addLocal(idx, 'sets', 's1', { scopeKey: 'we1:1', parents: { [KC('sets', 'workoutExerciseId')]: 'we1' } });
  addLocal(idx, 'personal_records', 'pr1', { parents: { [KC('personal_records', 'setId')]: 's1', [KC('personal_records', 'workoutId')]: 'w1' } });
  addLocal(idx, 'exercises', 'e1', {});
  const v = validateBackup(doc({ tables: { ...doc().tables, workouts: [wRow({ updatedAt: T2, deletedAt: T2 })] } }));
  const actions = planImport(v.backup, idx);
  const tombs = actions.filter(a => a.kind === 'tombstone').map(a => `${a.table}:${a.id}`).sort();
  eq(tombs, ['personal_records:pr1', 'sets:s1', 'workout_exercises:we1'].sort(), 'tombstone cascades to live children');
  ok(actions.some(a => a.kind === 'update' && a.table === 'workouts' && a.id === 'w1'), 'parent tombstone applied as update');
}
{
  // position-conflict loser is tombstoned WITH its children
  const idx = emptyIndex();
  addLocal(idx, 'workouts', 'w1', {});
  addLocal(idx, 'exercises', 'e1', {});
  addLocal(idx, 'exercises', 'e2', {});
  addLocal(idx, 'workout_exercises', 'we-old', { updatedAtMs: ms(T0), scopeKey: 'w1:0', parents: { [KC('workout_exercises', 'workoutId')]: 'w1' } });
  addLocal(idx, 'sets', 's1', { scopeKey: 'we-old:1', parents: { [KC('sets', 'workoutExerciseId')]: 'we-old' } });
  const v = validateBackup(doc({ tables: {
    ...doc().tables,
    workout_exercises: [weRow({ id: 'we-new', exerciseId: 'e2', updatedAt: T2 })],
  } }));
  const actions = planImport(v.backup, idx);
  const tombs = actions.filter(a => a.kind === 'tombstone').map(a => a.id).sort();
  eq(tombs, ['s1', 'we-old'].sort(), 'conflict loser tombstoned with children');
}

/* ---------- scope tracking restored after lost contest ---------- */
{
  // we-old (local, w1:0, T0). Incoming we-old update T3 moves to (w1,1),
  // but local we-other holds (w1,1) at T9 -> update loses, DB unchanged.
  // A later incoming we-third at (w1,0) T1 must then contest we-old (T0) correctly.
  const idx = emptyIndex();
  addLocal(idx, 'workouts', 'w1', {});
  addLocal(idx, 'exercises', 'e1', {});
  addLocal(idx, 'exercises', 'e2', {});
  addLocal(idx, 'exercises', 'e3', {});
  addLocal(idx, 'workout_exercises', 'we-old', { updatedAtMs: ms(T0), scopeKey: 'w1:0', parents: { [KC('workout_exercises', 'workoutId')]: 'w1' } });
  addLocal(idx, 'workout_exercises', 'we-other', { updatedAtMs: ms(T9), scopeKey: 'w1:1', parents: { [KC('workout_exercises', 'workoutId')]: 'w1' } });
  const v = validateBackup(doc({ tables: {
    ...doc().tables,
    workout_exercises: [
      weRow({ id: 'we-old', exerciseId: 'e1', position: 1, updatedAt: T2 }), // moves, loses to we-other
      weRow({ id: 'we-third', exerciseId: 'e3', position: 0, updatedAt: T1 }), // contests restored (w1,0)
    ],
  } }));
  const actions = planImport(v.backup, idx);
  const weOldActions = actions.filter(a => a.id === 'we-old');
  ok(weOldActions.some(a => a.kind === 'skip'), 'losing update becomes skip (DB unchanged)');
  ok(actions.some(a => a.kind === 'insert' && a.id === 'we-third'), 'later row takes the restored slot');
  ok(weOldActions.some(a => a.kind === 'tombstone'), 'we-old tombstoned by we-third (tracking was restored)');
}

/* ---------- type validation ---------- */
{
  const d = doc({ tables: { ...doc().tables, workout_exercises: [weRow({ position: '1' })] } });
  const r = validateBackup(d);
  ok(!r.valid && r.errors.some(e => e.message.includes('integer')), 'string position rejected');
}
{
  const d = doc({ tables: { ...doc().tables, sets: [setRow({ completed: 'yes' })] } });
  const r = validateBackup(d);
  ok(!r.valid && r.errors.some(e => e.message.includes('boolean')), 'string completed rejected');
}
{
  const d = doc({ tables: { ...doc().tables, exercises: [row({ category: 'yoga' })] } });
  const r = validateBackup(d);
  ok(!r.valid && r.errors.some(e => e.message.includes('category')), 'bad category rejected');
}
{
  const d = doc({ tables: { ...doc().tables, sets: [{ ...setRow(), weightKg: 'heavy' }] } });
  ok(!validateBackup(d).valid, 'string weight rejected');
}

/* ---------- KB media allowlist ---------- */
{
  const { isAllowedKbMediaUrl } = require('./backupFormat.js');
  ok(isAllowedKbMediaUrl(null), 'null media url allowed');
  ok(isAllowedKbMediaUrl('https://rattymcfarty.github.io/lift-kb/img/squat.png'), 'KB pages url allowed');
  ok(!isAllowedKbMediaUrl('https://evil.example.com/img.png'), 'third-party host rejected');
  ok(!isAllowedKbMediaUrl('https://github.com/rattymcfarty/lift-kb-evil/x.png'), 'prefix-squatting host rejected');
  ok(!isAllowedKbMediaUrl('http://rattymcfarty.github.io/lift-kb/x.png'), 'non-https rejected');
}

/* ---------- clean position swap (reorder then restore) ---------- */
{
  // Backup has we-a@(w,1) and we-b@(w,0); local has we-a@(w,0), we-b@(w,1).
  // Both incoming rows are newer. Correct merge: both updates apply, no
  // tombstones, no lost children.
  const idx = emptyIndex();
  addLocal(idx, 'workouts', 'w1', {});
  addLocal(idx, 'exercises', 'e1', {});
  addLocal(idx, 'exercises', 'e2', {});
  addLocal(idx, 'workout_exercises', 'we-a', { updatedAtMs: ms(T0), scopeKey: 'w1:0', parents: { [KC('workout_exercises', 'workoutId')]: 'w1' } });
  addLocal(idx, 'workout_exercises', 'we-b', { updatedAtMs: ms(T0), scopeKey: 'w1:1', parents: { [KC('workout_exercises', 'workoutId')]: 'w1' } });
  addLocal(idx, 'sets', 'sa', { scopeKey: 'we-a:1', parents: { [KC('sets', 'workoutExerciseId')]: 'we-a' } });
  addLocal(idx, 'sets', 'sb', { scopeKey: 'we-b:1', parents: { [KC('sets', 'workoutExerciseId')]: 'we-b' } });
  const v = validateBackup(doc({ tables: {
    ...doc().tables,
    workout_exercises: [
      weRow({ id: 'we-a', exerciseId: 'e1', position: 1, updatedAt: T2 }),
      weRow({ id: 'we-b', exerciseId: 'e2', position: 0, updatedAt: T2 }),
    ],
  } }));
  const actions = planImport(v.backup, idx);
  const updates = actions.filter(a => a.kind === 'update');
  eq(updates.length, 2, 'swap: both updates apply');
  eq(actions.filter(a => a.kind === 'tombstone').length, 0, 'swap: nothing tombstoned');
  ok(actions.every(a => a.kind !== 'skip'), 'swap: nothing skipped');
}

/* ---------- P3 tables: validation ---------- */
function enrollmentRow(over = {}) {
  return {
    id: 'en1', createdAt: T0, updatedAt: T0, deletedAt: null,
    programId: 'prog-1', programKbId: null, kbVersion: null,
    snapshot: '{"kind":"linear"}', enrolledAt: T0, status: 'active',
    currentWeek: 1, currentDay: 1, longevityPillars: '[]',
    progressionState: '{}', lastAdvancedWorkoutId: null,
    ...over,
  };
}
function parqRow(over = {}) {
  return {
    id: 'pq1', createdAt: T0, updatedAt: T0, deletedAt: null,
    completedAt: T0, anyYes: false, answersJson: '[false,false,false,false,false,false,false]',
    clearanceAcknowledgedAt: null,
    ...over,
  };
}
function sessionRow(over = {}) {
  return {
    id: 'ss1', createdAt: T0, updatedAt: T0, deletedAt: null,
    enrollmentId: 'en1', week: 1, day: 1, routineKbId: 'prog-1--session-1',
    scheduledDate: T0, status: 'scheduled', workoutId: null, resolvedAt: null,
    ...over,
  };
}
{
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_enrollments: [enrollmentRow()],
    parq_screenings: [parqRow()],
    program_session_states: [sessionRow()],
  } }));
  ok(v.valid, 'P3 rows validate');
}
{
  const d = doc({ tables: { ...doc().tables, program_enrollments: [enrollmentRow({ status: 'flying' })] } });
  const r = validateBackup(d);
  ok(!r.valid && r.errors.some(e => e.message.includes('enrollment status')), 'bad enrollment status rejected');
}
{
  const d = doc({ tables: { ...doc().tables, program_session_states: [sessionRow({ status: 'napping' })] } });
  const r = validateBackup(d);
  ok(!r.valid && r.errors.some(e => e.message.includes('session status')), 'bad session status rejected');
}
{
  const d = doc({ tables: { ...doc().tables, program_enrollments: [enrollmentRow({ snapshot: null })] } });
  ok(!validateBackup(d).valid, 'missing enrollment required field rejected');
}
{
  const d = doc({ tables: { ...doc().tables, program_session_states: [sessionRow({ week: 'one' })] } });
  const r = validateBackup(d);
  ok(!r.valid && r.errors.some(e => e.message.includes('integer')), 'string week rejected');
}
{
  const d = doc({ tables: { ...doc().tables, parq_screenings: [parqRow({ anyYes: 'no' })] } });
  const r = validateBackup(d);
  ok(!r.valid && r.errors.some(e => e.message.includes('boolean')), 'string anyYes rejected');
}
{
  const d = doc({ tables: { ...doc().tables, parq_screenings: [parqRow({ completedAt: 'yesterday' })] } });
  ok(!validateBackup(d).valid, 'bad parq date rejected');
}

/* ---------- P3 tables: plan basics ---------- */
{
  // all three insert into an empty DB
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_enrollments: [enrollmentRow()],
    parq_screenings: [parqRow()],
    program_session_states: [sessionRow()],
  } }));
  const actions = planImport(v.backup, emptyIndex());
  const byTable = {};
  for (const a of actions) { (byTable[a.table] = byTable[a.table] || []).push(a.kind); }
  eq(byTable.program_enrollments, ['insert'], 'enrollment inserts');
  eq(byTable.parq_screenings, ['insert'], 'parq inserts');
  eq(byTable.program_session_states, ['insert'], 'session state inserts');
  const order = actions.map(a => a.table);
  ok(order.indexOf('program_enrollments') < order.indexOf('program_session_states'), 'enrollment planned before its session states');
}
{
  // session state without its enrollment => orphaned
  const v = validateBackup(doc({ tables: { ...doc().tables, program_session_states: [sessionRow()] } }));
  const actions = planImport(v.backup, emptyIndex());
  eq(actions[0].reason, 'orphaned', 'session state without enrollment skipped');
}
{
  // session state with tombstoned enrollment => orphaned
  const idx = emptyIndex();
  idx.rows.program_enrollments.set('en1', localRef({ updatedAtMs: ms(T1), deletedAtMs: ms(T1) }));
  const v = validateBackup(doc({ tables: { ...doc().tables, program_session_states: [sessionRow({ updatedAt: T2 })] } }));
  const actions = planImport(v.backup, idx);
  eq(actions[0].reason, 'orphaned', 'session state of tombstoned enrollment skipped');
}
{
  // session state with null workoutId (allowed) inserts fine
  const idx = emptyIndex();
  addLocal(idx, 'program_enrollments', 'en1', {});
  const v = validateBackup(doc({ tables: { ...doc().tables, program_session_states: [sessionRow()] } }));
  const actions = planImport(v.backup, idx);
  eq(actions[0].kind, 'insert', 'session state with null workoutId inserts');
}
{
  // session state with dangling workoutId => orphaned
  const idx = emptyIndex();
  addLocal(idx, 'program_enrollments', 'en1', {});
  const v = validateBackup(doc({ tables: { ...doc().tables, program_session_states: [sessionRow({ workoutId: 'ghost' })] } }));
  const actions = planImport(v.backup, idx);
  eq(actions[0].reason, 'orphaned', 'session state with dangling workoutId skipped');
}

/* ---------- P3: active-enrollment uniqueness ---------- */
{
  // local active E-old (T0), incoming active E-new (T2) same program => newer wins, loser tombstoned WITH session states
  const idx = emptyIndex();
  addLocal(idx, 'program_enrollments', 'en-old', { updatedAtMs: ms(T0), scopeKey: 'prog-1' });
  addLocal(idx, 'program_session_states', 'ss-old', {
    scopeKey: 'en-old:1:1',
    parents: { [KC('program_session_states', 'enrollmentId')]: 'en-old' },
  });
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_enrollments: [enrollmentRow({ id: 'en-new', updatedAt: T2 })],
    program_session_states: [sessionRow({ id: 'ss-new', enrollmentId: 'en-new', updatedAt: T2 })],
  } }));
  const actions = planImport(v.backup, idx);
  const byKind = {};
  for (const a of actions) { (byKind[a.kind] = byKind[a.kind] || []).push(a.id); }
  ok(byKind.insert && byKind.insert.includes('en-new'), 'newer active enrollment inserted');
  ok(byKind.tombstone && byKind.tombstone.includes('en-old'), 'older active enrollment tombstoned');
  ok(byKind.tombstone && byKind.tombstone.includes('ss-old'), 'loser session states cascade-tombstoned');
  ok(byKind.insert && byKind.insert.includes('ss-new'), 'winner session states inserted');
}
{
  // incoming active OLDER than local active => incoming skipped, local untouched
  const idx = emptyIndex();
  addLocal(idx, 'program_enrollments', 'en-local', { updatedAtMs: ms(T2), scopeKey: 'prog-1' });
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_enrollments: [enrollmentRow({ id: 'en-backup', updatedAt: T0 })],
  } }));
  const actions = planImport(v.backup, idx);
  ok(actions.some(a => a.kind === 'skip' && a.id === 'en-backup' && a.reason === 'conflict'), 'older active enrollment skipped as conflict');
  eq(actions.filter(a => a.kind === 'tombstone').length, 0, 'no tombstone when incoming loses');
}
{
  // completed enrollments never collide: local completed + incoming active same program => both live
  const idx = emptyIndex();
  addLocal(idx, 'program_enrollments', 'en-done', { updatedAtMs: ms(T2), scopeKey: null });
  idx.rows.program_enrollments.get('en-done').scopeKey = null; // completed: not in active scope
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_enrollments: [enrollmentRow({ id: 'en-new', status: 'active', updatedAt: T2 })],
  } }));
  // simulate the completed status by patching the local ref's scope out (inScope=false)
  const actions = planImport(v.backup, idx);
  ok(actions.some(a => a.kind === 'insert' && a.id === 'en-new'), 'active enrollment inserts alongside completed');
  eq(actions.filter(a => a.kind === 'tombstone').length, 0, 'completed enrollment untouched');
}
{
  // two active enrollments for DIFFERENT programs => no conflict
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_enrollments: [
      enrollmentRow({ id: 'en-a', programId: 'prog-a' }),
      enrollmentRow({ id: 'en-b', programId: 'prog-b' }),
    ],
  } }));
  const actions = planImport(v.backup, emptyIndex());
  eq(actions.filter(a => a.kind === 'insert').length, 2, 'different programs do not conflict');
}

/* ---------- P3: session (week, day) composite uniqueness ---------- */
{
  // local live (en1,1,1) older; incoming newer at (en1,1,1) => incoming wins
  const idx = emptyIndex();
  addLocal(idx, 'program_enrollments', 'en1', {});
  addLocal(idx, 'program_session_states', 'ss-old', {
    updatedAtMs: ms(T0), scopeKey: 'en1:1:1',
    parents: { [KC('program_session_states', 'enrollmentId')]: 'en1' },
  });
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_session_states: [sessionRow({ id: 'ss-new', updatedAt: T2 })],
  } }));
  const actions = planImport(v.backup, idx);
  const byKind = {};
  for (const a of actions) { (byKind[a.kind] = byKind[a.kind] || []).push(a.id); }
  ok(byKind.insert && byKind.insert.includes('ss-new'), 'newer session state inserted');
  ok(byKind.tombstone && byKind.tombstone.includes('ss-old'), 'older session state tombstoned');
}
{
  // same week, different day => no conflict
  const idx = emptyIndex();
  addLocal(idx, 'program_enrollments', 'en1', {});
  addLocal(idx, 'program_session_states', 'ss-d1', {
    updatedAtMs: ms(T0), scopeKey: 'en1:1:1',
    parents: { [KC('program_session_states', 'enrollmentId')]: 'en1' },
  });
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_session_states: [sessionRow({ id: 'ss-d2', day: 2, updatedAt: T2 })],
  } }));
  const actions = planImport(v.backup, idx);
  ok(actions.some(a => a.kind === 'insert' && a.id === 'ss-d2'), 'different day inserts cleanly');
  eq(actions.filter(a => a.kind === 'tombstone').length, 0, 'no conflict across days');
}
{
  // enrollment tombstone cascades to its session states
  const idx = emptyIndex();
  addLocal(idx, 'program_enrollments', 'en1', { scopeKey: 'prog-1' });
  addLocal(idx, 'program_session_states', 'ss1', {
    scopeKey: 'en1:1:1',
    parents: { [KC('program_session_states', 'enrollmentId')]: 'en1' },
  });
  addLocal(idx, 'program_session_states', 'ss2', {
    scopeKey: 'en1:1:2',
    parents: { [KC('program_session_states', 'enrollmentId')]: 'en1' },
  });
  const v = validateBackup(doc({ tables: { ...doc().tables,
    program_enrollments: [enrollmentRow({ updatedAt: T2, deletedAt: T2 })],
  } }));
  const actions = planImport(v.backup, idx);
  const tombs = actions.filter(a => a.kind === 'tombstone').map(a => a.id).sort();
  eq(tombs, ['ss1', 'ss2'], 'enrollment tombstone cascades to session states');
}

/* ---------- summary ---------- */
{
  const v = validateBackup(doc({ tables: { ...doc().tables, exercises: [row({ id: 'e1' })] } }));
  const s = summarizePlan(planImport(v.backup, emptyIndex()));
  eq(s.totalInserts, 1, 'summary counts inserts');
  const text = formatImportSummary(s);
  ok(text.includes('1 new') && text.includes('exercises'), 'summary text human-readable');
}
{
  const text = formatImportSummary(summarizePlan([]));
  ok(text.includes('Nothing to import'), 'empty plan message');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
