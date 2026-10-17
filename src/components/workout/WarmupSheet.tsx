/**
 * WarmupSheet — the "Warm-up sets" bottom sheet opened from the exercise
 * actions menu. Lets the user set a working weight, see a live preview of the
 * warmup ramp (3 rows at 50/70/85% with reps 5/3/2, rounded to loadable
 * steps), edit any row, then insert the pending warmup rows above the
 * working sets.
 *
 * - Working weight prefilled from (in order): first working set on card,
 *   previous performance weight, routine target weight, else empty.
 * - Bodyweight exercises (equipment includes "Bodyweight") or "No weight"
 *   toggle -> 2 reps-only rows (5, 3).
 * - Every preview row's weight and reps editable.
 * - Primary button "Add N warm-up sets" disabled until weight entered or
 *   "No weight" is on.
 * - Adds PENDING rows flagged warmup, placed above working rows, numbered
 *   with "W" badge, excluded from working-set volume.
 * - If warmup rows already exist (unlogged), sheet says so and replaces only
 *   the still-unlogged ones.
 * - kg/lb aware (stored in kg).
 */
import React, { useEffect, useRef, useState, type JSX } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme, withAlpha } from '../../theme';
import { decodeStringArray } from '../../db/schema';
import { buildWarmupPreview, type WarmupPreviewRow } from '../../lib/exerciseMenu';
import { formatWeight, parseWeightInput } from '../../lib/units';
import { ActionIcon } from '../icons';
import { BottomSheet } from '../ui/BottomSheet';
import * as Haptics from 'expo-haptics';

export interface WarmupSheetProps {
  visible: boolean;
  /** The exercise detail (for equipment, name, etc.). */
  exercise: {
    id: string;
    name: string;
    equipment: string;
  };
  /** The workout exercise detail (for notes, unit preference, etc.). */
  workoutExercise: {
    id: string;
    unitPreference: 'kg' | 'lb' | null;
    notes?: string | null;
  };
  /** The first working set's weight on the card (if user has typed one), in canonical kg. */
  firstWorkingWeightKg: number | null;
  /** Previous performance weight for this exercise (from history), in canonical kg. */
  previousPerformanceWeightKg: number | null;
  /** Routine/planned target weight for this exercise, in canonical kg. */
  routineTargetWeightKg: number | null;
  /** Global display unit (fallback when no per-exercise override). */
  globalUnit: 'kg' | 'lb';
  /** Called when the user confirms adding the warmup rows. */
  onAdd: (rows: Array<{ reps: string; weightKg: number | null; isWarmup: true }>) => void;
  /** True when the card already has unlogged warm-up rows (they get replaced). */
  hasExistingUnloggedWarmups?: boolean;
  onClose: () => void;
  testID?: string;
}

function UnitLabel({ unit, theme }: { unit: 'kg' | 'lb'; theme: ReturnType<typeof useTheme>['theme'] }) {
  const t = theme.typography;
  return (
    <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, marginTop: 2 }}>
      Weights in {unit === 'kg' ? 'kg' : 'lb'}
    </Text>
  );
}

function PreviewRow({
  row,
  index,
  unit,
  isBodyweight,
  onRepsChange,
  onWeightChange,
  theme,
}: {
  row: WarmupPreviewRow;
  index: number;
  unit: 'kg' | 'lb';
  isBodyweight: boolean;
  onRepsChange: (index: number, reps: string) => void;
  onWeightChange: (index: number, weightKg: number | null) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}): JSX.Element {
  const t = theme.typography;
  const displayWeight = row.weightKg != null
    ? formatWeight(row.weightKg, unit)
    : '';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
      <Text style={{ color: theme.colors.muted, fontSize: t.size.body, minWidth: 32, textAlign: 'right' }}>
        {index + 1}.
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <TextInput
          testID={`warmup-preview-reps-${index}`}
          value={row.reps}
          onChangeText={(v) => onRepsChange(index, v)}
          placeholder="Reps"
          keyboardType="numeric"
          maxLength={3}
          maxFontSizeMultiplier={1.15}
          style={{
            flex: 1,
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.text,
            borderRadius: theme.radius.md,
            padding: theme.spacing.xs,
            fontSize: t.size.body,
            textAlign: 'center',
            minWidth: 60,
          }}
        />
        {!isBodyweight && !row.isBodyweight ? (
          <TextInput
            testID={`warmup-preview-weight-${index}`}
            value={displayWeight}
            onChangeText={(v) => {
              const kg = parseWeightInput(v, unit);
              onWeightChange(index, kg ?? null);
            }}
            placeholder="Weight"
            keyboardType="decimal-pad"
            maxFontSizeMultiplier={1.15}
            style={{
              flex: 1,
              backgroundColor: theme.colors.surfaceMuted,
              color: theme.colors.text,
              borderRadius: theme.radius.md,
              padding: theme.spacing.xs,
              fontSize: t.size.body,
              textAlign: 'center',
              minWidth: 80,
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>Bodyweight</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function WarmupSheet({
  visible,
  exercise,
  workoutExercise,
  firstWorkingWeightKg,
  previousPerformanceWeightKg,
  routineTargetWeightKg,
  globalUnit,
  onAdd,
  hasExistingUnloggedWarmups = false,
  onClose,
  testID = 'warmup-sheet',
}: WarmupSheetProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const unit = (workoutExercise.unitPreference ?? globalUnit) as 'kg' | 'lb';
  const equipment = decodeStringArray(exercise.equipment);
  const isBodyweightExercise = equipment.includes('Bodyweight');

  const [forceBodyweight, setForceBodyweight] = useState(false);
  const [workingWeightInput, setWorkingWeightInput] = useState('');
  const [previewRows, setPreviewRows] = useState<WarmupPreviewRow[]>([]);

  // Rebuild preview when inputs change
  const rebuildPreview = () => {
    const weightKg = workingWeightInput.trim() === '' ? null : parseWeightInput(workingWeightInput, unit);
    const rows = buildWarmupPreview({
      firstWorkingWeightKg: weightKg,
      previousPerformanceWeightKg: forceBodyweight ? null : previousPerformanceWeightKg,
      routineTargetWeightKg: forceBodyweight ? null : routineTargetWeightKg,
      forceBodyweight,
      equipment,
      unit,
    });
    setPreviewRows(rows);
  };

  // Prefill exactly once per opening. Re-running it while the user types would
  // write the old value back over the field and corrupt what they are entering.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      prefilledRef.current = false;
      return;
    }
    if (!prefilledRef.current) {
      prefilledRef.current = true;
      // Prefill working weight from first working set on card, else previous, else routine target
      let prefillKg: number | null = firstWorkingWeightKg;
      if (prefillKg == null) prefillKg = previousPerformanceWeightKg;
      if (prefillKg == null) prefillKg = routineTargetWeightKg;

      if (prefillKg != null && Number.isFinite(prefillKg) && prefillKg > 0) {
        setWorkingWeightInput(unit === 'kg' ? String(prefillKg) : String(Math.round(prefillKg * 2.20462 * 10) / 10));
      } else {
        setWorkingWeightInput('');
      }
      setForceBodyweight(isBodyweightExercise);
      rebuildPreview();
    }
  }, [visible, firstWorkingWeightKg, previousPerformanceWeightKg, routineTargetWeightKg, unit, isBodyweightExercise]);

  // Update preview when working weight input changes (debounced via state)
  useEffect(() => {
    if (visible) rebuildPreview();
  }, [workingWeightInput, forceBodyweight, unit, visible]);

  const handleWeightChange = (text: string) => {
    // Allow only valid numeric input (digits, one dot/comma)
    const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    setWorkingWeightInput(parts[0] + (parts[1] !== undefined ? '.' + parts[1] : ''));
  };

  const handleAdd = () => {
    if (previewRows.length === 0) return;
    const hasWeight = previewRows.some((r) => r.weightKg != null && r.weightKg > 0);
    if (!hasWeight && !forceBodyweight) {
      Alert.alert('Enter a working weight', 'Type a working weight or enable "No weight" for bodyweight-style warmups.');
      return;
    }
    const rows = previewRows.map((r) => ({
      reps: r.reps,
      weightKg: r.weightKg,
      isWarmup: true as const,
    }));
    onAdd(rows);
    onClose();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const canAdd = previewRows.some((r) => r.weightKg != null && r.weightKg > 0) || forceBodyweight;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Warm-up sets"
      subtitle={exercise.name}
      testID={testID}
      maxHeightRatio={0.9}
    >
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          {/* Working weight input */}
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
              Working weight
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <TextInput
                testID="warmup-weight-input"
                value={workingWeightInput}
                onChangeText={handleWeightChange}
                placeholder={isBodyweightExercise ? 'Bodyweight \u2014 no weight needed' : 'e.g., 100'}
                keyboardType="decimal-pad"
                maxFontSizeMultiplier={1.15}
                editable={!forceBodyweight && !isBodyweightExercise}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.surfaceMuted,
                  color: theme.colors.text,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm,
                  fontSize: t.size.body,
                  textAlign: 'center',
                  opacity: (forceBodyweight || isBodyweightExercise) ? 0.5 : 1,
                }}
              />
              <UnitLabel unit={unit} theme={theme} />
            </View>
          </View>

          {/* No weight toggle */}
          <Pressable
            testID="warmup-no-weight"
            onPress={() => {
              setForceBodyweight((v) => !v);
              void Haptics.selectionAsync().catch(() => undefined);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: forceBodyweight }}
            accessibilityLabel={forceBodyweight ? 'Weight enabled' : 'No weight (bodyweight warmup)'}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: theme.radius.sm,
                borderWidth: 2,
                borderColor: forceBodyweight ? theme.colors.accent : theme.colors.border,
                backgroundColor: forceBodyweight ? theme.colors.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {forceBodyweight && <ActionIcon name="check" color={theme.colors.accentText} size={16} />}
            </View>
            <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
              No weight (bodyweight warmup)
            </Text>
          </Pressable>

          {/* Existing warmups notice */}
          {hasExistingUnloggedWarmups && (
            <View
              style={{
                backgroundColor: withAlpha(theme.colors.warning, 0.12),
                borderRadius: theme.radius.md,
                padding: theme.spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <ActionIcon name="history" color={theme.colors.warning} size={20} />
              <Text style={{ color: theme.colors.warning, fontSize: t.size.body, flex: 1 }}>
                This exercise already has unlogged warm-up sets. Adding will replace them.
              </Text>
            </View>
          )}

          {/* Live preview */}
          <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, marginTop: theme.spacing.xs }}>
            Preview ({previewRows.length} set{previewRows.length === 1 ? '' : 's'})
          </Text>
          {previewRows.map((row, idx) => (
            <View key={idx} testID={`warmup-row-${idx}`}>
              <PreviewRow
                row={row}
                index={idx}
                unit={unit}
                isBodyweight={forceBodyweight || isBodyweightExercise}
                onRepsChange={(i, reps) => {
                  setPreviewRows((prev) => prev.map((r, j) => (j === i ? { ...r, reps } : r)));
                }}
                onWeightChange={(i, weightKg) => {
                  setPreviewRows((prev) => prev.map((r, j) => (j === i ? { ...r, weightKg } : r)));
                }}
                theme={theme}
              />
            </View>
          ))}

          {/* Add button */}
          <Pressable
            testID="warmup-add"
            onPress={handleAdd}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAdd }}
            style={({ pressed }) => ({
              marginTop: theme.spacing.md,
              backgroundColor: canAdd ? (pressed ? withAlpha(theme.colors.accent, 0.8) : theme.colors.accent) : theme.colors.muted,
              borderRadius: theme.radius.md,
              paddingVertical: theme.spacing.md,
              alignItems: 'center',
            })}
          >
            <Text
              style={{
                color: canAdd ? theme.colors.accentText : theme.colors.faint,
                fontSize: t.size.body,
                fontWeight: t.weight.semibold,
              }}
            >
              Add {previewRows.length} warm-up set{previewRows.length === 1 ? '' : 's'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}