/**
 * Local backup export — privacy-safe by construction.
 *
 * R8: user data never leaves the device except through an explicit user
 * action. The export writes a JSON file to the app's private CACHE directory
 * and does NOTHING else with it — no upload, no cloud, no analytics. The
 * cache directory is excluded from platform auto-backup on both Android and
 * iOS, so unlike the live database (which needs explicit data-extraction
 * rules), an export file can never silently reach Google Drive or iCloud.
 * The file leaves the device only if the user taps "share" and picks a
 * destination in the OS share sheet. Call deleteBackupFile() after sharing
 * (or when the user dismisses it) so plaintext exports don't accumulate.
 */
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { isAvailableAsync as isSharingAvailableAsync, shareAsync } from 'expo-sharing';
import { db, runInTransaction } from '../db/client';
import {
  BACKUP_FORMAT,
  BACKUP_TABLE_ORDER,
  BACKUP_VERSION,
  type BackupTableName,
  type ValidatedBackup,
} from './backupFormat';
import { BACKUP_DB_TABLES } from './backupDb';

export interface ExportedBackup {
  uri: string;
  fileName: string;
  rowCount: number;
  exportedAt: string;
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

/**
 * Serializes the ENTIRE user database — including tombstones, so a restore
 * reproduces deletes instead of resurrecting them. Reads run inside a single
 * transaction so the table reads are a consistent snapshot (a set
 * logged mid-export can't produce orphans). Read-only; takes no write lock.
 */
export async function buildBackupDocument(): Promise<ValidatedBackup> {
  return runInTransaction(async () => {
    const tables = {} as Record<BackupTableName, Record<string, unknown>[]>;
    for (const table of BACKUP_TABLE_ORDER) {
      const rows = await db.select().from(BACKUP_DB_TABLES[table]);
      // JSON round-trip: Date -> ISO-8601 strings, and guarantees the document
      // is plain serializable data (no Drizzle proxies).
      tables[table] = JSON.parse(JSON.stringify(rows)) as Record<string, unknown>[];
    }
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      appVersion: appVersion(),
      exportedAt: new Date().toISOString(),
      tables,
    };
  });
}

function backupFileName(when: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}-` +
    `${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`;
  return `lift-backup-${stamp}.json`;
}

/**
 * Writes the backup JSON to the app's private cache directory (never
 * auto-backed-up). The caller owns the file's lifetime — share it, then
 * delete it with deleteBackupFile().
 */
export async function writeBackupFile(json: string, fileName?: string): Promise<{ uri: string; fileName: string }> {
  const name = fileName ?? backupFileName();
  const file = new File(Paths.cache, name);
  file.write(json);
  return { uri: file.uri, fileName: name };
}

/** Removes a backup file, e.g. after the user shared or dismissed it. */
export function deleteBackupFile(uri: string): void {
  new File(uri).delete();
}

/** Full export: build the document, write the file, report what was written. */
export async function exportBackup(): Promise<ExportedBackup> {
  const doc = await buildBackupDocument();
  const json = JSON.stringify(doc);
  const { uri, fileName } = await writeBackupFile(json);
  const rowCount = BACKUP_TABLE_ORDER.reduce((n, t) => n + doc.tables[t].length, 0);
  return { uri, fileName, rowCount, exportedAt: doc.exportedAt };
}

/**
 * Opens the OS share sheet for a backup file. This is the ONLY path by which
 * backup data leaves the device, and it requires an explicit user gesture.
 */
export async function shareBackup(uri: string): Promise<void> {
  if (!(await isSharingAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Share LIFT backup',
  });
}

/** Format marker, for the import side to recognize our own files quickly. */
export function isLiftBackupFileName(fileName: string): boolean {
  return fileName.startsWith('lift-backup-') && fileName.endsWith('.json');
}

// Re-export the format constants for consumers that only import from here.
export { BACKUP_FORMAT, BACKUP_VERSION };
