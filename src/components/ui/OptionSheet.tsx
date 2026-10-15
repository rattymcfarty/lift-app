/**
 * OptionSheet — a bottom sheet with a list of choices (schedule type,
 * duration, day actions). Cross-platform (plain Modal), theme-aware, sized
 * from the type scale. Tapping the dim backdrop or Cancel closes it.
 */
import type { JSX } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../theme';

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable
          testID={testID}
          onPress={() => undefined}
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            paddingBottom: theme.spacing.lg,
            maxHeight: '75%',
          }}
        >
          {title ? (
            <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium, padding: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
              {title.toUpperCase()}
            </Text>
          ) : null}
          <ScrollView>
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
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={{ alignItems: 'center', padding: theme.spacing.md, marginTop: theme.spacing.xs }}
          >
            <Text style={{ color: c.muted, fontSize: t.size.row, fontWeight: t.weight.medium }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
