/**
 * Per-exercise actions bottom sheet — REFERENCE A.
 *
 * Opens from the "⋯" button in the exercise-card footer. Full-width rows
 * separated by hairline dividers, a line icon on the left, a regular-weight
 * label, and a right-aligned value/control. Brand colour discipline: purple
 * (`accent`) is the primary/selection colour (the active segmented option),
 * blue (`highlight`) is the active/secondary border colour. No emoji.
 *
 * Row order: Add Warmup Sets · Add Exercise Note · Rest Timer · Auto
 * Progression · Reorder Exercises · View Demo & History · Weight Unit ·
 * Create Superset, then the destructive/session rows (Swap, Remove).
 *
 * Storage: all writes go through the repositories (notes, rest, unit,
 * auto-progression, superset, reorder, remove). Superset uses the existing
 * `workout_exercises.superset_id` column — no schema change.
 */
import React, { useEffect, useState, type JSX } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../theme';
import {
  setExerciseNotes,
  setExerciseRest,
  setExerciseUnitPreference,
  reorderWorkoutExercises,
  setSupersetGroup,
  removeWorkoutExercise,
  isProgressionAvailable,
  setAutoProgressionOverride,
  getPreviousPerformance,
  type WorkoutExerciseDetail,
  type PreviousPerformance,
} from '../../data/repositories';
import { newId } from '../../db/id';
import { REST_PRESETS, formatRestLabel } from '../../lib/exerciseMenu';
import { displayName } from '../../kb/taxonomy';
import { ActionIcon, type ActionIconName } from '../icons';
import { BottomSheet } from '../ui/BottomSheet';
import { ReorderExercisesSheet } from './ReorderExercisesSheet';
import { WarmupSheet } from './WarmupSheet';

export interface ExerciseActionsSheetProps {
  visible: boolean;
  detail: WorkoutExerciseDetail;
  workoutItems: WorkoutExerciseDetail[];
  workoutId: string;
  workoutName?: string;
  /** Global default rest, shown as "2:00 (default)" when no per-exercise override. */
  defaultRestSeconds?: number;
  onClose: () => void;
  onChanged: () => void;
  /** Called when warmup rows should be added to the exercise card. */
  onAddWarmupRows?: (rows: Array<{ reps: string; weightKg: number | null; isWarmup: true }>) => void;
  /** The first working set's weight on the card (if user has typed one), in canonical kg. */
  firstWorkingWeightKg?: number | null;
  /** Previous-performance weight for this exercise (from history), in canonical kg. */
  previousPerformanceWeightKg?: number | null;
  /** Routine/planned target weight for this exercise, in canonical kg. */
  routineTargetWeightKg?: number | null;
  /** True when the card already has unlogged warm-up rows (they get replaced). */
  hasUnloggedWarmups?: boolean;
  /** Global display unit (fallback when no per-exercise override). */
  globalUnit?: 'kg' | 'lb';
}

/** One full-width sheet row: icon, regular-weight label, right-aligned value. */
function ActionRow({
  icon,
  label,
  subtitle,
  right,
  destructive,
  disabled,
  testID,
  onPress,
}: {
  icon: ActionIconName;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
  onPress?: () => void;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const textColor = destructive ? theme.colors.danger : theme.colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled === true}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ disabled: disabled === true }}
      style={({ pressed }) => [
        {
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <ActionIcon name={icon} color={destructive ? theme.colors.danger : theme.colors.muted} size={22} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: textColor, fontSize: t.size.body, fontWeight: t.weight.regular }} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>{right}</View>
      ) : null}
    </Pressable>
  );
}

/** A small nested option row used for the expanded rest/auto/superset lists. */
function OptionButton({
  label,
  testID,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  testID: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: selected === true, disabled: disabled === true }}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.surfaceMuted : 'transparent',
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? theme.colors.accent : theme.colors.text,
          fontSize: t.size.body,
          fontWeight: selected ? t.weight.semibold : t.weight.regular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Inline lb | kg segmented control (active option in the accent colour). */
function UnitToggle({
  unit,
  onChange,
}: {
  unit: 'kg' | 'lb';
  onChange: (u: 'kg' | 'lb') => void;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      {(['lb', 'kg'] as const).map((u) => {
        const on = u === unit;
        return (
          <Pressable
            key={u}
            testID={`action-unit-${u}`}
            onPress={() => onChange(u)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Weight unit ${u}`}
            style={{
              paddingVertical: 6,
              paddingHorizontal: theme.spacing.sm + 2,
              backgroundColor: on ? theme.colors.accent : 'transparent',
            }}
          >
            <Text style={{ color: on ? theme.colors.accentText : theme.colors.muted, fontSize: t.size.meta, fontWeight: on ? t.weight.bold : t.weight.medium }}>
              {u}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ExerciseActionsSheet({
  visible,
  detail,
  workoutItems,
  workoutId,
  workoutName,
  defaultRestSeconds = 90,
  onClose,
  onChanged,
  onAddWarmupRows,
  firstWorkingWeightKg = null,
  previousPerformanceWeightKg = null,
  routineTargetWeightKg = null,
  hasUnloggedWarmups = false,
  globalUnit = 'kg',
}: ExerciseActionsSheetProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { workoutExercise, exercise } = detail;

  const [noteText, setNoteText] = useState(workoutExercise.notes ?? '');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [showAutoPicker, setShowAutoPicker] = useState(false);
  const [showSupersetPicker, setShowSupersetPicker] = useState(false);
  const [reorderVisible, setReorderVisible] = useState(false);
  const [warmupVisible, setWarmupVisible] = useState(false);
  const [autoAvailable, setAutoAvailable] = useState<boolean | null>(null);

  // Reset any expanded sub-list when the sheet opens/close.
  useEffect(() => {
    if (visible) {
      setNoteText(workoutExercise.notes ?? '');
      setShowNoteInput(false);
      setShowRestPicker(false);
      setShowAutoPicker(false);
      setShowSupersetPicker(false);
    }
  }, [visible, workoutExercise.id, workoutExercise.notes]);

  // Resolve auto-progression availability when the sheet opens.
  useEffect(() => {
    if (visible) {
      isProgressionAvailable(workoutId, exercise.id)
        .then((avail) => setAutoAvailable(avail))
        .catch(() => setAutoAvailable(false));
    }
  }, [visible, workoutId, exercise.id]);

  const run = async (fn: () => Promise<unknown>, msg: string): Promise<void> => {
    try {
      await fn();
      onChanged();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : msg);
    }
  };

  // "Add Warmup Sets" leaves this sheet and opens the warm-up sheet; the
  // card inserts the confirmed rows when the warm-up sheet reports back.
  const handleAddWarmup = (): void => {
    setWarmupVisible(true);
    onClose();
  };

  const handleAddNoteSave = async (): Promise<void> => {
    await run(() => setExerciseNotes(workoutExercise.id, noteText.trim() || null), 'Could not save note');
    setShowNoteInput(false);
  };

  const unit: 'kg' | 'lb' = workoutExercise.unitPreference ?? 'kg';
  const autoLabel = workoutExercise.autoProgression === true
    ? 'On'
    : workoutExercise.autoProgression === false
      ? 'Off'
      : 'Auto';
  const restValue = workoutExercise.restSeconds;
  const restLabel = `${formatRestLabel(restValue ?? defaultRestSeconds)}${restValue == null ? ' (default)' : ''}`;
  const supersetId = workoutExercise.supersetId;
  const isGrouped = supersetId != null;
  const supersetCandidates = workoutItems.filter((w) => w.workoutExercise.id !== workoutExercise.id);

  return (
    <>
      <BottomSheet
        visible={visible && !reorderVisible}
        onClose={onClose}
        title="Actions"
        subtitle={displayName(exercise)}
        testID="action-sheet"
      >
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          <ActionRow icon="warmup" label="Add Warmup Sets" testID="action-add-warmup" onPress={handleAddWarmup} />

          {!showNoteInput ? (
            <ActionRow
              icon="note"
              label="Add Exercise Note"
              testID="action-add-note"
              right={workoutExercise.notes ? <ActionIcon name="check" color={theme.colors.accent} size={18} /> : undefined}
              onPress={() => {
                setNoteText(workoutExercise.notes ?? '');
                setShowNoteInput(true);
              }}
            />
          ) : (
            <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <TextInput
                multiline
                autoFocus
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Note for this exercise"
                placeholderTextColor={theme.colors.faint}
                maxFontSizeMultiplier={1.15}
                style={{
                  backgroundColor: theme.colors.surfaceMuted,
                  color: theme.colors.text,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm,
                  minHeight: 80,
                  textAlignVertical: 'top',
                  fontSize: t.size.body,
                }}
              />
              <Pressable
                testID="action-save-note"
                onPress={() => void handleAddNoteSave()}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  backgroundColor: theme.colors.accent,
                  borderRadius: theme.radius.md,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: theme.colors.accentText, fontSize: t.size.body, fontWeight: t.weight.semibold }}>Save note</Text>
              </Pressable>
            </View>
          )}

          <ActionRow
            icon="timer"
            label="Rest Timer"
            testID="action-rest-timer"
            right={<Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>{restLabel}</Text>}
            onPress={() => setShowRestPicker((v) => !v)}
          />
          {showRestPicker ? (
            <View style={{ paddingBottom: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, padding: theme.spacing.md }}>
                {REST_PRESETS.map((sec) => (
                  <OptionButton
                    key={sec}
                    testID={`rest-preset-${sec}`}
                    label={formatRestLabel(sec)}
                    selected={restValue === sec}
                    onPress={() => void run(() => setExerciseRest(workoutExercise.id, sec), 'Could not save rest')}
                  />
                ))}
              </View>
              <OptionButton
                testID="rest-preset-default"
                label="Use default"
                selected={restValue == null}
                onPress={() => void run(() => setExerciseRest(workoutExercise.id, null), 'Could not save rest')}
              />
            </View>
          ) : null}

          <ActionRow
            icon="progression"
            label="Auto Progression"
            testID="action-auto-progression"
            right={<Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>{autoLabel}</Text>}
            onPress={() => setShowAutoPicker((v) => !v)}
          />
          {showAutoPicker ? (
            <View style={{ paddingBottom: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
              <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, paddingBottom: theme.spacing.xs }}>
                Auto follows the plan's program progression. On/Off overrides it for this exercise only.
              </Text>
              {([
                { label: 'Auto', value: null },
                { label: 'On', value: true },
                { label: 'Off', value: false },
              ] as const).map((opt) => (
                <OptionButton
                  key={opt.label}
                  testID={`action-auto-${opt.label.toLowerCase()}`}
                  label={opt.label}
                  selected={workoutExercise.autoProgression === opt.value}
                  disabled={opt.value === null && autoAvailable === false}
                  onPress={() => void run(() => setAutoProgressionOverride(workoutExercise.id, opt.value), 'Could not save progression')}
                />
              ))}
            </View>
          ) : null}

          <ActionRow
            icon="reorder"
            label="Reorder Exercises"
            testID="action-reorder"
            onPress={() => {
              setReorderVisible(true);
            }}
          />

          <ActionRow
            icon="history"
            label="View Demo & History"
            testID="action-demo-history"
            onPress={() => {
              onClose();
              router.push(`/exercises/${exercise.id}`);
            }}
          />

          <ActionRow
            icon="scale"
            label="Weight Unit"
            testID="action-weight-unit"
            right={
              <UnitToggle
                unit={unit}
                onChange={(u) => void run(() => setExerciseUnitPreference(workoutExercise.id, u), 'Could not save unit')}
              />
            }
          />

          {!isGrouped ? (
            <ActionRow
              icon="link"
              label="Create Superset"
              testID="action-create-superset"
              subtitle={supersetCandidates.length === 0 ? 'Add another exercise first' : undefined}
              disabled={supersetCandidates.length === 0}
              onPress={() => setShowSupersetPicker((v) => !v)}
            />
          ) : (
            <ActionRow
              icon="unlink"
              label="Remove from Superset"
              testID="action-remove-superset"
              onPress={() =>
                void run(async () => {
                  await setSupersetGroup([workoutExercise.id], null);
                  onClose();
                }, 'Could not remove from superset')
              }
            />
          )}
          {showSupersetPicker && !isGrouped ? (
            <View style={{ paddingBottom: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
              <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, paddingBottom: theme.spacing.xs }}>
                Pick one exercise to pair with this one.
              </Text>
              {supersetCandidates.map((candidate) => (
                <OptionButton
                  key={candidate.workoutExercise.id}
                  testID={`action-superset-${candidate.workoutExercise.id}`}
                  label={displayName(candidate.exercise)}
                  onPress={() =>
                    void run(async () => {
                      await setSupersetGroup([workoutExercise.id, candidate.workoutExercise.id], newId());
                      onClose();
                    }, 'Could not create superset')
                  }
                />
              ))}
            </View>
          ) : null}

          <ActionRow
            icon="swap"
            label="Swap Exercise"
            testID="action-swap-exercise"
            onPress={() => {
              onClose();
              router.push(`/workout/${workoutId}/swap-exercise?workoutExerciseId=${workoutExercise.id}`);
            }}
          />

          <ActionRow
            icon="trash"
            label="Remove Exercise"
            destructive
            testID="action-remove-exercise"
            onPress={() =>
              Alert.alert('Remove exercise?', `"${displayName(exercise)}" and its logged sets will be removed from this workout.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    void run(async () => {
                      await removeWorkoutExercise(workoutExercise.id);
                      onClose();
                    }, 'Could not remove exercise'),
                },
              ])
            }
          />
        </ScrollView>
      </BottomSheet>

      <ReorderExercisesSheet
        visible={reorderVisible}
        title={workoutName ?? 'Workout'}
        subtitle={`${workoutItems.length} exercise${workoutItems.length === 1 ? '' : 's'}`}
        items={workoutItems}
        onClose={() => setReorderVisible(false)}
        onSave={async (orderedIds) => {
          try {
            await reorderWorkoutExercises(workoutId, orderedIds);
            onChanged();
            setReorderVisible(false);
            onClose();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not reorder exercises');
          }
        }}
      />

      <WarmupSheet
        visible={warmupVisible}
        exercise={exercise}
        workoutExercise={workoutExercise}
        firstWorkingWeightKg={firstWorkingWeightKg}
        previousPerformanceWeightKg={previousPerformanceWeightKg}
        routineTargetWeightKg={routineTargetWeightKg}
        hasExistingUnloggedWarmups={hasUnloggedWarmups}
        globalUnit={globalUnit}
        onAdd={(rows) => onAddWarmupRows?.(rows)}
        onClose={() => setWarmupVisible(false)}
      />
    </>
  );
}
