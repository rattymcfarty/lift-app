/**
 * Device-level configuration that is not in the SQLite database — profile,
 * settings, reminders, theme — carried in the backup file's optional
 * `appData` block so "export everything" really is everything.
 *
 * Only an explicit whitelist of keys is ever read or written, and only
 * string values are accepted, so a hand-edited or hostile backup cannot
 * write arbitrary storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_DATA_KEYS = [
  'lift:settings',
  'lift:profile',
  'lift:reminders',
  'lift:theme-preference',
] as const;

export async function collectAppData(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of APP_DATA_KEYS) {
    try {
      const v = await AsyncStorage.getItem(key);
      if (v != null) out[key] = v;
    } catch {
      // A key that cannot be read is simply omitted.
    }
  }
  return out;
}

/** Restores whitelisted keys; returns how many were applied. */
export async function restoreAppData(data: unknown): Promise<number> {
  if (typeof data !== 'object' || data === null) return 0;
  let applied = 0;
  for (const key of APP_DATA_KEYS) {
    const v = (data as Record<string, unknown>)[key];
    if (typeof v !== 'string' || v.length > 100_000) continue;
    try {
      JSON.parse(v); // every stored value is JSON (or a bare 'dark'/'light')
    } catch {
      if (key !== 'lift:theme-preference') continue;
    }
    try {
      await AsyncStorage.setItem(key, v);
      applied++;
    } catch {
      // ignore — best effort
    }
  }
  return applied;
}
