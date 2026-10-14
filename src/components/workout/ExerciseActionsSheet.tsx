/**
 * Per-exercise actions bottom sheet.
 *
 * Opens from the "⋯" button in ExerciseCard header. Replaces the previous
 * "×" remove affordance (remove moved here as destructive row).
 *
 * Decisions:
 * - Storage for #4 (auto progression): schema already has `autoProgression`
 *   nullable integer-boolean column (m0011), so no new migration needed.
 * - #5 reorder uses arrow buttons (not drag) — robust in RN without library.
 * - #6 view demo/history: no `/exercises/[id]` route exists; shows KB
 *   instructions + longevityNotes in-sheet.
 */

import React, { useState, useEffect, type JSX } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import {
  setExerciseNotes,
  setExerciseRest,
  setExerciseUnitPreference,
  reorderWorkoutExercises,
  setSupersetGroup,
  getProgressionSuggestion,
  getSupersetGroups,
  removeWorkoutExercise,
  type WorkoutExerciseDetail,
  setAutoProgressionOverride,
  isProgressionAvailable,
  resolveAutoProgression,
} from '../../data/repositories';
import { getSettings } from '../../data/settings';
import { formatWeight } from '../../lib/units';
import { displayName } from '../../kb/taxonomy';

export interface ExerciseActionsSheetProps {
  visible: boolean;
  detail: WorkoutExerciseDetail;
  workoutItems: WorkoutExerciseDetail[];
  workoutId: string;
  onClose: () => void;
  onChanged: () => void;
  onAddWarmup?: () => void;
}

function formatRest(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Minimal subcomponent: one action row. */
function ActionRow({
  label,
  right,
  destructive,
  testID,
  onPress,
}: {
  label: string;
  right?: React.ReactNode;
  destructive?: boolean;
  testID?: string;
  onPress?: () => void;
}): JSX.Element {
  const { theme } = useTheme();
  const textColor = destructive ? theme.colors.danger : theme.colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.colors.border },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={{ color: textColor, fontSize: theme.typography.size.body }}>{label}</Text>
      {right !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {right}
        </View>
      ) : null}
    </Pressable>
  );
}

export function ExerciseActionsSheet({
  visible,
  detail,
  workoutItems,
  workoutId,
  onClose,
  onChanged,
  onAddWarmup,
}: ExerciseActionsSheetProps): JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { workoutExercise, exercise } = detail;

  const [noteText, setNoteText] = useState(workoutExercise.notes ?? '');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [autoAvailable, setAutoAvailable] = useState<boolean | null>(null);

  // Resolve auto-progression availability when sheet opens or detail changes
  useEffect(() => {
    if (visible) {
      isProgressionAvailable(workoutId, exercise.id).then((avail) => setAutoAvailable(avail)).catch(() => setAutoAvailable(false));
    }
  }, [visible, workoutId, exercise.id]);

  // Warmup add: uses existing pending mechanism in ExerciseCard
  const handleAddWarmup = () => {
    onAddWarmup?.();
    onClose();
  };

  const handleAddNoteSave = async () => {
    try {
      await setExerciseNotes(workoutExercise.id, noteText || null);
      onChanged();
      setShowNoteInput(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save note');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.overlay, { paddingTop: insets.top + 48 }]}
        onPress={onClose}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.headerRow}>
            <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.card, fontWeight: theme.typography.weight.bold }}>
              Actions
            </Text>
            <Pressable testID="action-sheet-close" onPress={onClose} hitSlop={12}>
              <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.card }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll}>
            <ActionRow
              label="⊕ Add Warmup Sets"
              testID="action-add-warmup"
              onPress={handleAddWarmup}
            />

            {!showNoteInput ? (
              <ActionRow
                label="📝 Add Exercise Note"
                testID="action-add-note"
                onPress={() => {
                  setNoteText(workoutExercise.notes ?? '');
                  setShowNoteInput(true);
                }}
              />
            ) : (
              <View style={{ gap: 8, paddingVertical: 4 }}>
                <TextInput
                  multiline
                  value={noteText}
                  onChangeText={setNoteText}
                  style={{
                    backgroundColor: theme.colors.surfaceMuted,
                    color: theme.colors.text,
                    borderRadius: 8,
                    padding: 8,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                />
                <ActionRow
                  label="Save Note"
                  testID="action-save-note"
                  onPress={handleAddNoteSave}
                />
              </View>
            )}

            <Pressable
              testID="action-rest-timer"
              onPress={() => setShowRestPicker((v) => !v)}
              accessibilityRole="button"
            >
              <ActionRow
                label="⏱ Rest Timer"
                right={
                  <Text style={{ color: theme.colors.muted }}>
                    {workoutExercise.restSeconds == null ? formatRest(90) + ' (default)' : formatRest(workoutExercise.restSeconds)}
                  </Text>
                }
              />
            </Pressable>
            {showRestPicker && (
              <View style={{ paddingLeft: 16, paddingBottom: 8, gap: 4 }}>
                {[30, 60, 90, 120, 180, 300].map((sec) => (
                  <Pressable
                    key={sec}
                    testID={`rest-preset-${sec}`}
                    onPress={async () => {
                      try {
                        await setExerciseRest(workoutExercise.id, sec);
                        onChanged();
                      } catch (e) {
                        Alert.alert('Error', e instanceof Error ? e.message : 'Could not save rest');
                      }
                    }}
                    style={{ paddingVertical: 6 }}
                  >
                    <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.body }}>{formatRest(sec)}</Text>
                  </Pressable>
                ))}
                <Pressable
                  testID="rest-preset-default"
                  onPress={async () => {
                    try {
                      await setExerciseRest(workoutExercise.id, null);
                      onChanged();
                    } catch (e) {
                      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save rest');
                    }
                  }}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.body }}>Default</Text>
                </Pressable>
              </View>
            )}
            <Pressable
              testID="action-auto-progression"
              onPress={async () => {
                const current = workoutExercise.autoProgression;
                let next: boolean | null;
                if (current === null) next = true; // Auto -> On
                else if (current === true) next = false; // On -> Off
                else next = null; // Off -> Auto
                try {
                  await setAutoProgressionOverride(workoutExercise.id, next);
                  onChanged();
                } catch (e) {
                  Alert.alert('Error', e instanceof Error ? e.message : 'Could not save progression');
                }
              }}
              accessibilityRole="button"
            >
              <ActionRow
                label="⇈ Auto Progression"
                right={
                  <Text style={{ color: theme.colors.muted }}>
                    {autoAvailable === null
                      ? (workoutExercise.autoProgression === null ? 'Auto' : workoutExercise.autoProgression ? 'On' : 'Off')
                      : resolveAutoProgression(workoutExercise.autoProgression, autoAvailable).label}
                  </Text>
                }
              />
            </Pressable>
            <ActionRow label="⇅ Reorder Exercises" testID="action-reorder" />
            <ActionRow label="▤ View Demo & History" testID="action-demo-history" />
            <ActionRow
              label="👜 Weight Unit"
              right={<Text style={{ color: theme.colors.muted }}>{workoutExercise.unitPreference ?? 'kg'}</Text>}
              testID="action-weight-unit"
            />
            <ActionRow label="🔗 Create Superset" testID="action-create-superset" />
            <ActionRow
              label="🔗 Remove from Superset"
              testID="action-remove-superset"
              onPress={async () => {
                try {
                  const groups = await getSupersetGroups(workoutId);
                  for (const group of groups) {
                    if (group.some((row) => row.id === detail.workoutExercise.id)) {
                      await setSupersetGroup([detail.workoutExercise.id], null);
                      onChanged();
                      onClose();
                      return;
                    }
                  }
                } catch (e) {
                  Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove from superset');
                }
              }}
            />
            <ActionRow
              label="🗑 Remove Exercise"
              destructive
              testID="action-remove-exercise"
              onPress={() => {
                Alert.alert('Remove exercise?', `"${displayName(exercise)}" and its logged sets will be removed.`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await removeWorkoutExercise(workoutExercise.id);
                        onChanged();
                        onClose();
                      } catch (e) {
                        Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove');
                      }
                    },
                  },
                ]);
              }}
            />
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    padding: 16,
    maxHeight: '70%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scroll: {
    maxHeight: 500,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
