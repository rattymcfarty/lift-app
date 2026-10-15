/**
 * Mounted once at the app root (after the database is ready). On launch and
 * every time the app returns to the foreground it reconciles open workouts:
 *  - tells the user about workouts LIFT finished on their behalf, and
 *  - asks "still working out?" when the current workout has gone quiet.
 * Renders nothing.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { router } from 'expo-router';
import { softDeleteWorkout } from '../data/repositories';
import {
  finishAtLastActivity,
  reconcileWorkouts,
  type OpenWorkoutStatus,
} from './lifecycle';

/** Don't re-ask about the same workout more often than this. */
const REPROMPT_MS = 20 * 60_000;

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function WorkoutLifecycleWatcher(): null {
  const lastPrompt = useRef<{ id: string; at: number } | null>(null);
  const busy = useRef(false);

  const prompt = useCallback((s: OpenWorkoutStatus) => {
    lastPrompt.current = { id: s.id, at: Date.now() };
    const buttons = [
      { text: 'Resume', onPress: () => router.push(`/workout/${s.id}`) },
      {
        text: 'Finish workout',
        onPress: () => {
          void finishAtLastActivity(s)
            .then(() => router.push(`/workout/${s.id}/summary`))
            .catch(() => Alert.alert('Could not finish the workout', 'Open it and try again.'));
        },
      },
      ...(s.setCount === 0
        ? [
            {
              text: 'Discard',
              style: 'destructive' as const,
              onPress: () => {
                void softDeleteWorkout(s.id).then(() => reconcileWorkouts());
              },
            },
          ]
        : []),
      { text: 'Not now', style: 'cancel' as const },
    ];
    Alert.alert(
      'Still working out?',
      `"${s.name}" has had no activity for ${s.idleText} (last at ${clock(s.lastActivityAt)}, ${s.setCount} set${s.setCount === 1 ? '' : 's'} logged).\n\nIf you don't respond it will be finished automatically at your last activity.`,
      buttons,
    );
  }, []);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await reconcileWorkouts();
      const finished = res.closed.filter((c) => c.action === 'finish');
      if (finished.length > 0) {
        const lines = finished
          .map((c) => `• "${c.name}" — ${c.setCount} set${c.setCount === 1 ? '' : 's'}, ended ${clock(c.endedAt)}`)
          .join('\n');
        Alert.alert(
          finished.length === 1 ? 'Workout finished automatically' : 'Workouts finished automatically',
          `${lines}\n\nThey went quiet, so LIFT closed them at your last activity. Everything you logged is saved.`,
        );
      } else if (res.shouldPrompt && res.current) {
        const lp = lastPrompt.current;
        if (!lp || lp.id !== res.current.id || Date.now() - lp.at > REPROMPT_MS) prompt(res.current);
      }
    } catch (e) {
      console.warn('[lifecycle] reconcile failed', e);
    } finally {
      busy.current = false;
    }
  }, [prompt]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  return null;
}
