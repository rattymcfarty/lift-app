/**
 * Exercise detail — Guide | History | Records | Charts tabs.
 * The top-left back arrow (ScreenHeader) is always present — the detail
 * screen is pushed from the browser/pickers, so there must be a way back.
 */

import { useEffect, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getExercise } from '../../src/data/repositories';
import { deleteCustomExercise } from '../../src/data/customExercises';
import { decodeStringArray, type Exercise } from '../../src/db/schema';
import { useTheme, type Theme } from '../../src/theme';
import { Button, Card, EmptyState, ScreenHeader } from '../../src/components/workout/ui';
import { displayName, muscleLabel, equipmentLabel } from '../../src/kb/taxonomy';
import { TaxonomyIcon } from '../../src/components/icons';

type TabId = 'guide' | 'history' | 'records' | 'charts';

export default function ExerciseDetailScreen(): JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const params = useLocalSearchParams<{ id: string }>();
  const exerciseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('guide');

  useEffect(() => {
    if (!exerciseId) {
      setExercise(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const ex = await getExercise(exerciseId);
      if (!cancelled) {
        setExercise(ex);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScreenHeader title="Exercise" onBack={() => router.back()} />
        <ActivityIndicator color={theme.colors.muted} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScreenHeader title="Exercise" onBack={() => router.back()} />
        <EmptyState
          message="Exercise not found"
          hint="This exercise may have been deleted or is not available."
          action={
            <Button title="Go back" onPress={() => router.back()} variant="secondary" />
          }
        />
      </SafeAreaView>
    );
  }

  const primaryMuscles = decodeStringArray(exercise.primaryMuscles);
  const secondaryMuscles = decodeStringArray(exercise.secondaryMuscles);
  const equipmentList = decodeStringArray(exercise.equipment);

  const renderHeroImage = () => {
    // The ScreenHeader above already shows the exercise name as the large
    // title — the hero shows only the primary-muscle icon, no duplicate name.
    return (
      <View style={styles.heroContainer}>
        <View style={styles.heroPlaceholder}>
          <TaxonomyIcon
            kind="muscle"
            id={primaryMuscles.length > 0 ? primaryMuscles[0] : 'Other'}
            size={96}
            tiled={false}
          />
        </View>
      </View>
    );
  };

  // Tabs scroll horizontally so every tab stays reachable at 320pt
  // (fixed flex:1 tabs clipped "Charts" off the right edge).
  const renderTabBar = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.tabBar}>
	{([['guide', 'Guide'], ['history', 'History'], ['records', 'Records'], ['charts', 'Charts']] as [TabId, string][]).map(
        ([tabId, label]) => (
          <Pressable
            key={tabId}
            testID={`exercise-tab-${tabId}`}
            onPress={() => setActiveTab(tabId)}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === tabId }}
            style={({ pressed }) => [
              styles.tabButton,
              {
                backgroundColor: activeTab === tabId ? theme.colors.surfaceMuted : 'transparent',
                borderColor: activeTab === tabId ? theme.colors.text : theme.colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={{ color: activeTab === tabId ? theme.colors.text : theme.colors.muted, fontSize: theme.typography.size.body }}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        )
      )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={displayName(exercise)} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {renderHeroImage()}
        <View style={{ marginVertical: theme.spacing.lg }}>
          {renderTabBar()}
        </View>
        {exercise.isCustom ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Edit exercise"
                variant="secondary"
                testID="exercise-edit"
                onPress={() => router.push(`/exercises/new?id=${exercise.id}`)}
              />
            </View>
            <Button
              title="Delete"
              variant="danger"
              testID="exercise-delete"
              onPress={() =>
                Alert.alert('Delete exercise?', `"${exercise.name}" will be removed from your library. Logged history is kept.`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void deleteCustomExercise(exercise.id)
                        .then(() => router.back())
                        .catch((e: unknown) => Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.'));
                    },
                  },
                ])
              }
            />
          </View>
        ) : null}
        <View style={{ paddingHorizontal: theme.spacing.sm }}>
          {activeTab === 'guide' && <GuideTab exercise={exercise} />}
          {activeTab === 'history' && <HistoryTab exerciseId={exerciseId} />}
          {activeTab === 'records' && <RecordsTab exerciseId={exerciseId} />}
          {activeTab === 'charts' && <ChartsTab exerciseId={exerciseId} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Tab components
const GuideTab = ({ exercise }: { exercise: any }) => {
  const { theme } = useTheme();
  const t = theme.typography;

  const primaryMuscles = decodeStringArray(exercise.primaryMuscles);
  const secondaryMuscles = decodeStringArray(exercise.secondaryMuscles);
  const equipmentList = decodeStringArray(exercise.equipment);
  const longevityPillars = JSON.parse(exercise.longevityPillars || '[]');
  const kbDetailJson = JSON.parse(exercise.kbDetailJson || '{}');

  const renderMetadataCard = () => (
    <Card>
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {primaryMuscles.map((muscle, index) => (
            <View
              key={muscle}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
            >
              <TaxonomyIcon kind="muscle" id={muscle} size={28} />
              <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
                {muscleLabel(muscle)}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginVertical: theme.spacing.xs }}>
          {equipmentList.map((equip, index) => (
            <Text key={equip} style={{ color: theme.colors.text, fontSize: t.size.body }}>
              {equipmentLabel(equip)}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, flexShrink: 0 }}>
            Category
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: t.size.body, flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>
            {exercise.kbCategory || exercise.category}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, flexShrink: 0 }}>
            Difficulty
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: t.size.body, flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>
            {kbDetailJson.difficulty || 'beginner'}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderOverviewSection = () => {
    const instructions = exercise.instructions || '';
    if (!instructions) return null;
    return (
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
            Overview
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
            {instructions.split('\n').map((line: string, index: number) => (
              <Text key={index} style={{ marginBottom: 2 }}>
                {line.trim() ? line : <View style={{ height: 8 }} />}
              </Text>
            ))}
          </Text>
        </View>
      </Card>
    );
  };

  const renderWhySection = () => {
    const longevityNotes = exercise.longevityNotes || '';
    if (!longevityNotes) return null;
    return (
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
            Why
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
            {longevityNotes}
          </Text>
        </View>
      </Card>
    );
  };

  const renderHowToSection = () => {
    const cues: string[] = kbDetailJson.cues || [];
    const commonMistakes: string[] = kbDetailJson.commonMistakes || [];
    const safetyNotes = kbDetailJson.safetyNotes || '';

    if (cues.length === 0 && commonMistakes.length === 0 && !safetyNotes) return null;

    return (
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
            How-to
          </Text>
          {cues.length > 0 && (
            <>
              <Text style={{ color: theme.colors.text, fontSize: t.size.body, marginBottom: theme.spacing.xs }}>
                Cues:
              </Text>
              {cues.map((cue, index) => (
                <Text key={index} style={{ color: theme.colors.text, fontSize: t.size.body }}>
                  • {cue}
                </Text>
              ))}
            </>
          )}
          {commonMistakes.length > 0 && (
            <>
              <Text style={{ color: theme.colors.text, fontSize: t.size.body, marginBottom: theme.spacing.xs }}>
                Watch out for:
              </Text>
              {commonMistakes.map((mistake, index) => (
                <Text key={index} style={{ color: theme.colors.text, fontSize: t.size.body }}>
                  • {mistake}
                </Text>
              ))}
            </>
          )}
          {safetyNotes && (
            <View style={{ marginVertical: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.text, fontSize: t.size.body, marginBottom: theme.spacing.xs }}>
                Safety:
              </Text>
              <Text style={{ color: theme.colors.warning, fontSize: t.size.body }}>
                {safetyNotes}
              </Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

  const renderProgressionSection = () => {
    const progression = kbDetailJson.progression || {};
    if (!progression.regressTo && !progression.progressTo && !progression.loadingGuidance) return null;

    return (
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
            Progression
          </Text>
          {progression.regressTo && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
                Regress to:
              </Text>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>
                {progression.regressTo}
              </Text>
            </View>
          )}
          <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium, marginVertical: theme.spacing.sm }}>
            Current: {displayName(exercise)}
          </Text>
          {progression.progressTo && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
                Progress to:
              </Text>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>
                {progression.progressTo}
              </Text>
            </View>
          )}
          {progression.loadingGuidance && (
            <View style={{ marginVertical: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
                Loading guidance:
              </Text>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.body }}>
                {progression.loadingGuidance}
              </Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View>
      {renderMetadataCard()}
      {renderOverviewSection()}
      {renderWhySection()}
      {renderHowToSection()}
      {renderProgressionSection()}
    </View>
  );
};

const HistoryTab = ({ exerciseId }: { exerciseId: string }) => {
  // In a real implementation, we'd mount the existing history component here
  // For now, placeholder showing we're reusing existing components
  const { theme } = useTheme();
  return (
    <Card>
      <Text style={{ color: theme.colors.muted, textAlign: 'center', padding: theme.spacing.lg }}>
        History tab – reusing existing P1b exercise-history component(s)
      </Text>
    </Card>
  );
};

const RecordsTab = ({ exerciseId }: { exerciseId: string }) => {
  // In a real implementation, we'd mount the existing PR display here
  const { theme } = useTheme();
  return (
    <Card>
      <Text style={{ color: theme.colors.muted, textAlign: 'center', padding: theme.spacing.lg }}>
        Records tab – reusing existing P1b PR display for this exercise (P1b #10)
      </Text>
    </Card>
  );
};

const ChartsTab = ({ exerciseId }: { exerciseId: string }) => {
  // In a real implementation, we'd mount the existing volume/strength charts here
  const { theme } = useTheme();
  return (
    <Card>
      <Text style={{ color: theme.colors.muted, textAlign: 'center', padding: theme.spacing.lg }}>
        Charts tab – reusing existing P4 volume/strength charts scoped to this exercise
      </Text>
    </Card>
  );
};

const getStyles = (theme: Theme) => StyleSheet.create({
  heroContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  heroPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    flexShrink: 0,
    minWidth: 76,
  },
});
