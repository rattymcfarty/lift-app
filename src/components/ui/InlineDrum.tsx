/**
 * InlineDrum — a drum you render *inside* an existing sheet.
 *
 * The sheet-based `WheelNumberField` cannot be used from inside a `BottomSheet`:
 * on Android, closing the nested modal also dismisses the sheet underneath it
 * (seen on the device 2026-10-25 — the plate calculator vanished and left a bare
 * keyboard). So sheets that own numeric fields render the drum in place: one
 * `InlineDrum` under the field being edited, with a Done action.
 *
 * Pure presentation: the caller owns which field is open and the value.
 */
import type { JSX } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { indexOfValue, type WheelItem } from './wheelModel';
import { WheelPicker } from './WheelPicker';

export interface InlineDrumProps {
  testID: string;
  /** Field name shown beside the drum ("Target", "Working weight"). */
  label: string;
  items: readonly WheelItem[];
  value: string;
  unit?: string;
  onChange: (value: string) => void;
  onDone: () => void;
}

export function InlineDrum({ testID, label, items, value, unit, onChange, onDone }: InlineDrumProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const index = value.trim() === '' ? 0 : indexOfValue(items, value.trim(), 0, true);

  return (
    <View
      testID={testID}
      style={{
        borderTopWidth: 1,
        borderTopColor: c.border,
        paddingTop: theme.spacing.sm,
        marginTop: theme.spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {label}
        </Text>
        <Pressable
          testID={`${testID}-done`}
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Done editing this value"
          hitSlop={8}
        >
          <Text style={{ color: c.accent, fontSize: t.size.meta, fontWeight: t.weight.semibold }}>Done</Text>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
        <View style={{ width: 220 }}>
          <WheelPicker
            items={items}
            index={index}
            unit={unit}
            onChange={(_, item) => onChange(item.value)}
            testID={`${testID}-wheel`}
          />
        </View>
      </View>
    </View>
  );
}
