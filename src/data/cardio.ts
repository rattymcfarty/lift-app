/**
 * Cardio pillar data access (P4b) — manual cardio-minutes logging.
 *
 * The v1 pillar model is strength (derived from training volume) + cardio
 * (manual entry). This module owns the cardio_logs table. Separate module
 * (not repositories.ts) so parallel workstreams can't clobber each other.
 */
import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { cardioLogs, type CardioLog, type NewCardioLog } from '../db/schema';
import { withWriteLock } from './repositories';

export type { CardioLog };

function assertCardioMinutes(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0 || value > 1440) {
    throw new Error(`${field} must be a whole number of minutes between 1 and 1440`);
  }
}

/** Log a cardio session. Returns the new row id. */
export async function logCardio(input: {
  minutes: number;
  activity?: string;
  loggedAt?: Date;
  notes?: string;
}): Promise<string> {
  assertCardioMinutes(input.minutes, 'minutes');
  const loggedAt = input.loggedAt ?? new Date();
  if (!(loggedAt instanceof Date) || Number.isNaN(loggedAt.getTime())) {
    throw new Error('loggedAt must be a valid Date');
  }
  return withWriteLock(async () => {
    const values: NewCardioLog = {
      minutes: input.minutes,
      activity: input.activity?.trim() || null,
      loggedAt,
      notes: input.notes?.trim() || null,
    };
    const [row] = await db.insert(cardioLogs).values(values).returning({ id: cardioLogs.id });
    return row.id;
  });
}

/** Recent cardio logs, newest first. */
export async function listCardioLogs(limit = 100): Promise<CardioLog[]> {
  return db
    .select()
    .from(cardioLogs)
    .where(isNull(cardioLogs.deletedAt))
    .orderBy(desc(cardioLogs.loggedAt))
    .limit(limit);
}

/** Total cardio minutes logged in [start, end). */
export async function cardioMinutesInRange(start: Date, end: Date): Promise<number> {
  const rows = await db
    .select({ minutes: cardioLogs.minutes })
    .from(cardioLogs)
    .where(
      and(
        isNull(cardioLogs.deletedAt),
        gte(cardioLogs.loggedAt, start),
        lt(cardioLogs.loggedAt, end),
      ),
    );
  return rows.reduce((sum, r) => sum + r.minutes, 0);
}

/** Soft-delete a cardio log. */
export async function softDeleteCardioLog(id: string): Promise<void> {
  return withWriteLock(async () => {
    await db
      .update(cardioLogs)
      .set({ deletedAt: new Date() })
      .where(and(eq(cardioLogs.id, id), isNull(cardioLogs.deletedAt)));
  });
}
