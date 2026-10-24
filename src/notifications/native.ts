/**
 * `expo-notifications`, loaded lazily and defensively.
 *
 * Why this exists: Expo Go ships a *fixed* set of native modules, frozen when
 * that Expo Go build was published. Our JS package (`expo-notifications`
 * 58.1.6) imports `ExpoTopicSubscriptionModule` at module load on Android, but
 * Expo Go on Android (58.0.5) predates it, so the bare import throws
 * "Cannot find native module 'ExpoTopicSubscriptionModule'" while the router is
 * evaluating `app/_layout.tsx` — the whole app fails to start.
 *
 * A development build (and the release APK, which bundles the module) has it.
 * So instead of pinning the JS package back and drifting from the SDK's
 * recommended version, load the module on demand and treat "not present" as
 * "notifications are off". Everything else — the app, training, history — works.
 *
 * Rules for callers:
 *   - import only *types* from `expo-notifications` (`import type`), never the
 *     module itself;
 *   - call `notifications()` at the point of use and no-op when it returns null;
 *   - use the API object it returns (`N.SchedulableTriggerInputTypes`, not a
 *     named import), so nothing evaluates the native module at import time.
 */

/** The module's own type, without importing its runtime. */
export type NotificationsApi = typeof import('expo-notifications');

let cached: NotificationsApi | null | undefined;

/**
 * The notifications API, or null when this runtime does not provide it.
 * The failure is cached: requiring a broken module again would throw again.
 */
export function notifications(): NotificationsApi | null {
  if (cached !== undefined) return cached;
  try {
    // Metro still bundles the module; this call is what throws when a native
    // module is missing, and require() propagates it synchronously.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsApi;
  } catch (error) {
    cached = null;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // Visible once in the dev console instead of a silent feature loss.
      console.warn('[notifications] native module unavailable — local alerts are off in this build.', error);
    }
  }
  return cached;
}

/** True when local notifications can be scheduled on this runtime. */
export function notificationsAvailable(): boolean {
  return notifications() !== null;
}
