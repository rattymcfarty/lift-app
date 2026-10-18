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
  'lift:user-programs',
  'lift:tab-order',
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
      let toWrite = v;
      if (key === 'lift:user-programs') {
        // Merge by id (newest wins) so importing never wipes programs that
        // already exist on this device.
        const existingRaw = await AsyncStorage.getItem(key);
        const existing: Array<{ id?: string; updatedAt?: number }> = existingRaw ? JSON.parse(existingRaw) : [];
        const incoming: Array<{ id?: string; updatedAt?: number }> = JSON.parse(v);
        const byId = new Map<string, { id?: string; updatedAt?: number }>();
        for (const p of [...existing, ...incoming]) {
          if (!p || typeof p.id !== 'string') continue;
          const prev = byId.get(p.id);
          if (!prev || (p.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) byId.set(p.id, p);
        }
        toWrite = JSON.stringify([...byId.values()]);
      }
      await AsyncStorage.setItem(key, toWrite);
      applied++;
    } catch {
      // ignore — best effort
    }
  }
  return applied;
}
