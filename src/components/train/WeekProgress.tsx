/**
 * "This week" — seven day dots (Mon–Sun) plus an animated bar toward the
 * weekly session goal. Pure presentation; the screen supplies the data.
 */
import { useEffect, useRef, type JSX } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useTheme } from '../../theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface WeekProgressProps {
  /** Monday-first booleans: did the user train that day? */
  trained: boolean[];
  /** 0-6, Monday = 0. */
  todayIndex: number;
  goal: number;
}

export function WeekProgress({ trained, todayIndex, goal }: WeekProgressProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const done = trained.filter(Boolean).length;
  const target = Math.max(1, goal);
  const fraction = Math.min(1, done / target);
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: fraction,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fraction, width]);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {LETTERS.map((l, i) => {
          const on = trained[i];
          const today = i === todayIndex;
          return (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ color: today ? c.text : c.faint, fontSize: t.size.caption, fontWeight: today ? t.weight.bold : t.weight.regular }} maxFontSizeMultiplier={1.1}>
                {l}
              </Text>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? c.accent : 'transparent',
                  borderWidth: on ? 0 : today ? 2 : 1,
                  borderColor: today ? c.highlight : c.border,
                }}
              >
                {on ? <Text style={{ color: c.accentText, fontSize: t.size.meta, fontWeight: t.weight.bold }}>✓</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ gap: 4 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceMuted, overflow: 'hidden' }}>
          <Animated.View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: done >= target ? c.success : c.accent,
              width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        </View>
        <Text style={{ color: c.muted, fontSize: t.size.meta }}>
          {done >= target
            ? `Weekly goal reached — ${done} of ${target} sessions. Nice work.`
            : `${done} of ${target} sessions this week`}
        </Text>
      </View>
    </View>
  );
}
