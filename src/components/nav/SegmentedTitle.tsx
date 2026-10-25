/**
 * SegmentedTitle — the large screen title that doubles as a section switcher
 * ("Train | History", "Explore | Library"). The active title is full-strength
 * with a purple underline; the others are muted. Sizes come from the type
 * scale (screen / screenCompact below 360pt) and shrink-to-fit so a long
 * pair still fits a 320pt Display-Zoom screen and 1.3x Dynamic Type.
 */
import type { JSX, ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { TOP_BAR_HEIGHT, useTopBarVisible } from '../chrome/TopBar';
import { useTheme } from '../../theme';
import { fitGroupSize } from '../../theme/adaptive';

export interface SegmentedTitleProps<K extends string> {
  segments: ReadonlyArray<{ key: K; label: string; testID?: string }>;
  active: K;
  onChange: (key: K) => void;
  /**
   * Section name, rendered as the page title above the segments (Programs).
   * Without it the segments ARE the title (Train's "Train | History"), which is
   * fine when one of them names the section; use it when none of them does.
   */
  title?: string;
  /** Trailing controls (settings gear, action button). */
  right?: ReactNode;
  /** Width reserved for the trailing controls, in dp (two buttons need more than one). */
  rightSize?: number;
}

export function SegmentedTitle<K extends string>({
  segments,
  active,
  onChange,
  title,
  right,
  rightSize = 40,
}: SegmentedTitleProps<K>): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { width } = useWindowDimensions();
  const topBarVisible = useTopBarVisible();
  // Titled mode: the section name carries the hierarchy, so the segments step
  // down to row size and read as a switcher, not as a second title.
  const titled = title != null;
  // One size for every segment, computed once from the narrowest thing that has
  // to fit: the longest label in the width left over after the trailing action.
  // Each segment used to autoshrink on its own, so "Train | History" could come
  // out as two different sizes.
  const reserved = right ? theme.spacing.md + rightSize : 0;
  const size = fitGroupSize(width - theme.spacing.md * 2 - reserved, {
    longest: segments.reduce((a, s) => (s.label.length > a.length ? s.label : a), ''),
    base: titled ? t.size.row : width < 360 ? t.size.screenCompact : t.size.screen,
    min: titled ? t.size.meta : t.size.card,
    count: segments.length,
    gap: theme.spacing.md * (segments.length - 1),
  });
  // The page title matches ScreenHeader's: same scale formula, same width rules,
  // so every section's title is the same size on the same device.
  const titleScale = Math.min(1.05, Math.max(0.86, width / 390));
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.md,
        // Same top-bar allowance as ScreenHeader; screens must NOT add their own
        // spacer on top of this or their headers drift apart.
        paddingTop: theme.spacing.sm + (topBarVisible ? TOP_BAR_HEIGHT : 0),
        paddingBottom: theme.spacing.sm,
        gap: theme.spacing.sm,
      }}
    >
      {title != null ? (
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.text,
            fontSize: Math.round((width < 360 ? t.size.screenCompact : t.size.screen) * titleScale * 2) / 2,
            fontWeight: t.weight.bold,
          }}
        >
          {title}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
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
    </View>
  );
}
