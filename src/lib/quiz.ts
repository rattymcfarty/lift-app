/**
 * The guided interview, as data.
 *
 * The owner asked for "a step-by-step interview that (re)builds the persona,
 * explains each question, then produces a multi-week program with plans inside it
 * … and shows the result for review before saving." The questions are the six
 * answers the generator already reads — no new model, no new data, nothing
 * intelligent happening off-device — so this module only adds the *order*, the
 * *why* for each question, and the one-line summary shown for review.
 *
 * Every "why" is a hint, not a promise: the numbers under each answer in the
 * review come from `personaImpact()` (which reads the generator's tables), so the
 * interview cannot describe a plan the generator would not build.
 */
import type { Experience, EquipmentAccess, Goal, Limitation, Profile } from '../data/profile';
import {
  EQUIPMENT_ANSWER,
  EXPERIENCE_ANSWER,
  GOAL_ANSWER,
  LIMITATION_ANSWER,
} from './personaImpact';

export type QuizKey = 'goal' | 'experience' | 'daysPerWeek' | 'minutes' | 'equipment' | 'limitations';

export interface QuizStep {
  key: QuizKey;
  /** The question, in the user's words. */
  question: string;
  /** Why it is asked, and what it will change. */
  why: string;
}

export const QUIZ_STEPS: readonly QuizStep[] = [
  {
    key: 'goal',
    question: 'What are you training for?',
    why: 'This sets the sets, reps and rest on the main lifts. Longevity keeps the volume moderate; strength trades reps for heavier work and longer rests.',
  },
  {
    key: 'experience',
    question: 'How much lifting have you done?',
    why: 'Sets, the estimated starting load and the hardest exercises allowed all follow from this. Beginner starts lighter and never sees advanced movements.',
  },
  {
    key: 'daysPerWeek',
    question: 'How many days can you train?',
    why: 'This chooses the split — two or three full-body days, or an upper/lower rotation — and gives you one editable plan per day.',
  },
  {
    key: 'minutes',
    question: 'How long is a session?',
    why: 'Sessions are capped so they fit the time you have. Extra accessories are dropped first; mobility work always stays.',
  },
  {
    key: 'equipment',
    question: 'What can you train with?',
    why: 'Only movements you can actually do are selected. Dumbbells only still gives you a complete programme.',
  },
  {
    key: 'limitations',
    question: 'Anything a joint needs to avoid?',
    why: 'Movements that stress that joint are skipped. Everything else stays, so the programme still trains the whole body.',
  },
] as const;

/** 0-based index of a step, or -1. */
export function stepIndex(key: QuizKey): number {
  return QUIZ_STEPS.findIndex((s) => s.key === key);
}

/** Fraction complete after answering step `index` (0-based), for the bar. */
export function progressAfter(index: number, total = QUIZ_STEPS.length): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (index + 1) / total));
}

/**
 * One line describing the answers, for the review header.
 * "Strength · Intermediate · 4 days a week · 60 min · Full gym · Knees protected"
 */
export function personaSummary(
  p: Pick<Profile, 'goal' | 'experience' | 'daysPerWeek' | 'minutes' | 'equipment' | 'limitations'>,
): string {
  const goal: Goal = p.goal;
  const experience: Experience = p.experience;
  const equipment: EquipmentAccess = p.equipment;
  const parts = [
    GOAL_ANSWER[goal],
    EXPERIENCE_ANSWER[experience],
    `${p.daysPerWeek} days a week`,
    `${p.minutes} min`,
    EQUIPMENT_ANSWER[equipment],
  ];
  if (p.limitations.length > 0) {
    parts.push(`${p.limitations.map((l: Limitation) => LIMITATION_ANSWER[l]).join(' + ')} protected`);
  }
  return parts.join(' · ');
}

/**
 * The plan-set name the builder writes, so the review can promise exactly what
 * will appear in the library without importing the writer.
 */
export function planName(dayNumber: number, dayName: string): string {
  return `My Plan · Day ${dayNumber} · ${dayName}`;
}
