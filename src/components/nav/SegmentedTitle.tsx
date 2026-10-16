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
  const size = width < 360 ? t.size.screenCompact : t.size.screen;
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
                adjustsFontSizeToFit
                minimumFontScale={0.7}
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
