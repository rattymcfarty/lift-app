/**
 * WheelSheet — one drum in a bottom sheet, with the unit in its band.
 *
 * This is what a long-press on a set-row value opens (weight, reps, RPE). The
 * value updates as the drum settles, so the row behind the sheet is already
 * right when the sheet closes; the unit comes from the caller ("kg"/"lb" for a
 * weight, "reps", "RPE"), never from the component.
 *
 * The wheel is the default way in (owner decision, 2026-10-25). Typing is one
 * tap deeper — "Type instead" — for when a big jump is quicker than a flick.
 */
import type { JSX } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../workout/ui';
import { BottomSheet } from './BottomSheet';
import { WheelPicker } from './WheelPicker';
import type { WheelItem } from './wheelModel';

export interface WheelSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Field name — "Weight", "Reps", "RPE". */
  title: string;
  /** Context line, usually the exercise name. */
  subtitle?: string;
  /** Optional field switcher (the set row's Weight | Reps | RPE). */
  tabs?: ReadonlyArray<{ key: string; label: string; testID?: string }>;
  activeTab?: string;
  onTabChange?: (key: string) => void;
  items: readonly WheelItem[];
  /** Row to open on. */
  index: number;
  /** Unit shown in the band. */
  unit?: string;
  /** Called on every settle, with the row's value. */
  onSelect: (value: string) => void;
  /** Shows a "Clear" action when set (optional fields). */
  onClear?: () => void;
  /**
   * Shows "Type instead": the caller closes the sheet and hands the field to the
   * keypad. The wheel is the default path; typing stays one tap away.
   */
  onType?: () => void;
  testID: string;
}

export function WheelSheet({
  visible,
  onClose,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  items,
  index,
  unit,
  onSelect,
  onClear,
  onType,
  testID,
}: WheelSheetProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} testID={testID}>
      {/* Deliberately NOT a ScrollView: the drum is a scrollable itself, and a
          vertical ScrollView around it swallows the drag on Android (the wheel
          would not move at all). The content is a fixed height — tabs, drum,
          buttons — so nothing needs to scroll here. */}
      <View style={{ paddingBottom: theme.spacing.lg }}>
        {tabs && tabs.length > 1 ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              paddingTop: theme.spacing.sm,
            }}
          >
            {tabs.map((tab) => {
              const on = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  testID={tab.testID}
                  onPress={() => onTabChange?.(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  hitSlop={6}
                  style={{
                    borderBottomWidth: 2,
                    borderBottomColor: on ? theme.colors.accent : 'transparent',
                    paddingBottom: 2,
                  }}
                >
                  <Text
                    style={{
                      color: on ? theme.colors.text : theme.colors.muted,
                      fontSize: t.size.row,
                      fontWeight: on ? t.weight.semibold : t.weight.medium,
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
          <View style={{ width: 220 }}>
            <WheelPicker
              items={items}
              index={index}
              unit={unit}
              onChange={(_, item) => onSelect(item.value)}
              testID={`${testID}-wheel`}
            />
          </View>
        </View>
        {onType ? (
          <Pressable
            testID={`${testID}-type`}
            onPress={() => {
              onType();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Type the value instead"
            hitSlop={8}
            style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}
          >
            <Text style={{ color: theme.colors.accent, fontSize: t.size.meta, fontWeight: t.weight.semibold }}>
              Type instead
            </Text>
          </Pressable>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          {onClear ? (
            <View style={{ flex: 1 }}>
              <Button
                title="Clear"
                variant="secondary"
                testID={`${testID}-clear`}
                onPress={() => {
                  onClear();
                  onClose();
                }}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button title="Done" testID={`${testID}-done`} onPress={onClose} />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
