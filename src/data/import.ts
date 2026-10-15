/**
 * Local backup import — validate first, dry-run, then merge.
 *
 * Flow the UI should implement:
 *   1. pickBackupFile()            -> uri | null (user cancelled)
 *   2. dryRunImport(uri)           -> { ok, summaryText } | { ok: false, errors }
 *   3. show summaryText, ask "Import?"
 *   4. importBackup(uri)           -> final ImportSummary (re-plans fresh)
 *   5. deleteBackupFile(uri)       -> clean up the picked copy
 *
 * Safety properties:
 * - Nothing is written until the document validates (shape, version, dates,
 *   field types, required fields, no duplicate ids).
 * - The merge is a single transaction: any failure rolls everything back.
 * - Merge rules live in backupFormat.ts (pure, unit-tested via
 *   `npm run test:backup`): newer updatedAt wins, tombstones are terminal
 *   and cascade to live children, FK orphans are skipped, position-unique
 *   collisions resolve newest-wins with the loser tombstoned.
 * - Media URLs from a backup are re-checked against the KB allowlist: a
 *   crafted file can't smuggle in a third-party host that would learn which
 *   exercises the user opens (R8).
 * - Writes go through withWriteLock (never nested — this module calls the
 *   Drizzle client directly, never the repository functions).
 */
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { and, eq, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db, runInTransaction } from '../db/client';
import { withWriteLock } from './repositories';
import { restoreAppData } from './appData';
import {
  BACKUP_TABLE_ORDER,
  childIndexKey,
  formatImportSummary,
  getCascadeEdges,
  getScopeKey,
  isAllowedKbMediaUrl,
  isDateField,
  planImport,
  summarizePlan,
  TABLE_FIELDS,
  validateBackup,
  type BackupTableName,
  type BackupValidationError,
  type ImportAction,
  type ImportSummary,
  type LocalIndex,
  type LocalRowRef,
  type ValidatedBackup,
} from './backupFormat';
import { BACKUP_DB_TABLES } from './backupDb';
import { deleteBackupFile } from './export';

export { deleteBackupFile };

export class BackupImportError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors[0] ?? 'Invalid backup file');
    this.name = 'BackupImportError';
    this.errors = errors;
  }
}

export function formatValidationErrors(errors: BackupValidationError[]): string[] {
  return errors.map((e) => {
    const where = e.table ? `${e.table}${e.index !== undefined ? `[${e.index}]` : ''}: ` : '';
    return `${where}${e.message}`;
  });
}

/**
 * OS file picker for a backup file; null when the user cancels.
 *
 * Accepts any MIME type (not just application/json): Android content
 * providers (Drive, Downloads, messaging apps) commonly label JSON files as
 * application/octet-stream or text/plain, which would grey out real backups.
 * Non-JSON picks fail cleanly at the parse step with a readable error.
 */
export async function pickBackupFile(): Promise<string | null> {
  const result = await getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

async function readAndValidate(uri: string): Promise<ValidatedBackup> {
  let doc: unknown;
  try {
    doc = JSON.parse(await new File(uri).text());
  } catch {
    throw new BackupImportError(['The selected file is not valid JSON.']);
  }
  const validation = validateBackup(doc);
  if (!validation.valid) {
    throw new BackupImportError(formatValidationErrors(validation.errors));
  }
  return validation.backup;
}

/** Minimal local snapshot for merge planning: sync columns + scope keys + parent links. */
async function buildLocalIndex(): Promise<LocalIndex> {
  const rows = {} as Record<BackupTableName, Map<string, LocalRowRef>>;
  const liveIds = {} as Record<BackupTableName, Set<string>>;
  const liveChildren = new Map<string, Map<string, string[]>>();
  for (const parentTable of BACKUP_TABLE_ORDER) {
    for (const edge of getCascadeEdges(parentTable)) {
      liveChildren.set(childIndexKey(edge.childTable, edge.parentColumn), new Map());
    }
  }
  for (const table of BACKUP_TABLE_ORDER) {
    // Full-row select: single-user data volumes are small, and this avoids a
    // per-table column projection that would rot when the schema grows.
    const list = (await db.select().from(BACKUP_DB_TABLES[table])) as Record<string, unknown>[];
    const byId = new Map<string, LocalRowRef>();
    const live = new Set<string>();
    for (const row of list) {
      const id = row['id'] as string;
      const updatedAt = row['updatedAt'];
      const deletedAt = row['deletedAt'];
      const isLive = deletedAt === null || deletedAt === undefined;
      byId.set(id, {
        updatedAtMs: updatedAt instanceof Date ? updatedAt.getTime() : 0,
        deletedAtMs: deletedAt instanceof Date ? deletedAt.getTime() : null,
        scopeKey: getScopeKey(table, row),
      });
      if (!isLive) continue;
      live.add(id);
      for (const [key, byParent] of liveChildren) {
        const [childTable, parentColumn] = key.split(':');
        if (childTable !== table) continue;
        const pid = row[parentColumn];
        if (typeof pid !== 'string') continue;
        const siblings = byParent.get(pid) ?? [];
        siblings.push(id);
        byParent.set(pid, siblings);
      }
    }
    rows[table] = byId;
    liveIds[table] = live;
  }
  return { rows, liveIds, liveChildren };
}

/**
 * Whitelisted fields with ISO date strings converted back to Dates.
 * Media URLs are re-checked against the KB allowlist: a disallowed host is
 * stripped (nulled), never stored — see schema.ts privacy note.
 */
function toDbRow(table: BackupTableName, fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of TABLE_FIELDS[table]) {
    const v = fields[f];
    if (v === undefined) continue;
    if ((f === 'mediaImageUrl' || f === 'mediaVideoUrl') && !isAllowedKbMediaUrl(v as string | null)) {
      out[f] = null;
      continue;
    }
    out[f] = isDateField(table, f) && v !== null ? new Date(v as string | number) : v;
  }
  return out;
}

/**
 * Single boundary cast for the heterogeneous table map. Every backup table
 * shares the sync-base shape (text id PK, timestamp_ms dates); per-table
 * field correctness is enforced by TABLE_FIELDS (whitelist) + validateBackup
 * (types), both unit-tested — so the Drizzle calls below can't silently
 * write a wrong-shaped row.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

function anyTable(t: SQLiteTable): AnyTable {
  return t as AnyTable;
}

async function applyActions(actions: ImportAction[]): Promise<void> {
  // Tombstones first: they vacate position-unique slots before the rows that
  // won those slots are inserted/updated (partial UNIQUE index is per-statement).
  for (const a of actions) {
    if (a.kind !== 'tombstone') continue;
    const t = anyTable(BACKUP_DB_TABLES[a.table]);
    const now = new Date();
    // Guarded by deletedAt IS NULL so a redundant tombstone is a no-op.
    await db.update(t).set({ deletedAt: now, updatedAt: now }).where(and(eq(t.id, a.id), isNull(t.deletedAt)));
  }
  for (const table of BACKUP_TABLE_ORDER) {
    const t = anyTable(BACKUP_DB_TABLES[table]);
    for (const a of actions) {
      if (a.table !== table) continue;
      if (a.kind === 'insert') {
        await db.insert(t).values(toDbRow(table, a.row));
      } else if (a.kind === 'update') {
        const { id: _id, ...rest } = toDbRow(table, a.row);
        await db.update(t).set(rest).where(eq(t.id, a.id));
      }
    }
  }
}

export type DryRunResult =
  | { ok: true; summary: ImportSummary; summaryText: string }
  | { ok: false; errors: string[] };

/**
 * Validates the file and computes the merge plan WITHOUT writing anything.
 * Show summaryText to the user and only call importBackup() on confirmation.
 */
export async function dryRunImport(uri: string): Promise<DryRunResult> {
  let backup: ValidatedBackup;
  try {
    backup = await readAndValidate(uri);
  } catch (e) {
    if (e instanceof BackupImportError) return { ok: false, errors: e.errors };
    throw e;
  }
  const local = await buildLocalIndex();
  const summary = summarizePlan(planImport(backup, local));
  return { ok: true, summary, summaryText: formatImportSummary(summary) };
}

/**
 * Validates, re-plans against the CURRENT database state, and applies the
 * merge in a single transaction. Serialized with all other writes.
 */
export async function importBackup(uri: string): Promise<ImportSummary> {
  const backup = await readAndValidate(uri);
  const summary = await withWriteLock(async () =>
    runInTransaction(async () => {
      const local = await buildLocalIndex();
      const actions = planImport(backup, local);
      await applyActions(actions);
      return summarizePlan(actions);
    }),
  );
  // Device configuration (profile, settings, reminders) rides along.
  await restoreAppData(backup.appData);
  return summary;
}
