/**
 * Swap Exercise screen — replace an exercise mid-workout without losing sets.
 */

import { useCallback, useEffect, useState, type JSX } from 'react';
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
  swapWorkoutExercise,
  searchExercises,
  listExercises,
  createCustomExercise,
  getExercise,
} from '../../../src/data/repositories';
import { decodeStringArray, EXERCISE_CATEGORIES, type Exercise } from '../../../src/db/schema';
import { useTheme } from '../../../src/theme';
import { Button, ScreenHeader, EmptyState } from '../../../src/components/workout/ui';
import { TaxonomyFilterGrid } from '../../../src/components/workout/TaxonomyFilterGrid';
import { FilterChip, FilterChipRow } from '../../../src/components/workout/FilterChip';
import { toggleFilterPanel, type OpenFilterPanel } from '../../../src/components/workout/filterPanel';
import { listExercisesWithHistory, type ExerciseHistoryOption } from '../../../src/data/history';
import { exerciseMatchesFilters } from '../../../src/lib/filterExercises';
import { ExercisePickRow } from '../../../src/components/workout/ExercisePickRow';
import { displayName } from '../../../src/kb/taxonomy';
import { useTabBarSpace } from '../../../src/components/nav/TabBar';

const SEARCH_DEBOUNCE_MS = 250;
/** Picker search cap: covers the whole library (433 exercises); FlatList virtualizes. */
const SEARCH_LIMIT = 500;

export default function SwapExerciseScreen(): JSX.Element {
  const tabBarSpace = useTabBarSpace();
  const { theme } = useTheme();
  const t = theme.typography;
  const params = useLocalSearchParams<{ id: string; workoutExerciseId: string }>();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;
  const workoutExerciseId = Array.isArray(params.workoutExerciseId) ? params.workoutExerciseId[0] : params.workoutExerciseId;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recent, setRecent] = useState<ExerciseHistoryOption[]>([]);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state — shared TaxonomyFilterGrid.
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  /** One filter grid at a time — the caret can then never describe a closed grid. */
  const [openFilter, setOpenFilter] = useState<OpenFilterPanel>(null);
  const filtersActive = selectedMuscles.length > 0 || selectedEquipment.length > 0;

  // Load current exercise info
  useEffect(() => {
    if (!workoutExerciseId) return;
    // We don't have direct repo to get workoutExercise with exercise; we'll rely on the parent passing or fetch from DB.
    // For simplicity, fetch the workout detail isn't available here easily; we'll approximate by not blocking.
  }, [workoutExerciseId]);

  // Recent exercises (most recently used first)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listExercisesWithHistory(10);
        if (!cancelled) setRecent(rows);
      } catch {
        if (!cancelled) setRecent([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Search / browse
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const q = query.trim();
        setSearching(true);
        setError(null);
        try {
          const rows = q ? await searchExercises(q, SEARCH_LIMIT) : await listExercises();
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
    setOpenFilter('muscle');
  };
  const toggleEquipment = (id: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setOpenFilter('equipment');
  };
  const clearMuscles = () => setSelectedMuscles([]);
  const clearEquipment = () => setSelectedEquipment([]);

  const handleConfirm = useCallback(async () => {
    if (!workoutExerciseId || !selectedId || selectedId === currentExercise?.id || !workoutId) {
      return;
    }
    setSwapping(true);
    setError(null);
    try {
      await swapWorkoutExercise(workoutExerciseId, selectedId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swap failed.');
    } finally {
      setSwapping(false);
    }
  }, [workoutExerciseId, selectedId, currentExercise, workoutId]);

  const disabled = !selectedId || selectedId === currentExercise?.id || swapping;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScreenHeader
        title="Swap Exercise"
        right={
          <Pressable onPress={() => router.push(`/workout/${workoutId}/add-exercise`) } accessibilityRole="button" accessibilityLabel="Create new exercise">
            <Text style={{ color: theme.colors.accent, fontSize: t.size.body, fontWeight: t.weight.medium }}>Create New</Text>
          </Pressable>
        }
        onBack={() => router.back()}
      />

      <View style={[styles.body, { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }]}>
        <FlatList
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
              <TextInput
                value={query}
                testID="swap-search"
                onChangeText={setQuery}
                placeholder="Search exercise name"
                placeholderTextColor={theme.colors.faint}
                returnKeyType="search"
                autoCapitalize="none"
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

              <FilterChipRow>
                <FilterChip
                  label="Muscles"
                  count={selectedMuscles.length}
                  expanded={openFilter === 'muscle'}
                  onToggle={() => setOpenFilter((p) => toggleFilterPanel(p, 'muscle'))}
                  onClear={clearMuscles}
                  testID="swap-filter-muscle"
                />
                <FilterChip
                  label="Equipment"
                  count={selectedEquipment.length}
                  expanded={openFilter === 'equipment'}
                  onToggle={() => setOpenFilter((p) => toggleFilterPanel(p, 'equipment'))}
                  onClear={clearEquipment}
                  testID="swap-filter-equipment"
                />
              </FilterChipRow>
              {openFilter === 'muscle' ? (
                <TaxonomyFilterGrid
                  mode="muscle"
                  selected={selectedMuscles}
                  onToggle={toggleMuscle}
                />
              ) : null}
              {openFilter === 'equipment' ? (
                <TaxonomyFilterGrid
                  mode="equipment"
                  selected={selectedEquipment}
                  onToggle={toggleEquipment}
                />
              ) : null}

              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium, marginTop: theme.spacing.sm }}>
                Similar Exercises
              </Text>
            </View>
          }
          data={results.slice(0, 20)}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ExercisePickRow
              exercise={item}
              mode="select"
              selected={selectedId === item.id}
              onPress={() => setSelectedId(item.id)}
              testID={`swap-row-${item.id}`}
              infoTestID={`exercise-info-${item.id}`}
            />
          )}
          ListEmptyComponent={
            searching ? undefined : (
              <EmptyState
                message={
                  query.trim()
                    ? `No exercises match "${query.trim()}".`
                    : filtersActive
                      ? 'No exercises match these filters.'
                      : 'No exercises found.'
                }
              />
            )
          }
        />

        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium, marginTop: theme.spacing.md }}>
          Recent Exercise
        </Text>
        {recent.length === 0 ? (
          <Text style={{ color: theme.colors.faint, fontSize: t.size.body, textAlign: 'center', paddingVertical: theme.spacing.md }}>
            No recent exercises yet.
          </Text>
        ) : (
          recent
            .filter((r) => r.exercise.id !== currentExercise?.id)
            .slice(0, 5)
            .map((r) => (
              <Pressable
                key={r.exercise.id}
                onPress={() => setSelectedId(r.exercise.id)}
                accessibilityRole="button"
                testID={`swap-recent-${r.exercise.id}`}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderBottomColor: theme.colors.border,
                    paddingVertical: theme.spacing.sm,
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: selectedId === r.exercise.id ? theme.colors.surfaceMuted : 'transparent',
                  },
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }} numberOfLines={2}>
                    {displayName(r.exercise)}
                  </Text>
                  <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }} numberOfLines={2}>
                    {decodeStringArray(r.exercise.primaryMuscles).join(', ')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push(`/exercises/${r.exercise.id}`)}
                  testID={`exercise-info-${r.exercise.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`About ${displayName(r.exercise)}`}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>ⓘ</Text>
                </Pressable>
                <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>
                  {selectedId === r.exercise.id ? '✓' : '○'}
                </Text>
              </Pressable>
            ))
        )}
      </View>

      <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md + tabBarSpace }}>
        <Button
          title="Swap Exercise"
          testID="swap-confirm"
          variant="primary"
          disabled={disabled}
          busy={swapping}
          onPress={() => void handleConfirm()}
        />
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  rowText: { flex: 1, gap: 2 },
});
