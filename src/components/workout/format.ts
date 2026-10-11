/**
 * Formatting + input-parsing helpers for the workout logging UI.
 *
 * Pure functions only — no React, no theme, no DB. Unit-testable.
 * Canonical units everywhere: kg for weight, seconds for duration.
 */

import type { LoggedSet } from '../../db/schema';
import type { PreviousPerformance } from '../../data/repositories';

/** 60 -> "60", 62.5 -> "62.5", 62.55 -> "62.55" (no trailing zeros). */
export function trimNumber(n: number): string {
  return String(Number(n.toFixed(2)));
}

export interface SetSummaryInput {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  rpe?: number | null;
}

/** Compact one-line set summary: "8 × 60 kg · RPE 8", "8 reps", "90s". */
export function formatSetSummary(s: SetSummaryInput): string {
  const parts: string[] = [];
  if (s.reps != null && s.weightKg != null) {
    parts.push(`${s.reps} × ${trimNumber(s.weightKg)} kg`);
  } else if (s.reps != null) {
    parts.push(`${s.reps} rep${s.reps === 1 ? '' : 's'}`);
  } else if (s.weightKg != null) {
    parts.push(`${trimNumber(s.weightKg)} kg`);
  }
  if (s.durationSeconds != null) parts.push(`${s.durationSeconds}s`);
  if (s.distanceM != null) parts.push(`${trimNumber(s.distanceM)} m`);
  if (s.rpe != null) parts.push(`RPE ${trimNumber(s.rpe)}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** Milliseconds -> "4:32" or "1:02:03". Never negative. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "Oct 11, 2026" — local timezone, no network. */
export function formatWorkoutDay(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Total volume in kg across sets: sum(reps × weightKg), skipping partial rows. */
export function totalVolumeKg(sets: Pick<LoggedSet, 'reps' | 'weightKg'>[]): number {
  return sets.reduce((acc, s) => {
    if (s.reps == null || s.weightKg == null) return acc;
    return acc + s.reps * s.weightKg;
  }, 0);
}

/**
 * "Last time" line for an exercise: "Last time · Oct 3: 8×60, 8×60, 6×62.5".
 * Returns null when there is no previous performance to show.
 */
export function formatPreviousPerformance(prev: PreviousPerformance | null): string | null {
  if (!prev || prev.sets.length === 0) return null;
  const day = formatWorkoutDay(new Date(prev.workout.startedAt));
  const sets = prev.sets.map(formatSetSummary).join(', ');
  return `Last time · ${day}: ${sets}`;
}

/**
 * Parses a user-typed number field.
 * Blank -> undefined (field left empty), valid -> number,
 * garbage -> NaN (caller shows an inline error; repositories would throw).
 * Accepts comma decimals ("62,5"). Strict decimal shape: Number() would also
 * accept "0x10", "1e3" and "Infinity", which are never valid gym input.
 */
export function parseUserNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  // Strict decimal shape (".5" and "62." allowed): Number() would also
  // accept "0x10", "1e3" and "Infinity", which are never valid gym input.
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Integer variant of parseUserNumber (reps, RPE-as-int is not used — RPE allows .5). */
export function parseUserInt(text: string): number | undefined {
  const n = parseUserNumber(text);
  if (n === undefined || Number.isNaN(n)) return n;
  return Number.isInteger(n) ? n : NaN;
}
