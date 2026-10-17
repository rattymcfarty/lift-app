/**
 * Reactive bridge between the persisted companion style setting
 * (`src/data/settings.ts`) and the running UI — the same shape as the
 * on/off bridge in `./enabled.ts`.
 *
 * The setting lives in AsyncStorage; the overlay needs it immediately, so
 * this module keeps an in-memory mirror and notifies subscribers. The
 * selection logic itself is pure and lives in `./skin.ts`.
 */
import { useSyncExternalStore } from 'react';
import { getSettings, setCompanionStyleSetting } from '../data/settings';
import {
  DEFAULT_COMPANION_STYLE,
  normalizeCompanionStyle,
  type CompanionStyle,
} from './skin';

/** Default 'mouse', matching DEFAULTS.companionStyle in settings.ts. */
let style: CompanionStyle = DEFAULT_COMPANION_STYLE;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function apply(next: CompanionStyle): void {
  style = next;
  emit();
}

export function subscribeCompanionStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot for `useSyncExternalStore` (a string → referentially stable). */
export function getCompanionStyle(): CompanionStyle {
  return style;
}

/** Reads the persisted value once. Best-effort: keeps the default on failure. */
export async function loadCompanionStyle(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const settings = await getSettings();
    apply(normalizeCompanionStyle(settings.companionStyle));
  } catch {
    // Keep the default (mouse); the user can still switch.
  }
}

/** Persists and applies the choice, updating the UI immediately. */
export async function setCompanionStyle(next: CompanionStyle): Promise<void> {
  const value = normalizeCompanionStyle(next);
  apply(value);
  try {
    await setCompanionStyleSetting(value);
  } catch {
    // Best effort — the in-session state already reflects the choice.
  }
}

/** Returns which art the companion currently draws. */
export function useCompanionStyle(): CompanionStyle {
  return useSyncExternalStore(subscribeCompanionStyle, getCompanionStyle, () => DEFAULT_COMPANION_STYLE);
}
