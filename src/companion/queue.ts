/**
 * Companion message queue — pure, dependency-free and unit-testable.
 *
 * Anything in the app can hand the companion something to say with `say()`:
 * a tip, a cheer, a reminder, a personal-record nudge or plain info. This
 * module owns the *policy* — ordering, de-duplication, eviction and expiry —
 * so the React overlay stays a thin renderer and the rules can be tested
 * against an injected clock.
 *
 * Rules
 * - Higher `priority` is shown first; ties break oldest-first (FIFO).
 * - A `dedupeKey` already queued is replaced; a key shown within `cooldownMs`
 *   is dropped entirely.
 * - The queue holds at most `maxSize` messages. When full, the weakest
 *   (lowest priority, then oldest) is evicted — but only if the incoming
 *   message is at least as important.
 * - The visible message auto-expires after `durationMs` (default by kind).
 *
 * `Date.now` is only the *default* clock; tests pass their own `now`.
 */

export type CompanionMood = 'idle' | 'happy' | 'excited' | 'sleepy' | 'focused';

export type CompanionKind = 'tip' | 'cheer' | 'reminder' | 'pr' | 'info';

export interface SayInput {
  /** Stable id; generated when omitted. */
  id?: string;
  text: string;
  kind: CompanionKind;
  /** Defaults by kind. */
  mood?: CompanionMood;
  /** How long the message stays on screen, measured from when it appears. */
  durationMs?: number;
  /** Defaults by kind; higher shows first. */
  priority?: number;
  /** Collapse/replace identical messages and rate-limit repeats. */
  dedupeKey?: string;
}

export interface CompanionMessage {
  id: string;
  text: string;
  kind: CompanionKind;
  mood: CompanionMood;
  /** Higher shows first. */
  priority: number;
  durationMs: number;
  dedupeKey: string | null;
  createdAtMs: number;
  /** When this message became visible — set lazily by the store. @internal */
  shownAtMs?: number;
}

/** Default priority per kind. */
export const DEFAULT_PRIORITY: Record<CompanionKind, number> = {
  pr: 80,
  cheer: 60,
  reminder: 50,
  tip: 40,
  info: 20,
};

/** Default mood per kind. */
export const DEFAULT_MOOD: Record<CompanionKind, CompanionMood> = {
  pr: 'excited',
  cheer: 'happy',
  reminder: 'focused',
  tip: 'idle',
  info: 'idle',
};

/** Default on-screen time per kind (ms). */
export const DEFAULT_DURATION_MS: Record<CompanionKind, number> = {
  pr: 6500,
  cheer: 4500,
  reminder: 8000,
  tip: 7000,
  info: 5000,
};

export const DEFAULT_COOLDOWN_MS = 60_000;
export const DEFAULT_MAX_QUEUE = 4;

export interface CompanionQueueOptions {
  /** Injected clock (ms). Defaults to Date.now. */
  now?: () => number;
  /** Maximum queued messages. Default 4. */
  maxSize?: number;
  /** How long a shown dedupeKey is suppressed. Default 60 s. */
  cooldownMs?: number;
  /** Id generator for messages without an explicit id. */
  generateId?: (n: number) => string;
  /** Initial enabled state. Default true. */
  enabled?: boolean;
}

/** Immutable view for `useSyncExternalStore`. */
export interface CompanionSnapshot {
  current: CompanionMessage | null;
  queued: number;
  revision: number;
}

export interface CompanionQueue {
  /** Queue a message. Returns it, or null when dropped (disabled/cooldown/full). */
  say(input: SayInput): CompanionMessage | null;
  /** The message currently on screen, or null. */
  current(): CompanionMessage | null;
  /** Remove the visible message. */
  dismiss(): void;
  /** Empty the queue (cooldowns are kept). */
  clear(): void;
  /** Expire anything past its duration and notify if it changed. */
  tick(): void;
  size(): number;
  /** Disabling empties the queue and makes `say` a no-op. */
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  subscribe(listener: () => void): () => void;
  getSnapshot(): CompanionSnapshot;
  getServerSnapshot(): CompanionSnapshot;
}

const EMPTY_SNAPSHOT: CompanionSnapshot = { current: null, queued: 0, revision: 0 };

export function createCompanionQueue(options: CompanionQueueOptions = {}): CompanionQueue {
  const now = options.now ?? (() => Date.now());
  const maxSize = Math.max(1, options.maxSize ?? DEFAULT_MAX_QUEUE);
  const cooldownMs = Math.max(0, options.cooldownMs ?? DEFAULT_COOLDOWN_MS);
  const generateId = options.generateId ?? ((n: number) => `companion-${n}`);

  let enabled = options.enabled ?? true;
  let items: CompanionMessage[] = [];
  let seq = 0;
  let revision = 0;
  const lastShownAt = new Map<string, number>();
  const listeners = new Set<() => void>();
  let snapshot: CompanionSnapshot = EMPTY_SNAPSHOT;

  const emit = (): void => {
    revision += 1;
    snapshot = { current: items[0] ?? null, queued: items.length, revision };
    for (const listener of listeners) listener();
  };

  /** Drops expired messages and stamps a head's `shownAtMs`. Returns true if anything changed. */
  const prune = (at: number): boolean => {
    let changed = false;
    while (items.length > 0) {
      const head = items[0];
      if (head.shownAtMs == null) {
        head.shownAtMs = at;
        if (head.dedupeKey) lastShownAt.set(head.dedupeKey, at);
        changed = true;
      }
      const shownAt = head.shownAtMs;
      if (at - shownAt >= head.durationMs) {
        items = items.slice(1);
        changed = true;
        continue;
      }
      break;
    }
    return changed;
  };

  const comesBefore = (a: CompanionMessage, b: CompanionMessage): number =>
    b.priority - a.priority || a.createdAtMs - b.createdAtMs;

  const say = (input: SayInput): CompanionMessage | null => {
    if (!enabled) return null;
    const at = now();
    prune(at);

    const dedupeKey = input.dedupeKey ?? null;
    const message: CompanionMessage = {
      id: input.id ?? generateId(++seq),
      text: input.text,
      kind: input.kind,
      mood: input.mood ?? DEFAULT_MOOD[input.kind],
      priority: input.priority ?? DEFAULT_PRIORITY[input.kind],
      durationMs: Math.max(0, input.durationMs ?? DEFAULT_DURATION_MS[input.kind]),
      dedupeKey,
      createdAtMs: at,
    };

    if (dedupeKey) {
      const existing = items.findIndex((m) => m.dedupeKey === dedupeKey);
      if (existing >= 0) {
        // Already queued: replace it (fresh text/duration), keep one slot.
        items.splice(existing, 1, message);
        items.sort(comesBefore);
        if (items[0] === message) {
          message.shownAtMs = undefined;
          prune(now());
        }
        emit();
        return message;
      }
      const last = lastShownAt.get(dedupeKey);
      if (last != null && at - last < cooldownMs) return null;
    }

    if (items.length >= maxSize) {
      let weakest = 0;
      for (let i = 1; i < items.length; i += 1) {
        if (items[i].priority < items[weakest].priority) weakest = i;
      }
      if (message.priority >= items[weakest].priority) {
        items.splice(weakest, 1);
      } else {
        return null;
      }
    }

    items.push(message);
    items.sort(comesBefore);
    prune(now());
    emit();
    return message;
  };

  const dismiss = (): void => {
    if (items.length === 0) return;
    items = items.slice(1);
    prune(now());
    emit();
  };

  const clear = (): void => {
    if (items.length === 0) return;
    items = [];
    emit();
  };

  const tick = (): void => {
    if (prune(now())) emit();
  };

  const setEnabled = (next: boolean): void => {
    if (enabled === next) return;
    enabled = next;
    if (!next && items.length > 0) {
      items = [];
      emit();
    }
  };

  return {
    say,
    current: () => snapshot.current,
    dismiss,
    clear,
    tick,
    size: () => items.length,
    setEnabled,
    isEnabled: () => enabled,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY_SNAPSHOT,
  };
}

/** The app-wide queue. Tests build their own with `createCompanionQueue`. */
export const companionQueue = createCompanionQueue();

/** Hand the companion something to say (no-op while the companion is off). */
export function say(input: SayInput): CompanionMessage | null {
  return companionQueue.say(input);
}
