/**
 * Browse Exercises — the full exercise inventory, explorable. Search,
 * muscle/equipment filters (same TaxonomyFilterGrid as the pickers), tap
 * a row for the exercise detail screen. Read-only: no add-to-workout or
 * custom-create here — those live in the workout/plan pickers.
 *
 * Browse uses the same data path as the pickers: listExercises() unbounded
 * + searchExercises(q, 500), client-side taxonomy filter. SEARCH_LIMIT
 * covers the whole library; SectionList virtualizes.
 *
 * The list is sectioned: "Core & foundational" (the owner's curated
 * shortlist, src/lib/foundational.ts) first, then everything else. Search and
 * the filters apply to both groups — see src/lib/exerciseSections.ts.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listExercises, searchExercises } from '../../src/data/repositories';
import { decodeStringArray, type Exercise } from '../../src/db/schema';
import { useTheme } from '../../src/theme';
import { Button, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { TaxonomyFilterGrid } from '../../src/components/workout/TaxonomyFilterGrid';
import { buildExerciseSections, type ExerciseSection } from '../../src/lib/exerciseSections';
import { SwipeableRow } from '../../src/components/ui/SwipeableRow';
import { ExercisePickRow } from '../../src/components/workout/ExercisePickRow';
import { deleteCustomExercise } from '../../src/data/customExercises';
import { useTopBarInset } from '../../src/components/chrome/TopBar';
import { useTabBarSpace } from '../../src/components/nav/TabBar';

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 500;

function ExerciseRow({
  exercise,
  onDeleted,
}: {
  exercise: Exercise;
  onDeleted: (id: string) => void;
}): JSX.Element {
  const { theme } = useTheme();
  return (
    <SwipeableRow
      backgroundColor={theme.colors.background}
      rightLabel="+ New exercise"
      onSwipeRight={() => router.push('/exercises/new')}
      confirm={{
        title: 'Delete exercise?',
        message: `"${exercise.name}" will be removed from your library. Logged history is kept.`,
      }}
      onDelete={
        exercise.isCustom
          ? async () => {
              try {
                await deleteCustomExercise(exercise.id);
                onDeleted(exercise.id);
              } catch (e) {
                Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
              }
            }
          : undefined
      }
    >
      <ExercisePickRow
        exercise={exercise}
        mode="browse"
        onPress={() => router.push(`/exercises/${exercise.id}`)}
        testID={`browse-exercise-row-${exercise.id}`}
        infoTestID={`browse-exercise-info-${exercise.id}`}
      />
    </SwipeableRow>
  );
}

function SectionHeader({
  title,
  testID,
}: {
  title: string;
  testID: string;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    // Opaque background: the header sticks to the top while its section scrolls.
    <View
      testID={testID}
      style={{
        backgroundColor: theme.colors.background,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xs,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ color: theme.colors.text, fontSize: t.size.section, fontWeight: t.weight.bold }}
      >
        {title}
      </Text>
    </View>
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
  const tabBarSpace = useTabBarSpace();
  const params = useLocalSearchParams<{ focus?: string }>();
  const searchRef = useRef<TextInput>(null);

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

  // The left panel's "Search exercises" row lands here with ?focus=search:
  // give the field a beat to mount, then open the keyboard.
  useEffect(() => {
    if (params.focus !== 'search') return;
    const timer = setTimeout(() => searchRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [params.focus]);

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
            // rows are unfiltered from the repo (filtering + sectioning is a
            // pure client-side pass), so the unfiltered count is the library
            // size. Store raw rows; sections are derived below.
            if (!q) setTotal(rows.length);
            setResults(rows);
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
  }, [query]);

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

  // Filter + split into "Core & foundational" then "All exercises". Pure and
  // memoised: the section list stays virtualized over the whole library.
  const sections = useMemo(
    () => buildExerciseSections(results, selectedMuscles, selectedEquipment, query),
    [results, selectedMuscles, selectedEquipment, query],
  );

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
        <SectionList
          contentContainerStyle={{ paddingBottom: tabBarSpace }}
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
              <TextInput
                value={query}
                testID="browse-exercises-search"
                ref={searchRef}
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
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ExerciseRow exercise={item} onDeleted={(id) => setResults((prev) => prev.filter((e) => e.id !== id))} />
          )}
          sections={sections}
          renderSectionHeader={({ section }: { section: ExerciseSection<Exercise> }) => (
            <SectionHeader title={section.title} testID={`browse-section-${section.key}`} />
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
