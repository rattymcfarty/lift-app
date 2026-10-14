/**
 * Muscle + equipment selection for the Create New (custom exercise) composer.
 * Two collapsible sections reusing TaxonomyFilterGrid with "custom"-prefixed
 * testIDs, so they never collide with the picker's list-filter grids
 * (which use the default "picker" prefix).
 * Selection is optional: creating with nothing picked stores empty lists,
 * same as the composer behaved before this component existed.
 */
import { useState, type JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { TaxonomyFilterGrid } from './TaxonomyFilterGrid';

export interface ComposerTaxonomyPickerProps {
  muscles: string[];
  equipment: string[];
  onToggleMuscle: (id: string) => void;
  onToggleEquipment: (id: string) => void;
}

export function ComposerTaxonomyPicker({
  muscles,
  equipment,
  onToggleMuscle,
  onToggleEquipment,
}: ComposerTaxonomyPickerProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [musclesExpanded, setMusclesExpanded] = useState(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Pressable
        testID="custom-composer-muscles-toggle"
        onPress={() => setMusclesExpanded((p) => !p)}
        accessibilityRole="button"
        accessibilityState={{ expanded: musclesExpanded }}
        style={styles.header}
      >
        <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
          Muscles{muscles.length > 0 ? ` (${muscles.length})` : ''}
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>
          {musclesExpanded ? '▴' : '▾'}
        </Text>
      </Pressable>
      {musclesExpanded ? (
        <TaxonomyFilterGrid
          mode="muscle"
          selected={muscles}
          onToggle={onToggleMuscle}
          testIDPrefix="custom"
        />
      ) : null}
      <Pressable
        testID="custom-composer-equipment-toggle"
        onPress={() => setEquipmentExpanded((p) => !p)}
        accessibilityRole="button"
        accessibilityState={{ expanded: equipmentExpanded }}
        style={styles.header}
      >
        <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
          Equipment{equipment.length > 0 ? ` (${equipment.length})` : ''}
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>
          {equipmentExpanded ? '▴' : '▾'}
        </Text>
      </Pressable>
      {equipmentExpanded ? (
        <TaxonomyFilterGrid
          mode="equipment"
          selected={equipment}
          onToggle={onToggleEquipment}
          testIDPrefix="custom"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});
