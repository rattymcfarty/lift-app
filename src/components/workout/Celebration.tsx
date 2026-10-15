/**
 * Post-workout celebration: a card that springs in, with a success haptic,
 * listing the personal records set in the session. Purely presentational —
 * honest, no fake streak numbers.
 */
import { useEffect, useRef, type JSX } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

export interface CelebrationRecord {
  id: string;
  exerciseName: string;
  label: string;
  value: string;
}

export function Celebration({
  records,
  setCount,
}: {
  records: CelebrationRecord[];
  setCount: number;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const pop = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      { iterations: 3 },
    ).start();
  }, [pop, shine]);

  const hasRecords = records.length > 0;
  return (
    <Animated.View
      style={{
        opacity: pop,
        transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
        backgroundColor: c.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 2,
        borderColor: hasRecords ? c.accent : c.border,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Animated.Text
          style={{
            fontSize: t.size.display,
            transform: [{ scale: shine.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
          }}
        >
          {hasRecords ? '🏆' : '✅'}
        </Animated.Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }}>
            {hasRecords
              ? `${records.length} new record${records.length === 1 ? '' : 's'}!`
              : 'Session complete'}
          </Text>
          <Text style={{ color: c.muted, fontSize: t.size.meta + 1 }}>
            {hasRecords
              ? 'You beat your previous best. That is how it compounds.'
              : `${setCount} sets logged. Consistency is the whole game — see you next session.`}
          </Text>
        </View>
      </View>
      {records.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Text style={{ flex: 1, color: c.text, fontSize: t.size.body, fontWeight: t.weight.medium }} numberOfLines={1}>
            {r.exerciseName}
          </Text>
          <Text style={{ color: c.accent, fontSize: t.size.body, fontWeight: t.weight.bold }} numberOfLines={1}>
            {r.label} {r.value}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
}
