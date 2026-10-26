/**
 * New plan: name it (plus optional pillars and estimated duration),
 * then hand off to the builder where exercises are added.
 */

import { useRef, useState, type JSX } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createRoutine } from '../../src/data/repositories';
import { LONGEVITY_PILLARS, type LongevityPillar } from '../../src/db/schema';
import { useTheme } from '../../src/theme';
import { Button, ScreenHeader } from '../../src/components/workout/ui';
import { WheelNumberField } from '../../src/components/ui/WheelNumberField';
import { minutesItems } from '../../src/components/ui/wheelRanges';
import { parseUserInt } from '../../src/components/workout/format';
import { useTabBarSpace } from '../../src/components/nav/TabBar';

export default function NewPlanScreen(): JSX.Element {
  const tabBarSpace = useTabBarSpace();
  const { theme } = useTheme();
  const t = theme.typography;
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [pillars, setPillars] = useState<LongevityPillar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Re-entrancy guard: the disabled button state updates async.
  const creatingRef = useRef(false);

  const togglePillar = (pillar: LongevityPillar): void => {
    setPillars((prev) =>
      prev.includes(pillar) ? prev.filter((p) => p !== pillar) : [...prev, pillar],
    );
  };

  const handleCreate = async (): Promise<void> => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const trimmed = name.trim();
      if (!trimmed) {
        setError('Give the plan a name.');
        return;
      }
      const parsedMinutes = parseUserInt(minutes);
      if (Number.isNaN(parsedMinutes)) {
        setError('Estimated minutes must be a whole number.');
        return;
      }
      setCreating(true);
      setError(null);
      const id = await createRoutine({
        name: trimmed,
        estimatedMinutes: parsedMinutes,
        longevityPillars: pillars,
      });
      // Replace: back from the builder must not return to this empty form.
      router.replace(`/plans/${id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the plan.');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="New plan" onBack={() => router.back()} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.body,
          { paddingHorizontal: theme.spacing.md, gap: theme.spacing.md, paddingBottom: 32 + tabBarSpace },
        ]}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              color: theme.colors.muted,
              fontSize: t.size.caption,
              fontWeight: t.weight.medium,
            }}
          >
            PLAN NAME
          </Text>
          <TextInput
            testID="plan-new-name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            placeholder="Push day, 5K prep…"
            placeholderTextColor={theme.colors.faint}
            returnKeyType="done"
            editable={!creating}
            autoFocus
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontSize: t.size.body,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
            }}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              color: theme.colors.muted,
              fontSize: t.size.caption,
              fontWeight: t.weight.medium,
            }}
          >
            ESTIMATED DURATION
          </Text>
          <WheelNumberField
            testID="new-plan-minutes"
            label="minutes"
            value={minutes}
            onChangeText={(text) => {
              setMinutes(text);
              setError(null);
            }}
            items={minutesItems()}
            unit="min"
            placeholder="45"
            width={96}
            disabled={creating}
            sheetTestID="new-plan-minutes-sheet"
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              color: theme.colors.muted,
              fontSize: t.size.caption,
              fontWeight: t.weight.medium,
            }}
          >
            LONGEVITY PILLARS (OPTIONAL)
          </Text>
          <View style={[styles.pillarRow, { gap: theme.spacing.xs }]}>
            {LONGEVITY_PILLARS.map((pillar) => {
              const selected = pillars.includes(pillar);
              return (
                <Pressable
                  key={pillar}
                  onPress={() => togglePillar(pillar)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? theme.colors.text : theme.colors.border,
                    borderRadius: theme.radius.pill,
                    paddingVertical: theme.spacing.xs,
                    paddingHorizontal: theme.spacing.sm,
                    backgroundColor: selected ? theme.colors.surfaceMuted : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: selected ? theme.colors.text : theme.colors.muted,
                      fontSize: t.size.caption,
                      fontWeight: selected ? t.weight.medium : t.weight.regular,
                    }}
                  >
                    {pillar}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>{error}</Text>
        ) : null}

        <Button
          title="Create and add exercises"
          testID="plan-new-create"
          onPress={() => void handleCreate()}
          busy={creating}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    paddingBottom: 32,
  },
  pillarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
