/**
 * Settings — in-app preferences, persisted on this device.
 *
 * Appearance: Light / Dark, default Dark on first launch. The choice
 * applies immediately to every screen (including modals, sheets, and
 * pickers) and survives restarts; it always overrides the OS setting.
 * Weight unit: kg / lb display unit for the whole app.
 */

import { useEffect, useState, type JSX } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type ThemePreference } from '../src/theme';
import { getSettings, setWeightUnit, type WeightUnit } from '../src/data/settings';
import { Card, ScreenHeader } from '../src/components/workout/ui';

function SegmentedOption<T extends string>({
  label,
  narrowLabel,
  selected,
  onPress,
  testID,
}: {
  label: string;
  /** Short label used on narrow windows (Display Zoom) so text never wraps. */
  narrowLabel?: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { width } = useWindowDimensions();
  const shownLabel = width < 360 && narrowLabel ? narrowLabel : label;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors.highlight : theme.colors.border,
        backgroundColor: selected ? theme.colors.surfaceMuted : theme.colors.surface,
        paddingHorizontal: theme.spacing.sm,
      }}
    >
      <Text
        style={{
          color: selected ? theme.colors.text : theme.colors.muted,
          fontSize: t.size.body,
          fontWeight: selected ? t.weight.bold : t.weight.medium,
          flexShrink: 1,
          textAlign: 'center',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {shownLabel}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen(): JSX.Element {
  const { theme, preference, setPreference } = useTheme();
  const t = theme.typography;
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('kg');

  useEffect(() => {
    let cancelled = false;
    void getSettings().then((s) => {
      if (!cancelled) setWeightUnitState(s.weightUnit);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAppearance = (next: ThemePreference): void => {
    setPreference(next);
  };

  const handleWeightUnit = (unit: WeightUnit): void => {
    setWeightUnitState(unit);
    void setWeightUnit(unit).catch(() => {
      // Settings write failed — the toggle still shows the choice for
      // this session; it just won't survive a restart.
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          gap: theme.spacing.md,
        }}
      >
        <Card>
          <Text
            style={{
              color: theme.colors.muted,
              fontSize: t.size.caption,
              fontWeight: t.weight.medium,
            }}
          >
            APPEARANCE
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <SegmentedOption
              label="Dark"
              selected={preference === 'dark'}
              onPress={() => handleAppearance('dark')}
              testID="settings-appearance-dark"
            />
            <SegmentedOption
              label="Light"
              selected={preference === 'light'}
              onPress={() => handleAppearance('light')}
              testID="settings-appearance-light"
            />
          </View>
          <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
            Dark is the default. Your choice applies to every screen and is
            saved on this device.
          </Text>
        </Card>

        <Card>
          <Text
            style={{
              color: theme.colors.muted,
              fontSize: t.size.caption,
              fontWeight: t.weight.medium,
            }}
          >
            WEIGHT UNIT
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <SegmentedOption
              label="Kilograms (kg)"
              narrowLabel="kg"
              selected={weightUnit === 'kg'}
              onPress={() => handleWeightUnit('kg')}
              testID="settings-unit-kg"
            />
            <SegmentedOption
              label="Pounds (lb)"
              narrowLabel="lb"
              selected={weightUnit === 'lb'}
              onPress={() => handleWeightUnit('lb')}
              testID="settings-unit-lb"
            />
          </View>
          <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
            Weights are stored in kilograms; this only changes how they are
            shown.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
