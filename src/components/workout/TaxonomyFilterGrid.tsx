/**
 * Shared 2-column taxonomy filter grid used by the exercise picker,
 * the swap screen, and the exercise browser. Multi-select toggles.
 * Each cell is an icon-tile + label row (original LIFT icon art —
 * see src/components/icons/ for the copyright note).
 *
 * Every label in the grid renders at ONE size, computed from the grid's measured
 * width (`filterMetrics`). Do not reintroduce `adjustsFontSizeToFit` here: it
 * shrinks each label by a different amount, which is exactly the inconsistency
 * this replaced.
 */
import { useState, type JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { MUSCLE_GROUPS, EQUIPMENT } from '../../kb/taxonomy';
import { TaxonomyIcon } from '../icons';
import { filterMetrics } from './filterMetrics';

export interface TaxonomyFilterGridProps {
  mode: 'muscle' | 'equipment';
  selected: string[];
  onToggle: (id: string) => void;
  /** Prefix for cell testIDs — "picker" for list filters, "custom" for the composer. */
  testIDPrefix?: string;
}

export function TaxonomyFilterGrid({ mode, selected, onToggle, testIDPrefix = 'picker' }: TaxonomyFilterGridProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const items = mode === 'muscle' ? MUSCLE_GROUPS : EQUIPMENT;
  const [gridWidth, setGridWidth] = useState(0);
  const m = filterMetrics(gridWidth);
  return (
    <View
      style={styles.grid}
      onLayout={(e) => setGridWidth(Math.round(e.nativeEvent.layout.width))}
    >
      {items.map((item) => {
        const isSelected = selected.includes(item.id);
        return (
          <Pressable
            key={item.id}
            testID={`${testIDPrefix}-${mode}-${item.id}`}
            onPress={() => onToggle(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              styles.cell,
              {
                backgroundColor: theme.colors.surface,
                borderColor: isSelected ? theme.colors.highlight : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
                paddingVertical: m.pad,
                paddingHorizontal: m.pad,
                gap: m.gap,
              },
            ]}
          >
            <TaxonomyIcon kind={mode} id={item.id} size={m.icon} />
            <Text
              style={{
                color: isSelected ? theme.colors.highlight : theme.colors.text,
                fontSize: m.label,
                fontWeight: isSelected ? t.weight.medium : t.weight.regular,
                textAlign: 'left',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
  },
});
