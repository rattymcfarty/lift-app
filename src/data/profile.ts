/**
 * The user's on-device profile: who they are, what they want, what they
 * have. Everything here is optional personalisation — it never leaves the
 * phone (AsyncStorage, included in the exported backup file).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'longevity' | 'strength' | 'muscle' | 'fitness';
export type EquipmentAccess = 'full' | 'dumbbells' | 'bodyweight';
export type Limitation = 'knees' | 'lowerBack' | 'shoulders';
export type Sex = 'female' | 'male' | 'other';

export interface Profile {
  onboarded: boolean;
  name: string;
  sex: Sex | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  experience: Experience;
  goal: Goal;
  daysPerWeek: 2 | 3 | 4 | 5;
  minutes: 30 | 45 | 60 | 75;
  equipment: EquipmentAccess;
  limitations: Limitation[];
  /** Weekdays (0 = Sunday … 6 = Saturday) the user prefers to train. */
  trainingDays: number[];
}

const KEY = 'lift:profile';

export const DEFAULT_PROFILE: Profile = {
  onboarded: false,
  name: '',
  sex: null,
  birthYear: null,
  heightCm: null,
  weightKg: null,
  experience: 'beginner',
  goal: 'longevity',
  daysPerWeek: 3,
  minutes: 45,
  equipment: 'full',
  limitations: [],
  trainingDays: [1, 3, 5],
};

export async function getProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const next = { ...(await getProfile()), ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/** Approximate age from birth year, or null. */
export function ageOf(profile: Pick<Profile, 'birthYear'>, now = new Date()): number | null {
  return profile.birthYear ? now.getFullYear() - profile.birthYear : null;
}
