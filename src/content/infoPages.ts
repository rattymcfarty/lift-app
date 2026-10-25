/**
 * Long-form explainer pages, as data.
 *
 * These are the answers to questions the app raises by using a word: why RPE has
 * a sheet (that one lives in `workout/rpeGuide.ts`, because it is tied to a
 * field) and what "plan" versus "program" means here. Keeping the copy in a
 * module — blocks, not JSX — means the words can be edited (and later moved to
 * the knowledge base, where they can be updated without an app release) without
 * touching layout, and `scripts/test-content.mjs` can check the shape of every
 * page.
 *
 * Vocabulary rule (`docs/ops/HANDOFF.md` §4): **Program** is the multi-week
 * structure, **Plan** is the schedule the user edits, **Workout** is one
 * session. Copy must match the UI or it makes the confusion worse.
 */

export type InfoBlock =
  /** Small uppercase label above a group. */
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  /** Dash-prefixed lines. */
  | { kind: 'bullets'; items: readonly string[] }
  /** The two-sided definition card (Plan vs Program). */
  | {
      kind: 'pair';
      left: { label: string; text: string };
      right: { label: string; text: string };
    }
  /** A titled list — a worked example, a week, a prescription. */
  | { kind: 'example'; title: string; items: readonly string[] }
  /** The one line worth remembering, tinted with the accent. */
  | { kind: 'callout'; text: string }
  /** A quieter aside at the end. */
  | { kind: 'note'; text: string };

export interface InfoPage {
  /** URL segment: `/learn/<slug>`. */
  slug: string;
  /** Page title (screen header). */
  title: string;
  /** One line under the title. */
  subtitle: string;
  blocks: readonly InfoBlock[];
}

const PLAN_VS_PROGRAM: InfoPage = {
  slug: 'plan-vs-program',
  title: 'Plans and Programs',
  subtitle: 'What the two words mean in LIFT',
  blocks: [
    {
      kind: 'paragraph',
      text:
        'A plan is what you do, and when you do it. A program is how your training advances over the weeks to reach a goal. The plan organises your workouts; the program decides how they progress.',
    },
    {
      kind: 'pair',
      left: {
        label: 'Plan',
        text: 'The weekly schedule — which muscles or movements you train on which days, and how it fits your week.',
      },
      right: {
        label: 'Program',
        text: 'The multi-week structure — sets, reps, intensity, progressive overload and recovery, aimed at one goal.',
      },
    },
    { kind: 'heading', text: 'The short version' },
    {
      kind: 'bullets',
      items: [
        'Plan — what you are going to do, when you are going to do it.',
        'Program — how you are going to train over time to get somewhere specific.',
      ],
    },
    { kind: 'heading', text: 'Example: building muscle' },
    {
      kind: 'paragraph',
      text: 'Your plan for the week might look like this — the schedule you actually follow:',
    },
    {
      kind: 'example',
      title: 'A weekly plan',
      items: [
        'Monday — chest and triceps',
        'Tuesday — back and biceps',
        'Wednesday — rest',
        'Thursday — legs',
        'Friday — shoulders and core',
        'Saturday and Sunday — recovery',
      ],
    },
    {
      kind: 'paragraph',
      text: 'The program goes deeper. A 12-week hypertrophy program also decides:',
    },
    {
      kind: 'example',
      title: 'What the program adds',
      items: [
        'Bench press — 4 sets of 8–12 reps',
        'Incline dumbbell press — 3 sets of 10 reps',
        'Progressive overload — gradually more weight or more reps',
        'Recovery — rest periods and how much fatigue to carry',
        'Progress — measured across the full 12 weeks',
      ],
    },
    {
      kind: 'callout',
      text: 'The plan organises your workouts. The program determines how your training progresses.',
    },
    { kind: 'heading', text: 'How LIFT uses the words' },
    {
      kind: 'bullets',
      items: [
        'A Program is the higher-level structure: a 12-week build with weeks, deloads and progression.',
        'A Plan is the schedule that organises its execution — the days and exercises you edit whenever you like.',
        'A Workout is one session of a plan, logged on the Train tab.',
      ],
    },
    {
      kind: 'note',
      text:
        'The fitness industry uses the two words interchangeably — there is no enforced distinction. LIFT keeps Program for the bigger structure and Plan for the schedule, so every screen means the same thing.',
    },
  ],
};

/** Every explainer page, by slug. */
export const INFO_PAGES: ReadonlyArray<InfoPage> = [PLAN_VS_PROGRAM];

export function infoPage(slug: string): InfoPage | undefined {
  return INFO_PAGES.find((page) => page.slug === slug);
}
