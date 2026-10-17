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
