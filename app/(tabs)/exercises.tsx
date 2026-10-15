/**
 * Browse Exercises — the full exercise inventory, explorable. Search,
 * muscle/equipment filters (same TaxonomyFilterGrid as the pickers), tap
 * a row for the exercise detail screen. Read-only: no add-to-workout or
 * custom-create here — those live in the workout/plan pickers.
 *
 * Browse uses the same data path as the pickers: listExercises() unbounded
 * + searchExercises(q, 500), client-side taxonomy filter. SEARCH_LIMIT
 * covers the whole library (433 exercises); FlatList virtualizes.
 */

import { useEffect, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listExercises, searchExercises } from '../../src/data/repositories';
import { decodeStringArray, type Exercise } from '../../src/db/schema';
import { useTheme } from '../../src/theme';
import { Button, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { TaxonomyFilterGrid } from '../../src/components/workout/TaxonomyFilterGrid';
import { exerciseMatchesFilters } from '../../src/lib/filterExercises';
import { displayName, equipmentLabel, muscleLabel } from '../../src/kb/taxonomy';

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 500;

function ExerciseRow({ exercise }: { exercise: Exercise }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const muscles = decodeStringArray(exercise.primaryMuscles).map(muscleLabel);
  const equipment = decodeStringArray(exercise.equipment).map(equipmentLabel);
  const meta = [exercise.category, ...muscles, ...equipment]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={() => router.push(`/exercises/${exercise.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${displayName(exercise)}`}
      testID={`browse-exercise-row-${exercise.id}`}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rowText}>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }}
          numberOfLines={2}
        >
          {displayName(exercise)}
        </Text>
        {meta ? (
          <Text style={{ color: theme.colors.faint, fontSize: t.size.meta }} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
    </Pressable>
  );
}

function FilterChip({
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
          adjustsFontSizeToFit
          minimumFontScale={0.7}
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

export default function BrowseExercisesScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [muscleExpanded, setMuscleExpanded] = useState(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  const filtersActive = selectedMuscles.length > 0 || selectedEquipment.length > 0;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const q = query.trim();
        setSearching(true);
        setError(null);
        try {
          const rows = q
            ? await searchExercises(q, SEARCH_LIMIT)
            : await listExercises();
          if (!cancelled) {
            // rows are unfiltered from the repo (filtering is
            // client-side), so the unfiltered count is the library size.
            if (!q) setTotal(rows.length);
            setResults(rows.filter((e) =>
              exerciseMatchesFilters(e, selectedMuscles, selectedEquipment, q),
            ));
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : 'Search failed.');
            setResults([]);
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedMuscles, selectedEquipment]);

  const toggleMuscle = (id: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setMuscleExpanded(true);
  };
  const toggleEquipment = (id: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setEquipmentExpanded(true);
  };
  const clearMuscles = () => setSelectedMuscles([]);
  const clearEquipment = () => setSelectedEquipment([]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <ScreenHeader
        title="Browse Exercises"
        subtitle={total > 0 ? `${total} exercises in the library` : undefined}
        right={
          <Button title="New" variant="secondary" testID="exercises-new" onPress={() => router.push('/exercises/new')} />
        }
      />
      <View style={[styles.body, { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }]}>
        <FlatList
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
              <TextInput
                value={query}
                testID="browse-exercises-search"
                onChangeText={setQuery}
                placeholder="Search exercises…"
                placeholderTextColor={theme.colors.faint}
                returnKeyType="search"
                autoCapitalize="none"
                style={{
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: theme.radius.md,
                  color: theme.colors.text,
                  fontSize: t.size.body,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                }}
              />
              {searching ? <ActivityIndicator color={theme.colors.muted} /> : null}
              {error ? (
                <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>{error}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <FilterChip
                  label="Muscles"
                  count={selectedMuscles.length}
                  expanded={muscleExpanded}
                  onToggle={() => setMuscleExpanded((p) => !p)}
                  onClear={clearMuscles}
                  testID="browse-filter-muscle"
                />
                <FilterChip
                  label="Equipment"
                  count={selectedEquipment.length}
                  expanded={equipmentExpanded}
                  onToggle={() => setEquipmentExpanded((p) => !p)}
                  onClear={clearEquipment}
                  testID="browse-filter-equipment"
                />
              </View>
              {muscleExpanded ? (
                <TaxonomyFilterGrid
                  mode="muscle"
                  selected={selectedMuscles}
                  onToggle={toggleMuscle}
                />
              ) : null}
              {equipmentExpanded ? (
                <TaxonomyFilterGrid
                  mode="equipment"
                  selected={selectedEquipment}
                  onToggle={toggleEquipment}
                />
              ) : null}
            </View>
          }
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <ExerciseRow exercise={item} />}
          ListEmptyComponent={
            searching ? null : (
              <EmptyState
                message={
                  query.trim()
                    ? `No exercises match "${query.trim()}".`
                    : filtersActive
                      ? 'No exercises match these filters.'
                      : 'No exercises in the library yet.'
                }
                hint={
                  filtersActive
                    ? 'Try clearing the muscle or equipment filters.'
                    : undefined
                }
              />
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
