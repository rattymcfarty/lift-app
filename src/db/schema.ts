import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Sync-ready base columns. EVERY table gets these from day one so a future
 * sync layer never needs a key migration:
 * - id:        UUID v4 text PK, generated client-side (see ./id.ts)
 * - createdAt / updatedAt: millisecond epoch timestamps
 * - deletedAt: soft delete; NULL = live row. Sync tombstones, never drops.
 */
const syncBase = () => ({
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

/**
 * P0 scaffold tables demonstrating the convention.
 * Phase 1 replaces/extends these with the full data model (workout logging,
 * sets, routines, PRs, measurements, KB snapshot refs).
 */
export const workouts = sqliteTable('workouts', {
  ...syncBase(),
  name: text('name').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
  notes: text('notes'),
});

export const exercises = sqliteTable('exercises', {
  ...syncBase(),
  name: text('name').notNull(),
  /** JSON-encoded string arrays; normalized into join tables in P1. */
  primaryMuscles: text('primary_muscles').notNull().default('[]'),
  equipment: text('equipment').notNull().default('[]'),
  /** true = user-created; false = seeded from the KB snapshot. */
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  /** Permanent KB exercise ID when seeded from lift-kb (never renamed). */
  kbId: text('kb_id'),
});
