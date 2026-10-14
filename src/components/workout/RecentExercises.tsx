/**
 * RecentExercises — the "Recent Exercise" section above the full list
 * in the add-exercise picker (reference-picker layout, LIFT data).
 * Rows: icon tile (first primary muscle) + name + primary-muscle line
 * on the left; finished-workout count ("N times") + info button on
 * the right. Tapping a row picks the exercise (same as a list row);
 * selection state is shared with the main list via isSelected.
 * Shown only when the picker is unfiltered and the query is empty.
 */
import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { decodeStringArray, type Exercise } from '../../db/schema';
import type { ExerciseHistoryOption } from '../../data/history';
import { useTheme } from '../../theme';
import { TaxonomyIcon } from '../icons';
import { displayName } from '../../kb/taxonomy';

export interface RecentExercisesProps {
  items: ExerciseHistoryOption[];
  isSelected: (id: string) => boolean;
  onPick: (exercise: Exercise) => void;
  onInfo: (exercise: Exercise) => void;
}

export function RecentExercises({ items, isSelected, onPick, onInfo }: RecentExercisesProps): JSX.Element | null {
  const { theme } = useTheme();
  const t = theme.typography;
  if (items.length === 0) {
    return null;
  }
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>Recent Exercise</Text>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
        }}
      >
        {items.map(({ exercise, workoutCount }, index) => {
          const selected = isSelected(exercise.id);
          const primary = decodeStringArray(exercise.primaryMuscles);
          const muscleLine = primary.length > 0 ? primary.join(', ') : exercise.category;
          const countLabel = workoutCount === 1 ? '1 time' : `${workoutCount} times`;
          return (
            <Pressable
              key={exercise.id}
              testID={`recent-exercise-row-${exercise.id}`}
              onPress={() => onPick(exercise)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: theme.colors.border,
                  borderBottomWidth: index === items.length - 1 ? 0 : 1,
                  backgroundColor: selected ? theme.colors.surfaceMuted : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <TaxonomyIcon kind="muscle" id={primary.length > 0 ? primary[0] : 'Other'} size={44} />
              <View style={styles.rowText}>
                <Text
                  style={{
                    color: selected ? theme.colors.highlight : theme.colors.text,
                    fontSize: t.size.row,
                    fontWeight: t.weight.medium,
                  }}
                  numberOfLines={2}
                >
                  {displayName(exercise)}
                </Text>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.meta }} numberOfLines={1}>
                  {muscleLine}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: theme.spacing.xs, flexShrink: 0 }}>
                <Text style={{ color: theme.colors.muted, fontSize: t.size.meta }}>{countLabel}</Text>
                <Pressable
                  onPress={() => onInfo(exercise)}
                  testID={`recent-exercise-info-${exercise.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`About ${displayName(exercise)}`}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>ⓘ</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
