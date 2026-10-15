/**
 * Programs tab — "Explore | Library".
 *
 * Explore: the multi-week programs bundled in the knowledge base, each with
 * a "Start program" action (PAR-Q+ screening gate first, then enrollment).
 * Library: the active enrollment (if any) and the user's plans (workout
 * templates), plus Create Program.
 *
 * Naming: user-facing term for a template is "Plan". Internal identifiers
 * (tables, repository functions, the `Routine` type) keep the historical
 * name `routine` — renaming them would need a data migration and would
 * break backup-format compatibility.
 */

import { useCallback, useMemo, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { duplicateRoutine, listRoutinesWithStats, type RoutineListItem } from '../../src/data/routines';
import { softDeleteRoutine } from '../../src/data/repositories';
import { SwipeableRow } from '../../src/components/ui/SwipeableRow';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState } from '../../src/components/workout/ui';
import { SegmentedTitle } from '../../src/components/nav/SegmentedTitle';
import { formatWorkoutDay } from '../../src/components/workout/format';
import { loadSnapshot } from '../../src/kb/snapshot';
import { compileKbProgram, ProgramError } from '../../src/programs/compile';
import { enrollProgram, listEnrollments, unenrollProgram, type EnrolledProgram } from '../../src/programs/enrollments';
import { getParqGateStatus } from '../../src/programs/safety';
import {
  createUserProgram,
  deleteUserProgram,
  listUserPrograms,
  startUserProgram,
} from '../../src/programs/userPrograms';
import { daysPerWeekOf, isUserProgramRoutine, totalDays, type UserProgram } from '../../src/programs/userProgramDef';
import type { Href } from 'expo-router';

type Segment = 'explore' | 'library';

function Chip({ label }: { label: string }): JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.meta, fontWeight: theme.typography.weight.medium }}>
        {label}
      </Text>
    </View>
  );
}

function PlanCard({ item }: { item: RoutineListItem }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { routine, exerciseCount, lastUsedAt } = item;
  const meta: string[] = [`${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`];
  if (routine.estimatedMinutes != null) meta.push(`~${routine.estimatedMinutes} min`);
  meta.push(lastUsedAt ? `last used ${formatWorkoutDay(lastUsedAt)}` : 'never used');
  return (
    <Pressable
      onPress={() => router.push(`/plans/${routine.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open plan ${routine.name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }} numberOfLines={2}>
          {routine.name}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.meta }}>{meta.join(' · ')}</Text>
      </View>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
    </Pressable>
  );
}

export default function ProgramsScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const [segment, setSegment] = useState<Segment>('library');
  const [plans, setPlans] = useState<RoutineListItem[]>([]);
  const [enrolled, setEnrolled] = useState<EnrolledProgram[]>([]);
  const [mine, setMine] = useState<UserProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { programs, bundleVersion } = useMemo(() => {
    try {
      const { bundle } = loadSnapshot();
      return { programs: bundle.programs.filter((p) => !p.deprecated), bundleVersion: bundle.bundleVersion };
    } catch {
      return { programs: [], bundleVersion: '' };
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [p, e, u] = await Promise.all([listRoutinesWithStats(), listEnrollments('active'), listUserPrograms()]);
      // Days of your own programs live inside the program, not in the flat list.
      setPlans(p.filter((x) => !isUserProgramRoutine(x.routine.kbId)));
      setEnrolled(e);
      setMine(u);
    } catch {
      setPlans([]);
      setEnrolled([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const startProgram = async (programId: string): Promise<void> => {
    const kb = programs.find((p) => p.id === programId);
    if (!kb) return;
    setBusyId(programId);
    try {
      const gate = await getParqGateStatus();
      if (!gate.open) {
        // Safety gate: screening first; the user returns here and taps again.
        router.push('/programs/parq');
        return;
      }
      await enrollProgram(compileKbProgram(kb, bundleVersion));
      await load();
      setSegment('library');
      Alert.alert('Program started', 'Your next session is waiting on the Train tab.');
    } catch (e) {
      Alert.alert('Could not start program', e instanceof ProgramError ? e.message : 'Something went wrong — try again.');
    } finally {
      setBusyId(null);
    }
  };

  const stopProgram = (enrollmentId: string, name: string): void => {
    Alert.alert('Leave program?', `Stop "${name}"? Your logged workouts are kept.`, [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await unenrollProgram(enrollmentId);
              await load();
            } catch {
              Alert.alert('Could not leave program', 'Try again.');
            }
          })();
        },
      },
    ]);
  };

  const enrolledIds = new Set(enrolled.map((e) => e.program.source.kind === 'kb' ? e.program.source.kbId : e.program.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <SegmentedTitle
        segments={[
          { key: 'explore', label: 'Explore', testID: 'programs-segment-explore' },
          { key: 'library', label: 'Library', testID: 'programs-segment-library' },
        ]}
        active={segment}
        onChange={setSegment}
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.muted} />
        </View>
      ) : segment === 'explore' ? (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          {programs.length === 0 ? (
            <EmptyState message="No programs available." hint="Programs arrive with knowledge-base updates." />
          ) : null}
          {programs.map((p) => {
            const isEnrolled = enrolledIds.has(p.id);
            return (
              <Card key={p.id}>
                <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }}>{p.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  <Chip label={`${p.weeks} weeks`} />
                  <Chip label={`${p.daysPerWeek} days / week`} />
                  <Chip label={`Deload wk ${p.deload.week}`} />
                </View>
                <Text style={{ color: c.muted, fontSize: t.size.body }}>{p.goal}</Text>
                <Button
                  title={isEnrolled ? 'Enrolled' : 'Start program'}
                  testID={`program-start-${p.id}`}
                  size="large"
                  disabled={isEnrolled}
                  busy={busyId === p.id}
                  onPress={() => void startProgram(p.id)}
                />
              </Card>
            );
          })}
          <Text style={{ color: c.faint, fontSize: t.size.caption }}>
            LIFT programs are general fitness guidance, not medical advice. You&apos;ll complete a short PAR-Q+
            readiness screening before starting.
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(i) => i.routine.id}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing.sm }}
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
              <Button
                title="Create Program"
                variant="secondary"
                testID="programs-create"
                onPress={() => {
                  void createUserProgram()
                    .then((p) => router.push(`/programs/${p.id}/details?flow=create` as Href))
                    .catch(() => Alert.alert('Could not create the program', 'Try again.'));
                }}
              />
              {mine.length > 0 ? (
                <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
                  MY PROGRAMS · {mine.length}
                </Text>
              ) : null}
              {mine.map((p) => {
                const active = enrolled.some((e) => e.program.id === p.id);
                return (
                  <SwipeableRow
                    key={p.id}
                    backgroundColor={c.background}
                    borderRadius={theme.radius.lg}
                    confirm={{ title: 'Delete program?', message: `"${p.name}" and its days will be removed. Logged workouts are kept.` }}
                    onDelete={async () => {
                      try {
                        await deleteUserProgram(p.id);
                        await load();
                      } catch (e) {
                        Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
                      }
                    }}
                  >
                    <Card>
                      <Pressable
                        testID={`my-program-${p.id}`}
                        onPress={() => router.push(`/programs/${p.id}` as Href)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${p.name}`}
                        style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}
                      >
                        {p.details?.thumbnailUri ? (
                          <Image
                            source={{ uri: p.details.thumbnailUri }}
                            style={{ width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: c.surfaceMuted }}
                          />
                        ) : null}
                        <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }} numberOfLines={2}>
                          {p.name}
                        </Text>
                        {p.details?.tagline ? (
                          <Text style={{ color: c.muted, fontSize: t.size.meta + 1 }} numberOfLines={2}>
                            {p.details.tagline}
                          </Text>
                        ) : null}
                        <Text style={{ color: c.faint, fontSize: t.size.meta }}>
                          {p.weeks} week{p.weeks === 1 ? '' : 's'} · {daysPerWeekOf(p)} day{daysPerWeekOf(p) === 1 ? '' : 's'} a week ·{' '}
                          {totalDays(p)} sessions{active ? ' · active' : ''}
                        </Text>
                        </View>
                      </Pressable>
                      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <Button title="Edit" variant="secondary" onPress={() => router.push(`/programs/${p.id}` as Href)} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            title={active ? 'Following' : 'Start'}
                            disabled={active}
                            onPress={() => {
                              void (async () => {
                                try {
                                  const gate = await getParqGateStatus();
                                  if (!gate.open) {
                                    router.push('/programs/parq');
                                    return;
                                  }
                                  await startUserProgram(p);
                                  await load();
                                  Alert.alert('Program started', 'Your next session is waiting on the Train tab.');
                                } catch (e) {
                                  Alert.alert('Could not start program', e instanceof Error ? e.message : 'Try again.');
                                }
                              })();
                            }}
                          />
                        </View>
                      </View>
                    </Card>
                  </SwipeableRow>
                );
              })}
              {enrolled.map((e) => (
                <Card key={e.enrollment.id}>
                  <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>ACTIVE PROGRAM</Text>
                  <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }}>{e.program.name}</Text>
                  <Text style={{ color: c.faint, fontSize: t.size.meta }}>
                    Week {e.enrollment.currentWeek} of {e.program.weeks} · Day {e.enrollment.currentDay}
                  </Text>
                  <Button title="Leave program" variant="secondary" onPress={() => stopProgram(e.enrollment.id, e.program.name)} />
                </Card>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
                  MY PLANS · {plans.length}
                </Text>
                <Pressable testID="programs-new-plan" onPress={() => router.push('/plans/new')} accessibilityRole="button" hitSlop={8}>
                  <Text style={{ color: c.accent, fontSize: t.size.meta + 1, fontWeight: t.weight.semibold }}>+ New plan</Text>
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <SwipeableRow
              backgroundColor={c.background}
              rightLabel="+ Duplicate"
              onSwipeRight={() => {
                void duplicateRoutine(item.routine.id)
                  .then(() => load())
                  .catch(() => Alert.alert('Could not duplicate', 'Try again.'));
              }}
              confirm={{
                title: 'Delete plan?',
                message: `"${item.routine.name}" will be removed from your library. Logged workouts are kept.`,
              }}
              onDelete={async () => {
                try {
                  await softDeleteRoutine(item.routine.id);
                  await load();
                } catch {
                  Alert.alert('Could not delete the plan', 'Try again.');
                }
              }}
            >
              <PlanCard item={item} />
            </SwipeableRow>
          )}
          ListEmptyComponent={
            <EmptyState
              message="No plans yet."
              hint="Build a plan once, then start workouts from it in one tap — or explore a ready-made program."
              action={<Button title="Explore programs" onPress={() => setSegment('explore')} />}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
