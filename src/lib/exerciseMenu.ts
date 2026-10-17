/**
 * Pure logic for the in-workout exercise actions menu.
 *
 * Five small pieces, all IO-free so they can be unit-tested in
 * scripts/test-exercise-menu.mjs and reused by the sheets/cards:
 * - `moveItem`         the reorder sheet's move function (buttons + drag).
 * - `warmupRamp`       the warmup-set ramp (50/70/85% of the first working
 *                      set, reps 5/3/2; two empty rows when no weight is known).
 * - `buildWarmupPreview` builds the editable warmup preview for the sheet:
 *                        working weight → ramp rows with rounded weights, or
 *                        bodyweight/no-weight → reps-only rows.
 * - `planSupersetLink` the superset layout: linking members makes them
 *                      adjacent in workout order (partners keep their
 *                      relative order); fewer than two members dissolves.
 * - `buildSupersetRenderGroups` groups items by supersetId with the
 *                        SUPERSET A/B/C… letters used for the tag.
 * - `REST_PRESETS`     the rest-timer choices shown in the actions sheet.
 *
 * Weights are canonical kilograms; `warmupRamp` and `buildWarmupPreview`
 * round for the *display* unit so a lb user sees clean lb numbers and a
 * kg user clean 0.5kg steps. Stored weights are always canonical kg.
 */
import type { WorkoutExerciseDetail } from '../data/repositories';
import { kgToLb, lbToKg } from './units';

/** Rest-timer presets offered in the actions sheet, in seconds. */
export const REST_PRESETS: readonly number[] = [30, 45, 60, 90, 120, 180, 300];

/** Formats seconds as a timer label: 120 -> "2:00", 45 -> "0:45". */
export function formatRestLabel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '\u2014';
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Moves one item in an array, returning a new array. `from`/`to` are clamped
 * to the array bounds; an out-of-range or no-op move returns a copy unchanged.
 * Used by the reorder sheet so the pure ordering is unit-tested and the DB
 * write stays a dumb "persist this id order".
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const n = items.length;
  if (n === 0) return [];
  if (!Number.isInteger(from) || from < 0 || from >= n) return [...items];
  const dest = Math.max(0, Math.min(n - 1, Number.isInteger(to) ? to : from));
  if (dest === from) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(dest, 0, moved);
  return next;
}

export interface WarmupRow {
  reps: string;
  /** Canonical kilograms, or null for an empty row. */
  weightKg: number | null;
}

/** Ramp percentages of the first working set's weight, ascending. */
export const WARMUP_PERCENTS: readonly number[] = [0.5, 0.7, 0.85];
/** Reps paired with each ramp percentage. */
export const WARMUP_REPS: readonly number[] = [5, 3, 2];

/** Bodyweight warmup reps (no weight column). */
export const BODYWEIGHT_WARMUP_REPS: readonly number[] = [5, 3];

/**
 * Rounds a canonical-kg ramp weight to a clean number for the display unit:
 * kg \u2192 nearest 0.5kg; lb \u2192 nearest 5lb, stored back as canonical kg.
 */
export function roundRampWeight(weightKg: number, unit: 'kg' | 'lb'): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (unit === 'lb') {
    const lb = Math.round(kgToLb(weightKg) / 5) * 5;
    return Math.round(lbToKg(Math.max(5, lb)) * 100) / 100;
  }
  return Math.round(weightKg * 2) / 2;
}

/**
 * Builds the warmup ramp ahead of the working sets.
 *
 * - Known working weight (kg > 0): three rows at 50/70/85%, reps 5/3/2,
 *   each rounded for the display unit.
 * - Unknown weight: two empty rows for the user to fill in themselves.
 *
 * Returns plain rows in canonical kg; the card converts the weight to the
 * display unit when it prefills the inputs. Never touches logged sets.
 */
export function warmupRamp(
  workingWeightKg: number | null | undefined,
  unit: 'kg' | 'lb',
): WarmupRow[] {
  if (workingWeightKg == null || !Number.isFinite(workingWeightKg) || workingWeightKg <= 0) {
    return [
      { reps: '', weightKg: null },
      { reps: '', weightKg: null },
    ];
  }
  return WARMUP_PERCENTS.map((pct, i) => ({
    reps: String(WARMUP_REPS[i]),
    weightKg: roundRampWeight(workingWeightKg * pct, unit),
  }));
}

export interface WarmupPreviewRow {
  reps: string;
  weightKg: number | null;
  /** True when this is a bodyweight/no-weight row (weight hidden, reps only). */
  isBodyweight: boolean;
}

/**
 * Builds the editable warmup preview for the "Warm-up sets" sheet.
 *
 * Inputs (in priority order for the working weight):
 *   1. firstWorkingWeightKg \u2014 the first working set's weight on the card (if typed).
 *   2. previousPerformanceWeightKg \u2014 the exercise's last logged working weight from history.
 *   3. routineTargetWeightKg \u2014 the routine/planned target weight for this exercise.
 *   4. null \u2014 no weight known.
 *
 * - If a working weight is resolved (> 0 kg): returns 3 ramp rows at 50/70/85%
 *   with reps 5/3/2, weights rounded for the display unit (kg: 0.5kg steps,
 *   lb: 5lb steps), stored as canonical kg. Duplicates (after rounding) are
 *   collapsed. Rows are never below the empty bar (0 kg).
 * - If the exercise is bodyweight (equipment includes "Bodyweight") OR
 *   `forceBodyweight` is true: returns 2 reps-only rows (5, 3), weightKg=null,
 *   isBodyweight=true.
 * - If no weight and not bodyweight: returns 2 empty rows (reps='', weightKg=null,
 *   isBodyweight=false) so the user can type their own.
 *
 * The sheet lets the user edit every row's reps and weight (when not bodyweight)
 * before tapping "Add N warm-up sets".
 */
export function buildWarmupPreview(
  options: {
    firstWorkingWeightKg?: number | null;
    previousPerformanceWeightKg?: number | null;
    routineTargetWeightKg?: number | null;
    forceBodyweight?: boolean;
    equipment?: string[]; // decoded from exercise.equipment
    unit: 'kg' | 'lb';
  }
): WarmupPreviewRow[] {
  const { firstWorkingWeightKg, previousPerformanceWeightKg, routineTargetWeightKg, forceBodyweight, equipment, unit } = options;

  const isBodyweight = forceBodyweight === true || (equipment?.includes('Bodyweight') ?? false);

  // Resolve working weight in priority order
  let workingWeightKg: number | null = null;
  if (firstWorkingWeightKg != null && Number.isFinite(firstWorkingWeightKg) && firstWorkingWeightKg > 0) {
    workingWeightKg = firstWorkingWeightKg;
  } else if (previousPerformanceWeightKg != null && Number.isFinite(previousPerformanceWeightKg) && previousPerformanceWeightKg > 0) {
    workingWeightKg = previousPerformanceWeightKg;
  } else if (routineTargetWeightKg != null && Number.isFinite(routineTargetWeightKg) && routineTargetWeightKg > 0) {
    workingWeightKg = routineTargetWeightKg;
  }

  if (isBodyweight) {
    // Bodyweight exercise or "No weight" toggle: reps-only rows
    return BODYWEIGHT_WARMUP_REPS.map((reps) => ({
      reps: String(reps),
      weightKg: null,
      isBodyweight: true,
    }));
  }

  if (workingWeightKg == null) {
    // No weight known, not bodyweight: two empty rows for user to fill
    return [
      { reps: '', weightKg: null, isBodyweight: false },
      { reps: '', weightKg: null, isBodyweight: false },
    ];
  }

  // Weighted exercise: build ramp, round, collapse duplicates, clamp to >= 0
  const rampRows = WARMUP_PERCENTS.map((pct, i) => ({
    reps: String(WARMUP_REPS[i]),
    weightKg: roundRampWeight(workingWeightKg * pct, unit),
    isBodyweight: false,
  }));

  // Collapse duplicates (same rounded weight and reps) and ensure >= 0
  const seen = new Set<string>();
  const unique: WarmupPreviewRow[] = [];
  for (const row of rampRows) {
    const w = Math.max(0, row.weightKg ?? 0);
    const key = `${w}:${row.reps}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ ...row, weightKg: w });
    }
  }
  return unique;
}

/**
 * Given a superset group's members (in position order) and their logged-set
 * counts, returns the next member to focus and whether a rest timer should start.
 *
 * - Members work in rounds: each member logs one set per round.
 * - After logging a set, focus moves to the next member that has logged fewer
 *   sets than the current round leader.
 * - Rest timer starts ONLY after the LAST member of the group completes the
 *   current round (i.e., all members have the same logged count).
 *
 * @param members Array of workout exercise IDs in position order.
 * @param loggedCounts Map of workoutExerciseId -> number of logged (completed) sets.
 * @returns { nextMemberId: string | null; startRest: boolean }
 */
export function getSupersetNextAction(
  members: readonly string[],
  loggedCounts: ReadonlyMap<string, number>
): { nextMemberId: string | null; startRest: boolean } {
  if (members.length < 2) return { nextMemberId: null, startRest: false };

  const counts = members.map((id) => loggedCounts.get(id) ?? 0);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  // If all members have the same count AND at least one set has been logged,
  // the round is complete -> rest starts, next focus is the first member for the next round.
  if (minCount === maxCount && minCount > 0) {
    return { nextMemberId: members[0], startRest: true };
  }

  // Find the first member that hasn't caught up to the max count yet.
  for (const id of members) {
    if ((loggedCounts.get(id) ?? 0) < maxCount) {
      return { nextMemberId: id, startRest: false };
    }
  }

  // All counts equal but zero: no round completed yet, start at first member, no rest.
  return { nextMemberId: members[0], startRest: false };
}

/* ------------------------------------------------------------------ */
/* superset layout + render grouping                                   */
/* ------------------------------------------------------------------ */

/** The minimal live-row shape the superset layout works on. */
export interface SupersetLayoutItem {
  id: string;
  position: number;
  supersetId: string | null;
}

export interface SupersetLinkPlan {
  /** Every live workout-exercise id in its new order (positions are 0..n-1). */
  orderedIds: string[];
  /** The superset's members in their final relative order (empty when dissolving). */
  memberIds: string[];
  /** true when the group drops below two members and must be dissolved. */
  dissolve: boolean;
}

/**
 * Computes the new workout order after linking `memberIds` into one superset.
 *
 * The members become ONE contiguous block: every non-member keeps its place
 * relative to the others, and the block is anchored at the reference point —
 * the tapped exercise for a fresh group, or the first (lowest-position)
 * existing member when adding to an existing group. Partners keep their
 * relative order. Fewer than two members dissolves the group instead
 * (orderedIds is then the current order, untouched).
 *
 * Precondition (guaranteed by the sheet): every member is either ungrouped
 * or shares one supersetId. Callers re-plan from live rows, so no writes
 * happen here.
 *
 * @throws RangeError if the anchor or any member is not a live row, or the
 *         anchor is not among the members.
 */
export function planSupersetLink(
  items: readonly SupersetLayoutItem[],
  anchorId: string,
  memberIds: readonly string[],
): SupersetLinkPlan {
  const byId = new Map(items.map((i) => [i.id, i]));
  const anchor = byId.get(anchorId);
  if (!anchor) throw new RangeError('anchor exercise is not in this workout');
  const members = [...new Set(memberIds)];
  if (!members.includes(anchorId)) {
    throw new RangeError('the anchor exercise must be a member of the superset');
  }
  for (const id of members) {
    if (!byId.has(id)) throw new RangeError('superset member is not in this workout');
  }

  const currentOrder = [...items].sort((a, b) => a.position - b.position).map((i) => i.id);

  if (members.length < 2) {
    return { orderedIds: currentOrder, memberIds: [], dissolve: true };
  }

  // Existing block anchor: the lowest-position member that already carries a
  // supersetId keeps the current group in place (partners are appended after
  // it); a fresh group anchors at the tapped exercise so the chosen partners
  // move directly after it.
  const reference =
    members
      .map((id) => byId.get(id)!)
      .filter((i) => i.supersetId != null)
      .sort((a, b) => a.position - b.position)[0]?.id ?? anchorId;

  const memberSet = new Set(members);
  const memberOrder = members
    .map((id) => byId.get(id)!)
    .sort((a, b) => a.position - b.position)
    .map((i) => i.id);
  const refIndex = currentOrder.indexOf(reference);
  const others = currentOrder.filter((id) => !memberSet.has(id));
  const orderedIds = [...others.slice(0, refIndex), ...memberOrder, ...others.slice(refIndex)];
  return { orderedIds, memberIds: memberOrder, dissolve: false };
}

/** A render group: one superset (labelled) or a singleton (label ''). */
export interface SupersetRenderGroup {
  supersetId: string | null;
  label: string;
  items: WorkoutExerciseDetail[];
}

/**
 * Groups workout items by supersetId, preserving position order, and assigns
 * each group its letter (SUPERSET A, B, C… by position order). Singletons get
 * an empty label. This is the pure behind-the-scene version of the list the
 * workout screen renders (left accent bar + tag on the first card).
 */
export function buildSupersetRenderGroups(
  items: readonly WorkoutExerciseDetail[],
): SupersetRenderGroup[] {
  const groups: SupersetRenderGroup[] = [];
  let letter = 0;
  for (const item of items) {
    const sid = item.workoutExercise.supersetId;
    if (sid == null) {
      groups.push({ supersetId: null, label: '', items: [item] });
      continue;
    }
    let group = groups.find((g) => g.supersetId === sid);
    if (!group) {
      const label = letter < 26
        ? `SUPERSET ${String.fromCharCode(65 + letter)}`
        : `SUPERSET ${letter + 1}`;
      letter += 1;
      group = { supersetId: sid, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** The tag pill text for a superset group's first card, e.g. "SUPERSET A · 2". */
export function supersetTagText(label: string, memberCount: number): string {
  return `${label} · ${memberCount}`;
}

/**
 * Given a superset group's members (in position order), their logged-set counts,
 * and the ID of the member that was just logged, returns the next member to focus.
 * Returns null if no member needs focus (e.g., single-member group).
 *
 * Members work in rounds: each member logs one set per round.
 * After logging a set, focus moves to the next member (wrapping) that has logged
 * fewer sets than the current round leader.
 */
export function nextSupersetMember(
  members: readonly string[],
  loggedCounts: ReadonlyMap<string, number>,
  justLoggedId: string
): string | null {
  if (members.length < 2) return null;

  const counts = members.map((id) => loggedCounts.get(id) ?? 0);
  const maxCount = Math.max(...counts);

  // Find the index of the member that was just logged.
  const justLoggedIndex = members.indexOf(justLoggedId);
  if (justLoggedIndex === -1) return null;

  // Search starting from the NEXT member (wrapping around).
  for (let offset = 1; offset <= members.length; offset++) {
    const idx = (justLoggedIndex + offset) % members.length;
    const id = members[idx];
    if ((loggedCounts.get(id) ?? 0) < maxCount) {
      return id;
    }
  }

  // All caught up: round complete, next round starts at first member.
  return members[0];
}

/**
 * Returns true if a rest timer should start after the given member logs a set.
 * Rest starts ONLY after the LAST member of the group (in position order)
 * completes the current round (i.e., all members have the same logged count,
 * and at least one set has been logged).
 * For ungrouped exercises (members.length < 2), returns false — the caller
 * handles ungrouped rest logic separately.
 */
export function shouldStartRest(
  members: readonly string[],
  loggedCounts: ReadonlyMap<string, number>,
  justLoggedId: string
): boolean {
  if (members.length < 2) return false;

  // Only the last member in position order can trigger rest.
  const lastMemberId = members[members.length - 1];
  if (justLoggedId !== lastMemberId) return false;

  const counts = members.map((id) => loggedCounts.get(id) ?? 0);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  // Round complete: all members have the same count AND at least one set logged.
  return minCount === maxCount && minCount > 0;
}