/**
 * The one live workout, for the chrome.
 *
 * The owner's rule (2026-10-25): an ongoing session has priority over everything
 * else — it must be visible from anywhere, and there must always be a way back to
 * it until it is finished or discarded. That needs one piece of state outside the
 * workout screen: which workout is open, when it started, and what it is called.
 *
 * The database stays the source of truth (`getActiveWorkout`); this is a small
 * external store the `TopBar` mirrors on every route change (`sessionSync.ts` owns
 * that read, so this module stays pure and testable). Screens that end a session
 * do not have to remember to clear it: finishing or discarding changes the route,
 * and the next mirror finds nothing. `setActiveSession` exists for the cases where
 * the same screen ends a workout without navigating.
 */
import { useSyncExternalStore } from 'react';

export interface ActiveSession {
  id: string;
  /** Workout name, shown in the badge's accessibility label. */
  name: string;
  /** Epoch ms. */
  startedAt: number;
}

let snapshot: ActiveSession | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setActiveSession(next: ActiveSession | null): void {
  if (next?.id === snapshot?.id && next?.startedAt === snapshot?.startedAt) return;
  snapshot = next;
  emit();
}

export function getActiveSessionSnapshot(): ActiveSession | null {
  return snapshot;
}

export function subscribeActiveSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live session, or null. Re-renders when it starts or ends. */
export function useActiveSession(): ActiveSession | null {
  return useSyncExternalStore(subscribeActiveSession, getActiveSessionSnapshot, getActiveSessionSnapshot);
}

/** "12:34" under an hour, "1:02:03" beyond it. */
export function formatElapsed(startedAt: number, now: number = Date.now()): string {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
