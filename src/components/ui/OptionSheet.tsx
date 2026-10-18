/**
 * OptionSheet — a list of choices (schedule type, duration, day actions) in the
 * shared glass bottom sheet. Same header, glass and dismissal as every other
 * sheet: the header close, a tap on the backdrop, a pull down on the header, or
 * Android back. Tapping an option selects it and closes.
 */
import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { BottomSheet } from './BottomSheet';

export interface SheetOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  destructive?: boolean;
  disabled?: boolean;
}

export interface OptionSheetProps<T extends string | number> {
  visible: boolean;
  title?: string;
  options: ReadonlyArray<SheetOption<T>>;
  selected?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
  testID?: string;
}

export function OptionSheet<T extends string | number>({
  visible,
  title,
  options,
  selected = null,
  onSelect,
  onClose,
  testID,
}: OptionSheetProps<T>): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} testID={testID} maxHeightRatio={0.75}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {options.map((o) => {
          const on = selected !== null && o.value === selected;
          return (
            <Pressable
              key={String(o.value)}
              testID={`${testID ?? 'sheet'}-${String(o.value)}`}
              disabled={o.disabled}
              onPress={() => {
                onSelect(o.value);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: o.disabled }}
              style={({ pressed }) => ({
                paddingVertical: theme.spacing.md - 2,
                paddingHorizontal: theme.spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                minHeight: 52,
                opacity: o.disabled ? 0.4 : pressed ? 0.7 : 1,
                backgroundColor: on ? c.surfaceMuted : 'transparent',
              })}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: o.destructive ? c.danger : c.text,
                    fontSize: t.size.row,
                    fontWeight: on ? t.weight.bold : t.weight.medium,
                  }}
                >
                  {o.label}
                </Text>
                {o.hint ? <Text style={{ color: c.faint, fontSize: t.size.meta }}>{o.hint}</Text> : null}
              </View>
              {on ? <Text style={{ color: c.accent, fontSize: t.size.row, fontWeight: t.weight.bold }}>✓</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
});
