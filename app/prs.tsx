/**
 * Personal records — best lifts per exercise.
 *
 * PRs are written automatically when a logged set beats the standing best
 * (max_weight / est_1rm — see logSet's auto-detection). This screen reads
 * live data on every focus so a PR set moments ago shows up immediately.
 * PRs from the last 7 days get a NEW badge.
 */

import { useCallback, useState, type JSX } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listPRsWithExercises,
  type PRWithExercise,
} from '../src/data/repositories';
import { useTheme } from '../src/theme';
import { Button, Card, EmptyState, ScreenHeader } from '../src/components/workout/ui';

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const KIND_LABELS: Record<string, string> = {
  max_weight: 'Max weight',
  est_1rm: 'Est. 1RM',
  max_reps: 'Max reps',
  max_volume: 'Max volume',
  longest_distance: 'Longest distance',
  fastest_time: 'Fastest time',
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isNew(achievedAt: Date): boolean {
  return Date.now() - achievedAt.getTime() < NEW_WINDOW_MS;
}

interface PRSection {
  exerciseId: string;
  exerciseName: string;
  latestAt: number;
  prs: PRWithExercise[];
}

function groupByExercise(prs: PRWithExercise[]): PRSection[] {
  const byId = new Map<string, PRSection>();
  for (const pr of prs) {
    let section = byId.get(pr.exerciseId);
    if (!section) {
      section = { exerciseId: pr.exerciseId, exerciseName: pr.exerciseName, latestAt: 0, prs: [] };
      byId.set(pr.exerciseId, section);
    }
    section.prs.push(pr);
    const t = pr.achievedAt.getTime();
    if (t > section.latestAt) section.latestAt = t;
  }
  return [...byId.values()].sort((a, b) => b.latestAt - a.latestAt);
}

function PRRow({ pr, last }: { pr: PRWithExercise; last: boolean }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const fresh = isNew(pr.achievedAt);
  const delta =
    pr.previousValue != null && pr.value > pr.previousValue
      ? `+${trimNumber(Math.round((pr.value - pr.previousValue) * 100) / 100)} ${pr.unit}`
      : null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
        borderBottomColor: theme.colors.border,
        borderBottomWidth: last ? 0 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
            {kindLabel(pr.kind)}
          </Text>
          {fresh ? (
            <View
              style={{
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: theme.radius.sm,
                paddingHorizontal: theme.spacing.xs,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  color: theme.colors.success,
                  fontSize: t.size.caption,
                  fontWeight: t.weight.bold,
                }}
              >
                NEW
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, marginTop: 2 }}>
          {formatDate(pr.achievedAt)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.bold }}>
          {trimNumber(pr.value)} {pr.unit}
        </Text>
        {delta ? (
          <Text
            style={{ color: theme.colors.success, fontSize: t.size.caption, fontWeight: t.weight.medium }}
          >
            {delta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ExerciseCard({ section }: { section: PRSection }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Card>
      <Text
        style={{
          color: theme.colors.muted,
          fontSize: t.size.caption,
          fontWeight: t.weight.bold,
          marginBottom: theme.spacing.xs,
        }}
      >
        {section.exerciseName.toUpperCase()}
      </Text>
      {section.prs.map((pr, i) => (
        <PRRow key={pr.id} pr={pr} last={i === section.prs.length - 1} />
      ))}
    </Card>
  );
}

export default function PRsScreen(): JSX.Element {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<PRSection[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listPRsWithExercises()
        .then((prs) => {
          if (!cancelled) setSections(groupByExercise(prs));
        })
        .catch(() => {
          if (!cancelled) setSections([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScreenHeader title="Personal Records" onBack={() => router.back()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.exerciseId}
          contentContainerStyle={{
            padding: theme.spacing.md,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
          renderItem={({ item }) => <ExerciseCard section={item} />}
          ListEmptyComponent={
            <EmptyState
              message="No personal records yet."
              hint="Log a workout — when a set beats your best, it lands here automatically."
              action={<Button title="Start workout" onPress={() => router.push('/workout/new')} />}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
