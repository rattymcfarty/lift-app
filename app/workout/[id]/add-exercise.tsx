/**
 * Add an exercise to the active workout: search the local exercise library
 * (KB-seeded in P2, custom exercises any time) or create a custom one
 * inline. Tapping an exercise adds it at the end of the workout and
 * returns to the active screen.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addExerciseToWorkout,
  addExercisesAsSuperset,
  createCustomExercise,
  listExercises,
  searchExercises,
} from '../../../src/data/repositories';
import type { Exercise } from '../../../src/db/schema';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../../../src/db/schema';
import { useTheme } from '../../../src/theme';
import { EmptyState, ScreenHeader, Button } from '../../../src/components/workout/ui';
import { TaxonomyFilterGrid } from '../../../src/components/workout/TaxonomyFilterGrid';
import { exerciseMatchesFilters } from '../../../src/lib/filterExercises';
import { listExercisesWithHistory, type ExerciseHistoryOption } from '../../../src/data/history';
import { RecentExercises } from '../../../src/components/workout/RecentExercises';
import { ExercisePickRow } from '../../../src/components/workout/ExercisePickRow';
import { ComposerTaxonomyPicker } from '../../../src/components/workout/ComposerTaxonomyPicker';
import { displayName } from '../../../src/kb/taxonomy';

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
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Pressable
      onPress={onAdd}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Add ${displayName(exercise)} to workout`}
      testID={`add-exercise-row-${exercise.id}`}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing.sm,
          opacity: pressed || busy ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.rowText}>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}
          numberOfLines={1}
        >
          {displayName(exercise)}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          {exercise.category}
          {exercise.isCustom ? ' · custom' : ''}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={theme.colors.muted} size="small" />
      ) : (
        <Text style={{ color: theme.colors.muted, fontSize: t.size.card }}>+</Text>
      )}
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

export default function AddExerciseScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [query, setQuery] = useState('');
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

  // Filter state — multi-select toggle chips.
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [muscleExpanded, setMuscleExpanded] = useState(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  // Selection model for multi-select add.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const filtersActive = selectedMuscles.length > 0 || selectedEquipment.length > 0;
  // Recent exercises (most recently used first) for the Recent section.
  const [recent, setRecent] = useState<ExerciseHistoryOption[]>([]);
  // Refs for the header "Create New" action: scroll to the custom composer + focus it.
  const listRef = useRef<FlatList<Exercise>>(null);
  const customNameRef = useRef<TextInput>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listExercisesWithHistory(5);
        if (!cancelled) setRecent(rows);
      } catch {
        if (!cancelled) setRecent([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const handleCreateNew = () => {
    listRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => customNameRef.current?.focus(), 350);
  };
  // Recent shows only when browsing unfiltered with an empty query.
  const showRecent = query.trim() === '' && !filtersActive && recent.length > 0;

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

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = useCallback(
    async (exerciseId: string) => {
      if (!workoutId || addingRef.current) return;
      addingRef.current = true;
      setAddingId(exerciseId);
      setError(null);
      try {
        await addExerciseToWorkout({ workoutId, exerciseId });
        router.back();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add the exercise.');
        addingRef.current = false;
        setAddingId(null);
      }
    },
    [workoutId],
  );

  const handleAddExercises = async () => {
    if (!workoutId || selectedIds.size === 0 || addingRef.current) return;
    addingRef.current = true;
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      for (const exerciseId of ids) {
        await addExerciseToWorkout({ workoutId, exerciseId });
      }
      setSelectedIds(new Set());
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the exercises.');
      addingRef.current = false;
    }
  };

  const handleAddAsSuperset = async () => {
    if (!workoutId || selectedIds.size < 2 || addingRef.current) return;
    addingRef.current = true;
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      await addExercisesAsSuperset(workoutId, ids);
      setSelectedIds(new Set());
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the superset.');
      addingRef.current = false;
    }
  };

  const handleCreateCustom = async (): Promise<void> => {
    const trimmed = customName.trim();
    if (!trimmed) {
      setError('Name the custom exercise first.');
      return;
    }
    if (!workoutId || addingRef.current) return;
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
      await addExerciseToWorkout({ workoutId, exerciseId });
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScreenHeader
        title="Add exercise"
        compact
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
        <FlatList
          ref={listRef}
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
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
                  value={query}
                  testID="add-exercise-search"
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
                  testID="picker-filter-muscle"
                />
                <FilterChip
                  label="Equipment"
                  count={selectedEquipment.length}
                  expanded={equipmentExpanded}
                  onToggle={() => setEquipmentExpanded((p) => !p)}
                  onClear={clearEquipment}
                  testID="picker-filter-equipment"
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
              {showRecent ? (
                <RecentExercises
                  items={recent}
                  isSelected={(id) => selectedIds.has(id)}
                  onPick={(exercise) => toggleRow(exercise.id)}
                  onInfo={(exercise) => router.push(`/exercises/${exercise.id}`)}
                />
              ) : null}
            </View>
          }
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ExercisePickRow
              exercise={item}
              mode="select"
              selected={selectedIds.has(item.id)}
              onPress={() => toggleRow(item.id)}
              testID={`add-exercise-row-${item.id}`}
              infoTestID={`exercise-info-${item.id}`}
            />
          )}
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
                }              />
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

        <View
          style={[
            styles.bottomBar,
            {
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              gap: theme.spacing.sm,
              borderTopColor: theme.colors.border,
              borderTopWidth: 1,
              backgroundColor: theme.colors.background,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Button
              title="As superset"
              variant="secondary"
              disabled={selectedIds.size < 2}
              busy={addingRef.current}
              onPress={() => void handleAddAsSuperset()}
              testID="picker-add-superset"
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <Button
              title={
                selectedIds.size === 0
                  ? 'Add exercises'
                  : `Add ${selectedIds.size} exercise${selectedIds.size === 1 ? '' : 's'}`
              }
              variant="primary"
              disabled={selectedIds.size === 0}
              busy={addingRef.current}
              onPress={() => void handleAddExercises()}
              testID="picker-add-exercises"
            />
          </View>
        </View>
        </View>
      </KeyboardAvoidingView>
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
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
