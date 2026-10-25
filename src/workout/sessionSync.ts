/**
 * Mirrors the open workout into the chrome's store.
 *
 * Kept apart from `activeSession.ts` so the store stays pure (and unit-testable):
 * this is the only file that reads the database for the badge. The TopBar calls it
 * on mount and on every route change — the moments a session can start or end.
 */
import { getActiveWorkout } from '../data/repositories';
import { setActiveSession } from './activeSession';

/**
 * Re-read the database. A locked/failed database keeps the last known state rather
 * than making the badge flicker; the next route change tries again.
 */
export async function refreshActiveSession(): Promise<void> {
  try {
    const active = await getActiveWorkout();
    setActiveSession(
      active
        ? {
            id: active.workout.id,
            name: active.workout.name,
            startedAt: new Date(active.workout.startedAt).getTime(),
          }
        : null,
    );
  } catch {
    // Keep the previous state.
  }
}
