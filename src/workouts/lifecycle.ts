/**
 * Workout lifecycle: finds open workouts, decides what is ongoing / idle /
 * stale, closes the abandoned ones on the user's behalf, and keeps the
 * "still training?" notifications in step with reality.
 *
 * Everything runs on the device. iOS cannot run our code in the background,
 * so closing is LAZY — it happens the next time the app is opened or
 * foregrounded — and local notifications are the nudge in between. The end
 * time recorded for an auto-closed workout is its last real activity, never
 * "now", so history and durations stay honest.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import {
  finishWorkout,
  listOpenWorkouts,
  softDeleteWorkout,
  type WorkoutDetail,
} from '../data/repositories';
import { getSettings } from '../data/settings';
import { prepareLocalAlerts } from '../notifications/restAlert';
import {
  alertTimes,
  formatIdle,
  idleMs,
  latestActivity,
  normalizePolicy,
  planReconcile,
  type IdlePolicy,
  type IdleState,
  type OpenWorkoutFacts,
} from './policy';

const HEARTBEAT_KEY = 'lift:workout-heartbeat';
const NOTICES_KEY = 'lift:workout-notices';
const ALERT_IDS_KEY = 'lift:workout-alert-ids';
const ALERT_KIND = 'lift-workout-idle';

export interface OpenWorkoutStatus {
  id: string;
  name: string;
  startedAt: number;
  lastActivityAt: number;
  idleMs: number;
  idleText: string;
  state: IdleState;
  exerciseCount: number;
  setCount: number;
}

export interface AutoClosedNotice {
  workoutId: string;
  name: string;
  /** 'finish' keeps the workout in history; 'discard' removed an empty one. */
  action: 'finish' | 'discard';
  reason: 'stale' | 'duplicate';
  endedAt: number;
  setCount: number;
  closedAt: number;
}

export interface ReconcileResult {
  /** The workout that is still open, if any (idle ones are flagged via `state`). */
  current: OpenWorkoutStatus | null;
  /** True when the user should be asked "still training?" right now. */
  shouldPrompt: boolean;
  /** Workouts LIFT closed during this pass. */
  closed: AutoClosedNotice[];
}

/* ---------------- heartbeat: "the workout screen is open" ---------------- */

/** Records that the user is looking at this workout right now. */
export async function recordHeartbeat(workoutId: string, at = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(HEARTBEAT_KEY, JSON.stringify({ id: workoutId, at }));
  } catch {
    // Best effort — worst case the DB activity timestamps are used.
  }
}

async function readHeartbeat(): Promise<{ id: string; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(HEARTBEAT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { id?: string; at?: number };
    return typeof v.id === 'string' && typeof v.at === 'number' ? { id: v.id, at: v.at } : null;
  } catch {
    return null;
  }
}

/* ---------------- activity facts ---------------- */

function lastActivityOf(detail: WorkoutDetail, heartbeat: { id: string; at: number } | null): number {
  const stamps: number[] = [new Date(detail.workout.updatedAt).getTime()];
  for (const item of detail.items) {
    stamps.push(new Date(item.workoutExercise.createdAt).getTime());
    stamps.push(new Date(item.workoutExercise.updatedAt).getTime());
    for (const s of item.sets) {
      stamps.push(new Date(s.createdAt).getTime());
      stamps.push(new Date(s.updatedAt).getTime());
    }
  }
  if (heartbeat && heartbeat.id === detail.workout.id) stamps.push(heartbeat.at);
  return latestActivity(new Date(detail.workout.startedAt).getTime(), stamps);
}

function toFacts(detail: WorkoutDetail, heartbeat: { id: string; at: number } | null): OpenWorkoutFacts {
  return {
    id: detail.workout.id,
    startedAtMs: new Date(detail.workout.startedAt).getTime(),
    lastActivityMs: lastActivityOf(detail, heartbeat),
    loggedSets: detail.items.reduce((n, i) => n + i.sets.length, 0),
  };
}

export async function loadPolicy(): Promise<IdlePolicy> {
  const s = await getSettings();
  return normalizePolicy({ promptAfterMin: s.idlePromptMinutes, autoFinishAfterMin: s.autoFinishMinutes });
}

/* ---------------- notices (what LIFT did while you were away) ---------------- */

export async function getNotices(): Promise<AutoClosedNotice[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTICES_KEY);
    return raw ? (JSON.parse(raw) as AutoClosedNotice[]) : [];
  } catch {
    return [];
  }
}

export async function dismissNotice(workoutId: string): Promise<void> {
  const next = (await getNotices()).filter((n) => n.workoutId !== workoutId);
  await AsyncStorage.setItem(NOTICES_KEY, JSON.stringify(next)).catch(() => undefined);
}

async function addNotices(items: AutoClosedNotice[]): Promise<void> {
  if (items.length === 0) return;
  const kept = (await getNotices()).slice(-4); // never let it grow unbounded
  await AsyncStorage.setItem(NOTICES_KEY, JSON.stringify([...kept, ...items])).catch(() => undefined);
}

/* ---------------- notifications ---------------- */

async function cancelAlerts(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ALERT_IDS_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
    await AsyncStorage.removeItem(ALERT_IDS_KEY);
  } catch {
    // ignore
  }
}

/**
 * (Re)schedules the two nudges for an open workout:
 *  1. "Still training?" at last activity + prompt window
 *  2. "Finishing automatically soon" 15 min before the auto-finish window
 * Cancels everything when nothing is open. Safe to call often.
 */
export async function syncIdleAlerts(
  current: { name: string; lastActivityAt: number } | null,
  policy: IdlePolicy,
): Promise<void> {
  await cancelAlerts();
  if (!current) return;
  const ready = await prepareLocalAlerts().catch(() => null);
  if (!ready) return;
  const now = Date.now();
  const { checkInAt, finishWarnAt } = alertTimes(current.lastActivityAt, policy);
  const ids: string[] = [];
  const schedule = async (at: number, title: string, body: string): Promise<void> => {
    if (at <= now + 5_000) return;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { kind: ALERT_KIND } },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: at, channelId: ready.channelId },
      });
      ids.push(id);
    } catch {
      // ignore a single failed schedule
    }
  };
  await schedule(
    checkInAt,
    'Still training?',
    `"${current.name}" has been quiet for ${policy.promptAfterMin} min. Open LIFT to resume or finish it.`,
  );
  if (finishWarnAt != null) {
    await schedule(
      finishWarnAt,
      'Finishing your workout soon',
      `"${current.name}" will be finished automatically at your last set unless you resume.`,
    );
  }
  await AsyncStorage.setItem(ALERT_IDS_KEY, JSON.stringify(ids)).catch(() => undefined);
}

/* ---------------- reconcile ---------------- */

/**
 * The single entry point. Call on app launch, on foreground, on Train focus
 * and after the workout changes. Idempotent.
 */
export async function reconcileWorkouts(now = Date.now()): Promise<ReconcileResult> {
  const [open, policy, heartbeat] = await Promise.all([listOpenWorkouts(), loadPolicy(), readHeartbeat()]);
  const detailById = new Map(open.map((d) => [d.workout.id, d]));
  const plan = planReconcile(now, open.map((d) => toFacts(d, heartbeat)), policy);

  const closed: AutoClosedNotice[] = [];
  for (const c of plan.closes) {
    const detail = detailById.get(c.workout.id);
    const name = detail?.workout.name ?? 'Workout';
    try {
      if (c.action === 'finish') await finishWorkout(c.workout.id, new Date(c.endedAtMs));
      else await softDeleteWorkout(c.workout.id);
      closed.push({
        workoutId: c.workout.id,
        name,
        action: c.action,
        reason: c.reason,
        endedAt: c.endedAtMs,
        setCount: c.workout.loggedSets,
        closedAt: now,
      });
    } catch (e) {
      console.warn('[lifecycle] could not auto-close workout', c.workout.id, e);
    }
  }
  // Only finished workouts need a notice; silently dropping an empty one is fine.
  await addNotices(closed.filter((c) => c.action === 'finish'));

  let current: OpenWorkoutStatus | null = null;
  if (plan.current && plan.currentState && detailById.get(plan.current.id)) {
    const d = detailById.get(plan.current.id)!;
    const idle = idleMs(now, plan.current.lastActivityMs);
    current = {
      id: plan.current.id,
      name: d.workout.name,
      startedAt: plan.current.startedAtMs,
      lastActivityAt: plan.current.lastActivityMs,
      idleMs: idle,
      idleText: formatIdle(idle),
      state: plan.currentState,
      exerciseCount: d.items.length,
      setCount: plan.current.loggedSets,
    };
  }
  await syncIdleAlerts(current ? { name: current.name, lastActivityAt: current.lastActivityAt } : null, policy);
  return { current, shouldPrompt: current?.state === 'idle', closed };
}

/** User chose "Finish" on an idle workout: end it at its last real activity. */
export async function finishAtLastActivity(status: OpenWorkoutStatus): Promise<void> {
  const endedAt = new Date(Math.max(status.lastActivityAt, status.startedAt + 60_000));
  await finishWorkout(status.id, endedAt);
  await syncIdleAlerts(null, await loadPolicy());
}
