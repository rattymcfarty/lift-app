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
import { listExercisesWithHistory, type ExerciseHistoryOption } from '../../../src/data/history';
import { exerciseMatchesFilters } from '../../../src/lib/filterExercises';
import { displayName } from '../../../src/kb/taxonomy';

const SEARCH_DEBOUNCE_MS = 250;
/** Picker search cap: covers the whole library (433 exercises); FlatList virtualizes. */
const SEARCH_LIMIT = 500;

export default function SwapExerciseScreen(): JSX.Element {
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
  const [muscleExpanded, setMuscleExpanded] = useState(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
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
    setMuscleExpanded(true);
  };
  const toggleEquipment = (id: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setEquipmentExpanded(true);
  };

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

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Pressable
                  testID="swap-filter-muscle"
                  onPress={() => setMuscleExpanded((p) => !p)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: muscleExpanded }}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                    backgroundColor: theme.colors.surface,
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                  }}
                >
                  <Text
                    style={{ color: theme.colors.text, fontSize: t.size.caption, fontWeight: t.weight.medium, flexShrink: 1 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {selectedMuscles.length > 0 ? `Muscles (${selectedMuscles.length})` : 'All Muscles'}
                  </Text>
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                    {muscleExpanded ? '▾' : '▴'}
                  </Text>
                </Pressable>
                <Pressable
                  testID="swap-filter-equipment"
                  onPress={() => setEquipmentExpanded((p) => !p)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: equipmentExpanded }}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                    backgroundColor: theme.colors.surface,
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                  }}
                >
                  <Text
                    style={{ color: theme.colors.text, fontSize: t.size.caption, fontWeight: t.weight.medium, flexShrink: 1 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {selectedEquipment.length > 0 ? `Equipment (${selectedEquipment.length})` : 'All Equipment'}
                  </Text>
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                    {equipmentExpanded ? '▾' : '▴'}
                  </Text>
                </Pressable>
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

              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium, marginTop: theme.spacing.sm }}>
                Similar Exercises
              </Text>
            </View>
          }
          data={results.slice(0, 20)}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedId(item.id)}
              accessibilityRole="button"
              testID={`swap-row-${item.id}`}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: theme.colors.border,
                  paddingVertical: theme.spacing.sm,
                  opacity: pressed ? 0.7 : 1,
                  backgroundColor: selectedId === item.id ? theme.colors.surfaceMuted : 'transparent',
                },
              ]}
            >
              <View style={styles.rowText}>
                <Text style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }} numberOfLines={2}>
                  {displayName(item)}
                </Text>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }} numberOfLines={2}>
                  {decodeStringArray(item.primaryMuscles).join(', ')}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/exercises/${item.id}`)}
                testID={`exercise-info-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={`About ${displayName(item)}`}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>ⓘ</Text>
              </Pressable>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>
                {selectedId === item.id ? '✓' : '○'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            searching ? null : (
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

      <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
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
