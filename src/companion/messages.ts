/**
 * Every line the companion can say. Copy lives here so tone stays in one
 * place and wiring code stays free of strings.
 *
 * Voice: short, warm, longevity-minded. No hype, no shame, no medical claims,
 * no streak pressure — it is company, not a coach shouting.
 */
import type { SayInput } from './queue';

/** The placeholder procedural character's name (a skin may rename it). */
export const COMPANION_NAME = 'Pip';

/** Raw copy. Kept as data so a future skin or translation pass can swap it. */
export const COPY = {
  welcome: 'Hi, I’m Pip. I’ll keep you company while you train.',
  sessionWaiting: (name: string | null): string =>
    name ? `${name} is ready when you are.` : 'Your session is ready when you are.',
  finished: [
    'Good work today — that’s how it compounds.',
    'Session done. Nicely paced.',
    'You showed up and did the work. Rest well.',
  ],
  setCheer: [
    'Steady. Leave a couple in the tank.',
    'Nice set.',
    'Good quality reps.',
  ],
  pr: (count: number): string =>
    count === 1
      ? 'New personal best — strong and controlled.'
      : `${count} personal bests today. Steady progress.`,
} as const;

let finishedIndex = 0;
let setIndex = 0;

/** Welcome shown when a program session is waiting on the Train tab. */
export function sessionReady(name?: string | null): SayInput {
  return {
    text: COPY.sessionWaiting(name ?? null),
    kind: 'reminder',
    mood: 'focused',
    dedupeKey: 'session-ready',
  };
}

/** A short cheer when a workout is finished. */
export function finishedCheer(): SayInput {
  const text = COPY.finished[finishedIndex % COPY.finished.length];
  finishedIndex += 1;
  return { text, kind: 'cheer', mood: 'happy', dedupeKey: 'workout-finished' };
}

/** A rare nudge while logging sets (the caller rate-limits; this de-dupes). */
export function setCheer(): SayInput {
  const text = COPY.setCheer[setIndex % COPY.setCheer.length];
  setIndex += 1;
  return { text, kind: 'cheer', mood: 'happy', dedupeKey: 'set-cheer', durationMs: 3500 };
}

/** A personal-record message. */
export function prCheer(count: number): SayInput {
  return { text: COPY.pr(count), kind: 'pr', mood: 'excited' };
}
