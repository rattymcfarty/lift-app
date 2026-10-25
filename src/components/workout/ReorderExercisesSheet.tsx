/**
 * ReorderExercisesSheet — REFERENCE B.
 *
 * A full-height sheet listing the workout's exercises as rounded bordered
 * cards: index number in the highlight (blue) colour, exercise name, and
 * up/down buttons. Reordering is reliable via the buttons (haptics on every
 * move); the grip icon marks the row as draggable in a future gesture pass.
 * The most recently moved row gets a stronger border. OK persists the new
 * order in one transaction (reorderWorkoutExercises); Cancel discards it.
 *
 * Logged sets reference their workout_exercise row, so reordering never
 * detaches them; the logging screen re-fetches and reflects the order.
 */
import { useEffect, useState, type JSX } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { moveItem } from '../../lib/exerciseMenu';
import { displayName } from '../../kb/taxonomy';
import { ActionIcon } from '../icons';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from './ui';
import type { WorkoutExerciseDetail } from '../../data/repositories';

export interface ReorderExercisesSheetProps {
  visible: boolean;
  title: string;
  subtitle: string;
  items: WorkoutExerciseDetail[];
  onClose: () => void;
  onSave: (orderedIds: string[]) => Promise<void>;
}

export function ReorderExercisesSheet({
  visible,
  title,
  subtitle,
  items,
  onClose,
  onSave,
}: ReorderExercisesSheetProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [ordered, setOrdered] = useState<WorkoutExerciseDetail[]>(items);
  const [movedId, setMovedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-seed every time the sheet opens (or the page prop changes underneath).
  useEffect(() => {
    if (visible) {
      setOrdered(items);
      setMovedId(null);
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    const next = moveItem(ordered, index, target);
    setOrdered(next);
    setMovedId(next[target].workoutExercise.id);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const handleOk = async (): Promise<void> => {
    setSaving(true);
    try {
      await onSave(ordered.map((it) => it.workoutExercise.id));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} testID="reorder-sheet" maxHeightRatio={0.9}>
      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ padding: theme.spacing.md, paddingTop: theme.spacing.sm, gap: theme.spacing.sm }}
      >
        {ordered.map((item, index) => {
          const isMoved = item.workoutExercise.id === movedId;
          return (
            <View
              key={item.workoutExercise.id}
              testID={`reorder-row-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                borderWidth: isMoved ? 2 : 1,
                borderColor: isMoved ? theme.colors.highlight : theme.colors.border,
                borderRadius: theme.radius.md,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Text style={{ color: theme.colors.highlight, fontSize: t.size.body, fontWeight: t.weight.bold, minWidth: 20 }}>
                {index + 1}
              </Text>
              <Text style={{ flex: 1, color: theme.colors.text, fontSize: t.size.body }} numberOfLines={3}>
                {displayName(item.exercise)}
              </Text>
              <ActionIcon name="grip" color={theme.colors.faint} size={18} />
              <MoveButton
                testID={`reorder-up-${index}`}
                icon="arrow-up"
                label={`Move ${displayName(item.exercise)} up`}
                disabled={index === 0}
                onPress={() => move(index, -1)}
              />
              <MoveButton
                testID={`reorder-down-${index}`}
                icon="arrow-down"
                label={`Move ${displayName(item.exercise)} down`}
                disabled={index === ordered.length - 1}
                onPress={() => move(index, 1)}
              />
            </View>
          );
        })}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button title={saving ? 'Saving…' : 'OK'} testID="reorder-ok" busy={saving} onPress={() => void handleOk()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" testID="reorder-cancel" variant="secondary" disabled={saving} onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}

function MoveButton({
  testID,
  icon,
  label,
  disabled,
  onPress,
}: {
  testID: string;
  icon: 'arrow-up' | 'arrow-down';
  label: string;
  disabled: boolean;
  onPress: () => void;
}): JSX.Element {
  const { theme } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceMuted,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <ActionIcon name={icon} color={theme.colors.text} size={20} />
    </Pressable>
  );
}
