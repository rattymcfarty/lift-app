/**
 * ProgramsCreateSheet — one "Create" door for the three things you can make.
 *
 * The Library used to open with two full-width buttons ("Create Program", "Set up my plans step by
 * step") plus a "+ New plan" link, which read as three competing primary actions (owner review
 * 2026-10-26). They are one choice now: a sheet naming each option, what it produces, and who it
 * is for. The actions themselves stay where they were — this only changes the way in.
 */
import type { JSX } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { BottomSheet } from '../ui/BottomSheet';

export interface CreateOption {
  key: 'program' | 'plan' | 'guide';
  title: string;
  body: string;
  testID: string;
  onPress: () => void;
}

export function ProgramsCreateSheet({
  visible,
  onClose,
  onProgram,
  onPlan,
  onGuide,
}: {
  visible: boolean;
  onClose: () => void;
  onProgram: () => void;
  onPlan: () => void;
  onGuide: () => void;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;

  const options: CreateOption[] = [
    {
      key: 'program',
      title: 'Create a program',
      body: 'A multi-week structure with days you repeat and adjust — for a goal you are training towards.',
      testID: 'create-program',
      onPress: onProgram,
    },
    {
      key: 'plan',
      title: 'New plan',
      body: 'One training day: the exercises, sets and targets. Start it whenever you like.',
      testID: 'create-plan',
      onPress: onPlan,
    },
    {
      key: 'guide',
      title: 'Set up my plans with a guide',
      body: 'Six questions, a review of what LIFT will build, then a plan per training day.',
      testID: 'create-guide',
      onPress: onGuide,
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Create" testID="create-sheet" maxHeightRatio={0.8}>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            testID={option.testID}
            onPress={() => {
              onClose();
              option.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            accessibilityHint={option.body}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? c.surfaceMuted : c.surface,
              padding: theme.spacing.md,
              gap: 2,
            })}
          >
            <Text style={{ color: c.text, fontSize: t.size.row, fontWeight: t.weight.semibold }}>
              {option.title}
            </Text>
            <Text style={{ color: c.muted, fontSize: t.size.meta }}>{option.body}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
