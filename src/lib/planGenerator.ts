/**
 * Rule-based personal plan generator — pure, deterministic, no I/O.
 *
 * Input: the user's profile + the exercise catalogue. Output: training days
 * made of ordinary exercise targets that get saved as normal, fully
 * editable plans. It is NOT a black box: every choice comes from the slot
 * tables below (movement vocabulary for a long, healthy training life:
 * squat · hinge · push · pull · lunge · carry · core · mobility), filtered
 * by the equipment the user has, their experience, and any limitations.
 *
 * Starting loads are deliberately conservative fractions of bodyweight and
 * are labelled as estimates in the notes.
 */

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'longevity' | 'strength' | 'muscle' | 'fitness';
export type EquipmentAccess = 'full' | 'dumbbells' | 'bodyweight';
export type Limitation = 'knees' | 'lowerBack' | 'shoulders';

export interface GeneratorProfile {
  experience: Experience;
  goal: Goal;
  daysPerWeek: 2 | 3 | 4 | 5;
  minutes: 30 | 45 | 60 | 75;
  equipment: EquipmentAccess;
  limitations: Limitation[];
  weightKg: number | null;
}

export interface CatalogueExercise {
  id: string;
  name: string;
  equipment: string[];
  movementPattern: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface PlannedItem {
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds: number;
  weightKg?: number;
  notes?: string;
}

export interface PlannedDay {
  name: string;
  items: PlannedItem[];
}

type Slot =
  | 'squat' | 'hinge' | 'pushH' | 'pullH' | 'pushV' | 'pullV'
  | 'lunge' | 'carry' | 'core' | 'mobility' | 'upperBack';

/** Ordered preferences per slot (first valid wins; variants rotate by day). */
export const SLOT_PREFERENCES: Record<Slot, readonly string[]> = {
  squat: ['goblet-squat', 'leg-press', 'smith-machine-squat', 'barbell-squat', 'bodyweight-squat', 'hack-squat'],
  hinge: ['db-romanian-deadlift', 'romanian-deadlift', 'hip-thrust-bw', 'glute-bridge-bw', 'kettlebell-swing', 'dumbbell-deadlift'],
  pushH: ['dumbbell-bench-press', 'push-up', 'chest-press-machine', 'bench-press-powerlifting'],
  pullH: ['bent-over-two-dumbbell-row', 'seated-cable-rows', 'inverted-row', 'single-arm-row-cable', 'high-row', 'bent-over-barbell-row'],
  pushV: ['dumbbell-overhead-press', 'landmine-press', 'standing-shoulder-press-dumbbell', 'seated-shoulder-press-dumbbell', 'shoulder-press-plate-loaded', 'leverage-shoulder-press', 'overhead-press', 'pike-push-up'],
  pullV: ['underhand-cable-pulldowns', 'lat-pulldown-neutral-grip', 'chin-up', 'pull-up-neutral-grip-bodyweight', 'machine-pullover'],
  lunge: ['reverse-lunge', 'dumbbell-lunges', 'split-squat-with-dumbbells', 'split-squat', 'kettlebell-lunge', 'barbell-walking-lunge'],
  carry: ['farmer-carry', 'suitcase-carry', 'goblet-march', 'overhead-carry'],
  core: ['dead-bug', 'plank', 'side-plank', 'hollow-hold', 'pallof-press', 'wall-press-dead-bug'],
  mobility: ['worlds-greatest-stretch', 'cat-cow-stretch', '90-90-hip-flow', 'hip-openers'],
  upperBack: ['face-pull', 'pull-apart-cable', 'band-pull-apart'],
};

const SLOT_FALLBACK: Record<Slot, { pattern: string; category?: string }> = {
  squat: { pattern: 'squat', category: 'Squat' },
  hinge: { pattern: 'hinge', category: 'Hinge' },
  pushH: { pattern: 'push', category: 'Horizontal Push' },
  pullH: { pattern: 'pull', category: 'Horizontal Pull' },
  pushV: { pattern: 'push', category: 'Vertical Push' },
  pullV: { pattern: 'pull', category: 'Vertical Pull' },
  lunge: { pattern: 'lunge' },
  carry: { pattern: 'carry' },
  core: { pattern: 'core', category: 'Core' },
  mobility: { pattern: 'mobility', category: 'Mobility' },
  upperBack: { pattern: 'pull', category: 'Horizontal Pull' },
};

const DAYS: Record<number, ReadonlyArray<{ name: string; slots: Slot[] }>> = {
  2: [
    { name: 'Full body A', slots: ['squat', 'pushH', 'pullH', 'hinge', 'core', 'mobility'] },
    { name: 'Full body B', slots: ['lunge', 'pushV', 'pullV', 'hinge', 'carry', 'mobility'] },
  ],
  3: [
    { name: 'Full body A', slots: ['squat', 'pushH', 'pullH', 'hinge', 'core', 'mobility'] },
    { name: 'Full body B', slots: ['lunge', 'pushV', 'pullV', 'hinge', 'carry', 'mobility'] },
    { name: 'Full body C', slots: ['squat', 'pushH', 'pullH', 'hinge', 'core', 'mobility'] },
  ],
  4: [
    { name: 'Upper A', slots: ['pushH', 'pullH', 'pushV', 'pullV', 'upperBack', 'mobility'] },
    { name: 'Lower A', slots: ['squat', 'hinge', 'lunge', 'carry', 'core', 'mobility'] },
    { name: 'Upper B', slots: ['pushV', 'pullV', 'pushH', 'pullH', 'core', 'mobility'] },
    { name: 'Lower B', slots: ['hinge', 'squat', 'lunge', 'carry', 'core', 'mobility'] },
  ],
  5: [
    { name: 'Upper A', slots: ['pushH', 'pullH', 'pushV', 'pullV', 'upperBack', 'mobility'] },
    { name: 'Lower A', slots: ['squat', 'hinge', 'lunge', 'carry', 'core', 'mobility'] },
    { name: 'Full body', slots: ['squat', 'pushH', 'pullH', 'hinge', 'core', 'mobility'] },
    { name: 'Upper B', slots: ['pushV', 'pullV', 'pushH', 'pullH', 'core', 'mobility'] },
    { name: 'Lower B', slots: ['hinge', 'squat', 'lunge', 'carry', 'core', 'mobility'] },
  ],
};

const MAX_ITEMS: Record<number, number> = { 30: 4, 45: 5, 60: 6, 75: 7 };
const RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;
const ALLOWED_EQUIPMENT: Record<EquipmentAccess, readonly string[] | null> = {
  full: null,
  dumbbells: ['Dumbbell', 'Kettlebell', 'Bodyweight'],
  bodyweight: ['Bodyweight'],
};
/** Specialist variants never chosen by the fallback. */
const FALLBACK_EXCLUDE = /weighted|assisted|partial|paused|deficit|behind|isometric|tempo|chains|speed|halting|banded|single-leg|one-arm|kroc|gorilla/i;
const AVOID: Record<Limitation, RegExp> = {
  knees: /jump|hop|box|sissy|pistol|lunge|split-squat|thruster|burpee|skater|plyo/i,
  lowerBack: /deadlift|good-morning|back-extension|hyperextension|swing|snatch|clean|superman|bent-over-barbell|barbell-row|sumo|block-pull/i,
  shoulders: /overhead|shoulder-press|handstand|behind-the-neck|dip|upright|military|push-press|arnold|pull-up/i,
};

/** Fraction of bodyweight for a conservative first working load. */
const LOAD_RATIO: Record<string, number> = {
  'goblet-squat': 0.2,
  'barbell-squat': 0.4,
  'leg-press': 0.7,
  'romanian-deadlift': 0.14,
  'kettlebell-swing': 0.18,
  'dumbbell-bench-press': 0.14,
  'chest-press-machine': 0.35,
  'bench-press-powerlifting': 0.35,
  'bent-over-two-dumbbell-row': 0.12,
  'seated-cable-rows': 0.3,
  'bent-over-barbell-row': 0.3,
  'standing-shoulder-press-dumbbell': 0.08,
  'seated-shoulder-press-dumbbell': 0.08,
  'overhead-press': 0.09,
  'lat-pulldown-neutral-grip': 0.4,
  'reverse-lunge': 0.1,
  'split-squat-with-dumbbells': 0.1,
  'farmer-carry': 0.25,
  'suitcase-carry': 0.25,
  'farmers-walk-weighted': 0.25,
  'face-pull': 0.1,
  'db-romanian-deadlift': 0.14,
  'dumbbell-lunges': 0.1,
  'dumbbell-overhead-press': 0.08,
  'landmine-press': 0.1,
  'underhand-cable-pulldowns': 0.4,
  'smith-machine-squat': 0.35,
  'single-arm-row-cable': 0.2,
  'high-row': 0.3,
  'dumbbell-deadlift': 0.2,
  'kettlebell-lunge': 0.1,
  'shoulder-press-plate-loaded': 0.2,
  'leverage-shoulder-press': 0.2,
  'pallof-press': 0.08,
};
const EXPERIENCE_LOAD = { beginner: 0.6, intermediate: 1, advanced: 1.3 } as const;

function roundLoad(kg: number): number {
  return kg < 10 ? Math.max(1, Math.round(kg)) : Math.round(kg / 2.5) * 2.5;
}

function isAvailable(ex: CatalogueExercise, p: GeneratorProfile): boolean {
  if (RANK[ex.difficulty] > RANK[p.experience]) return false;
  const allowed = ALLOWED_EQUIPMENT[p.equipment];
  if (allowed && !ex.equipment.some((e) => allowed.includes(e))) return false;
  const haystack = `${ex.id} ${ex.name}`;
  return !p.limitations.some((l) => AVOID[l].test(haystack));
}

function prescription(
  slot: Slot,
  ex: CatalogueExercise,
  p: GeneratorProfile,
): Pick<PlannedItem, 'sets' | 'reps' | 'restSeconds'> {
  const lvl = RANK[p.experience];
  if (slot === 'mobility') return { sets: 1, reps: '6-8 / side', restSeconds: 30 };
  if (slot === 'carry') return { sets: 2 + (lvl > 0 ? 1 : 0), reps: '30 m', restSeconds: 60 };
  if (slot === 'core') {
    const hold = /plank|hold/.test(ex.id);
    return { sets: 2, reps: hold ? '30-45 s' : '8-10 / side', restSeconds: 45 };
  }
  const compound = slot === 'squat' || slot === 'hinge' || slot === 'pushH' || slot === 'pullH' || slot === 'pushV' || slot === 'pullV';
  switch (p.goal) {
    case 'strength':
      return { sets: [3, 4, 5][lvl], reps: compound ? '4-6' : '6-8', restSeconds: compound ? 150 : 90 };
    case 'muscle':
      return { sets: [3, 3, 4][lvl], reps: '8-12', restSeconds: 75 };
    case 'fitness':
      return { sets: [2, 3, 3][lvl], reps: '10-15', restSeconds: 60 };
    default: // longevity
      return { sets: [2, 3, 3][lvl], reps: '8-12', restSeconds: 90 };
  }
}

export function generatePlan(p: GeneratorProfile, catalogue: readonly CatalogueExercise[]): PlannedDay[] {
  const byId = new Map(catalogue.map((c) => [c.id, c]));
  const usedIds = new Set<string>();
  const days = DAYS[p.daysPerWeek] ?? DAYS[3];
  const maxItems = MAX_ITEMS[p.minutes] ?? 5;

  const pick = (slot: Slot, variant: number, dayUsed: Set<string>): CatalogueExercise | null => {
    const preferred = SLOT_PREFERENCES[slot]
      .map((id) => byId.get(id))
      .filter((e): e is CatalogueExercise => !!e && isAvailable(e, p) && !dayUsed.has(e.id));
    const fresh = preferred.filter((e) => !usedIds.has(e.id));
    const base = fresh.length > 0 ? fresh : preferred;
    // Experienced lifters get loadable options first (a bodyweight squat is
    // a warm-up for them, not a strength movement).
    const loadable = base.filter((e) => LOAD_RATIO[e.id] !== undefined);
    const pool = p.experience !== 'beginner' && loadable.length > 0 ? loadable : base;
    // Rotate among the two best choices so days differ without ever
    // dropping to a weak option while a good one exists.
    if (pool.length > 0) return pool[variant % Math.min(2, pool.length)];
    const fb = SLOT_FALLBACK[slot];
    const fallback = catalogue
      .filter(
        (e) =>
          e.movementPattern === fb.pattern &&
          (!fb.category || e.category === fb.category) &&
          isAvailable(e, p) &&
          !e.equipment.includes('Other') &&
          !FALLBACK_EXCLUDE.test(e.id) &&
          !dayUsed.has(e.id) &&
          !usedIds.has(e.id),
      )
      .sort((a, b) => RANK[a.difficulty] - RANK[b.difficulty] || a.id.localeCompare(b.id));
    return fallback[0] ?? null;
  };

  return days.map((day, dayIndex) => {
    const items: PlannedItem[] = [];
    const dayUsed = new Set<string>();
    const slotEntries = day.slots.map((slot) => {
      const ex = pick(slot, dayIndex, dayUsed);
      if (ex) dayUsed.add(ex.id);
      return { slot, ex };
    });
    // Keep the main lifts first and mobility last when trimming to the
    // session length: drop from the middle (core/carry/accessories) first.
    const keepers = slotEntries.filter((s) => s.ex);
    const mobility = keepers.filter((s) => s.slot === 'mobility');
    const rest = keepers.filter((s) => s.slot !== 'mobility');
    const trimmed = [...rest.slice(0, Math.max(1, maxItems - mobility.length)), ...mobility];
    for (const { slot, ex } of trimmed) {
      if (!ex) continue;
      usedIds.add(ex.id);
      const rx = prescription(slot, ex, p);
      const ratio = LOAD_RATIO[ex.id];
      const weightKg =
        p.weightKg && ratio ? roundLoad(p.weightKg * ratio * EXPERIENCE_LOAD[p.experience]) : undefined;
      items.push({
        exerciseId: ex.id,
        ...rx,
        ...(weightKg ? { weightKg } : {}),
        notes: weightKg
          ? 'Estimated starting load — adjust to feel. Stop 2-3 reps before failure.'
          : slot === 'mobility'
            ? 'Move slowly, breathe, no pain.'
            : 'Stop 2-3 reps before failure.',
      });
    }
    return { name: day.name, items };
  });
}
