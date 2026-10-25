/**
 * WorkoutBadge — "a session is running, here is how long, tap to go back".
 *
 * Part of the floating chrome, on every screen except the workout itself. The
 * owner's rule: an ongoing session outranks whatever else the user wandered into.
 * The badge is deliberately small (a dot and the elapsed time) because it lives in
 * the top band between the companion and the settings button, where a wordier
 * label would crowd a 320 pt phone; the full sentence is its accessibility label
 * and the tap target carries a generous hitSlop.
 *
 * Ticks once a second only while it is mounted (i.e. only while a session is
 * open), and taps use `navigate` so returning to the workout does not stack
 * duplicate workout screens.
 */
import { useEffect, useState, type JSX } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { withAlpha } from '../../theme/color';
import { Glass } from '../ui/Glass';
import { formatElapsed, type ActiveSession } from '../../workout/activeSession';

export function WorkoutBadge({ session }: { session: ActiveSession }): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = formatElapsed(session.startedAt, now);

  return (
    <Pressable
      testID="topbar-workout"
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        router.navigate(`/workout/${session.id}` as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Workout in progress, ${session.name}, ${elapsed} elapsed. Return to the workout.`}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <Glass
        shape="pill"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 30,
          paddingHorizontal: 10,
          backgroundColor: withAlpha(c.accent, 0.18),
          borderColor: withAlpha(c.accent, 0.55),
        }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} />
        <Text
          testID="topbar-workout-elapsed"
          style={{
            color: c.text,
            fontSize: theme.typography.size.caption,
            fontWeight: theme.typography.weight.bold,
            fontVariant: ['tabular-nums'],
          }}
          maxFontSizeMultiplier={1.2}
        >
          {elapsed}
        </Text>
      </Glass>
    </Pressable>
  );
}
