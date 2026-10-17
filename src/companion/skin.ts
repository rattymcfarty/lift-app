/**
 * Recipe for mounting a companion character. `Companion.tsx` renders whatever
 * skin it is given, so a future Lottie/Rive/image-sequence character can drop
 * in without touching the overlay, the queue or the settings.
 */
import type { ComponentType } from 'react';
import type { CompanionMood } from './queue';

export interface CompanionSkinProps {
  /** Drives the character's expression and idle motion. */
  mood: CompanionMood;
  /** Rendered size in dp (square). */
  size: number;
  /** When true, skip looping motion (accessibility reduce-motion). */
  reduceMotion?: boolean;
}

/** A pluggable companion renderer. */
export type CompanionSkin = ComponentType<CompanionSkinProps>;

/**
 * Which character art the overlay renders. 'mouse' is the owner-supplied
 * mouse picture (`ImageSkin`); 'blob' is the procedural SVG creature
 * (`Creature`). Pure data — the selection is persisted with the other
 * settings and mirrored by `./style.ts`.
 */
export type CompanionStyle = 'mouse' | 'blob';

/** Every selectable style, in display order. */
export const COMPANION_STYLES: readonly CompanionStyle[] = ['mouse', 'blob'];

/** Default art: the mouse picture the owner supplied. */
export const DEFAULT_COMPANION_STYLE: CompanionStyle = 'mouse';

/** Settings-screen labels (the skin name, not the character's name). */
export const COMPANION_STYLE_LABEL: Record<CompanionStyle, string> = {
  mouse: 'Mouse',
  blob: 'Blob',
};

/** Runtime guard — persisted and imported values are untrusted. */
export function isCompanionStyle(value: unknown): value is CompanionStyle {
  return value === 'mouse' || value === 'blob';
}

/** Coerces anything (missing key, corrupt storage, hand-edited backup) to a
 *  valid style, falling back to the default. */
export function normalizeCompanionStyle(value: unknown): CompanionStyle {
  return isCompanionStyle(value) ? value : DEFAULT_COMPANION_STYLE;
}
