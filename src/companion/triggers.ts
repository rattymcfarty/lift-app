/**
 * Additive trigger helpers — the only places feature code talks to the
 * companion. Each is safe to call anywhere: while the companion is off,
 * `say` is a no-op, and none of these touch app logic or data.
 */
import { say } from './queue';
import { finishedCheer, prCheer, sessionReady, setCheer } from './messages';

/** Sets logged this session, for the "at most one cheer per 3 sets" rule. */
let loggedSetsSinceCheer = 0;

/** Call after a working set is logged. Cheers at most once every 3 sets. */
export function companionSetLogged(): void {
  loggedSetsSinceCheer += 1;
  if (loggedSetsSinceCheer % 3 !== 0) return;
  say(setCheer());
}

/** Call when a workout finishes: a short cheer, and reset the set counter. */
export function companionWorkoutFinished(): void {
  loggedSetsSinceCheer = 0;
  say(finishedCheer());
}

/** Call when the finished workout set new personal records. */
export function companionRecords(count: number): void {
  if (count <= 0) return;
  say(prCheer(count));
}

/** Call when the Train tab finds a program session waiting. */
export function companionSessionWaiting(name?: string | null): void {
  say(sessionReady(name));
}
