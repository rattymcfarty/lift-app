/**
 * Workout lifecycle policy — PURE (no I/O), so every rule is unit-tested.
 *
 * Vocabulary
 *  - "last activity": the most recent real sign of life in a workout — a set
 *    logged, an exercise added/changed, or the workout screen being open and
 *    foregrounded (heartbeat). Never "when the user last opened the app".
 *  - state: `active`  → within the check-in window, leave it alone
 *           `idle`    → past the check-in window: ask the user
 *           `stale`   → past the auto-finish window: close it for them
 *
 * Closing rules (applied by lifecycle.ts)
 *  - stale + at least one logged set → FINISH, ending at the last activity
 *    (not "now"), so duration and history stay honest.
 *  - stale + nothing logged          → DISCARD (it was never a workout).
 *  - more than one open workout      → the older ones are zombies; close them
 *    by the same rules regardless of idle time (only one can be current).
 */

export interface IdlePolicy {
  /** Minutes without activity before the user is asked "still training?". */
  promptAfterMin: number;
  /** Minutes without activity before LIFT finishes the workout itself. 0 = never. */
  autoFinishAfterMin: number;
}

export const DEFAULT_IDLE_POLICY: IdlePolicy = { promptAfterMin: 45, autoFinishAfterMin: 180 };

export type IdleState = 'active' | 'idle' | 'stale';

const MIN = 60_000;

/** Keeps a policy sane: prompt ≥ 10 min; auto-finish (if on) ≥ prompt + 15 min. */
export function normalizePolicy(p: Partial<IdlePolicy> | undefined): IdlePolicy {
  const prompt = Math.max(10, Math.round(p?.promptAfterMin ?? DEFAULT_IDLE_POLICY.promptAfterMin));
  const rawAuto = Math.round(p?.autoFinishAfterMin ?? DEFAULT_IDLE_POLICY.autoFinishAfterMin);
  const auto = rawAuto <= 0 ? 0 : Math.max(prompt + 15, rawAuto);
  return { promptAfterMin: prompt, autoFinishAfterMin: auto };
}

export function idleMs(nowMs: number, lastActivityMs: number): number {
  return Math.max(0, nowMs - lastActivityMs);
}

export function classifyIdle(nowMs: number, lastActivityMs: number, policy: IdlePolicy): IdleState {
  const idle = idleMs(nowMs, lastActivityMs);
  if (policy.autoFinishAfterMin > 0 && idle >= policy.autoFinishAfterMin * MIN) return 'stale';
  if (idle >= policy.promptAfterMin * MIN) return 'idle';
  return 'active';
}

/** Latest of a list of timestamps (ms); ignores null/NaN. */
export function latestActivity(startedAtMs: number, others: ReadonlyArray<number | null | undefined>): number {
  let latest = startedAtMs;
  for (const t of others) if (typeof t === 'number' && Number.isFinite(t) && t > latest) latest = t;
  return latest;
}

/**
 * When an auto-closed workout should be recorded as ending: at the last
 * activity, but never before the start (+1 min so duration is never 0).
 */
export function autoFinishEndTime(startedAtMs: number, lastActivityMs: number): number {
  return Math.max(lastActivityMs, startedAtMs + MIN);
}

export type CloseAction = 'keep' | 'finish' | 'discard';

export interface OpenWorkoutFacts {
  id: string;
  startedAtMs: number;
  lastActivityMs: number;
  loggedSets: number;
}

export interface ReconcilePlan {
  /** The workout that stays open (newest), or null. */
  current: OpenWorkoutFacts | null;
  currentState: IdleState | null;
  /** Workouts to close now, with how. */
  closes: Array<{ workout: OpenWorkoutFacts; action: 'finish' | 'discard'; reason: 'stale' | 'duplicate'; endedAtMs: number }>;
}

/**
 * Decides everything in one pass. `open` may be in any order; the newest by
 * start time is "current".
 */
export function planReconcile(nowMs: number, open: readonly OpenWorkoutFacts[], policy: IdlePolicy): ReconcilePlan {
  const sorted = [...open].sort((a, b) => b.startedAtMs - a.startedAtMs);
  const closes: ReconcilePlan['closes'] = [];
  const closeBy = (w: OpenWorkoutFacts, reason: 'stale' | 'duplicate'): void => {
    closes.push({
      workout: w,
      action: w.loggedSets > 0 ? 'finish' : 'discard',
      reason,
      endedAtMs: autoFinishEndTime(w.startedAtMs, w.lastActivityMs),
    });
  };
  let current: OpenWorkoutFacts | null = sorted[0] ?? null;
  for (const w of sorted.slice(1)) closeBy(w, 'duplicate');
  let currentState: IdleState | null = null;
  if (current) {
    currentState = classifyIdle(nowMs, current.lastActivityMs, policy);
    if (currentState === 'stale') {
      closeBy(current, 'stale');
      current = null;
      currentState = null;
    }
  }
  return { current, currentState, closes };
}

/** "47 min", "2 h 5 min" — used in prompts and the resume card. */
export function formatIdle(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MIN));
  if (total < 1) return 'less than a minute';
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** When the two local notifications should fire for a workout (ms epoch). */
export function alertTimes(lastActivityMs: number, policy: IdlePolicy): { checkInAt: number; finishWarnAt: number | null } {
  const checkInAt = lastActivityMs + policy.promptAfterMin * MIN;
  const finishWarnAt = policy.autoFinishAfterMin > 0 ? lastActivityMs + (policy.autoFinishAfterMin - 15) * MIN : null;
  return { checkInAt, finishWarnAt };
}
