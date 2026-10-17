/**
 * Reactive bridge between the persisted companion setting
 * (`src/data/settings.ts`) and the running UI.
 *
 * The setting lives in AsyncStorage; the overlay and the settings screen
 * need to react to it immediately, so this module keeps an in-memory mirror,
 * notifies subscribers, and gates the shared `companionQueue`.
 */
import { useSyncExternalStore } from 'react';
import { getSettings, setCompanionEnabledSetting } from '../data/settings';
import { companionQueue } from './queue';

/** Default ON, matching DEFAULTS.companionEnabled in settings.ts. */
let enabled = true;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function apply(next: boolean): void {
  enabled = next;
  companionQueue.setEnabled(next);
  emit();
}

export function subscribeCompanionEnabled(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot for `useSyncExternalStore` (primitive → referentially stable). */
export function getCompanionEnabled(): boolean {
  return enabled;
}

/** Reads the persisted value once. Best-effort: keeps the default on failure. */
export async function loadCompanionEnabled(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const settings = await getSettings();
    apply(settings.companionEnabled);
  } catch {
    // Keep the default (ON); the user can still toggle it.
  }
}

/** Persists and applies the setting, updating the UI immediately. */
export async function setCompanionEnabled(next: boolean): Promise<void> {
  apply(next);
  try {
    await setCompanionEnabledSetting(next);
  } catch {
    // Best effort — the in-session state already reflects the choice.
  }
}

/** Returns whether the companion is currently shown. */
export function useCompanionEnabled(): boolean {
  return useSyncExternalStore(subscribeCompanionEnabled, getCompanionEnabled, () => true);
}
