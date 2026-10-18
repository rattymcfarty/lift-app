/**
 * Plate calculator modal — calculates plates per side for a target weight.
 * Reuses calcPlates from src/lib/units and settings barWeight.
 */

import { useState, useCallback, useEffect, type JSX } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { BottomSheet } from '../ui/BottomSheet';
import { calcPlates, parseWeightInput, formatWeight } from '../../lib/units';
import { getSettings, setBarWeightKg } from '../../data/settings';
import { FONT_WEIGHT } from '../../theme/tokens';

interface PlateCalculatorProps {
  visible: boolean;
  onClose: () => void;
  /** Optional pre-filled weight in kg */
  initialWeightKg?: number | null;
  /** If set, writes selected weight back via this callback */
  onSelectWeight?: (kg: number) => void;
}

export function PlateCalculator({ visible, onClose, initialWeightKg, onSelectWeight }: PlateCalculatorProps): JSX.Element {
  const { theme } = useTheme();
  const [barWeight, setBarWeight] = useState<number>(20);
  const [targetText, setTargetText] = useState<string>(initialWeightKg != null ? String(initialWeightKg) : '');
  useEffect(() => {
    setTargetText(initialWeightKg != null ? String(initialWeightKg) : '');
  }, [initialWeightKg]);

  // Load bar weight from settings when modal opens
  useEffect(() => {
    if (visible) {
      getSettings().then((s) => setBarWeight(s.barWeightKg));
    }
  }, [visible]);

  const handleSelect = useCallback((kg: number) => {
    onSelectWeight?.(kg);
  }, [onSelectWeight]);

  const parsedTarget = parseWeightInput(targetText, 'kg');
  const hasTarget = parsedTarget != null && Number.isFinite(parsedTarget) && parsedTarget > 0;

  let result: { perSide: number[]; loadedKg: number; remainderKg: number } | null = null;
  let error = '';
  if (hasTarget) {
    try {
      result = calcPlates(parsedTarget, barWeight);
    } catch (e) {
      error = e instanceof RangeError ? e.message : 'Invalid input';
    }
  }

  const handleUseWeight = () => {
    if (hasTarget && parsedTarget != null && Number.isFinite(parsedTarget)) {
      handleSelect(parsedTarget);
      onClose();
    }
  };

  const handleSaveBar = async () => {
    try {
      await setBarWeightKg(barWeight);
    } catch (e) {
      // ignore
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Plate Calculator" testID="plate-sheet" maxHeightRatio={0.7}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <View style={styles.inputRow}>
          <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.body }}>Target (kg)</Text>
          <TextInput
            testID="plate-target-input"
            value={targetText}
            onChangeText={setTargetText}
            keyboardType="decimal-pad"
            placeholder="60"
            placeholderTextColor={theme.colors.faint}
            style={{
              backgroundColor: theme.colors.surfaceMuted,
              color: theme.colors.text,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: 8,
              padding: 8,
              minWidth: 120,
              textAlign: 'center',
            }}
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.body }}>Bar (kg)</Text>
          <TextInput
            testID="plate-bar-input"
            value={String(barWeight)}
            onChangeText={(t) => {
              const n = Number(t);
              if (!Number.isNaN(n) && Number.isFinite(n) && n >= 0 && n <= 50) setBarWeight(n);
            }}
            onBlur={handleSaveBar}
            keyboardType="decimal-pad"
            placeholder="20"
            placeholderTextColor={theme.colors.faint}
            style={{
              backgroundColor: theme.colors.surfaceMuted,
              color: theme.colors.text,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: 8,
              padding: 8,
              minWidth: 120,
              textAlign: 'center',
            }}
          />
        </View>

        {result && (
          <View style={{ gap: 8, marginTop: 12 }}>
            <Text style={{ color: theme.colors.text, fontWeight: FONT_WEIGHT.bold, fontSize: theme.typography.size.body }} testID="plate-per-side">
              Per side: {result.perSide.map((p) => `${p}`).join(' + ') || 'none'}
            </Text>
            <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.body }} testID="plate-total">
              Total loaded: {formatWeight(result.loadedKg, 'kg')} · Bar: {formatWeight(barWeight, 'kg')}
            </Text>
            {result.remainderKg > 0 && (
              <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.meta }}>
                Add {formatWeight(result.remainderKg, 'kg')} — no plate combination
              </Text>
            )}
          </View>
        )}

        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.meta, marginTop: 4 }}>{error}</Text> : null}

        <View style={styles.actionRow}>
          <Pressable
            testID="plate-use-weight"
            onPress={handleUseWeight}
            disabled={!hasTarget}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.colors.accent,
                opacity: !hasTarget ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.colors.accentText, fontWeight: FONT_WEIGHT.bold, fontSize: theme.typography.size.body }}>
              Use this weight
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  actionRow: {
    marginTop: 16,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
});
