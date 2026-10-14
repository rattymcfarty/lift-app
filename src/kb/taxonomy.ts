/**
 * Canonical taxonomy for the LIFT knowledge base.
 * Mirrors the KB schema enums so the app can render labels
 * and validate incoming KB data without throwing on unknown values.
 * Icons live in src/components/icons/ (original SVG art) - the taxonomy
 * carries ids + labels only.
 */

export const MUSCLE_GROUPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'Chest', label: 'Chest' },
  { id: 'Front Delts', label: 'Front Delts' },
  { id: 'Middle Delts', label: 'Middle Delts' },
  { id: 'Rear Delts', label: 'Rear Delts' },
  { id: 'Biceps', label: 'Biceps' },
  { id: 'Triceps', label: 'Triceps' },
  { id: 'Forearms', label: 'Forearms' },
  { id: 'Lats', label: 'Lats' },
  { id: 'Upper Back', label: 'Upper Back' },
  { id: 'Lower Back', label: 'Lower Back' },
  { id: 'Neck', label: 'Neck' },
  { id: 'Abs', label: 'Abs' },
  { id: 'Glutes', label: 'Glutes' },
  { id: 'Hamstrings', label: 'Hamstrings' },
  { id: 'Quadriceps', label: 'Quadriceps' },
  { id: 'Abductors', label: 'Abductors' },
  { id: 'Adductors', label: 'Adductors' },
  { id: 'Calves', label: 'Calves' },
  { id: 'Olympic', label: 'Olympic' },
  { id: 'Full-Body', label: 'Full-Body' },
  { id: 'Other', label: 'Other' },
] as const;

export const EQUIPMENT: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'Barbell', label: 'Barbell' },
  { id: 'Dumbbell', label: 'Dumbbell' },
  { id: 'Kettlebell', label: 'Kettlebell' },
  { id: 'Machine', label: 'Machine' },
  { id: 'Bodyweight', label: 'Bodyweight' },
  { id: 'Cardio', label: 'Cardio' },
  { id: 'Smith Machine', label: 'Smith Machine' },
  { id: 'Cable', label: 'Cable' },
  { id: 'Safety Bar', label: 'Safety Bar' },
  { id: 'Other', label: 'Other' },
] as const;

export const EXERCISE_CATEGORIES = [
  'Vertical Push',
  'Vertical Pull',
  'Horizontal Push',
  'Horizontal Pull',
  'Squat',
  'Hinge',
  'Lunge',
  'Carry',
  'Core',
  'Cardio',
  'Mobility',
  'Olympic',
  'Other',
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

/** Lookup tables for O(1) label resolution. */
const MUSCLE_LABEL_MAP = new Map(MUSCLE_GROUPS.map((m) => [m.id, m.label]));
const EQUIPMENT_LABEL_MAP = new Map(EQUIPMENT.map((e) => [e.id, e.label]));

/**
 * Return the display label for a muscle id.
 * Falls back to the raw id if unknown — never throws on KB data.
 */
export function muscleLabel(id: string): string {
  return MUSCLE_LABEL_MAP.get(id) ?? id;
}

/**
 * Return the display label for an equipment id.
 * Falls back to the raw id if unknown — never throws on KB data.
 */
export function equipmentLabel(id: string): string {
  return EQUIPMENT_LABEL_MAP.get(id) ?? id;
}

/**
 * Check if a muscle id is in the canonical list.
 */
export function isKnownMuscle(id: string): boolean {
  return MUSCLE_LABEL_MAP.has(id);
}

/**
 * Check if an equipment id is in the canonical list.
 */
export function isKnownEquipment(id: string): boolean {
  return EQUIPMENT_LABEL_MAP.has(id);
}

/**
 * Check if a category is in the canonical list.
 */
export function isKnownCategory(category: string): category is ExerciseCategory {
  return EXERCISE_CATEGORIES.includes(category as ExerciseCategory);
}

/**
 * Decode an equipment field that may be a JSON string array (DB rows)
 * or a plain string array (KB JSON) into a string list. Never throws.
 */
function decodeEquipmentList(equipment: string | string[] | null | undefined): string[] {
  if (Array.isArray(equipment)) {
    return equipment.filter((s): s is string => typeof s === 'string');
  }
  if (!equipment) return [];
  try {
    const parsed: unknown = JSON.parse(equipment);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Display name for an exercise: stored name + " (Equipment)" from the
 * first equipment value. DISPLAY LAYER ONLY — KB data is never renamed,
 * and search keeps matching the stored base name.
 *
 * Rules (applied consistently everywhere a name renders):
 * - No equipment, or first equipment is "Other" -> bare name.
 * - Name already ends with a "(...)" parenthetical -> left alone, so
 *   "Bicep Curl (Barbell)" never becomes "Bicep Curl (Barbell) (Barbell)".
 * - Multiple equipment values -> first one only ("Farmer Carry (Dumbbell)").
 */
export function displayName(exercise: {
  name: string;
  equipment?: string | string[] | null;
}): string {
  const name = exercise.name;
  const list = decodeEquipmentList(exercise.equipment);
  const first = list[0];
  if (!first) return name;
  const label = equipmentLabel(first);
  if (!label || label === 'Other') return name;
  if (/\(.*\)\s*$/.test(name)) return name;
  return `${name} (${label})`;
}