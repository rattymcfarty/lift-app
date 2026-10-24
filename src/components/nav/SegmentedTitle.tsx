/**
 * SegmentedTitle — the large screen title that doubles as a section switcher
 * ("Train | History", "Explore | Library"). The active title is full-strength
 * with a purple underline; the others are muted. Sizes come from the type
 * scale (screen / screenCompact below 360pt) and shrink-to-fit so a long
 * pair still fits a 320pt Display-Zoom screen and 1.3x Dynamic Type.
 */
import type { JSX, ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme';
import { fitGroupSize } from '../../theme/adaptive';

export interface SegmentedTitleProps<K extends string> {
  segments: ReadonlyArray<{ key: K; label: string; testID?: string }>;
  active: K;
  onChange: (key: K) => void;
  /** Trailing controls (settings gear, action button). */
  right?: ReactNode;
}

export function SegmentedTitle<K extends string>({
  segments,
  active,
  onChange,
  right,
}: SegmentedTitleProps<K>): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { width } = useWindowDimensions();
  // One size for every segment, computed once from the narrowest thing that has
  // to fit: the longest label in the width left over after the trailing action.
  // Each segment used to autoshrink on its own, so "Train | History" could come
  // out as two different sizes.
  const reserved = right ? theme.spacing.md + 40 : 0;
  const size = fitGroupSize(width - theme.spacing.md * 2 - reserved, {
    longest: segments.reduce((a, s) => (s.label.length > a.length ? s.label : a), ''),
    base: width < 360 ? t.size.screenCompact : t.size.screen,
    min: t.size.card,
    count: segments.length,
    gap: theme.spacing.md * (segments.length - 1),
  });
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', flexShrink: 1, gap: theme.spacing.md }}>
        {segments.map((s) => {
          const on = s.key === active;
          return (
            <Pressable
              key={s.key}
              testID={s.testID}
              onPress={() => onChange(s.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              hitSlop={6}
              style={{
                flexShrink: 1,
                borderBottomWidth: 3,
                borderBottomColor: on ? theme.colors.accent : 'transparent',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: on ? theme.colors.text : theme.colors.muted,
                  fontSize: size,
                  fontWeight: t.weight.bold,
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {right ? <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>{right}</View> : null}
    </View>
  );
}
