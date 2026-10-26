/**
 * ValuePill — a labelled value that opens an inline drum (in sheets) or any editor.
 *
 * Presentation only: the label sits above a pill, the pill shows the current value
 * or a placeholder, and tapping it is the caller's job. `active` draws the accent
 * border while that field's drum is open.
 */
import type { JSX } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface ValuePillProps {
  testID: string;
  label?: string;
  value: string;
  placeholder?: string;
  unit?: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ValuePill({
  testID,
  label,
  value,
  placeholder = '0',
  unit,
  active = false,
  disabled = false,
  onPress,
  style,
}: ValuePillProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const shown = value.trim() === '' ? placeholder : `${value}${unit ? ` ${unit}` : ''}`;

  return (
    <View style={[{ gap: 2, flex: 1 }, style]}>
      {label ? (
        <Text style={{ color: c.faint, fontSize: t.size.caption, textAlign: 'center' }}>{label}</Text>
      ) : null}
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Value'}: ${shown}. Opens the scroll wheel.`}
        hitSlop={4}
        style={{
          backgroundColor: c.surfaceMuted,
          borderColor: active ? c.accent : c.border,
          borderWidth: active ? 2 : 1,
          borderRadius: theme.radius.sm,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.xs,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text
          testID={`${testID}-text`}
          numberOfLines={1}
          style={{
            color: value.trim() === '' ? c.faint : c.text,
            fontSize: t.size.body,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}
        >
          {shown}
        </Text>
      </Pressable>
    </View>
  );
}
