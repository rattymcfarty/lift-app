/**
 * Weekly workout reminders — local notifications only, scheduled on the
 * device. No server, no push token, nothing leaves the phone. The schedule
 * is stored in AsyncStorage and re-applied whenever the user changes it.
 */
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { prepareLocalAlerts } from './restAlert';

export interface ReminderSettings {
  enabled: boolean;
  /** Weekdays, 0 = Sunday … 6 = Saturday. */
  days: number[];
  hour: number;
  minute: number;
}

const KEY = 'lift:reminders';
const KIND = 'lift-workout-reminder';

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, days: [1, 3, 5], hour: 18, minute: 0 };

export async function getReminders(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_REMINDERS, ...(JSON.parse(raw) as Partial<ReminderSettings>) } : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

async function cancelOurs(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => (n.content.data as { kind?: string } | null)?.kind === KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

const MESSAGES = [
  'Your session is ready. Even a short one counts.',
  'Strong for life: today is a training day.',
  'Show up, do the work, leave 2-3 reps in the tank.',
];

/**
 * Persists the schedule and (re)creates the notifications. Returns false
 * when the user turned reminders on but notification permission is denied
 * — the caller should say so rather than pretend it worked.
 */
export async function applyReminders(next: ReminderSettings): Promise<boolean> {
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  try {
    await cancelOurs();
  } catch {
    // Nothing scheduled yet / platform quirk — safe to continue.
  }
  if (!next.enabled || next.days.length === 0) return true;
  const ready = await prepareLocalAlerts();
  if (!ready) return false;
  let i = 0;
  for (const day of next.days) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Time to train', body: MESSAGES[i++ % MESSAGES.length], data: { kind: KIND } },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: day + 1, // expo: 1 = Sunday … 7 = Saturday
        hour: next.hour,
        minute: next.minute,
        channelId: ready.channelId,
      },
    });
  }
  return true;
}
