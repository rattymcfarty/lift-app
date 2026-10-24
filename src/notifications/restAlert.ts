/**
 * Rest-timer completion alerts via timestamp-based local notifications.
 *
 * Plan §3 requires the rest timer to alert with a local notification (never
 * tick-counting). The countdown itself stays timestamp-based in
 * `useRestTimer`; this module mirrors it into one OS-scheduled notification
 * so the user is alerted even with the phone locked or the app backgrounded.
 *
 * - Scheduling is best-effort: denied permission or missing native module
 *   never breaks the timer (in-app haptics still fire on foreground).
 * - Permission is requested lazily on the first timer start, never on mount.
 * - Foreground presentation is suppressed when the app is open (the in-app
 *   UI + haptics already signal completion); the banner/sound only appear
 *   when the user isn't looking at the app. (The handler governs foreground
 *   presentation; backgrounded/locked delivery falls back to OS defaults,
 *   which is exactly the split we want — the AppState check keeps it
 *   correct on platforms where the handler also runs in background.)
 * - Android 12+ note: without the SCHEDULE_EXACT_ALARM permission, DATE
 *   triggers use inexact alarms and can arrive late under deep Doze. The
 *   permission is deliberately NOT declared here: it needs a Play Console
 *   declaration and a Settings-grant UX, which is a P6 release decision.
 *   The in-app haptic path stays exact while the app is open.
 * - expo-notifications ships inside Expo Go — no custom native code.
 */

import { AppState, Platform } from 'react-native';
import { notifications } from './native';

const CHANNEL_ID = 'lift-rest-timer';

let handlerInstalled = false;

/** Install the foreground handler once per app lifetime. */
function ensureHandler(): void {
  if (handlerInstalled) return;
  const N = notifications();
  if (!N) return; // Expo Go built before the module existed — stay silent.
  handlerInstalled = true;
  N.setNotificationHandler({
    handleNotification: async () => {
      // When the app is open the timer UI + haptics already announce
      // completion — only banner when the user isn't looking.
      const foreground = AppState.currentState === 'active';
      return {
        shouldShowBanner: !foreground,
        shouldShowList: !foreground,
        shouldPlaySound: !foreground,
        shouldSetBadge: false,
      };
    },
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const N = notifications();
  if (!N) return;
  try {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rest timer',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  } catch {
    // Channel setup is a nicety; the default channel still delivers.
  }
}

/**
 * True when we may schedule. Permission is requested lazily on the first
 * timer start, never on mount. Uses `canAskAgain` so a permanent denial
 * (user chose "don't ask again", or OS policy) doesn't nag every start —
 * but a later grant in OS Settings takes effect immediately since the
 * current status is re-read each time.
 */
async function canAlert(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  try {
    const existing = await N.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const requested = await N.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export interface RestAlertContent {
  title: string;
  body: string;
}

/**
 * Schedule a one-shot local notification for an absolute timestamp.
 * Returns the notification id, or null when alerts aren't available.
 * Cancelling the returned id before it fires is the caller's job.
 */
export async function scheduleRestAlert(
  atTimestamp: number,
  content: RestAlertContent,
): Promise<string | null> {
  if (atTimestamp <= Date.now()) return null;
  const N = notifications();
  if (!N) return null;
  ensureHandler();
  // Channel first: on Android 13+ the POST_NOTIFICATIONS prompt is tied to
  // channel existence — asking before any channel exists never surfaces.
  await ensureAndroidChannel();
  if (!(await canAlert())) return null;
  try {
    return await N.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: atTimestamp,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
  } catch {
    return null;
  }
}

/** Cancel a scheduled rest alert. Safe to call with null/unknown ids. */
export async function cancelRestAlert(id: string | null): Promise<void> {
  if (!id) return;
  const N = notifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already cancelled — nothing to do.
  }
}

/**
 * Shared readiness gate for other local notifications (workout reminders):
 * installs the foreground handler, ensures the Android channel exists and
 * asks for permission when it can. Returns the channel id when alerts may
 * be scheduled, or null when they may not.
 */
/** Install at import time, so a notification that fires after a cold start is
 * presented correctly without waiting for the first schedule call. */
ensureHandler();

export async function prepareLocalAlerts(): Promise<{ channelId: string | undefined } | null> {
  ensureHandler();
  await ensureAndroidChannel();
  if (!(await canAlert())) return null;
  return { channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined };
}
