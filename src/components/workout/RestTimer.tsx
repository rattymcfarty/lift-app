/**
 * Rest countdown chip shown after a set is logged.
 *
 * Built on workstream #4's `useRestTimer`, which implements plan §3:
 * timestamp-based countdown (never tick-counting — immune to background
 * throttling), AppState-aware, and mirrored into a local notification so
 * the user is alerted with the phone locked. Tapping the chip skips the
 * rest (finishes immediately).
 *
 * Props contract: `seconds` in, `onDone` out (fired once when the countdown
 * reaches zero or the user skips). The parent unmounts this chip in onDone.
 */

import { useEffect, useRef, type JSX } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRestTimer } from '../../hooks/useRestTimer';
import { useTheme } from '../../theme';
import { formatDuration } from './format';

interface RestTimerProps {
  seconds: number;
  onDone: () => void;
}

export function RestTimer({ seconds, onDone }: RestTimerProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;

  // Latest-callback ref: the hook stores callbacks in refs itself, but this
  // keeps the options object identity-independent anyway.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const { remainingMs, phase, start, skip } = useRestTimer({
    onComplete: () => onDoneRef.current(),
    completionAlert: { title: 'Rest over', body: 'Time for your next set.' },
  });

  // (Re)start when the requested length changes. The parent also remounts
  // this chip via `key` after every logged set, so this is belt-and-braces.
  useEffect(() => {
    start(Math.max(0, Math.round(seconds)) * 1000);
  }, [seconds, start]);

  if (phase === 'complete' || phase === 'idle') {
    // Complete: onDone has fired and the parent is about to unmount us.
    return <></>;
  }

  return (
    <Pressable
      onPress={() => skip()}
      accessibilityRole="button"
      accessibilityLabel={`Rest timer, ${Math.ceil(remainingMs / 1000)} seconds left. Tap to skip.`}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.pill,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
        Rest{' '}
        <Text style={{ color: theme.colors.text, fontWeight: t.weight.bold }}>
          {formatDuration(remainingMs)}
        </Text>{' '}
        · tap to skip
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
});
