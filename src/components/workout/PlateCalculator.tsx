/**
 * Plate calculator modal — calculates plates per side for a target weight.
 * Reuses calcPlates from src/lib/units and settings barWeight.
 */

import { useState, useCallback, useEffect, type JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { BottomSheet } from '../ui/BottomSheet';
import { InlineDrum } from '../ui/InlineDrum';
import { ValuePill } from '../ui/ValuePill';
import { barItems, weightItems, type Unit } from '../ui/wheelRanges';
import { calcPlates, formatWeight, kgToLb, parseWeightInput } from '../../lib/units';
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
  /** The user's weight unit — the plate maths is unit-agnostic, the entry is not. */
  const [unit, setUnit] = useState<Unit>('kg');
  const [targetText, setTargetText] = useState<string>(
    initialWeightKg != null ? String(initialWeightKg) : '',
  );
  /** Which field's inline drum is open (sheets can't host the nested modal wheel). */
  const [editing, setEditing] = useState<'target' | 'bar' | null>(null);
  useEffect(() => {
    setTargetText(initialWeightKg != null ? String(initialWeightKg) : '');
  }, [initialWeightKg]);

  // Load bar weight from settings when modal opens
  useEffect(() => {
    if (visible) {
      getSettings().then((s) => {
        setBarWeight(s.barWeightKg);
        setUnit(s.weightUnit);
        // Reopen in the user's unit: the value the row passed is kg.
        if (initialWeightKg != null) {
          setTargetText(
            s.weightUnit === 'kg'
              ? String(initialWeightKg)
              : String(Math.round(kgToLb(initialWeightKg) * 10) / 10),
          );
        }
      });
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

  const barText =
    unit === 'kg' ? String(barWeight) : String(Math.round(kgToLb(barWeight) * 10) / 10);

  const changeBar = (text: string): void => {
    const kg = parseWeightInput(text, unit);
    if (kg != null && Number.isFinite(kg) && kg >= 0 && kg <= 60) setBarWeight(kg);
  };

  const handleSaveBar = async () => {
    try {
      await setBarWeightKg(barWeight);
    } catch (e) {
      // ignore
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Plate Calculator" testID="plate-sheet" maxHeightRatio={0.85}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        {/* The wheel is the way in; the drum renders in place because a nested
            modal wheel would dismiss this sheet on Android. */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
          <ValuePill
            testID="plate-target"
            label={`Target (${unit})`}
            value={targetText}
            placeholder={unit === 'kg' ? '60' : '135'}
            unit={unit}
            active={editing === 'target'}
            onPress={() => setEditing((e) => (e === 'target' ? null : 'target'))}
          />
          <ValuePill
            testID="plate-bar"
            label={`Bar (${unit})`}
            value={barText}
            placeholder={unit === 'kg' ? '20' : '45'}
            unit={unit}
            active={editing === 'bar'}
            onPress={() => setEditing((e) => (e === 'bar' ? null : 'bar'))}
          />
        </View>

        {editing === 'target' ? (
          <InlineDrum
            testID="plate-target-drum"
            label={`Target (${unit})`}
            items={weightItems(unit)}
            value={targetText}
            unit={unit}
            onChange={setTargetText}
            onDone={() => setEditing(null)}
          />
        ) : null}
        {editing === 'bar' ? (
          <InlineDrum
            testID="plate-bar-drum"
            label={`Bar (${unit})`}
            items={barItems(unit)}
            value={barText}
            unit={unit}
            onChange={changeBar}
            onDone={() => setEditing(null)}
          />
        ) : null}

        {result && (
          <View style={{ gap: 8, marginTop: 12 }}>
            <Text style={{ color: theme.colors.text, fontWeight: FONT_WEIGHT.bold, fontSize: theme.typography.size.body }} testID="plate-per-side">
              Per side: {result.perSide.map((p) => `${p}`).join(' + ') || 'none'}
            </Text>
            <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.body }} testID="plate-total">
              Total loaded: {formatWeight(result.loadedKg, unit)} · Bar: {formatWeight(barWeight, unit)}
            </Text>
            {result.remainderKg > 0 && (
              <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.meta }}>
                Add {formatWeight(result.remainderKg, unit)} — no plate combination
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
