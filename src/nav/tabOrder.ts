/**
 * Bottom-tab order — which of the three main doors comes first.
 *
 * The pure half (`normalizeOrder`, `moveTab`) touches no storage and is
 * unit-tested by `scripts/test-tab-order.mjs` (which stubs AsyncStorage). The
 * stored half keeps the order in AsyncStorage under `lift:tab-order`, which is
 * whitelisted in `src/data/appData.ts` so the chosen order rides along in
 * backups.
 *
 * Nothing here imports React: the tab bar reads the order through
 * `useSyncExternalStore(subscribeTabOrder, getTabOrderSnapshot)`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage key (whitelisted for backups). */
export const TAB_ORDER_KEY = 'lift:tab-order';

/** The three tabs in their shipped order — Train · Analytics · Exercises. */
export const DEFAULT_TAB_ORDER = ['train', 'analytics', 'exercises'] as const;

/** A reorderable tab. Stable ids: they outlive screen and route names. */
export type TabKey = (typeof DEFAULT_TAB_ORDER)[number];

/** True for the three known tab ids — anything else is dropped. */
export function isTabKey(value: unknown): value is TabKey {
  return typeof value === 'string' && (DEFAULT_TAB_ORDER as readonly string[]).includes(value);
}

/**
 * Turns any stored or imported value into a usable order: known ids in the order
 * given, duplicates and unknown ids dropped, and every missing tab appended at
 * the end — so a stale or hand-edited value can never lose a tab.
 */
export function normalizeOrder(value: unknown): TabKey[] {
  const out: TabKey[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isTabKey(item) && !out.includes(item)) out.push(item);
    }
  }
  for (const key of DEFAULT_TAB_ORDER) {
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * Moves `key` to position `toIndex` (clamped to the ends), returning a NEW
 * normalized order. Unknown keys and a move onto the same index leave the order
 * as it is (still a fresh array).
 */
export function moveTab(order: readonly TabKey[], key: TabKey, toIndex: number): TabKey[] {
  const current = normalizeOrder(order);
  const from = current.indexOf(key);
  if (from < 0) return current;
  const to = Math.max(0, Math.min(current.length - 1, Math.trunc(toIndex)));
  if (to === from) return current;
  const next = [...current];
  next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
}

// --- stored order ---------------------------------------------------------

let cached: TabKey[] = [...DEFAULT_TAB_ORDER];
const listeners = new Set<() => void>();

function publish(value: unknown): TabKey[] {
  cached = normalizeOrder(value);
  for (const listener of listeners) listener();
  return cached;
}

/** The current order as a stable reference — safe for `useSyncExternalStore`. */
export function getTabOrderSnapshot(): TabKey[] {
  return cached;
}

/** Subscribes to order changes; returns the unsubscribe function. */
export function subscribeTabOrder(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reads the stored order into the snapshot. Idempotent, never throws and always
 * resolves to a complete order (defaults when nothing usable is stored).
 */
export async function loadTabOrder(): Promise<TabKey[]> {
  try {
    const raw = await AsyncStorage.getItem(TAB_ORDER_KEY);
    return publish(raw ? (JSON.parse(raw) as unknown) : DEFAULT_TAB_ORDER);
  } catch {
    return publish(DEFAULT_TAB_ORDER);
  }
}

/** Saves a new order (normalized), updates subscribers, and returns it. */
export async function setTabOrder(order: readonly TabKey[]): Promise<TabKey[]> {
  const next = publish(order);
  try {
    await AsyncStorage.setItem(TAB_ORDER_KEY, JSON.stringify(next));
  } catch {
    // Best effort, like the other device-level stores: the in-memory order stands.
  }
  return next;
}
