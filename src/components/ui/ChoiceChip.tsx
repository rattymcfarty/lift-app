/**
 * ChoiceChip — one selectable answer in a row of mutually exclusive choices.
 *
 * Small on purpose: the persona editor asks six questions and shows every choice
 * at once, so the answers have to fit as chips rather than as a list of cards.
 * The selected state is a filled accent chip (not just an outline) so the current
 * answer reads at a glance on a dim screen, and the chip never resizes between
 * states — a moving target is hard to tap twice.
 */
import type { JSX } from 'react';
import { Pressable, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

export interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  /** Multi-select rows pass `checkbox` so the role matches the behaviour. */
  role?: 'radio' | 'checkbox';
}

export function ChoiceChip({ label, selected, onPress, testID, role = 'radio' }: ChoiceChipProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole={role}
      accessibilityState={{ selected, checked: selected }}
      style={{
        borderWidth: 1,
        borderColor: selected ? c.accent : c.border,
        backgroundColor: selected ? c.accent : c.surface,
        borderRadius: theme.radius.pill,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
      }}
    >
      <Text
        style={{
          color: selected ? c.accentText : c.text,
          fontSize: t.size.meta,
          fontWeight: selected ? t.weight.semibold : t.weight.medium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
