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
  createCustomExercise,
  listExercises,
  searchExercises,
} from '../../../src/data/repositories';
import type { Exercise } from '../../../src/db/schema';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../../../src/db/schema';
import { useTheme } from '../../../src/theme';
import { EmptyState, ScreenHeader, Button } from '../../../src/components/workout/ui';

const SEARCH_DEBOUNCE_MS = 250;
const BROWSE_LIMIT = 100;

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
      accessibilityLabel={`Add ${exercise.name} to workout`}
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
          {exercise.name}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          {exercise.category}
          {exercise.isCustom ? ' · custom' : ''}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={theme.colors.muted} size="small" />
      ) : (
        <Text style={{ color: theme.colors.muted, fontSize: t.size.title }}>+</Text>
      )}
    </Pressable>
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

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const q = query.trim();
        setSearching(true);
        setError(null);
        try {
          const rows = q
            ? await searchExercises(q)
            : await listExercises({ limit: BROWSE_LIMIT });
          if (!cancelled) setResults(rows);
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
  }, [query]);

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
      <ScreenHeader title="Add exercise" onBack={() => router.back()} />
      <View style={[styles.body, { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }]}>
        <TextInput
          value={query}
          testID="add-exercise-search"
          onChangeText={setQuery}
          placeholder="Search exercises…"
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
        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>{error}</Text>
        ) : null}

        <FlatList
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
            searching ? <ActivityIndicator color={theme.colors.muted} /> : null
          }
          ListEmptyComponent={
            searching ? null : (
              <EmptyState
                message={
                  query.trim()
                    ? `No exercises match "${query.trim()}".`
                    : 'No exercises in the library yet.'
                }
                hint="Create a custom exercise below — the KB exercise library arrives in P2."
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
