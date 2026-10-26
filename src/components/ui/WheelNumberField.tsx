/**
 * WheelNumberField — one numeric value entered with the scroll wheel.
 *
 * The set row proved the pattern (owner decision 2026-10-25: the wheel is the
 * default, typing is one tap deeper). This is that pattern for a single labelled
 * field, so rest seconds, plan targets, plate loads, measurements and body stats
 * all behave like the weight/reps/RPE drums instead of opening a keyboard.
 *
 * Layout: a caption label above a pill showing the value. Tapping the pill opens
 * the drum for this field; "Type instead" in the sheet turns the pill into a
 * focused keypad input (`<testID>-input`) and blurring returns to the wheel.
 *
 * The caller owns the value as text (the app stores targets as text ranges), so
 * the wheel simply writes `item.value` through `onChangeText`.
 */
import { useState, type JSX } from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { WheelSheet } from './WheelSheet';
import { indexOfValue, type WheelItem } from './wheelModel';

export interface WheelNumberFieldProps {
  /** Stable id: the pill and the typed input are `<testID>` / `<testID>-input`. */
  testID: string;
  /** Small caption above the pill. */
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  items: readonly WheelItem[];
  /** Unit in the drum's band ("kg", "s", "min"). */
  unit?: string;
  placeholder?: string;
  /** Decimal keypad in type mode. */
  decimal?: boolean;
  maxLength?: number;
  /** Fixed width; omit to share the row. */
  width?: number;
  disabled?: boolean;
  /** Shows Clear in the sheet (optional values). */
  clearable?: boolean;
  /** Tapping the label runs this (e.g. the RPE explainer). */
  onLabelPress?: () => void;
  labelTestID?: string;
  style?: StyleProp<ViewStyle>;
  /** Recently shown in a failing flow: expose the drum's test id prefix. */
  sheetTestID?: string;
}

export function WheelNumberField({
  testID,
  label,
  value,
  onChangeText,
  items,
  unit,
  placeholder = '0',
  decimal = false,
  maxLength,
  width,
  disabled = false,
  clearable = false,
  onLabelPress,
  labelTestID,
  style,
  sheetTestID,
}: WheelNumberFieldProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;

  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);

  const labelNode = (
    <Text
      testID={labelTestID}
      onPress={onLabelPress}
      style={{ color: c.faint, fontSize: t.size.caption, textAlign: 'center' }}
      suppressHighlighting
    >
      {label}
    </Text>
  );

  return (
    <View style={[{ width, gap: 2, flex: width ? undefined : 1 }, style]}>
      {label ? labelNode : null}
      {typing ? (
        <TextInput
          testID={`${testID}-input`}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.faint}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          maxLength={maxLength}
          returnKeyType="done"
          autoFocus
          selectTextOnFocus
          maxFontSizeMultiplier={1.15}
          onBlur={() => setTyping(false)}
          style={{
            backgroundColor: c.surfaceMuted,
            borderColor: c.accent,
            borderWidth: 1,
            borderRadius: theme.radius.sm,
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.xs,
            color: c.text,
            fontSize: t.size.body,
            textAlign: 'center',
          }}
        />
      ) : (
        <Pressable
          testID={testID}
          disabled={disabled}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}${value ? `, ${value}` : ''}. Opens the scroll wheel.`}
          accessibilityHint="Tap Type instead in the sheet to use the keypad."
          hitSlop={4}
          style={{
            backgroundColor: c.surfaceMuted,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: theme.radius.sm,
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.xs,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Text
            testID={`${testID}-text`}
            numberOfLines={1}
            maxFontSizeMultiplier={1.15}
            style={{
              color: value ? c.text : c.faint,
              fontSize: t.size.body,
              textAlign: 'center',
            }}
          >
            {value || placeholder}
          </Text>
        </Pressable>
      )}

      <WheelSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        items={items}
        index={value.trim() === '' ? 0 : indexOfValue(items, value.trim(), 0, true)}
        unit={unit}
        onSelect={onChangeText}
        onClear={clearable ? () => onChangeText('') : undefined}
        onType={() => {
          setOpen(false);
          setTimeout(() => setTyping(true), 320);
        }}
        testID={sheetTestID ?? `${testID}-sheet`}
      />
    </View>
  );
}
