/**
 * React binding for the companion queue. `useSyncExternalStore` keeps the
 * overlay in step with `say()`/`dismiss()` without any provider.
 */
import { useSyncExternalStore } from 'react';
import { companionQueue, type CompanionMessage } from './queue';

/** The message currently on screen, or null. */
export function useCompanionMessage(): CompanionMessage | null {
  return useSyncExternalStore(
    companionQueue.subscribe,
    () => companionQueue.getSnapshot().current,
    () => null,
  );
}
