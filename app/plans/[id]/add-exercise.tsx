/**
 * Add an exercise to a plan template: search the local exercise library
 * (KB-seeded in P2, custom exercises any time) or create a custom one
 * inline. Tapping an exercise appends it to the template and returns to
 * the builder, where targets are set. Mirrors the workout add-exercise
 * screen's search/debounce/re-entrancy patterns.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addRoutineExercise,
  createCustomExercise,
  listExercises,
  searchExercises,
} from '../../../src/data/repositories';
import type { Exercise } from '../../../src/db/schema';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../../../src/db/schema';
import { useTheme } from '../../../src/theme';
import { EmptyState, ScreenHeader, Button } from '../../../src/components/workout/ui';
import { ComposerTaxonomyPicker } from '../../../src/components/workout/ComposerTaxonomyPicker';
import { displayName } from '../../../src/kb/taxonomy';
import { ExercisePickRow } from '../../../src/components/workout/ExercisePickRow';
import { FilterChip } from '../../../src/components/workout/FilterChip';
import { TaxonomyFilterGrid } from '../../../src/components/workout/TaxonomyFilterGrid';
import { exerciseMatchesFilters } from '../../../src/lib/filterExercises';

const SEARCH_DEBOUNCE_MS = 250;
/** Picker search cap: covers the whole library (433 exercises); FlatList virtualizes. */
const SEARCH_LIMIT = 500;

function ExerciseRow({
  exercise,
  busy,
  onAdd,
}: {
  exercise: Exercise;
  busy: boolean;
  onAdd: () => void;
}): JSX.Element {
  return (
    <ExercisePickRow
      exercise={exercise}
      mode="add"
      busy={busy}
      onPress={onAdd}
      testID={`plan-add-exercise-row-${exercise.id}`}
    />
  );
}

export default function AddPlanExerciseScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const params = useLocalSearchParams<{ id: string; equip?: string }>();
  const planId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [query, setQuery] = useState('');
  // Muscle / equipment filters — same multi-select grids as the workout picker.
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  // Programs pass their equipment choice (e.g. "Dumbbell Only") as a starting
  // filter; the user can clear or change it.
  const initialEquip = (Array.isArray(params.equip) ? params.equip[0] : params.equip)
    ?.split(',')
    .filter(Boolean) ?? [];
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(initialEquip);
  const [muscleExpanded, setMuscleExpanded] = useState(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  const filtersActive = selectedMuscles.length > 0 || selectedEquipment.length > 0;
  const toggleIn = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  const [results, setResults] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Refs, not state: two taps before a re-render must not double-add.
  const addingRef = useRef(false);
  // A retry after a failed add reuses the already-created custom exercise
  // instead of inserting a duplicate row with the same name.
  const createdCustomIdRef = useRef<string | null>(null);

  // Custom-exercise composer.
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<ExerciseCategory>('strength');
  const [creating, setCreating] = useState(false);
  // Custom-exercise taxonomy: muscles + equipment picked in the composer
  // (same icon grids as the list filters, "custom"-prefixed testIDs).
  const [customMuscles, setCustomMuscles] = useState<string[]>([]);
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const toggleCustomMuscle = (id: string) => {
    setCustomMuscles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleCustomEquipment = (id: string) => {
    setCustomEquipment((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  // Refs for the header "Create New" action: scroll to the custom composer + focus it.
  const listRef = useRef<FlatList<Exercise>>(null);
  const customNameRef = useRef<TextInput>(null);
  const handleCreateNew = () => {
    listRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => customNameRef.current?.focus(), 350);
  };

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
            setResults(
              rows.filter((e) => exerciseMatchesFilters(e, selectedMuscles, selectedEquipment, q)),
            );
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

  const handleAdd = useCallback(
    async (exerciseId: string) => {
      if (!planId || addingRef.current) return;
      addingRef.current = true;
      setAddingId(exerciseId);
      setError(null);
      try {
        await addRoutineExercise({ routineId: planId, exerciseId });
        router.back();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add the exercise.');
        addingRef.current = false;
        setAddingId(null);
      }
    },
    [planId],
  );

  const handleCreateCustom = async (): Promise<void> => {
    const trimmed = customName.trim();
    if (!trimmed) {
      setError('Name the custom exercise first.');
      return;
    }
    if (!planId || addingRef.current) return;
    addingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      let exerciseId = createdCustomIdRef.current;
      if (!exerciseId) {
        exerciseId = await createCustomExercise({
          name: trimmed,
          category: customCategory,
          primaryMuscles: customMuscles,
          equipment: customEquipment,
        });
        createdCustomIdRef.current = exerciseId;
      }
      await addRoutineExercise({ routineId: planId, exerciseId });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the exercise.');
      addingRef.current = false;
      setCreating(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader
        title="Add exercise"
        onBack={() => router.back()}
        backGlyph="✕"
        right={
          <Pressable
            testID="picker-create-new"
            onPress={handleCreateNew}
            accessibilityRole="button"
            hitSlop={8}
            style={{ paddingVertical: 4 }}
          >
            <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>Create New</Text>
          </Pressable>
        }
      />
      <View style={[styles.body, { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }]}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: theme.radius.pill,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.xs,
          }}
        >
          <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>⌕</Text>
          <TextInput
            testID="plan-picker-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises…"
            placeholderTextColor={theme.colors.faint}
            returnKeyType="search"
            autoCapitalize="none"
            style={{
              flex: 1,
              color: theme.colors.text,
              fontSize: t.size.body,
              paddingVertical: theme.spacing.sm,
            }}
          />
        </View>
        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>{error}</Text>
        ) : null}

        <FlatList
          ref={listRef}
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ExerciseRow
              exercise={item}
              busy={addingId === item.id}
              onAdd={() => void handleAdd(item.id)}
            />
          )}
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <FilterChip
                  label="Muscles"
                  count={selectedMuscles.length}
                  expanded={muscleExpanded}
                  onToggle={() => setMuscleExpanded((p) => !p)}
                  onClear={() => setSelectedMuscles([])}
                  testID="plan-picker-filter-muscle"
                />
                <FilterChip
                  label="Equipment"
                  count={selectedEquipment.length}
                  expanded={equipmentExpanded}
                  onToggle={() => setEquipmentExpanded((p) => !p)}
                  onClear={() => setSelectedEquipment([])}
                  testID="plan-picker-filter-equipment"
                />
              </View>
              {muscleExpanded ? (
                <TaxonomyFilterGrid
                  mode="muscle"
                  selected={selectedMuscles}
                  onToggle={(id) => setSelectedMuscles((prev) => toggleIn(prev, id))}
                  testIDPrefix="plan-picker"
                />
              ) : null}
              {equipmentExpanded ? (
                <TaxonomyFilterGrid
                  mode="equipment"
                  selected={selectedEquipment}
                  onToggle={(id) => setSelectedEquipment((prev) => toggleIn(prev, id))}
                  testIDPrefix="plan-picker"
                />
              ) : null}
              {searching ? <ActivityIndicator color={theme.colors.muted} /> : null}
            </View>
          }
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
                    : 'Create a custom exercise below.'
                }
              />
            )
          }
          ListFooterComponent={
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              <Text
                style={{
                  color: theme.colors.muted,
                  fontSize: t.size.caption,
                  fontWeight: t.weight.medium,
                }}
              >
                OR CREATE A CUSTOM EXERCISE
              </Text>
              <TextInput
                ref={customNameRef}
                value={customName}
                onChangeText={(text) => {
                  setCustomName(text);
                  setError(null);
                }}
                placeholder="Exercise name"
                placeholderTextColor={theme.colors.faint}
                returnKeyType="done"
                editable={!creating}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: theme.radius.md,
                  color: theme.colors.text,
                  fontSize: t.size.body,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                }}
              />
              <View style={[styles.categoryRow, { gap: theme.spacing.xs }]}>
                {EXERCISE_CATEGORIES.map((cat) => {
                  const selected = customCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCustomCategory(cat)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? theme.colors.text : theme.colors.border,
                        borderRadius: theme.radius.pill,
                        paddingVertical: theme.spacing.xs,
                        paddingHorizontal: theme.spacing.sm,
                        backgroundColor: selected ? theme.colors.surfaceMuted : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? theme.colors.text : theme.colors.muted,
                          fontSize: t.size.caption,
                          fontWeight: selected ? t.weight.medium : t.weight.regular,
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <ComposerTaxonomyPicker
                muscles={customMuscles}
                equipment={customEquipment}
                onToggleMuscle={toggleCustomMuscle}
                onToggleEquipment={toggleCustomEquipment}
              />
              <Button
                title="Create and add"
                variant="secondary"
                onPress={() => void handleCreateCustom()}
                busy={creating}
              />
            </View>
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
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
