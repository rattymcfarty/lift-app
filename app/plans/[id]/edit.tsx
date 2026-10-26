/**
 * Plan builder/editor: rename, notes, duration, pillars, plus the
 * template items — add exercises, reorder, edit per-exercise targets
 * (sets × reps × weight, RPE, rest), remove.
 *
 * Detail edits save via an explicit Save button; exercise operations
 * (add/remove/reorder/targets) persist immediately like the workout flow.
 */

import { useCallback, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  decodePillars,
  getRoutine,
  type RoutineDetail,
} from '../../../src/data/repositories';
import { SwipeableRow } from '../../../src/components/ui/SwipeableRow';
import { WheelNumberField } from '../../../src/components/ui/WheelNumberField';
import { countItems, minutesItems, restItems, rpeItems, weightItems } from '../../../src/components/ui/wheelRanges';
import {
  removeRoutineExercise,
  reorderRoutineExercises,
  updateRoutine,
  updateRoutineExercise,
  type RoutineExercisePatch,
} from '../../../src/data/routines';
import {
  LONGEVITY_PILLARS,
  type LongevityPillar,
  type RoutineExercise,
} from '../../../src/db/schema';
import { useTheme } from '../../../src/theme';
import {
  Button,
  EmptyState,
  NumberInput,
  ScreenHeader,
} from '../../../src/components/workout/ui';
import { parseUserInt, parseUserNumber } from '../../../src/components/workout/format';
import { RpeSheet } from '../../../src/components/workout/RpeSheet';
import { formatTargets as formatPlanTargets } from '../../../src/components/routines/format';
import { displayName } from '../../../src/kb/taxonomy';
import { useTabBarSpace } from '../../../src/components/nav/TabBar';

interface TargetDraft {
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
  rest: string;
}

function draftFrom(item: RoutineExercise): TargetDraft {
  return {
    sets: item.targetSets?.toString() ?? '',
    reps: item.targetReps ?? '',
    weight: item.targetWeightKg?.toString() ?? '',
    rpe: item.targetRpe?.toString() ?? '',
    rest: item.targetRestSeconds?.toString() ?? '',
  };
}

export default function PlanEditScreen(): JSX.Element {
  const tabBarSpace = useTabBarSpace();
  const { theme } = useTheme();
  const t = theme.typography;
  const params = useLocalSearchParams<{ id: string }>();
  const planId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [detail, setDetail] = useState<RoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail form state.
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState('');
  const [pillars, setPillars] = useState<LongevityPillar[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  // Exercise operations.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TargetDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [savingTargets, setSavingTargets] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  /** The RPE explainer, opened from the RPE target field's label. */
  const [rpeSheetVisible, setRpeSheetVisible] = useState(false);

  // Re-entrancy guard: disabled-button state updates async.
  const busyRef = useRef(false);
  // Detail-form state is initialized once from the DB. Later reloads (after
  // add/remove/reorder/target edits) refresh the exercise list but must NOT
  // clobber unsaved name/notes/minutes/pillars edits.
  const formInitRef = useRef(false);

  const load = useCallback(async () => {
    if (!planId) {
      setLoading(false);
      return;
    }
    try {
      const d = await getRoutine(planId);
      setDetail(d);
      if (d && !formInitRef.current) {
        setName(d.routine.name);
        setNotes(d.routine.notes ?? '');
        setMinutes(d.routine.estimatedMinutes?.toString() ?? '');
        setPillars(decodePillars(d.routine.longevityPillars));
        formInitRef.current = true;
      }
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const togglePillar = (pillar: LongevityPillar): void => {
    setPillars((prev) =>
      prev.includes(pillar) ? prev.filter((p) => p !== pillar) : [...prev, pillar],
    );
    setSavedTick(false);
  };

  const handleSaveDetails = async (): Promise<void> => {
    if (!planId || busyRef.current) return;
    busyRef.current = true;
    try {
      const trimmed = name.trim();
      if (!trimmed) {
        setError('Give the plan a name.');
        return;
      }
      const parsedMinutes = parseUserInt(minutes);
      if (Number.isNaN(parsedMinutes)) {
        setError('Estimated minutes must be a whole number.');
        return;
      }
      setSaving(true);
      setError(null);
      const updated = await updateRoutine(planId, {
        name: trimmed,
        notes: notes.trim() ? notes.trim() : null,
        estimatedMinutes: parsedMinutes,
        longevityPillars: pillars,
      });
      if (!updated) {
        setError('This plan no longer exists.');
        return;
      }
      setDetail((d) => (d ? { ...d, routine: updated } : d));
      setSavedTick(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the plan.');
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const move = async (index: number, direction: -1 | 1): Promise<void> => {
    if (!planId || !detail || busyRef.current) return;
    const target = index + direction;
    if (target < 0 || target >= detail.items.length) return;
    busyRef.current = true;
    const itemId = detail.items[index].routineExercise.id;
    setActingId(itemId);
    try {
      setError(null);
      const ids = detail.items.map((i) => i.routineExercise.id);
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await reorderRoutineExercises(planId, ids);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reorder.');
    } finally {
      busyRef.current = false;
      setActingId(null);
    }
  };

  const handleRemove = (itemId: string, exerciseName: string): void => {
    if (busyRef.current) return;
    Alert.alert('Remove exercise?', `"${exerciseName}" will be removed from this plan.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          busyRef.current = true;
          setActingId(itemId);
          void removeRoutineExercise(itemId)
            .then(() => {
              if (expandedId === itemId) {
                setExpandedId(null);
                setDraft(null);
              }
              return load();
            })
            .catch((e: unknown) => {
              setError(e instanceof Error ? e.message : 'Could not remove the exercise.');
            })
            .finally(() => {
              busyRef.current = false;
              setActingId(null);
            });
        },
      },
    ]);
  };

  const openTargets = (item: RoutineDetail['items'][number]): void => {
    const id = item.routineExercise.id;
    if (expandedId === id) {
      setExpandedId(null);
      setDraft(null);
      setDraftError(null);
    } else {
      setExpandedId(id);
      setDraft(draftFrom(item.routineExercise));
      setDraftError(null);
    }
  };

  const handleSaveTargets = async (itemId: string): Promise<void> => {
    if (!draft || busyRef.current) return;
    busyRef.current = true;
    try {
      const sets = parseUserInt(draft.sets);
      const weight = parseUserNumber(draft.weight);
      const rpe = parseUserNumber(draft.rpe);
      const rest = parseUserInt(draft.rest);
      if (
        Number.isNaN(sets) ||
        Number.isNaN(weight) ||
        Number.isNaN(rpe) ||
        Number.isNaN(rest)
      ) {
        setDraftError('Sets, weight, RPE and rest must be numbers.');
        return;
      }
      setSavingTargets(true);
      setDraftError(null);
      const patch: RoutineExercisePatch = {
        targetSets: sets,
        targetReps: draft.reps.trim() ? draft.reps.trim() : null,
        targetWeightKg: weight,
        targetRpe: rpe,
        targetRestSeconds: rest,
      };
      const updated = await updateRoutineExercise(itemId, patch);
      if (!updated) {
        setDraftError('This item no longer exists.');
        return;
      }
      setExpandedId(null);
      setDraft(null);
      await load();
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Could not save targets.');
    } finally {
      busyRef.current = false;
      setSavingTargets(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top', 'bottom']}
      >
        <ScreenHeader title="Edit plan" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.muted} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top', 'bottom']}
      >
        <ScreenHeader title="Edit plan" onBack={() => router.back()} />
        <EmptyState
          message="This plan no longer exists."
          action={<Button title="Back to plans" onPress={() => router.back()} />}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader
        title="Edit plan"
        onBack={() => router.back()}
        right={
          <Button
            title="Done"
            variant="secondary"
            onPress={() => router.replace(`/plans/${planId}`)}
          />
        }
      />
      <FlatList
        data={detail.items}
        keyExtractor={(i) => i.routineExercise.id}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.xl + tabBarSpace,
          gap: theme.spacing.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            {/* Details form */}
            <View style={{ gap: theme.spacing.xs }}>
              <Text
                style={{
                  color: theme.colors.muted,
                  fontSize: t.size.caption,
                  fontWeight: t.weight.medium,
                }}
              >
                PLAN NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError(null);
                  setSavedTick(false);
                }}
                placeholder="Plan name"
                placeholderTextColor={theme.colors.faint}
                returnKeyType="done"
                editable={!saving}
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
            </View>
            <View style={{ gap: theme.spacing.xs }}>
              <Text
                style={{
                  color: theme.colors.muted,
                  fontSize: t.size.caption,
                  fontWeight: t.weight.medium,
                }}
              >
                NOTES (OPTIONAL)
              </Text>
              <TextInput
                value={notes}
                onChangeText={(text) => {
                  setNotes(text);
                  setSavedTick(false);
                }}
                placeholder="Focus cues, scheduling…"
                placeholderTextColor={theme.colors.faint}
                returnKeyType="done"
                editable={!saving}
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
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: theme.spacing.md,
              }}
            >
              <WheelNumberField
                testID="plan-minutes"
                label="minutes"
                value={minutes}
                onChangeText={(text) => {
                  setMinutes(text);
                  setError(null);
                  setSavedTick(false);
                }}
                items={minutesItems()}
                unit="min"
                placeholder="45"
                width={96}
                disabled={saving}
                sheetTestID="plan-minutes-sheet"
              />
              <View style={[styles.pillarRow, { gap: theme.spacing.xs, flex: 1 }]}>
                {LONGEVITY_PILLARS.map((pillar) => {
                  const selected = pillars.includes(pillar);
                  return (
                    <Pressable
                      key={pillar}
                      onPress={() => togglePillar(pillar)}
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
                        {pillar}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {error ? (
              <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>
                {error}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Button title="Save details" onPress={() => void handleSaveDetails()} busy={saving} />
              {savedTick ? (
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>Saved.</Text>
              ) : null}
            </View>

            <Text
              style={{
                color: theme.colors.muted,
                fontSize: t.size.caption,
                fontWeight: t.weight.medium,
                marginTop: theme.spacing.sm,
              }}
            >
              EXERCISES
            </Text>
            <Button
              title="Add exercise"
              variant="secondary"
              testID="plan-edit-add-exercise"
              onPress={() => router.push(`/plans/${planId}/add-exercise`)}
            />
          </View>
        }
        renderItem={({ item, index }) => {
          const re = item.routineExercise;
          const expanded = expandedId === re.id;
          const acting = actingId === re.id;
          return (
            <SwipeableRow
              backgroundColor={theme.colors.background}
              borderRadius={theme.radius.md}
              rightLabel="+ Add exercise"
              onSwipeRight={() => router.push(`/plans/${planId}/add-exercise`)}
              confirm={{
                title: 'Remove exercise?',
                message: `"${displayName(item.exercise)}" will be removed from this plan.`,
                confirmLabel: 'Remove',
              }}
              onDelete={async () => {
                try {
                  await removeRoutineExercise(re.id);
                  if (expandedId === re.id) {
                    setExpandedId(null);
                    setDraft(null);
                  }
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Could not remove the exercise.');
                }
              }}
            >
            <View
              style={[
                styles.itemCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm,
                  opacity: acting ? 0.6 : 1,
                },
              ]}
            >
              <Pressable
                onPress={() => openTargets(item)}
                accessibilityRole="button"
                accessibilityLabel={`Edit targets for ${displayName(item.exercise)}`}
                testID={`plan-item-${index}`}
                style={styles.itemRow}
              >
                <View style={styles.itemText}>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: t.size.body,
                      fontWeight: t.weight.medium,
                    }}
                    numberOfLines={3}
                  >
                    {index + 1}. {displayName(item.exercise)}
                  </Text>
                  <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                    {formatPlanTargets(re)}
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <Pressable
                    onPress={() => void move(index, -1)}
                    disabled={index === 0 || acting}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${displayName(item.exercise)} up`}
                    hitSlop={8}
                    style={[styles.arrow, { opacity: index === 0 ? 0.25 : 1 }]}
                  >
                    <Text style={{ color: theme.colors.muted, fontSize: t.size.card }}>↑</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void move(index, 1)}
                    disabled={index === detail.items.length - 1 || acting}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${displayName(item.exercise)} down`}
                    hitSlop={8}
                    style={[
                      styles.arrow,
                      { opacity: index === detail.items.length - 1 ? 0.25 : 1 },
                    ]}
                  >
                    <Text style={{ color: theme.colors.muted, fontSize: t.size.card }}>↓</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemove(re.id, displayName(item.exercise))}
                    disabled={acting}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${displayName(item.exercise)} from plan`}
                    hitSlop={8}
                    style={styles.arrow}
                  >
                    <Text style={{ color: theme.colors.danger, fontSize: t.size.card }}>×</Text>
                  </Pressable>
                </View>
              </Pressable>
              {expanded && draft ? (
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  <View style={[styles.targetRow, { gap: theme.spacing.sm }]}>
                    <WheelNumberField
                      testID="plan-target-sets"
                      label="sets"
                      value={draft.sets}
                      onChangeText={(text) => setDraft((d) => (d ? { ...d, sets: text } : d))}
                      items={countItems(1, 10)}
                      placeholder="3"
                      style={{ flex: 1 }}
                    />
                    <View style={{ width: 96, gap: 2 }}>
                      <Text
                        style={{
                          color: theme.colors.faint,
                          fontSize: t.size.caption,
                          textAlign: 'center',
                        }}
                      >
                        reps
                      </Text>
                      <TextInput
                        value={draft.reps}
                        onChangeText={(text) =>
                          setDraft((d) => (d ? { ...d, reps: text } : d))
                        }
                        placeholder="8-12"
                        placeholderTextColor={theme.colors.faint}
                        returnKeyType="done"
                        textAlign="center"
                        style={{
                          width: 96,
                          backgroundColor: theme.colors.surfaceMuted,
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                          borderWidth: 1,
                          fontSize: t.size.body,
                          borderRadius: theme.radius.sm,
                          paddingVertical: theme.spacing.xs,
                        }}
                      />
                    </View>
                    <WheelNumberField
                      testID="plan-target-weight"
                      label="kg"
                      value={draft.weight}
                      onChangeText={(text) => setDraft((d) => (d ? { ...d, weight: text } : d))}
                      items={weightItems('kg')}
                      unit="kg"
                      placeholder="60"
                      decimal
                      width={80}
                    />
                  </View>
                  <View style={[styles.targetRow, { gap: theme.spacing.sm }]}>
                    <WheelNumberField
                      testID="plan-target-rpe"
                      label="RPE"
                      value={draft.rpe}
                      onChangeText={(text) => setDraft((d) => (d ? { ...d, rpe: text } : d))}
                      items={rpeItems()}
                      placeholder="8"
                      decimal
                      clearable
                      width={80}
                      onLabelPress={() => setRpeSheetVisible(true)}
                      labelTestID="plan-rpe-help"
                    />
                    <WheelNumberField
                      testID="plan-target-rest"
                      label="rest s"
                      value={draft.rest}
                      onChangeText={(text) => setDraft((d) => (d ? { ...d, rest: text } : d))}
                      items={restItems()}
                      unit="s"
                      placeholder="90"
                      width={80}
                    />
                  </View>
                  {draftError ? (
                    <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>
                      {draftError}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <Button
                      title="Save targets"
                      variant="secondary"
                      onPress={() => void handleSaveTargets(re.id)}
                      busy={savingTargets}
                    />
                    <Button
                      title="Cancel"
                      variant="secondary"
                      onPress={() => {
                        setExpandedId(null);
                        setDraft(null);
                        setDraftError(null);
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </View>
            </SwipeableRow>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            message="No exercises in this plan yet."
            hint="Add exercises, then set target sets, reps and weight for each."
          />
        }
      />
      {/* RPE explainer — the RPE target field's label opens it. */}
      <RpeSheet visible={rpeSheetVisible} onClose={() => setRpeSheetVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  itemCard: {
    borderWidth: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
