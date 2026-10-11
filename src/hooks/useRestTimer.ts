/**
 * useRestTimer — countdown hook for between-set rest periods.
 *
 * Design notes:
 * - Time is tracked with wall-clock timestamps (`endsAt`), not by counting
 *   interval ticks. If the OS suspends JS (app backgrounded, screen locked),
 *   the next tick recomputes from `Date.now()`, so the countdown never
 *   drifts. An `AppState` listener forces a recompute on foreground.
 * - Completion also mirrors into a timestamp-based local notification
 *   (plan §3), so the user is alerted with the phone locked or the app
 *   backgrounded. If the timer elapses while JS is suspended, `onComplete`
 *   additionally fires on the next foreground tick.
 * - No network, no persistence — pure local state. Expo Go compatible
 *   (React Native core + expo-notifications, which ships in Expo Go).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  cancelRestAlert,
  scheduleRestAlert,
  type RestAlertContent,
} from '../notifications/restAlert';

export type RestTimerPhase = 'idle' | 'running' | 'paused' | 'complete';

export interface UseRestTimerOptions {
  /** Default countdown length in ms when `start()` is called without one. */
  defaultDurationMs?: number;
  /** Recompute cadence while running, in ms. Default 200. */
  tickIntervalMs?: number;
  /**
   * When set, mirror the countdown into a timestamp-based local
   * notification (plan §3) so completion alerts even with the phone locked.
   * Best-effort: denied permission never breaks the timer.
   */
  completionAlert?: RestAlertContent;
  onTick?: (remainingMs: number) => void;
  onComplete?: () => void;
}

export interface UseRestTimer {
  phase: RestTimerPhase;
  /** ms left on the countdown (0 when idle/complete). */
  remainingMs: number;
  /** The duration the current (or most recent) countdown was started with. */
  totalMs: number;
  /** 0..1 fraction of the countdown elapsed. */
  progress: number;
  start: (durationMs?: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** Finish immediately — fires `onComplete`. */
  skip: () => void;
  /** Shift the countdown by deltaMs (positive extends, negative shortens). */
  addTime: (deltaMs: number) => void;
}

/** Sensible gym rest default: 90 seconds. */
export const DEFAULT_REST_MS = 90_000;

export function useRestTimer(options: UseRestTimerOptions = {}): UseRestTimer {
  const {
    defaultDurationMs = DEFAULT_REST_MS,
    tickIntervalMs = 200,
    completionAlert,
    onTick,
    onComplete,
  } = options;

  const [phase, setPhase] = useState<RestTimerPhase>('idle');
  const [remainingMs, setRemainingMs] = useState(0);
  const [totalMs, setTotalMs] = useState(defaultDurationMs);

  // Mutable countdown state lives in refs so intervals and callbacks never
  // go stale. remainingRef mirrors the rendered state for logic use.
  const endsAtRef = useRef<number | null>(null);
  const remainingRef = useRef(0);
  const completedRef = useRef(false);
  const phaseRef = useRef<RestTimerPhase>('idle');
  const alertIdRef = useRef<string | null>(null);
  // Generation counter: scheduling is async (it can wait on the permission
  // dialog), so a pause/reset/skip/unmount that lands mid-schedule must
  // invalidate the in-flight attempt instead of orphaning a notification.
  const alertGenRef = useRef(0);

  // Callbacks in refs: effects below run once per mount and must always
  // call the latest callbacks without re-subscribing.
  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);
  const alertContentRef = useRef(completionAlert);
  onTickRef.current = onTick;
  onCompleteRef.current = onComplete;
  alertContentRef.current = completionAlert;

  const setPhaseBoth = useCallback((next: RestTimerPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const setRemainingBoth = useCallback((next: number) => {
    remainingRef.current = next;
    setRemainingMs(next);
  }, []);

  /** Drop any pending completion notification (pause/reset/finish). */
  const cancelAlert = useCallback(async () => {
    // Invalidate any schedule that's still awaiting the permission dialog
    // or the native scheduler — it will self-cancel on completion.
    alertGenRef.current++;
    const id = alertIdRef.current;
    alertIdRef.current = null;
    await cancelRestAlert(id);
  }, []);

  /** Mirror the countdown end into an OS-scheduled notification. */
  const scheduleAlert = useCallback(async (atTimestamp: number) => {
    const content = alertContentRef.current;
    if (!content) return;
    // Invalidate synchronously BEFORE the first await: with two overlapping
    // schedules (rapid ±15s taps), each must capture a distinct generation —
    // reading it after an await lets both see the same value and orphan one.
    alertGenRef.current++;
    const gen = alertGenRef.current;
    const oldId = alertIdRef.current;
    alertIdRef.current = null;
    await cancelRestAlert(oldId);
    const id = await scheduleRestAlert(atTimestamp, content);
    if (gen === alertGenRef.current) {
      alertIdRef.current = id;
    } else {
      // Superseded while scheduling (pause/reset/skip/unmount won the
      // race) — kill the orphan so no stale alert fires.
      await cancelRestAlert(id);
    }
  }, []);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    endsAtRef.current = null;
    void cancelAlert();
    setRemainingBoth(0);
    setPhaseBoth('complete');
    onCompleteRef.current?.();
  }, [setPhaseBoth, setRemainingBoth, cancelAlert]);

  const start = useCallback(
    (durationMs?: number) => {
      const total = Math.max(0, durationMs ?? defaultDurationMs);
      completedRef.current = false;
      const endsAt = Date.now() + total;
      endsAtRef.current = endsAt;
      setTotalMs(total);
      setRemainingBoth(total);
      if (total === 0) {
        finish();
      } else {
        setPhaseBoth('running');
        void scheduleAlert(endsAt);
      }
    },
    [defaultDurationMs, finish, setPhaseBoth, setRemainingBoth, scheduleAlert],
  );

  const pause = useCallback(() => {
    if (phaseRef.current !== 'running' || endsAtRef.current === null) return;
    const remaining = Math.max(0, endsAtRef.current - Date.now());
    endsAtRef.current = null;
    void cancelAlert();
    setRemainingBoth(remaining);
    setPhaseBoth('paused');
  }, [setPhaseBoth, setRemainingBoth, cancelAlert]);

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    completedRef.current = false;
    const endsAt = Date.now() + remainingRef.current;
    endsAtRef.current = endsAt;
    setPhaseBoth('running');
    void scheduleAlert(endsAt);
  }, [setPhaseBoth, scheduleAlert]);

  const reset = useCallback(() => {
    endsAtRef.current = null;
    completedRef.current = false;
    void cancelAlert();
    setRemainingBoth(0);
    setPhaseBoth('idle');
  }, [setPhaseBoth, setRemainingBoth, cancelAlert]);

  const skip = useCallback(() => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'complete') return;
    finish();
  }, [finish]);

  const addTime = useCallback(
    (deltaMs: number) => {
      const currentPhase = phaseRef.current;
      if (currentPhase === 'idle' || currentPhase === 'complete') return;
      if (currentPhase === 'running' && endsAtRef.current !== null) {
        const prevRemaining = Math.max(0, endsAtRef.current - Date.now());
        endsAtRef.current += deltaMs;
        const next = Math.max(0, endsAtRef.current - Date.now());
        setRemainingBoth(next);
        setTotalMs((total) => total + (next - prevRemaining));
        if (next === 0) {
          finish();
        } else {
          void scheduleAlert(endsAtRef.current);
        }
      } else if (currentPhase === 'paused') {
        const prevRemaining = remainingRef.current;
        const next = Math.max(0, prevRemaining + deltaMs);
        setRemainingBoth(next);
        setTotalMs((total) => total + (next - prevRemaining));
        if (next === 0) finish();
      }
    },
    [finish, setRemainingBoth, scheduleAlert],
  );

  // Drop any pending alert if the owning component unmounts mid-rest.
  useEffect(() => {
    return () => {
      alertGenRef.current++;
      const id = alertIdRef.current;
      alertIdRef.current = null;
      void cancelRestAlert(id);
    };
  }, []);

  // The ticking loop: recompute from the wall clock so backgrounding can't
  // cause drift. Runs for the lifetime of the hook; cheap when idle.
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== 'running' || endsAtRef.current === null) return;
      const remaining = endsAtRef.current - Date.now();
      if (remaining <= 0) {
        finish();
      } else {
        setRemainingBoth(remaining);
        onTickRef.current?.(remaining);
      }
    }, tickIntervalMs);
    return () => clearInterval(id);
  }, [tickIntervalMs, finish, setRemainingBoth]);

  // Foreground catch-up: the OS may have suspended JS while we were away.
  // Recompute immediately instead of waiting for the next interval tick.
  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState !== 'active') return;
        if (phaseRef.current !== 'running' || endsAtRef.current === null) {
          return;
        }
        const remaining = endsAtRef.current - Date.now();
        if (remaining <= 0) {
          finish();
        } else {
          setRemainingBoth(remaining);
          onTickRef.current?.(remaining);
        }
      },
    );
    return () => sub.remove();
  }, [finish, setRemainingBoth]);

  // Idle (never started, or reset) shows an empty bar; complete shows full.
  const progress =
    phase === 'idle' || totalMs <= 0
      ? 0
      : Math.min(1, Math.max(0, 1 - remainingMs / totalMs));

  return {
    phase,
    remainingMs,
    totalMs,
    progress,
    start,
    pause,
    resume,
    reset,
    skip,
    addTime,
  };
}
