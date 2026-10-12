/**
 * LIFT backup document format + pure validation / merge-planning logic.
 *
 * This module has ZERO runtime imports (types only, all erased) so the
 * validation and merge rules are unit-tested under plain Node without
 * expo-sqlite (`npm run test:backup`), and so a bug here can never open the
 * database at import time.
 *
 * Format (version 1):
 *   {
 *     format: "lift-backup",
 *     version: 1,
 *     appVersion: "0.1.0",            // informational only
 *     exportedAt: "<ISO-8601>",
 *     tables: { workouts: [...], workout_exercises: [...], sets: [...],
 *               exercises: [...], routines: [...], routine_exercises: [...],
 *               measurements: [...], personal_records: [...],
 *               program_enrollments: [...], parq_screenings: [...],
 *               program_session_states: [...] }
 *   }
 *
 * Row keys are the Drizzle camelCase field names; dates are ISO-8601 strings.
 * Tombstones (deletedAt != null) are exported so deletes survive a round-trip.
 *
 * Merge rules (planImport):
 *  1. Upsert by UUID — the PK is stable, so an import can never duplicate.
 *  2. Newer updatedAt wins. A stale backup never overwrites fresher local data,
 *     and a stale tombstone never deletes a fresher live row.
 *  3. Tombstones are terminal — a live incoming row never resurrects a locally
 *     tombstoned row (there is no "undelete" in the repository layer).
 *  4. FK integrity — a row is applied only if every referenced parent is live
 *     (locally live, or an incoming row that is itself being applied as live).
 *     Orphaned rows are skipped, never inserted dangling (FKs are enforced).
 *  5. Position-unique scopes — workout_exercises (workoutId+position),
 *     routine_exercises (routineId+position), sets (workoutExerciseId+setNumber)
 *     are unique among live rows (partial index). On collision the newer row
 *     wins; a losing row is tombstoned locally (or skipped if it only exists
 *     in the backup) so the UNIQUE constraint can never fire mid-import.
 */

export const BACKUP_FORMAT = 'lift-backup' as const;
export const BACKUP_VERSION = 1;

export const BACKUP_TABLES = [
  'workouts',
  'workout_exercises',
  'sets',
  'exercises',
  'routines',
  'routine_exercises',
  'measurements',
  'personal_records',
  'program_enrollments',
  'parq_screenings',
  'program_session_states',
] as const;
export type BackupTableName = (typeof BACKUP_TABLES)[number];

/** Insert order: parents before children, so FK targets always exist first. */
export const BACKUP_TABLE_ORDER: readonly BackupTableName[] = [
  'exercises',
  'routines',
  'measurements',
  'parq_screenings',
  'program_enrollments',
  'workouts',
  'routine_exercises',
  'workout_exercises',
  'program_session_states',
  'sets',
  'personal_records',
];

interface FkDep {
  column: string;
  parentTable: BackupTableName;
  nullable: boolean;
}

const FK_DEPS: Record<BackupTableName, readonly FkDep[]> = {
  exercises: [],
  routines: [],
  measurements: [],
  workouts: [{ column: 'routineId', parentTable: 'routines', nullable: true }],
  routine_exercises: [
    { column: 'routineId', parentTable: 'routines', nullable: false },
    { column: 'exerciseId', parentTable: 'exercises', nullable: false },
  ],
  workout_exercises: [
    { column: 'workoutId', parentTable: 'workouts', nullable: false },
    { column: 'exerciseId', parentTable: 'exercises', nullable: false },
  ],
  sets: [{ column: 'workoutExerciseId', parentTable: 'workout_exercises', nullable: false }],
  personal_records: [
    { column: 'exerciseId', parentTable: 'exercises', nullable: false },
    { column: 'workoutId', parentTable: 'workouts', nullable: true },
    { column: 'setId', parentTable: 'sets', nullable: true },
  ],
  program_enrollments: [],
  parq_screenings: [],
  program_session_states: [
    { column: 'enrollmentId', parentTable: 'program_enrollments', nullable: false },
    { column: 'workoutId', parentTable: 'workouts', nullable: true },
  ],
};

interface PositionScope {
  parentColumn: string;
  /**
   * Position column(s) within the parent scope. A single column name for the
   * classic (parent, position) scopes; an array for composite keys
   * (program_session_states is unique on enrollmentId + week + day); null
   * for a parent-only scope (program_enrollments allows one ACTIVE
   * enrollment per program).
   */
  positionColumn: string | readonly string[] | null;
  /**
   * Extra predicate: the row participates in the scope only when this
   * returns true. Models partial unique indexes — the enrollment scope
   * covers only active rows (completed/abandoned enrollments never collide).
   */
  inScope?: (row: Record<string, unknown>) => boolean;
}

/** Tables with a partial unique index over live rows. */
const POSITION_SCOPES: Partial<Record<BackupTableName, PositionScope>> = {
  workout_exercises: { parentColumn: 'workoutId', positionColumn: 'position' },
  routine_exercises: { parentColumn: 'routineId', positionColumn: 'position' },
  sets: { parentColumn: 'workoutExerciseId', positionColumn: 'setNumber' },
  program_enrollments: {
    parentColumn: 'programId',
    positionColumn: null,
    inScope: (row) => row['status'] === 'active',
  },
  program_session_states: {
    parentColumn: 'enrollmentId',
    positionColumn: ['week', 'day'],
  },
};

/** NOT NULL columns (camelCase). deletedAt is nullable on every table. */
const REQUIRED_FIELDS: Record<BackupTableName, readonly string[]> = {
  workouts: ['id', 'name', 'startedAt', 'longevityPillars', 'createdAt', 'updatedAt'],
  workout_exercises: ['id', 'workoutId', 'exerciseId', 'position', 'createdAt', 'updatedAt'],
  sets: ['id', 'workoutExerciseId', 'setNumber', 'completed', 'createdAt', 'updatedAt'],
  exercises: [
    'id', 'name', 'primaryMuscles', 'secondaryMuscles', 'equipment',
    'category', 'longevityPillars', 'isCustom', 'createdAt', 'updatedAt',
  ],
  routines: ['id', 'name', 'longevityPillars', 'createdAt', 'updatedAt'],
  routine_exercises: ['id', 'routineId', 'exerciseId', 'position', 'createdAt', 'updatedAt'],
  measurements: ['id', 'type', 'value', 'unit', 'measuredAt', 'createdAt', 'updatedAt'],
  personal_records: ['id', 'exerciseId', 'kind', 'value', 'unit', 'achievedAt', 'createdAt', 'updatedAt'],
  program_enrollments: [
    'id', 'programId', 'snapshot', 'enrolledAt', 'status', 'currentWeek',
    'currentDay', 'longevityPillars', 'progressionState', 'createdAt', 'updatedAt',
  ],
  parq_screenings: ['id', 'completedAt', 'anyYes', 'answersJson', 'createdAt', 'updatedAt'],
  program_session_states: [
    'id', 'enrollmentId', 'week', 'day', 'routineKbId', 'scheduledDate',
    'status', 'createdAt', 'updatedAt',
  ],
};

/** Every column the importer may write (unknown keys are stripped). */
export const TABLE_FIELDS: Record<BackupTableName, readonly string[]> = {
  workouts: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'name', 'startedAt', 'endedAt', 'notes', 'longevityPillars', 'routineId'],
  workout_exercises: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'workoutId', 'exerciseId', 'position', 'notes', 'restSeconds'],
  sets: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'workoutExerciseId', 'setNumber', 'reps', 'weightKg', 'rpe', 'rir', 'durationSeconds', 'distanceM', 'completed', 'notes'],
  exercises: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'name', 'primaryMuscles', 'secondaryMuscles', 'equipment', 'category', 'instructions', 'mediaImageUrl', 'mediaVideoUrl', 'longevityPillars', 'isCustom', 'kbId', 'kbVersion'],
  routines: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'name', 'notes', 'estimatedMinutes', 'longevityPillars'],
  routine_exercises: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'routineId', 'exerciseId', 'position', 'targetSets', 'targetReps', 'targetWeightKg', 'targetRpe', 'targetRestSeconds', 'notes'],
  measurements: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'type', 'value', 'unit', 'measuredAt', 'notes'],
  personal_records: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'exerciseId', 'kind', 'value', 'unit', 'achievedAt', 'workoutId', 'setId', 'previousValue'],
  program_enrollments: [
    'id', 'createdAt', 'updatedAt', 'deletedAt', 'programId', 'programKbId',
    'kbVersion', 'snapshot', 'enrolledAt', 'status', 'currentWeek', 'currentDay',
    'longevityPillars', 'progressionState', 'lastAdvancedWorkoutId',
  ],
  parq_screenings: [
    'id', 'createdAt', 'updatedAt', 'deletedAt', 'completedAt', 'anyYes',
    'answersJson', 'clearanceAcknowledgedAt',
  ],
  program_session_states: [
    'id', 'createdAt', 'updatedAt', 'deletedAt', 'enrollmentId', 'week', 'day',
    'routineKbId', 'scheduledDate', 'status', 'workoutId', 'resolvedAt',
  ],
};

/** Columns that must be Date objects on write (ISO strings in the document). */
export const DATE_FIELDS: Record<BackupTableName, readonly string[]> = {
  workouts: ['createdAt', 'updatedAt', 'deletedAt', 'startedAt', 'endedAt'],
  workout_exercises: ['createdAt', 'updatedAt', 'deletedAt'],
  sets: ['createdAt', 'updatedAt', 'deletedAt'],
  exercises: ['createdAt', 'updatedAt', 'deletedAt'],
  routines: ['createdAt', 'updatedAt', 'deletedAt'],
  routine_exercises: ['createdAt', 'updatedAt', 'deletedAt'],
  measurements: ['createdAt', 'updatedAt', 'deletedAt', 'measuredAt'],
  personal_records: ['createdAt', 'updatedAt', 'deletedAt', 'achievedAt'],
  program_enrollments: ['createdAt', 'updatedAt', 'deletedAt', 'enrolledAt'],
  parq_screenings: ['createdAt', 'updatedAt', 'deletedAt', 'completedAt', 'clearanceAcknowledgedAt'],
  program_session_states: ['createdAt', 'updatedAt', 'deletedAt', 'scheduledDate', 'resolvedAt'],
};

export function isDateField(table: BackupTableName, field: string): boolean {
  return (DATE_FIELDS[table] as readonly string[]).includes(field);
}

/**
 * Field type expectations for validation. SQLite is dynamically typed and
 * would silently coerce `"1"` -> 1 (then the partial UNIQUE index aborts the
 * import), so the importer rejects mistyped values up front instead of
 * relying on the database to complain mid-transaction.
 */
const INT_FIELDS: Record<BackupTableName, readonly string[]> = {
  workouts: [],
  workout_exercises: ['position'],
  sets: ['setNumber'],
  exercises: [],
  routines: [],
  routine_exercises: ['position'],
  measurements: [],
  personal_records: [],
  program_enrollments: ['currentWeek', 'currentDay'],
  parq_screenings: [],
  program_session_states: ['week', 'day'],
};

const NUMBER_FIELDS: Record<BackupTableName, readonly string[]> = {
  workouts: [],
  workout_exercises: ['restSeconds'],
  sets: ['reps', 'weightKg', 'rpe', 'rir', 'durationSeconds', 'distanceM'],
  exercises: [],
  routines: ['estimatedMinutes'],
  routine_exercises: ['targetSets', 'targetWeightKg', 'targetRpe', 'targetRestSeconds'],
  measurements: ['value'],
  personal_records: ['value', 'previousValue'],
  program_enrollments: [],
  parq_screenings: [],
  program_session_states: [],
};

export const BOOL_FIELDS: Record<BackupTableName, readonly string[]> = {
  workouts: [],
  workout_exercises: [],
  sets: ['completed'],
  exercises: ['isCustom'],
  routines: [],
  routine_exercises: [],
  measurements: [],
  personal_records: [],
  program_enrollments: [],
  parq_screenings: ['anyYes'],
  program_session_states: [],
};

const EXERCISE_CATEGORIES = ['strength', 'cardio', 'mobility', 'balance', 'other'] as const;

/** program_enrollments.status values (schema: active | completed | abandoned). */
const ENROLLMENT_STATUSES = ['active', 'completed', 'abandoned'] as const;

/** program_session_states.status values (see SESSION_STATUSES in schema.ts). */
const SESSION_STATUSES = ['scheduled', 'done', 'missed', 'skipped'] as const;

/** Cascade edges for tombstones: parent -> live children that must die with it. */
const CASCADE_EDGES: Record<BackupTableName, readonly { childTable: BackupTableName; parentColumn: string }[]> = {
  workouts: [
    { childTable: 'workout_exercises', parentColumn: 'workoutId' },
    { childTable: 'personal_records', parentColumn: 'workoutId' },
  ],
  workout_exercises: [
    { childTable: 'sets', parentColumn: 'workoutExerciseId' },
    { childTable: 'personal_records', parentColumn: 'setId' },
  ],
  sets: [{ childTable: 'personal_records', parentColumn: 'setId' }],
  routines: [{ childTable: 'routine_exercises', parentColumn: 'routineId' }],
  exercises: [],
  routine_exercises: [],
  measurements: [],
  personal_records: [],
  program_enrollments: [{ childTable: 'program_session_states', parentColumn: 'enrollmentId' }],
  parq_screenings: [],
  program_session_states: [],
};

export function getCascadeEdges(
  table: BackupTableName,
): readonly { childTable: BackupTableName; parentColumn: string }[] {
  return CASCADE_EDGES[table];
}

/**
 * Scope key for a live DB row (`${parentId}:${position}`) in the tables with a
 * partial unique index over live rows; null otherwise. Used when snapshotting
 * the local DB for merge planning. Accepts Drizzle row objects (Date fields).
 */
export function getScopeKey(table: BackupTableName, row: Record<string, unknown>): string | null {
  const scope = POSITION_SCOPES[table];
  if (!scope) return null;
  return scopeKeyFor(scope, row);
}

/**
 * Computes the scope key for a row under a PositionScope, or null when the
 * row doesn't participate (tombstoned, fails the partial-index predicate,
 * or has a malformed key). Shared by getScopeKey (DB rows) and normalizeRow
 * (backup rows) so both sides agree on key shape.
 */
function scopeKeyFor(scope: PositionScope, row: Record<string, unknown>): string | null {
  const deleted = row['deletedAt'];
  if (deleted !== null && deleted !== undefined) return null;
  if (scope.inScope && !scope.inScope(row)) return null;
  const parentId = row[scope.parentColumn];
  if (typeof parentId !== 'string') return null;
  if (scope.positionColumn === null) return parentId;
  const cols = Array.isArray(scope.positionColumn) ? scope.positionColumn : [scope.positionColumn];
  const parts: string[] = [];
  for (const col of cols) {
    const p = row[col];
    if (typeof p !== 'number') return null;
    parts.push(String(p));
  }
  return `${parentId}:${parts.join(':')}`;
}

/* ------------------------------------------------------------------ */
/* validation                                                          */
/* ------------------------------------------------------------------ */

export interface BackupValidationError {
  table?: BackupTableName;
  index?: number;
  message: string;
}

export interface ValidatedBackup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  appVersion: string;
  exportedAt: string;
  tables: Record<BackupTableName, Record<string, unknown>[]>;
}

/* ------------------------------------------------------------------ */
/* KB media URL allowlist (shared with the repository layer)           */
/*                                                                     */
/* Path prefixes allowed for KB media URLs. The KB publishes via GitHub */
/* Releases + Pages; anything else (a malformed or compromised bundle  */
/* pointing at a third-party host) would leak which exercises the user */
/* opens, plus IP/timing. Compared against the NORMALIZED url (new URL */
/* resolves .. and %-encoding) with a trailing slash, so neither      */
/* https://github.com/rattymcfarty/lift-kb-anything/… nor              */
/* https://github.com/rattymcfarty/lift-kb/../../attacker/… can slip   */
/* through. P2 (KB app-side) owns this list — keep it in sync with the */
/* publishing setup.                                                   */
/* ------------------------------------------------------------------ */

export const KB_MEDIA_URL_PREFIXES = [
  'https://github.com/rattymcfarty/lift-kb/',
  'https://rattymcfarty.github.io/lift-kb/',
] as const;

/** Pure allowlist check — no throws, so the importer can strip bad URLs. */
export function isAllowedKbMediaUrl(url: string | null | undefined): boolean {
  if (url == null || url === '') return true;
  let normalized: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    normalized = parsed.origin + parsed.pathname;
  } catch {
    return false;
  }
  return (KB_MEDIA_URL_PREFIXES as readonly string[]).some((prefix) => normalized.startsWith(prefix));
}

export type ValidationResult =
  | { valid: true; backup: ValidatedBackup }
  | { valid: false; errors: BackupValidationError[] };

function parseDateMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateBackup(doc: unknown): ValidationResult {
  const errors: BackupValidationError[] = [];
  if (!isRecord(doc)) {
    return { valid: false, errors: [{ message: 'backup is not a JSON object' }] };
  }
  if (doc['format'] !== BACKUP_FORMAT) {
    errors.push({ message: `not a LIFT backup (format is ${JSON.stringify(doc['format'])})` });
  }
  const version = doc['version'];
  if (version !== BACKUP_VERSION) {
    errors.push({
      message:
        typeof version === 'number' && version > BACKUP_VERSION
          ? `unsupported backup version ${version} (this app reads version ${BACKUP_VERSION}); update the app first`
          : `unsupported backup version ${JSON.stringify(version)} (expected ${BACKUP_VERSION})`,
    });
  }
  if (doc['exportedAt'] !== undefined && parseDateMs(doc['exportedAt']) === null) {
    errors.push({ message: 'exportedAt is not a valid date' });
  }
  if (doc['appVersion'] !== undefined && typeof doc['appVersion'] !== 'string') {
    errors.push({ message: 'appVersion must be a string' });
  }

  const tables = doc['tables'];
  const rowsByTable = {} as Record<BackupTableName, Record<string, unknown>[]>;
  if (!isRecord(tables)) {
    errors.push({ message: 'backup has no "tables" object' });
  } else {
    for (const table of BACKUP_TABLES) {
      const rows = tables[table];
      if (!Array.isArray(rows)) {
        errors.push({ table, message: `missing or invalid table array "${table}"` });
        continue;
      }
      const clean: Record<string, unknown>[] = [];
      const seenIds = new Set<string>();
      rows.forEach((row, index) => {
        if (!isRecord(row)) {
          errors.push({ table, index, message: 'row is not an object' });
          return;
        }
        const id = row['id'];
        if (typeof id !== 'string' || id.length === 0) {
          errors.push({ table, index, message: 'row has no valid string id' });
          return;
        }
        if (seenIds.has(id)) {
          errors.push({ table, index, message: `duplicate id "${id}" in table "${table}"` });
          return;
        }
        seenIds.add(id);
        for (const field of REQUIRED_FIELDS[table]) {
          if (row[field] === undefined || row[field] === null) {
            errors.push({ table, index, message: `missing required field "${field}"` });
            return;
          }
        }
        for (const field of DATE_FIELDS[table]) {
          const v = row[field];
          if (v !== null && v !== undefined && parseDateMs(v) === null) {
            errors.push({ table, index, message: `field "${field}" is not a valid date` });
            return;
          }
        }
        for (const field of INT_FIELDS[table]) {
          const v = row[field];
          if (v !== null && v !== undefined && !Number.isInteger(v)) {
            errors.push({ table, index, message: `field "${field}" must be an integer` });
            return;
          }
        }
        for (const field of NUMBER_FIELDS[table]) {
          const v = row[field];
          if (v !== null && v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) {
            errors.push({ table, index, message: `field "${field}" must be a finite number` });
            return;
          }
        }
        for (const field of BOOL_FIELDS[table]) {
          const v = row[field];
          if (v !== null && v !== undefined && typeof v !== 'boolean') {
            errors.push({ table, index, message: `field "${field}" must be a boolean` });
            return;
          }
        }
        if (table === 'exercises') {
          const category = row['category'];
          if (!(EXERCISE_CATEGORIES as readonly string[]).includes(category as string)) {
            errors.push({ table, index, message: `invalid exercise category: ${JSON.stringify(category)}` });
            return;
          }
        }
        if (table === 'program_enrollments') {
          const status = row['status'];
          if (!(ENROLLMENT_STATUSES as readonly string[]).includes(status as string)) {
            errors.push({ table, index, message: `invalid enrollment status: ${JSON.stringify(status)}` });
            return;
          }
        }
        if (table === 'program_session_states') {
          const status = row['status'];
          if (!(SESSION_STATUSES as readonly string[]).includes(status as string)) {
            errors.push({ table, index, message: `invalid session status: ${JSON.stringify(status)}` });
            return;
          }
        }
        clean.push(row);
      });
      rowsByTable[table] = clean;
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      appVersion: typeof doc['appVersion'] === 'string' ? doc['appVersion'] : 'unknown',
      exportedAt: typeof doc['exportedAt'] === 'string' ? doc['exportedAt'] : '',
      tables: rowsByTable,
    },
  };
}

/* ------------------------------------------------------------------ */
/* merge planning (pure)                                               */
/* ------------------------------------------------------------------ */

export interface LocalRowRef {
  updatedAtMs: number;
  deletedAtMs: number | null;
  /** `${parentId}:${position}` for live rows in scoped tables; else null. */
  scopeKey: string | null;
}

export interface LocalIndex {
  rows: Record<BackupTableName, Map<string, LocalRowRef>>;
  /** Live ids per table — the only valid FK targets. */
  liveIds: Record<BackupTableName, Set<string>>;
  /**
   * `${childTable}:${parentColumn}` -> parentId -> live child ids.
   * Built from CASCADE_EDGES so a tombstoned parent can take its live
   * children with it (mirroring the repository layer's explicit cascade
   * soft-deletes).
   */
  liveChildren: Map<string, Map<string, string[]>>;
}

/** Index key for liveChildren. */
export function childIndexKey(childTable: BackupTableName, parentColumn: string): string {
  return `${childTable}:${parentColumn}`;
}

export type SkipReason = 'stale' | 'resurrected' | 'orphaned' | 'conflict';

export type ImportAction =
  | { kind: 'insert'; table: BackupTableName; id: string; row: Record<string, unknown> }
  | { kind: 'update'; table: BackupTableName; id: string; row: Record<string, unknown> }
  | { kind: 'tombstone'; table: BackupTableName; id: string }
  | { kind: 'skip'; table: BackupTableName; id: string; reason: SkipReason };

interface NormalizedRow {
  id: string;
  updatedAtMs: number;
  deletedAtMs: number | null;
  scopeKey: string | null;
  fields: Record<string, unknown>;
}

function normalizeRow(table: BackupTableName, row: Record<string, unknown>): NormalizedRow {
  const scope = POSITION_SCOPES[table];
  const deletedAtMs = parseDateMs(row['deletedAt']);
  const updatedAtMs = parseDateMs(row['updatedAt']) ?? 0;
  const scopeKey = scope && deletedAtMs === null ? scopeKeyFor(scope, row) : null;
  // Whitelist fields so a hand-edited document can't smuggle unknown columns
  // into the INSERT/UPDATE.
  const fields: Record<string, unknown> = {};
  for (const f of TABLE_FIELDS[table]) {
    if (row[f] !== undefined) fields[f] = row[f];
  }
  return { id: row['id'] as string, updatedAtMs, deletedAtMs, scopeKey, fields };
}

interface Occupant {
  id: string;
  updatedAtMs: number;
  /** Index into actions when the occupant is a planned incoming row; null for pure-local. */
  actionIdx: number | null;
  /** Whether the occupant also exists as a live row in the local DB. */
  localLive: boolean;
}

/**
 * Computes the full merge plan without touching the database.
 * Deterministic: tables in FK dependency order, rows in document order;
 * on any tie the existing / earlier-planned row wins.
 */
/**
 * Computes the full merge plan without touching the database.
 * Deterministic: tables in FK dependency order, rows in document order;
 * on any tie the existing / earlier-planned row wins.
 *
 * Per table, planning runs in two phases:
 *  1. Preliminary actions (insert/update/skip) with FK checks, but NO scope
 *     conflict resolution. Every live insert/update records its intended
 *     position key.
 *  2. Scope resolution: group live rows by intended key; the newest wins each
 *     key. Losers are skipped (pure incoming), tombstoned (local stayers), or
 *     fall back to their local key (movers whose destination was taken, when
 *     that key is free). This handles reorder-then-restore (e.g. a clean
 *     position swap) without ever losing rows or tripping the partial UNIQUE
 *     indexes at apply time.
 */
export function planImport(backup: ValidatedBackup, local: LocalIndex): ImportAction[] {
  const actions: ImportAction[] = [];
  const liveIds: Record<BackupTableName, Set<string>> = {
    workouts: new Set(local.liveIds.workouts),
    workout_exercises: new Set(local.liveIds.workout_exercises),
    sets: new Set(local.liveIds.sets),
    exercises: new Set(local.liveIds.exercises),
    routines: new Set(local.liveIds.routines),
    routine_exercises: new Set(local.liveIds.routine_exercises),
    measurements: new Set(local.liveIds.measurements),
    personal_records: new Set(local.liveIds.personal_records),
    program_enrollments: new Set(local.liveIds.program_enrollments),
    parq_screenings: new Set(local.liveIds.parq_screenings),
    program_session_states: new Set(local.liveIds.program_session_states),
  };
  // Local ids already planned for death (tombstone updates + cascades).
  // Children are always in later tables than their parents, so by the time a
  // table is planned, all cascades targeting it have been recorded here.
  const deadIds: Record<BackupTableName, Set<string>> = {
    workouts: new Set(),
    workout_exercises: new Set(),
    sets: new Set(),
    exercises: new Set(),
    routines: new Set(),
    routine_exercises: new Set(),
    measurements: new Set(),
    personal_records: new Set(),
    program_enrollments: new Set(),
    parq_screenings: new Set(),
    program_session_states: new Set(),
  };

  const markDead = (table: BackupTableName, id: string): void => {
    deadIds[table].add(id);
    liveIds[table].delete(id);
  };

  const isDead = (table: BackupTableName, id: string): boolean => {
    const ref = local.rows[table].get(id);
    return (ref !== undefined && ref.deletedAtMs !== null) || deadIds[table].has(id);
  };

  /**
   * Emits tombstones for every locally-live descendant of (table, id),
   * recursively. Mirrors the repository layer's cascade soft-deletes so an
   * imported delete can never leave live children under a tombstoned parent
   * (which "previous performance" and stats would then read as orphans).
   * Only runs for live->tombstoned transitions, never for tombstone refreshes.
   */
  const cascadeTombstone = (table: BackupTableName, id: string): void => {
    const worklist: [BackupTableName, string][] = [[table, id]];
    const seen = new Set<string>([`${table}:${id}`]);
    while (worklist.length > 0) {
      const [t, parentId] = worklist.pop() as [BackupTableName, string];
      for (const edge of CASCADE_EDGES[t]) {
        const children =
          local.liveChildren.get(childIndexKey(edge.childTable, edge.parentColumn))?.get(parentId) ?? [];
        for (const childId of children) {
          const key = `${edge.childTable}:${childId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          // Skip children already dead or already planned for death in this run.
          if (!liveIds[edge.childTable].has(childId)) continue;
          actions.push({ kind: 'tombstone', table: edge.childTable, id: childId });
          markDead(edge.childTable, childId);
          worklist.push([edge.childTable, childId]);
        }
      }
    }
  };

  interface Intent {
    row: NormalizedRow;
    actionIdx: number;
    /** Live position key after this action; null when the row won't be live. */
    intendedKey: string | null;
    intendedLive: boolean;
  }

  for (const table of BACKUP_TABLE_ORDER) {
    const scoped = POSITION_SCOPES[table] !== undefined;
    const intentById = new Map<string, Intent>();

    // ---- Phase 1: preliminary actions (no scope resolution) ----
    for (const raw of backup.tables[table]) {
      const row = normalizeRow(table, raw);
      const localRef = local.rows[table].get(row.id);

      if (localRef && isDead(table, row.id)) {
        // Local tombstone (including cascade-planned): never resurrect. A
        // newer incoming tombstone only refreshes the tombstone timestamp.
        if (row.deletedAtMs === null) {
          actions.push({ kind: 'skip', table, id: row.id, reason: 'resurrected' });
          continue;
        }
        if (row.updatedAtMs > localRef.updatedAtMs) {
          const actionIdx = actions.length;
          actions.push({ kind: 'update', table, id: row.id, row: row.fields });
          intentById.set(row.id, { row, actionIdx, intendedKey: null, intendedLive: false });
        } else {
          actions.push({ kind: 'skip', table, id: row.id, reason: 'stale' });
        }
        continue;
      }

      if (localRef && !isDead(table, row.id) && row.updatedAtMs <= localRef.updatedAtMs) {
        actions.push({ kind: 'skip', table, id: row.id, reason: 'stale' });
        continue;
      }

      // FK liveness: every referenced parent must be live — locally, or an
      // incoming row already planned as live earlier in this run.
      // NOTE: a null OPTIONAL parent only skips that one dependency (continue);
      // it must not skip the remaining checks.
      let orphaned = false;
      for (const dep of FK_DEPS[table]) {
        const parentId = row.fields[dep.column];
        if (parentId === null || parentId === undefined) {
          if (!dep.nullable) orphaned = true;
          continue;
        }
        if (typeof parentId !== 'string' || !liveIds[dep.parentTable].has(parentId)) {
          orphaned = true;
          break;
        }
      }
      if (orphaned) {
        actions.push({ kind: 'skip', table, id: row.id, reason: 'orphaned' });
        continue;
      }

      const actionIdx = actions.length;
      actions.push({ kind: localRef ? 'update' : 'insert', table, id: row.id, row: row.fields });
      const live = row.deletedAtMs === null;
      intentById.set(row.id, {
        row,
        actionIdx,
        intendedKey: live ? row.scopeKey : null,
        intendedLive: live,
      });
      if (live) {
        liveIds[table].add(row.id);
      } else {
        // Incoming tombstone applies: take the live children with it
        // (repository cascade) so no orphans survive the restore.
        markDead(table, row.id);
        cascadeTombstone(table, row.id);
      }
    }

    // ---- Phase 2: resolve position-unique scopes ----
    if (!scoped) continue;

    interface Claim {
      id: string;
      updatedAtMs: number;
      key: string;
      intent: Intent | null; // null = pure local stayer (no incoming row)
      localKey: string | null; // position key the row holds in the DB, if any
      isMover: boolean; // preliminary update moves it to a different key
    }
    const claimsByKey = new Map<string, Claim[]>();
    const addClaim = (key: string | null, c: Omit<Claim, 'key'>): void => {
      if (key === null) return;
      const list = claimsByKey.get(key) ?? [];
      list.push({ ...c, key });
      claimsByKey.set(key, list);
    };

    // Local rows claim their post-phase-1 key.
    for (const [id, ref] of local.rows[table]) {
      if (isDead(table, id)) continue;
      const intent = intentById.get(id);
      if (intent && !intent.intendedLive) continue; // tombstoned by incoming
      if (intent) {
        addClaim(intent.intendedKey, {
          id,
          updatedAtMs: intent.row.updatedAtMs,
          intent,
          localKey: ref.scopeKey,
          isMover: intent.intendedKey !== ref.scopeKey,
        });
      } else {
        addClaim(ref.scopeKey, {
          id,
          updatedAtMs: ref.updatedAtMs,
          intent: null,
          localKey: ref.scopeKey,
          isMover: false,
        });
      }
    }
    // Pure incoming inserts (no local row).
    for (const intent of intentById.values()) {
      if (!intent.intendedLive) continue;
      if (local.rows[table].get(intent.row.id) !== undefined) continue; // handled above
      addClaim(intent.intendedKey, {
        id: intent.row.id,
        updatedAtMs: intent.row.updatedAtMs,
        intent,
        localKey: null,
        isMover: false,
      });
    }

    // Newest wins each key; ties prefer the stayer (no-op beats churn).
    for (const list of claimsByKey.values()) {
      if (list.length < 2) continue;
      const rank = (c: Claim): number => (c.isMover ? 1 : 2);
      const sorted = [...list].sort((a, b) => b.updatedAtMs - a.updatedAtMs || rank(b) - rank(a));
      for (const loser of sorted.slice(1)) {
        if (loser.intent === null) {
          // Pure local stayer with no incoming row: must vacate the key.
          actions.push({ kind: 'tombstone', table, id: loser.id });
          markDead(table, loser.id);
          cascadeTombstone(table, loser.id);
        } else if (loser.localKey === null) {
          // Pure incoming row: drop it.
          actions[loser.intent.actionIdx] = { kind: 'skip', table, id: loser.id, reason: 'conflict' };
          liveIds[table].delete(loser.id);
        } else if (loser.isMover && loser.localKey !== loser.key) {
          // Lost the destination: fall back to the local key when it's free,
          // otherwise tombstone. (The local key can't be claimed by anyone
          // else — keys are unique per local row.)
          const homeClaims = claimsByKey.get(loser.localKey) ?? [];
          if (!homeClaims.some((c) => c.id !== loser.id)) {
            actions[loser.intent.actionIdx] = { kind: 'skip', table, id: loser.id, reason: 'conflict' };
            // Stays live at localKey; liveIds already contains it.
          } else {
            actions[loser.intent.actionIdx] = { kind: 'skip', table, id: loser.id, reason: 'conflict' };
            actions.push({ kind: 'tombstone', table, id: loser.id });
            markDead(table, loser.id);
            cascadeTombstone(table, loser.id);
          }
        } else {
          // Stayer (or mover whose destination is its local key): vacate.
          actions[loser.intent.actionIdx] = { kind: 'skip', table, id: loser.id, reason: 'conflict' };
          actions.push({ kind: 'tombstone', table, id: loser.id });
          markDead(table, loser.id);
          cascadeTombstone(table, loser.id);
        }
      }
    }
  }

  return actions;
}

/* ------------------------------------------------------------------ */
/* summaries                                                           */
/* ------------------------------------------------------------------ */

export interface TableImportCounts {
  inserts: number;
  updates: number;
  tombstoned: number;
  skipped: Record<SkipReason, number>;
}

export interface ImportSummary {
  tables: Record<BackupTableName, TableImportCounts>;
  totalInserts: number;
  totalUpdates: number;
  totalTombstoned: number;
  totalSkipped: number;
}

function emptyCounts(): TableImportCounts {
  return { inserts: 0, updates: 0, tombstoned: 0, skipped: { stale: 0, resurrected: 0, orphaned: 0, conflict: 0 } };
}

export function summarizePlan(actions: ImportAction[]): ImportSummary {
  const tables = {
    workouts: emptyCounts(),
    workout_exercises: emptyCounts(),
    sets: emptyCounts(),
    exercises: emptyCounts(),
    routines: emptyCounts(),
    routine_exercises: emptyCounts(),
    measurements: emptyCounts(),
    personal_records: emptyCounts(),
    program_enrollments: emptyCounts(),
    parq_screenings: emptyCounts(),
    program_session_states: emptyCounts(),
  } as Record<BackupTableName, TableImportCounts>;
  for (const a of actions) {
    const c = tables[a.table];
    if (a.kind === 'insert') c.inserts++;
    else if (a.kind === 'update') c.updates++;
    else if (a.kind === 'tombstone') c.tombstoned++;
    else c.skipped[a.reason]++;
  }
  const all = Object.values(tables) as TableImportCounts[];
  const sum = (f: (c: TableImportCounts) => number) => all.reduce((n, c) => n + f(c), 0);
  return {
    tables,
    totalInserts: sum((c) => c.inserts),
    totalUpdates: sum((c) => c.updates),
    totalTombstoned: sum((c) => c.tombstoned),
    totalSkipped: sum((c) => c.skipped.stale + c.skipped.resurrected + c.skipped.orphaned + c.skipped.conflict),
  };
}

const SKIP_LABELS: Record<SkipReason, string> = {
  stale: 'already up to date',
  resurrected: 'kept deleted (not resurrected)',
  orphaned: 'missing parent record',
  conflict: 'position conflict (newer kept)',
};

/** Human-readable dry-run report, shown before the user confirms the import. */
export function formatImportSummary(summary: ImportSummary): string {
  const lines: string[] = [];
  for (const table of BACKUP_TABLE_ORDER) {
    const c = summary.tables[table];
    const parts: string[] = [];
    if (c.inserts > 0) parts.push(`${c.inserts} new`);
    if (c.updates > 0) parts.push(`${c.updates} updated`);
    if (c.tombstoned > 0) parts.push(`${c.tombstoned} removed (position conflict)`);
    const skippedTotal = c.skipped.stale + c.skipped.resurrected + c.skipped.orphaned + c.skipped.conflict;
    if (skippedTotal > 0) {
      const reasons = (Object.keys(c.skipped) as SkipReason[])
        .filter((r) => c.skipped[r] > 0)
        .map((r) => `${c.skipped[r]} ${SKIP_LABELS[r]}`)
        .join(', ');
      parts.push(`${skippedTotal} skipped (${reasons})`);
    }
    if (parts.length > 0) lines.push(`- ${table}: ${parts.join('; ')}`);
  }
  if (lines.length === 0) return 'Nothing to import — the backup matches this device.';
  lines.unshift(
    `Import plan: ${summary.totalInserts} new, ${summary.totalUpdates} updated, ` +
      `${summary.totalTombstoned} removed, ${summary.totalSkipped} skipped.`,
  );
  return lines.join('\n');
}
