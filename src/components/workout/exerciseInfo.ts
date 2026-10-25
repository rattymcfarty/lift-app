/**
 * The content of the mid-workout exercise info sheet, as a pure function.
 *
 * Mid-set the question is not "tell me everything about this movement" — the
 * guide answers that — it is "am I doing this right, when do I stop, and what did
 * I lift last time?". This module turns the exercise row (KB prose cached on it),
 * the plan's target and the previous performance into exactly those few lines,
 * dropping any section the KB entry does not have instead of showing an empty
 * heading. Pure, so `scripts/test-exercise-info.mjs` can pin the trimming rules.
 *
 * Cues live in `kbDetailJson` (a JSON column); a malformed or missing blob must
 * degrade to "no cues", never throw mid-workout.
 */

export interface ExerciseInfoInput {
  name: string;
  /** Pre-joined muscle label, e.g. "Quadriceps, Glutes". */
  muscles?: string | null;
  /** Equipment label, e.g. "Dumbbell". */
  equipment?: string | null;
  /** KB detail cache: `cues`, `commonMistakes`, `safetyNotes`. */
  kbDetailJson?: string | null;
  /** Long-form longevity prose (markdown). */
  longevityNotes?: string | null;
  /** The plan's target line for this exercise, already formatted. */
  target?: string | null;
  /** "Last time" line, already formatted. */
  lastTime?: string | null;
  /** Most cues to show (they are a reminder, not a lesson). Default 4. */
  cueLimit?: number;
  /** Most mistakes to show. Default 2. */
  mistakeLimit?: number;
}

export interface ExerciseInfo {
  name: string;
  /** Compact facts under the name. */
  meta: string[];
  cues: string[];
  mistakes: string[];
  /** The "when to stop" line. */
  safety?: string;
  target?: string;
  lastTime?: string;
  /** One reason it is worth doing, taken from the top of the longevity prose. */
  why?: string;
}

interface KbDetail {
  cues?: unknown;
  commonMistakes?: unknown;
  safetyNotes?: unknown;
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, limit);
}

/**
 * First real sentence-group of the longevity prose: markdown headings and list
 * markers stripped, cut at a sentence end so the sheet never shows a fragment.
 */
export function firstParagraph(markdown: string | null | undefined, maxLength = 220): string | undefined {
  if (typeof markdown !== 'string') return undefined;
  const cleaned = markdown
    .split('\n')
    .map((line) => line.trim())
    // Headings label a section; the prose under them is what we want, so the
    // heading lines are dropped rather than unhashed into a fake sentence.
    .filter((line) => line.length > 0 && !/^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line.length > 0);
  if (cleaned.length === 0) return undefined;
  const text = cleaned[0];
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  // Land on a sentence end when there is one far enough in to be worth it, so the
  // sheet never shows a fragment like "First sentence is here. Second sen…".
  const minimum = Math.min(30, Math.floor(maxLength / 2));
  return lastStop >= minimum ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

export function exerciseInfo(input: ExerciseInfoInput): ExerciseInfo {
  let detail: KbDetail = {};
  try {
    detail = JSON.parse(input.kbDetailJson ?? '{}') as KbDetail;
  } catch {
    // A corrupt cache must not break the sheet.
    detail = {};
  }

  const meta = [input.muscles, input.equipment]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);

  const safety = typeof detail.safetyNotes === 'string' ? detail.safetyNotes.trim() : '';

  return {
    name: input.name,
    meta,
    cues: stringList(detail.cues, input.cueLimit ?? 4),
    mistakes: stringList(detail.commonMistakes, input.mistakeLimit ?? 2),
    safety: safety.length > 0 ? safety : undefined,
    target: input.target?.trim() ? input.target.trim() : undefined,
    lastTime: input.lastTime?.trim() ? input.lastTime.trim() : undefined,
    why: firstParagraph(input.longevityNotes),
  };
}
