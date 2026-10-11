import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const expoDb = openDatabaseSync('lift.db');

// SQLite ships with foreign-key enforcement OFF; without this PRAGMA every
// .references() in the schema (and onDelete cascade/set-null) is decoration.
// Per-connection setting — this module owns the single connection.
expoDb.execSync('PRAGMA foreign_keys = ON');

export const db = drizzle(expoDb, { schema });

export type DB = typeof db;

/**
 * Runs an async function inside a REAL transaction.
 *
 * WARNING: drizzle's db.transaction() is synchronous in the expo-sqlite
 * driver (drizzle-orm/expo-sqlite/session.js): it issues BEGIN, invokes the
 * callback, gets a Promise back, and COMMITs immediately — every `await tx…`
 * then runs in autocommit AFTER the commit, and rejections never roll back.
 * Never pass an async callback to db.transaction(). This helper uses the raw
 * handle's withTransactionAsync, which genuinely awaits the task.
 */
export async function runInTransaction<T>(task: () => Promise<T>): Promise<T> {
  let result!: T;
  await expoDb.withTransactionAsync(async () => {
    result = await task();
  });
  return result;
}

/** Raw handle — for PRAGMA toggles around migrations. Prefer db/runInTransaction. */
export function getRawDb() {
  return expoDb;
}
