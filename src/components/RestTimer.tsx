/**
 * RestTimer — between-set rest countdown UI.
 *
 * Consumes the theme system (`useTheme`) — no hard-coded colors or spacing.
 * Accent discipline: the accent color is reserved for completing a set, so
 * this component stays monochrome; the success token marks completion.
 *
 * Completion signal: haptics via expo-haptics (ships in Expo Go) plus a
 * timestamp-based local notification (plan §3) via expo-notifications, so
 * the alert fires even with the phone locked. Both are best-effort.
 *
 * Must be rendered inside a <ThemeProvider>.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import {
  DEFAULT_REST_MS,
  useRestTimer,
} from '../hooks/useRestTimer';

/** Quick-pick rest durations. */
const PRESETS_MS = [30_000, 60_000, 90_000, 120_000, 180_000, 300_000];
/** +/- step for the adjust buttons. */
const ADJUST_MS = 15_000;

export interface RestTimerProps {
  /** Initial selected duration. Default 90s. */
  defaultDurationMs?: number;
  /** Local-notification title on completion. Default "Rest over". */
  alertTitle?: string;
  /** Local-notification body on completion. Default "Time for your next set." */
  alertBody?: string;
  /** Fired when the rest period completes (countdown or skip). */
  onComplete?: () => void;
  /** Fired on every tick while running. */
  onTick?: (remainingMs: number) => void;
}

/** Haptics are best-effort: never let them break the timer. */
async function haptic(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Unsupported device, denied permission, etc. — the timer still works.
  }
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

function formatPreset(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`;
}

function formatAccessible(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secondWord = seconds === 1 ? 'second' : 'seconds';
  if (minutes === 0) return `${seconds} ${secondWord} remaining`;
  const minuteWord = minutes === 1 ? 'minute' : 'minutes';
  return `${minutes} ${minuteWord} ${seconds} ${secondWord} remaining`;
}

export function RestTimer({
  defaultDurationMs = DEFAULT_REST_MS,
  alertTitle = 'Rest over',
  alertBody = 'Time for your next set.',
  onComplete,
  onTick,
}: RestTimerProps): React.JSX.Element {
  const { theme } = useTheme();
  const [selectedMs, setSelectedMs] = useState(defaultDurationMs);

  const handleComplete = useCallback(() => {
    void haptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    );
    onComplete?.();
  }, [onComplete]);

  const {
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
  } = useRestTimer({
    defaultDurationMs: selectedMs,
    completionAlert: { title: alertTitle, body: alertBody },
    onComplete: handleComplete,
    onTick,
  });

  const running = phase === 'running';
  const paused = phase === 'paused';
  const complete = phase === 'complete';
  const active = running || paused;

  // Before starting, show the selected duration; afterwards, the live value.
  const displayMs = phase === 'idle' ? selectedMs : remainingMs;

  const statusText =
    phase === 'running'
      ? 'RESTING'
      : phase === 'paused'
        ? 'PAUSED'
        : complete
          ? 'REST COMPLETE'
          : 'REST';

  const selectPreset = useCallback(
    (ms: number) => {
      if (running) return;
      void haptic(() => Haptics.selectionAsync());
      setSelectedMs(ms);
      if (phase !== 'idle') reset();
    },
    [running, phase, reset],
  );

  const handleMainPress = useCallback(() => {
    void haptic(() =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    );
    if (phase === 'idle' || complete) {
      start(selectedMs);
    } else if (running) {
      pause();
    } else {
      resume();
    }
  }, [phase, complete, running, selectedMs, start, pause, resume]);

  const mainLabel =
    phase === 'idle'
      ? 'Start rest'
      : running
        ? 'Pause'
        : paused
          ? 'Resume'
          : 'Rest again';

  const c = theme.colors;
  const s = theme.spacing;
  const t = theme.typography;
  const r = theme.radius;

  return (
    <View
      style={[styles.container, { gap: s.md, padding: s.lg }]}
      accessibilityRole="timer"
      accessibilityLabel={`Rest timer, ${formatAccessible(displayMs)}`}
    >
      <Text
        style={[
          styles.status,
          {
            color: complete ? c.success : c.muted,
            fontSize: t.size.caption,
            letterSpacing: 2,
          },
        ]}
      >
        {statusText}
      </Text>

      <Text
        style={[
          styles.time,
          {
            color: c.text,
            fontSize: t.size.display * 1.5,
            fontWeight: t.weight.bold,
          },
        ]}
      >
        {formatMs(displayMs)}
      </Text>

      <View
        style={[
          styles.track,
          { backgroundColor: c.surfaceMuted, borderRadius: r.pill },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(progress * 100)}%` as const,
              backgroundColor: complete ? c.success : c.text,
              borderRadius: r.pill,
            },
          ]}
        />
      </View>

      <View style={[styles.row, { gap: s.sm }]}>
        {PRESETS_MS.map((ms) => {
          const selected = !active && selectedMs === ms;
          return (
            <Pressable
              key={ms}
              onPress={() => selectPreset(ms)}
              disabled={running}
              accessibilityRole="button"
              accessibilityLabel={`Set rest to ${formatPreset(ms)}`}
              accessibilityState={{ selected, disabled: running }}
              style={[
                styles.preset,
                {
                  borderRadius: r.pill,
                  paddingVertical: s.xs,
                  paddingHorizontal: s.sm,
                  borderWidth: 1,
                  borderColor: selected ? c.text : c.border,
                  backgroundColor: selected ? c.text : 'transparent',
                  opacity: running ? 0.4 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? c.background : c.text,
                  fontSize: t.size.caption,
                  fontWeight: t.weight.medium,
                }}
              >
                {formatPreset(ms)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.row, { gap: s.sm }]}>
        <GhostButton
          label="−15s"
          disabled={!active}
          onPress={() => addTime(-ADJUST_MS)}
          accessibilityLabel="Shorten rest by 15 seconds"
        />
        <GhostButton
          label="+15s"
          disabled={!active}
          onPress={() => addTime(ADJUST_MS)}
          accessibilityLabel="Extend rest by 15 seconds"
        />
        <GhostButton
          label="Skip"
          disabled={!active}
          onPress={() => skip()}
          accessibilityLabel="Skip rest"
        />
        <GhostButton
          label="Reset"
          disabled={phase === 'idle'}
          onPress={() => reset()}
          accessibilityLabel="Reset rest timer"
        />
      </View>

      <Pressable
        onPress={handleMainPress}
        accessibilityRole="button"
        accessibilityLabel={mainLabel}
        style={[
          styles.mainButton,
          {
            backgroundColor: c.text,
            borderRadius: r.lg,
            paddingVertical: s.md,
            marginTop: s.sm,
          },
        ]}
      >
        <Text
          style={{
            color: c.background,
            fontSize: t.size.body,
            fontWeight: t.weight.bold,
            textAlign: 'center',
          }}
        >
          {mainLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function GhostButton({
  label,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const s = theme.spacing;
  const t = theme.typography;
  const r = theme.radius;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        styles.ghost,
        {
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: r.md,
          paddingVertical: s.xs,
          paddingHorizontal: s.sm,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: c.text,
          fontSize: t.size.caption,
          fontWeight: t.weight.medium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
  },
  status: {
    textAlign: 'center',
    fontWeight: '600',
  },
  time: {
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  preset: {
    minWidth: 52,
    alignItems: 'center',
  },
  ghost: {
    minWidth: 56,
    alignItems: 'center',
  },
  mainButton: {
    minHeight: 52,
    justifyContent: 'center',
  },
});
