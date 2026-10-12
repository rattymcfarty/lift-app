/**
 * Muscle balance analytics (P4b) — pure, no DB, no UI.
 *
 * Takes the same StatWorkout[] the rest of the stats layer uses and produces
 * a balance report: per-group volume shares, push/pull and upper/lower
 * ratios, and plain-language imbalance flags with longevity-grounded
 * guidance.
 *
 * Muscle names in the KB are free-form strings, so every name is normalized
 * to a canonical group first. Unknown names land in 'other' and are excluded
 * from ratio math (they still show in the per-group bars).
 *
 * Longevity framing: balanced musculature prevents injury and preserves
 * function with age. The flags target meaningful imbalances (push >> pull,
 * upper >> lower, neglected groups) — not perfection.
 */
import { setVolume, startOfWeekMonday } from './volume';
import type { StatWorkout } from './types';

/** Canonical muscle groups, display order. */
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'forearms',
  'traps',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Free-form name → canonical group. Keep in sync with KB vocabulary. */
const NORMALIZE: Record<string, MuscleGroup> = {
  chest: 'chest',
  pecs: 'chest',
  pectorals: 'chest',
  'chest muscles': 'chest',
  back: 'back',
  lats: 'back',
  latissimus: 'back',
  'latissimus dorsi': 'back',
  'upper back': 'back',
  'lower back': 'back',
  erectors: 'back',
  'spinal erectors': 'back',
  shoulders: 'shoulders',
  deltoids: 'shoulders',
  delts: 'shoulders',
  'front delts': 'shoulders',
  'side delts': 'shoulders',
  'rear delts': 'shoulders',
  biceps: 'biceps',
  bicep: 'biceps',
  triceps: 'triceps',
  tricep: 'triceps',
  quadriceps: 'quadriceps',
  quads: 'quadriceps',
  'front thigh': 'quadriceps',
  hamstrings: 'hamstrings',
  hams: 'hamstrings',
  'back thigh': 'hamstrings',
  glutes: 'glutes',
  glute: 'glutes',
  buttocks: 'glutes',
  calves: 'calves',
  calf: 'calves',
  gastrocnemius: 'calves',
  soleus: 'calves',
  core: 'core',
  abs: 'core',
  abdominals: 'core',
  obliques: 'core',
  rectus: 'core',
  forearms: 'forearms',
  forearm: 'forearms',
  grip: 'forearms',
  traps: 'traps',
  trapezius: 'traps',
};

const UPPER: ReadonlySet<MuscleGroup> = new Set([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'traps',
]);
const LOWER: ReadonlySet<MuscleGroup> = new Set([
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
]);
/** Push-pattern groups (pressing). Core/legs are neutral. */
const PUSH: ReadonlySet<MuscleGroup> = new Set(['chest', 'shoulders', 'triceps']);
/** Pull-pattern groups (rowing/pulling). */
const PULL: ReadonlySet<MuscleGroup> = new Set(['back', 'biceps', 'traps']);

/** Normalize a free-form muscle name to a canonical group, or 'other'. */
export function canonicalMuscle(raw: string): MuscleGroup | 'other' {
  const key = raw.trim().toLowerCase();
  // hasOwnProperty — a muscle literally named "constructor" must not resolve
  // to Object.prototype.constructor. (Object.hasOwn needs ES2022; the
  // project targets ES2020.)
  return Object.prototype.hasOwnProperty.call(NORMALIZE, key) ? NORMALIZE[key] : 'other';
}

export interface GroupVolume {
  group: MuscleGroup | 'other';
  volumeKg: number;
  /** Share of grand total (volume, or set count when no kg), 0–1. */
  share: number;
  /** Completed sets (reps > 0) — for bodyweight-aware display. */
  sets: number;
}

export interface RatioResult {
  a: number;
  b: number;
  /** Completed sets per side (reps > 0) — for bodyweight-aware labels. */
  aSets: number;
  bSets: number;
  /** a/b, or null when a side has neither volume nor sets. */
  ratio: number | null;
  /** 'volume' when both sides have kg volume, 'sets' when the ratio fell
   * back to set counts (a side is bodyweight-only), 'none' when null. */
  basis: 'volume' | 'sets' | 'none';
}

export interface BalanceFlag {
  kind: 'push_pull' | 'upper_lower' | 'neglected' | 'dominant';
  severity: 'info' | 'watch';
  title: string;
  guidance: string;
}

export interface BalanceReport {
  byGroup: GroupVolume[];
  pushPull: RatioResult;
  upperLower: RatioResult;
  /** Total classified volume (excludes 'other'). */
  totalKg: number;
  /** Grand total including 'other' — for the empty-state check. */
  grandTotalKg: number;
  /** Workouts analyzed — flags stay quiet under 4. */
  workoutCount: number;
  /** Workouts with muscle-training sets (strength category). Cardio-only
   * and mobility-only sessions don't inform muscle balance. */
  trainingWorkoutCount: number;
  /** Completed sets with reps > 0 across all workouts — bodyweight work
   * counts here even at 0 kg, so the empty state doesn't fire for it. */
  totalSets: number;
  /** True when the 4-training-workout threshold was met and flags were
   * actually evaluated. */
  flagsEvaluated: boolean;
  flags: BalanceFlag[];
}

/**
 * Volume per canonical muscle group. Full set volume is credited to each
 * primary muscle (same convention as volumeByMuscle in volume.ts).
 * Only strength-category sets count — a mobility hamstring stretch isn't
 * hamstring training.
 */
export function volumeByGroup(workouts: StatWorkout[]): Map<MuscleGroup | 'other', number> {
  const out = new Map<MuscleGroup | 'other', number>();
  for (const w of workouts) {
    for (const s of w.sets) {
      if (s.exerciseCategory !== 'strength') continue;
      const v = setVolume(s);
      if (v === 0) continue;
      const muscles = s.primaryMuscles.length > 0 ? s.primaryMuscles : ['other'];
      for (const m of muscles) {
        const g = canonicalMuscle(m);
        out.set(g, (out.get(g) ?? 0) + v);
      }
    }
  }
  return out;
}

/**
 * Completed sets (reps > 0) per canonical muscle group. Bodyweight work
 * (no logged weight → zero kg volume) still counts here — a pull-up is
 * pulling even when setVolume is 0. Strength category only.
 */
export function countSetsByGroup(workouts: StatWorkout[]): Map<MuscleGroup | 'other', number> {
  const out = new Map<MuscleGroup | 'other', number>();
  for (const w of workouts) {
    for (const s of w.sets) {
      if (!s.completed || s.reps == null || s.reps <= 0) continue;
      if (s.exerciseCategory !== 'strength') continue;
      const muscles = s.primaryMuscles.length > 0 ? s.primaryMuscles : ['other'];
      for (const m of muscles) {
        const g = canonicalMuscle(m);
        out.set(g, (out.get(g) ?? 0) + 1);
      }
    }
  }
  return out;
}

/**
 * Analyze muscle balance. Needs a meaningful sample — with fewer than 4
 * workouts the flags stay quiet (not enough data to judge).
 */
export function analyzeBalance(workouts: StatWorkout[]): BalanceReport {
  const byGroupMap = volumeByGroup(workouts);
  const setsByGroupMap = countSetsByGroup(workouts);
  let total = 0; // classified volume (excludes 'other') — drives ratios + flags
  let grandTotal = 0; // everything — drives the honest per-bar shares
  for (const [g, v] of byGroupMap) {
    grandTotal += v;
    if (g !== 'other') total += v;
  }
  // Include groups with sets but no kg (bodyweight-only) so the bar card
  // isn't empty for them — shares fall back to set counts.
  const allGroups = new Set<MuscleGroup | 'other'>([...byGroupMap.keys(), ...setsByGroupMap.keys()]);
  let totalSets = 0;
  for (const s of setsByGroupMap.values()) totalSets += s;
  const byGroup: GroupVolume[] = [...allGroups]
    .map((group) => {
      const volumeKg = byGroupMap.get(group) ?? 0;
      const sets = setsByGroupMap.get(group) ?? 0;
      return {
        group,
        volumeKg: Math.round(volumeKg),
        // Share of ALL volume including 'other'; falls back to set share
        // when there's no kg volume (bodyweight-only).
        share: grandTotal > 0 ? volumeKg / grandTotal : totalSets > 0 ? sets / totalSets : 0,
        sets,
      };
    })
    .sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets);

  const sum = (groups: ReadonlySet<MuscleGroup>): number => {
    let s = 0;
    for (const g of groups) s += byGroupMap.get(g) ?? 0;
    return s;
  };
  // Completed sets per side (reps > 0, any weight) — bodyweight work
  // counts here even when its kg volume is 0. (setsByGroupMap defined above.)
  const sumSets = (groups: ReadonlySet<MuscleGroup>): number => {
    let s = 0;
    for (const g of groups) s += setsByGroupMap.get(g) ?? 0;
    return s;
  };
  // A side is "trained" if it has volume or completed sets.
  // Ratios prefer volume; when EITHER side is bodyweight-only (zero kg
  // but real sets), fall back to a set-count ratio so push-ups count as
  // pushing and pull-ups count as pulling. Only when a side has neither
  // volume nor sets is the ratio null (genuinely untrained).
  //
  // When BOTH ratios are available but tell very different stories (e.g.
  // heavy bench vs a few pull-ups: volume says 7.5:1 push-dominant, sets
  // say 1:1 balanced), the set ratio wins — sets are the common denominator
  // when one side's kg volume doesn't represent its effort. "Very different"
  // means the ratios differ by more than 3x.
  const trained = (groups: ReadonlySet<MuscleGroup>): boolean =>
    sum(groups) > 0 || sumSets(groups) > 0;
  const sideRatio = (aGroups: ReadonlySet<MuscleGroup>, bGroups: ReadonlySet<MuscleGroup>): RatioResult => {
    const a = sum(aGroups);
    const b = sum(bGroups);
    const aSets = sumSets(aGroups);
    const bSets = sumSets(bGroups);
    const volRatio = a > 0 && b > 0 ? a / b : null;
    const setRatio = aSets > 0 && bSets > 0 ? aSets / bSets : null;
    if (volRatio !== null && setRatio !== null) {
      const disagree =
        (volRatio > 1 && setRatio < 1) ||
        (volRatio < 1 && setRatio > 1) ||
        volRatio / setRatio > 3 ||
        setRatio / volRatio > 3;
      if (disagree) return { a, b, aSets, bSets, ratio: setRatio, basis: 'sets' };
      return { a, b, aSets, bSets, ratio: volRatio, basis: 'volume' };
    }
    if (volRatio !== null) return { a, b, aSets, bSets, ratio: volRatio, basis: 'volume' };
    if (setRatio !== null) return { a, b, aSets, bSets, ratio: setRatio, basis: 'sets' };
    return { a, b, aSets, bSets, ratio: null, basis: 'none' };
  };
  const pushPull = sideRatio(PUSH, PULL);
  const upperLower = sideRatio(UPPER, LOWER);

  const flags: BalanceFlag[] = [];
  // Only strength-category workouts with reps > 0 count toward the
  // threshold — cardio, mobility, and balance sessions (or blank sets)
  // add no muscle-balance signal.
  const trainingWorkouts = workouts.filter((w) =>
    w.sets.some(
      (s) => s.completed && s.exerciseCategory === 'strength' && s.reps != null && s.reps > 0,
    ),
  );
  const flagsEvaluated = trainingWorkouts.length >= 4;
  if (flagsEvaluated) {
    // Push/pull: healthy is roughly 1:1; flag beyond 1.6 either way.
    // A zero side with training on the other is the most extreme imbalance.
    // "Zero" means no volume AND no completed sets — bodyweight work counts.
    const pushTrained = trained(PUSH);
    const pullTrained = trained(PULL);
    let noPullWatch = false;
    let noPushWatch = false;
    let noLegsWatch = false;
    let noUpperWatch = false;
    if (!pullTrained && pushTrained) {
      noPullWatch = true;
      flags.push({
        kind: 'push_pull',
        severity: 'watch',
        title: 'No pulling at all',
        guidance:
          'All of your upper-body volume is pressing with no pulling (rows, pull-ups). ' +
          'Add one pulling movement a week to protect your shoulders and posture.',
      });
    } else if (!pushTrained && pullTrained) {
      noPushWatch = true;
      flags.push({
        kind: 'push_pull',
        severity: 'watch',
        title: 'No pressing at all',
        guidance:
          'All of your upper-body volume is pulling with no pressing. ' +
          'Add a push-up or press variation to keep the front of the shoulder strong.',
      });
    } else if (pushPull.ratio !== null && pushPull.ratio > 1.6) {
      flags.push({
        kind: 'push_pull',
        severity: 'watch',
        title: 'Push volume outweighs pull',
        guidance:
          'Your pressing (chest, shoulders, triceps) is well ahead of your pulling (back, biceps). ' +
          'Add a row or pull-up variation to protect your shoulders and posture as you age.',
      });
    } else if (pushPull.ratio !== null && pushPull.ratio < 0.625) {
      flags.push({
        kind: 'push_pull',
        severity: 'watch',
        title: 'Pull volume outweighs push',
        guidance:
          'Your pulling is well ahead of your pressing. ' +
          'Add a press variation (push-up, overhead press) to keep the front of the shoulder strong.',
      });
    }
    // Upper/lower: legs carry you through life — flag a heavy upper bias.
    // Zero on either side with training on the other is the clearest gap.
    // ("Lower body leads — nice" is only for when BOTH sides have volume.)
    const upperTrained = trained(UPPER);
    const lowerTrained = trained(LOWER);
    if (!lowerTrained && upperTrained) {
      noLegsWatch = true;
      flags.push({
        kind: 'upper_lower',
        severity: 'watch',
        title: 'No leg training at all',
        guidance:
          'Legs do the work of daily life — standing, stairs, catching yourself. ' +
          'One squat or hinge pattern a week protects independence with age.',
      });
    } else if (!upperTrained && lowerTrained) {
      noUpperWatch = true;
      flags.push({
        kind: 'upper_lower',
        severity: 'watch',
        title: 'No upper-body training at all',
        guidance:
          'Your legs are covered, but pushing, pulling, and carrying keep the ' +
          'shoulders, back, and grip strong for daily life. Add one upper-body day.',
      });
    } else if (upperLower.ratio !== null && upperLower.ratio > 2.2) {
      flags.push({
        kind: 'upper_lower',
        severity: 'watch',
        title: 'Upper body dominates',
        guidance:
          'Legs do the work of daily life — standing, stairs, catching yourself. ' +
          'A squat or hinge pattern each week protects independence with age.',
      });
    } else if (upperLower.ratio !== null && upperLower.ratio < 0.45) {
      flags.push({
        kind: 'upper_lower',
        severity: 'info',
        title: 'Lower body leads — nice',
        guidance:
          'Your legs are getting the work they deserve. Keep a weekly press or row so the upper body keeps up.',
      });
    }
    // Neglected groups: <3% of CLASSIFIED volume.
    // Zero-volume groups are only flagged when you train the surrounding
    // area but miss the specific muscle (otherwise the push/pull and
    // upper/lower flags already say it, and 11 info flags would be noise).
    const SIBLINGS: Partial<Record<MuscleGroup, MuscleGroup[]>> = {
      hamstrings: ['quadriceps', 'glutes'],
      triceps: ['chest', 'shoulders'],
      biceps: ['back'],
      calves: ['quadriceps', 'hamstrings', 'glutes'],
      shoulders: ['chest'],
      glutes: ['quadriceps', 'hamstrings'],
      core: ['chest', 'back', 'quadriceps'],
    };
    for (const g of MUSCLE_GROUPS) {
      if (g === 'forearms') continue; // grip work is incidental; don't nag
      const vol = byGroupMap.get(g) ?? 0;
      const groupSets = setsByGroupMap.get(g) ?? 0;
      const cShare = total > 0 ? vol / total : 0;
      // "Barely trained" only fires when the kg share is low AND the group
      // doesn't have meaningful bodyweight work. Otherwise adding one
      // weighted set to 20 bodyweight sets makes the flag WORSE.
      if (vol > 0 && cShare < 0.03 && groupSets < 10) {
        const pct = cShare < 0.005 ? '<1' : String(Math.round(cShare * 100));
        flags.push({
          kind: 'neglected',
          severity: 'info',
          title: `${label(g)} is barely trained`,
          guidance: `Just ${pct}% of your volume hits ${label(g)}. ` +
            'One exercise a week is enough to keep it in the game.',
        });
      } else if (vol === 0) {
        // A group with completed bodyweight sets is trained, just at 0 kg.
        const groupSets = setsByGroupMap.get(g) ?? 0;
        if (groupSets > 0) continue;
        const siblings = SIBLINGS[g] ?? [];
        const siblingTrained = siblings.some((s) => (byGroupMap.get(s) ?? 0) > 0 || (setsByGroupMap.get(s) ?? 0) > 0);
        // Don't repeat what a watch-level ratio flag already said. Only
        // hides when the corresponding WATCH flag actually fired.
        const coveredByRatio =
          (PULL.has(g) && noPullWatch) || (PUSH.has(g) && noPushWatch) ||
          (LOWER.has(g) && noLegsWatch) || (UPPER.has(g) && noUpperWatch);
        if (siblingTrained && !coveredByRatio) {
          flags.push({
            kind: 'neglected',
            severity: 'info',
            title: `${label(g)} isn't trained at all`,
            guidance: `You train the surrounding muscles but ${label(g)} gets nothing. ` +
              'One exercise a week is enough to keep it in the game.',
          });
        }
      }
    }
    // Single-group dominance: >45% of classified volume (ignores 'other').
    // Uses unrounded values throughout — no rounding drift.
    const topClassified = byGroup.find((g) => g.group !== 'other');
    if (topClassified) {
      const rawTop = byGroupMap.get(topClassified.group) ?? 0;
      const cShare = total > 0 ? rawTop / total : 0;
      if (cShare > 0.45) {
        flags.push({
          kind: 'dominant',
          severity: 'info',
          title: `${label(topClassified.group)} dominates your training`,
          guidance: 'Nothing wrong with a focus — just make sure the rest of the body gets a weekly check-in too.',
        });
      }
    }
  }
  return { byGroup, pushPull, upperLower, totalKg: Math.round(total), grandTotalKg: Math.round(grandTotal), workoutCount: workouts.length, trainingWorkoutCount: trainingWorkouts.length, totalSets, flagsEvaluated, flags };
}

function label(g: MuscleGroup | 'other'): string {
  return g === 'other' ? 'Other' : g.charAt(0).toUpperCase() + g.slice(1);
}

export interface MuscleWeekPoint {
  /** Monday 00:00 local starting the week. */
  weekStart: Date;
  byGroup: Map<MuscleGroup | 'other', number>;
}

/**
 * Weekly volume per canonical muscle group, oldest week first.
 * Always returns `weeks` buckets (zero-filled when empty).
 */
export function volumeByMuscleByWeek(
  workouts: StatWorkout[],
  weeks: number,
  now = new Date(),
): MuscleWeekPoint[] {
  const buckets: MuscleWeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    buckets.push({ weekStart: startOfWeekMonday(d), byGroup: new Map() });
  }
  const idxByWeek = new Map(buckets.map((b, i) => [b.weekStart.getTime(), i]));
  for (const w of workouts) {
    const idx = idxByWeek.get(startOfWeekMonday(w.startedAt).getTime());
    if (idx === undefined) continue;
    const byGroup = buckets[idx].byGroup;
    for (const s of w.sets) {
      // Strength category only — matches volumeByGroup.
      if (s.exerciseCategory !== 'strength') continue;
      const v = setVolume(s);
      if (v === 0) continue;
      const muscles = s.primaryMuscles.length > 0 ? s.primaryMuscles : ['other'];
      for (const m of muscles) {
        const g = canonicalMuscle(m);
        byGroup.set(g, (byGroup.get(g) ?? 0) + v);
      }
    }
  }
  return buckets;
}
