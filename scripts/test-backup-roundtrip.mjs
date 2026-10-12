#!/usr/bin/env node
/**
 * DB round-trip test for the backup system.
 *
 * Complements scripts/test-backup.mjs (pure unit tests): this exercises the
 * REAL database schema — migrations 0000..0007 applied to an in-memory
 * SQLite database via node:sqlite, with foreign keys enforced — through a
 * full export → wipe → import cycle:
 *
 *   1. Insert rows into every backup table, with FK relationships spanning
 *      the P3 tables (program_enrollments → program_session_states, plus a
 *      completed + an active enrollment for the same program to exercise the
 *      partial unique index).
 *   2. Export: SELECT * per table in BACKUP_TABLE_ORDER, mapped to the
 *      backup document shape (camelCase keys, ISO dates — mirrors export.ts).
 *   3. validateBackup must accept the document.
 *   4. Wipe every table.
 *   5. Import: planImport against an empty local index, then apply inserts
 *      in BACKUP_TABLE_ORDER (mirrors import.ts applyActions).
 *   6. Verify: per-table row counts, spot-checked values, PRAGMA
 *      foreign_key_check clean, and no partial-unique violations (an insert
 *      would have thrown).
 *
 * Run: npm run test:backup:roundtrip
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'lift-backup-rt-'));

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL:', name); }
}

try {
  // ---- compile backupFormat.ts standalone (same as test-backup.mjs) ----
  execFileSync(
    'npx',
    ['tsc', 'src/data/backupFormat.ts', '--ignoreConfig', '--outDir', tmp,
     '--module', 'commonjs', '--target', 'es2020', '--strict'],
    { cwd: root, stdio: 'pipe' },
  );
  const {
    BACKUP_TABLES,
    BACKUP_TABLE_ORDER,
    BACKUP_VERSION,
    TABLE_FIELDS,
    DATE_FIELDS,
    BOOL_FIELDS,
    validateBackup,
    planImport,
  } = require(join(tmp, 'backupFormat.js'));

  // ---- build the real schema ----
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const migDir = join(root, 'src/db/migrations');
  const files = readdirSync(migDir).filter(f => /^\d+.*\.sql$/.test(f)).sort();
  for (const f of files) {
    const sql = readFileSync(join(migDir, f), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint')) {
      const s = stmt.trim();
      if (s) db.exec(s);
    }
  }

  const camelToSnake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  const DB_TABLE = {
    workouts: 'workouts', workout_exercises: 'workout_exercises', sets: 'sets',
    exercises: 'exercises', routines: 'routines', routine_exercises: 'routine_exercises',
    measurements: 'measurements', personal_records: 'personal_records',
    program_enrollments: 'program_enrollments', parq_screenings: 'parq_screenings',
    program_session_states: 'program_session_states',
  };

  // ---- seed every backup table ----
  const T0 = Date.parse('2026-10-01T10:00:00.000Z');
  const seed = (table, rows) => {
    for (const r of rows) {
      const cols = Object.keys(r).map(c => `"${c}"`);
      const vals = Object.values(r);
      db.prepare(`INSERT INTO "${DB_TABLE[table]}" (${cols.join(',')}) VALUES (${vals.map(() => '?').join(',')})`).run(...vals);
    }
  };
  const base = (over = {}) => ({ id: 'x', created_at: T0, updated_at: T0, deleted_at: null, ...over });

  seed('exercises', [base({ id: 'e1', name: 'Squat', primary_muscles: '[]', secondary_muscles: '[]', equipment: '[]', category: 'strength', longevity_pillars: '["strength"]', is_custom: 1 })]);
  seed('routines', [base({ id: 'r1', name: 'Full Body', longevity_pillars: '["strength"]' })]);
  seed('routine_exercises', [base({ id: 're1', routine_id: 'r1', exercise_id: 'e1', position: 0 })]);
  seed('workouts', [base({ id: 'w1', name: 'Day 1', started_at: T0, longevity_pillars: '["strength"]' })]);
  seed('workout_exercises', [base({ id: 'we1', workout_id: 'w1', exercise_id: 'e1', position: 0 })]);
  seed('sets', [base({ id: 's1', workout_exercise_id: 'we1', set_number: 1, completed: 1, reps: 8, weight_kg: 60 })]);
  seed('personal_records', [base({ id: 'pr1', exercise_id: 'e1', kind: 'max_weight', value: 60, unit: 'kg', achieved_at: T0, workout_id: 'w1', set_id: 's1' })]);
  seed('measurements', [base({ id: 'm1', type: 'weight', value: 72.5, unit: 'kg', measured_at: T0 })]);
  seed('parq_screenings', [base({ id: 'pq1', completed_at: T0, any_yes: 0, answers_json: '[false,false,false,false,false,false,false]' })]);
  // active + completed enrollment for the SAME program: partial unique index
  // allows this (only one ACTIVE), and both must survive the round-trip.
  seed('program_enrollments', [
    base({ id: 'en-old', program_id: 'prog-1', snapshot: '{"kind":"linear"}', enrolled_at: T0, status: 'completed', current_week: 4, current_day: 3, longevity_pillars: '["strength"]', progression_state: '{"e1":{"weightKg":60}}' }),
    base({ id: 'en-new', program_id: 'prog-1', snapshot: '{"kind":"linear"}', enrolled_at: T0, status: 'active', current_week: 1, current_day: 2, longevity_pillars: '["strength"]', progression_state: '{}', last_advanced_workout_id: 'w1' }),
  ]);
  seed('program_session_states', [
    base({ id: 'ss1', enrollment_id: 'en-new', week: 1, day: 1, routine_kb_id: 'prog-1--session-1', scheduled_date: T0, status: 'done', workout_id: 'w1', resolved_at: T0 }),
    base({ id: 'ss2', enrollment_id: 'en-new', week: 1, day: 2, routine_kb_id: 'prog-1--session-2', scheduled_date: T0, status: 'scheduled' }),
    base({ id: 'ss3', enrollment_id: 'en-old', week: 4, day: 3, routine_kb_id: 'prog-1--session-3', scheduled_date: T0, status: 'missed', resolved_at: T0 }),
  ]);

  const countBefore = {};
  for (const t of BACKUP_TABLES) {
    countBefore[t] = db.prepare(`SELECT COUNT(*) AS n FROM "${DB_TABLE[t]}"`).get().n;
  }
  ok(Object.values(countBefore).every(n => n > 0), `seeded all tables (${JSON.stringify(countBefore)})`);

  // ---- export (mirrors export.ts: Drizzle select → JSON round-trip) ----
  const dbRowToBackup = (table, dbRow) => {
    const out = {};
    for (const f of TABLE_FIELDS[table]) {
      const v = dbRow[camelToSnake(f)];
      if (v === null || v === undefined) { out[f] = null; continue; }
      if (DATE_FIELDS[table].includes(f)) out[f] = new Date(v).toISOString();
      else if (BOOL_FIELDS[table].includes(f)) out[f] = v === 1;
      else out[f] = v;
    }
    return out;
  };
  const tables = {};
  for (const t of BACKUP_TABLE_ORDER) {
    tables[t] = db.prepare(`SELECT * FROM "${DB_TABLE[t]}"`).all().map(r => dbRowToBackup(t, r));
  }
  // JSON round-trip like the real exporter (Date → ISO, plain data only).
  const doc = JSON.parse(JSON.stringify({
    format: 'lift-backup', version: BACKUP_VERSION, appVersion: '0.1.0',
    exportedAt: new Date().toISOString(), tables,
  }));

  const validation = validateBackup(doc);
  ok(validation.valid, `exported document validates${validation.valid ? '' : ': ' + JSON.stringify(validation.errors)}`);

  // ---- wipe (reverse FK order: children before parents) ----
  for (const t of [...BACKUP_TABLE_ORDER].reverse()) db.exec(`DELETE FROM "${DB_TABLE[t]}"`);
  ok(db.prepare('SELECT COUNT(*) AS n FROM "program_enrollments"').get().n === 0, 'wipe cleared tables');

  // ---- import (mirrors import.ts: plan → apply in FK order) ----
  const emptyIndex = () => {
    const rows = {}, liveIds = {};
    for (const t of BACKUP_TABLES) { rows[t] = new Map(); liveIds[t] = new Set(); }
    return { rows, liveIds, liveChildren: new Map() };
  };
  const actions = planImport(validation.backup, emptyIndex());
  const backupRowToDb = (table, row) => {
    const cols = [], vals = [];
    for (const f of TABLE_FIELDS[table]) {
      const v = row[f];
      if (v === undefined) continue;
      let dbV = v;
      if (v !== null) {
        if (DATE_FIELDS[table].includes(f)) dbV = Date.parse(v);
        else if (BOOL_FIELDS[table].includes(f)) dbV = v ? 1 : 0;
      }
      cols.push(`"${camelToSnake(f)}"`);
      vals.push(dbV);
    }
    return { cols, vals };
  };
  let threw = null;
  try {
    for (const table of BACKUP_TABLE_ORDER) {
      for (const a of actions) {
        if (a.table !== table || a.kind !== 'insert') continue;
        const { cols, vals } = backupRowToDb(table, a.row);
        db.prepare(`INSERT INTO "${DB_TABLE[table]}" (${cols.join(',')}) VALUES (${vals.map(() => '?').join(',')})`).run(...vals);
      }
    }
  } catch (e) { threw = e; }
  ok(!threw, `import inserts applied without constraint violations${threw ? ': ' + threw.message : ''}`);

  // ---- verify ----
  for (const t of BACKUP_TABLES) {
    const n = db.prepare(`SELECT COUNT(*) AS n FROM "${DB_TABLE[t]}"`).get().n;
    ok(n === countBefore[t], `table ${t}: ${n} rows restored (was ${countBefore[t]})`);
  }
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  ok(fkViolations.length === 0, `no FK violations after restore${fkViolations.length ? ': ' + JSON.stringify(fkViolations) : ''}`);

  // spot-check values survived
  const en = db.prepare('SELECT * FROM "program_enrollments" WHERE "id" = ?').get('en-new');
  ok(en && en.snapshot === '{"kind":"linear"}' && en.status === 'active' && en.current_day === 2, 'enrollment values restored');
  ok(en && en.progression_state === '{}' && en.last_advanced_workout_id === 'w1', 'P3 progression columns restored');
  const ss = db.prepare('SELECT * FROM "program_session_states" WHERE "id" = ?').get('ss1');
  ok(ss && ss.status === 'done' && ss.workout_id === 'w1' && ss.week === 1 && ss.day === 1, 'session state values + workout link restored');
  const pq = db.prepare('SELECT * FROM "parq_screenings" WHERE "id" = ?').get('pq1');
  ok(pq && pq.any_yes === 0 && pq.answers_json === '[false,false,false,false,false,false,false]', 'parq values restored');
  const bothEnrollments = db.prepare('SELECT COUNT(*) AS n FROM "program_enrollments" WHERE "program_id" = ?').get('prog-1').n;
  ok(bothEnrollments === 2, 'active + completed enrollments for one program both restored (partial unique held)');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
