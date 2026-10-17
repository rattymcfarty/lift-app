/**
 * AsyncStorage-backed settings store.
 *
 * Pure data layer — no React, no UI. Canonical units: kg for weight,
 * seconds for rest. Display conversion happens in the UI layer.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Weight display unit. Storage is always canonical kg. */
export type WeightUnit = 'kg' | 'lb';

/** Persisted settings shape. */
export interface LiftSettings {
  weightUnit: WeightUnit;
  defaultRestSeconds: number;
  barWeightKg: number;
  /** Minutes without activity before LIFT asks "still training?". */
  idlePromptMinutes: number;
  /** Minutes without activity before LIFT finishes the workout itself (0 = never). */
  autoFinishMinutes: number;
  /** Show the floating companion avatar. Off hides it completely and makes
   *  companion messages a no-op. */
  companionEnabled: boolean;
}

const SETTINGS_KEY = 'lift:settings';

/** Default values when nothing is stored or data is corrupt. */
const DEFAULTS: LiftSettings = {
  weightUnit: 'kg',
  defaultRestSeconds: 90,
  barWeightKg: 20,
  idlePromptMinutes: 45,
  autoFinishMinutes: 180,
  companionEnabled: true,
};

/**
 * Reads settings from AsyncStorage.
 * Merges stored partial over defaults; never throws — returns defaults on
 * corrupt/missing data.
 */
export async function getSettings(): Promise<LiftSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LiftSettings>;
    return {
      weightUnit: parsed.weightUnit ?? DEFAULTS.weightUnit,
      defaultRestSeconds: parsed.defaultRestSeconds ?? DEFAULTS.defaultRestSeconds,
      barWeightKg: parsed.barWeightKg ?? DEFAULTS.barWeightKg,
      idlePromptMinutes: parsed.idlePromptMinutes ?? DEFAULTS.idlePromptMinutes,
      autoFinishMinutes: parsed.autoFinishMinutes ?? DEFAULTS.autoFinishMinutes,
      companionEnabled: parsed.companionEnabled ?? DEFAULTS.companionEnabled,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Writes the full settings object to AsyncStorage. */
async function writeSettings(settings: LiftSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Sets the weight display unit.
 * @throws RangeError if unit is not 'kg' or 'lb'
 */
export async function setWeightUnit(unit: WeightUnit): Promise<void> {
  if (unit !== 'kg' && unit !== 'lb') {
    throw new RangeError(`invalid weight unit: ${unit}`);
  }
  const current = await getSettings();
  await writeSettings({ ...current, weightUnit: unit });
}

/**
 * Sets the default rest timer duration in seconds.
 * @throws RangeError if seconds is not in [5, 600]
 */
export async function setDefaultRestSeconds(seconds: number): Promise<void> {
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 600) {
    throw new RangeError(`defaultRestSeconds must be an integer in [5, 600]: ${seconds}`);
  }
  const current = await getSettings();
  await writeSettings({ ...current, defaultRestSeconds: seconds });
}

/**
 * Sets the bar weight in canonical kilograms.
 * @throws RangeError if kg is not in [0, 50]
 */
export async function setBarWeightKg(kg: number): Promise<void> {
  if (!Number.isFinite(kg) || kg < 0 || kg > 50) {
    throw new RangeError(`barWeightKg must be a finite number in [0, 50]: ${kg}`);
  }
  const current = await getSettings();
  await writeSettings({ ...current, barWeightKg: kg });
}

/**
 * Sets the workout check-in thresholds (minutes of inactivity).
 * @throws RangeError if the prompt is outside [10, 240] or auto-finish is
 *   neither 0 (off) nor at least prompt + 15 and at most 720.
 */
export async function setIdleThresholds(promptMin: number, autoFinishMin: number): Promise<void> {
  if (!Number.isInteger(promptMin) || promptMin < 10 || promptMin > 240) {
    throw new RangeError(`idlePromptMinutes must be an integer in [10, 240]: ${promptMin}`);
  }
  if (!Number.isInteger(autoFinishMin) || (autoFinishMin !== 0 && (autoFinishMin < promptMin + 15 || autoFinishMin > 720))) {
    throw new RangeError(`autoFinishMinutes must be 0 or in [prompt+15, 720]: ${autoFinishMin}`);
  }
  const current = await getSettings();
  await writeSettings({ ...current, idlePromptMinutes: promptMin, autoFinishMinutes: autoFinishMin });
}

/**
 * Shows or hides the floating companion. Persisted like the other settings
 * (and carried in backups); the reactive companion store mirrors it for the
 * live UI.
 */
export async function setCompanionEnabledSetting(enabled: boolean): Promise<void> {
  const current = await getSettings();
  await writeSettings({ ...current, companionEnabled: enabled });
}
