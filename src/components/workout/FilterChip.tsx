/**
 * Collapsible filter chip used by every exercise picker/list: shows
 * "All Muscles" or "Muscles (2)", a chevron, and an inline clear button.
 *
 * One component for the whole app on purpose. Browse, Add exercise, Plan
 * add-exercise and Swap exercise used to carry their own copies, which drifted:
 * some had a clear button, some did not, and `adjustsFontSizeToFit` made the two
 * chips sit next to each other at different text sizes (“All Muscles” at 12 pt,
 * “All Equipment” at 10 pt on a narrow phone).
 *
 * The label has ONE size (`caption`) and never shrinks. The two chips split the
 * row in half and stay on one line; wrapping them turned “All Equipment” into a
 * lone chip on a second line on the owner's phone, which looked broken. A count
 * is short by nature, so the space the equal halves give is enough — and if a
 * label ever did overflow, it truncates instead of resizing its neighbour.
 */
import type { JSX, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export function FilterChip({
  label,
  count,
  expanded,
  onToggle,
  onClear,
  testID,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onClear: () => void;
  testID: string;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const display = count > 0 ? `${label} (${count})` : `All ${label}`;
  return (
    // The clear (X) button sits inline AFTER the chip, never absolutely
    // positioned over it — the old absolute X covered the chevron.
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      <Pressable
        testID={testID}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          gap: theme.spacing.xs,
        }}
      >
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.caption, fontWeight: t.weight.medium, flexShrink: 1 }}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
          {expanded ? '▾' : '▴'}
        </Text>
      </Pressable>
      {count > 0 && (
        <Pressable
          testID={`${testID}-clear`}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label} filter`}
          hitSlop={8}
          style={{ padding: 4, minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * The row the chips live in: two equal halves, one line, no wrapping. Kept as a
 * component so all four pickers lay the chips out identically.
 */
export function FilterChipRow({ children }: { children: ReactNode }): JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      {children}
    </View>
  );
}
