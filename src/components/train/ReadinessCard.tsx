/**
 * One-tap daily readiness check-in. The answer only changes the *advice*
 * shown (effort guidance), stays on the device, and is remembered for the
 * day. Longevity training is about showing up and recovering well — not
 * grinding through every session at 100%.
 */
import { useEffect, useState, type JSX } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { Card } from '../workout/ui';

export type Readiness = 'great' | 'okay' | 'low';

const OPTIONS: ReadonlyArray<{ key: Readiness; label: string; advice: string }> = [
  { key: 'great', label: 'Great', advice: 'Train as planned. Aim to finish each set with 2–3 reps in reserve.' },
  { key: 'okay', label: 'Okay', advice: 'Keep the plan, stay about 3 reps from failure, and cut a set if it drags.' },
  { key: 'low', label: 'Tired / sore', advice: 'Go lighter today: drop a set per exercise, keep it easy, and finish with mobility. Showing up still counts.' },
];

const keyFor = (d: Date): string => `lift:readiness:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function ReadinessCard(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const [value, setValue] = useState<Readiness | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(keyFor(new Date()))
      .then((v) => {
        if (!cancelled && (v === 'great' || v === 'okay' || v === 'low')) setValue(v);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = (v: Readiness): void => {
    setValue(v);
    void Haptics.selectionAsync().catch(() => undefined);
    void AsyncStorage.setItem(keyFor(new Date()), v).catch(() => undefined);
  };

  const advice = OPTIONS.find((o) => o.key === value)?.advice;
  return (
    <Card>
      <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>HOW ARE YOU FEELING?</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {OPTIONS.map((o) => {
          const on = value === o.key;
          return (
            <Pressable
              key={o.key}
              testID={`readiness-${o.key}`}
              onPress={() => choose(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                minHeight: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.md,
                borderWidth: on ? 2 : 1,
                borderColor: on ? c.accent : c.border,
                backgroundColor: on ? c.surfaceMuted : 'transparent',
                paddingHorizontal: theme.spacing.xs,
              }}
            >
              <Text
                style={{ color: on ? c.text : c.muted, fontSize: t.size.meta + 1, fontWeight: on ? t.weight.semibold : t.weight.regular }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {advice ? <Text style={{ color: c.text, fontSize: t.size.body }}>{advice}</Text> : null}
    </Card>
  );
}
