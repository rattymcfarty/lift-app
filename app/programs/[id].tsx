/**
 * Program editor — build or edit a multi-week program.
 *
 *   ← back                                           [Finish]
 *   Program name ✎
 *   [Repeating Weeks ▾] [12 Weeks ▾]
 *   ┌ Day 1 · Genesis ✎                              ⋯ ┐
 *   │ #  EXERCISE                         SETS   REPS  │
 *   │ 1  Bicep Curl (Dumbbell)             4      7    │
 *   │ ⊕ Add Exercise                                   │
 *   └──────────────────────────────────────────────────┘
 *   ⊕ Add day
 *
 * Every change is saved immediately (there is no unsaved state to lose);
 * "Finish" simply returns to the library. Swipe an exercise row left to
 * remove it, right to add another.
 */
import { useCallback, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState } from '../../src/components/workout/ui';
import { OptionSheet } from '../../src/components/ui/OptionSheet';
import { TextPromptModal } from '../../src/components/ui/TextPromptModal';
import { SwipeableRow } from '../../src/components/ui/SwipeableRow';
import { getRoutine, type RoutineDetail } from '../../src/data/repositories';
import { removeRoutineExercise, updateRoutine, updateRoutineExercise } from '../../src/data/routines';
import { displayName } from '../../src/kb/taxonomy';
import { getParqGateStatus } from '../../src/programs/safety';
import { ProgramError } from '../../src/programs/compile';
import {
  addDay,
  copyWeek,
  deleteUserProgram,
  setDeloadWeek,
  duplicateDay,
  detailsOf,
  getUserProgram,
  moveDay,
  removeDay,
  renameUserProgram,
  setSchedule,
  setWeeks,
  startUserProgram,
} from '../../src/programs/userPrograms';
import {
  MAX_DAYS_PER_WEEK,
  WEEK_CHOICES,
  daysPerWeekOf,
  equipmentFilterFor,
  programIssues,
  type ProgramSchedule,
  type UserProgram,
} from '../../src/programs/userProgramDef';

type DayMenu = { weekIdx: number; dayIdx: number } | null;

/** Compact numeric target pill (sets / reps). Commits when editing ends. */
function TargetPill({
  value,
  onCommit,
  numeric,
  testID,
  width,
}: {
  value: string;
  onCommit: (v: string) => void;
  numeric?: boolean;
  testID?: string;
  width: number;
}): JSX.Element {
  const { theme } = useTheme();
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      testID={testID}
      value={focused ? text : value}
      onFocus={() => {
        setText(value);
        setFocused(true);
      }}
      onChangeText={setText}
      onEndEditing={() => {
        setFocused(false);
        if (text.trim() !== value) onCommit(text.trim());
      }}
      keyboardType={numeric ? 'number-pad' : 'numbers-and-punctuation'}
      returnKeyType="done"
      selectTextOnFocus
      textAlign="center"
      maxFontSizeMultiplier={1.1}
      placeholder="–"
      placeholderTextColor={theme.colors.faint}
      style={{
        width,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 10,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? theme.colors.highlight : theme.colors.border,
        backgroundColor: theme.colors.surfaceMuted,
        color: theme.colors.text,
        fontSize: theme.typography.size.body,
        fontWeight: theme.typography.weight.semibold,
        fontVariant: ['tabular-nums'],
      }}
    />
  );
}

export default function ProgramEditorScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const scale = Math.min(1.1, Math.max(0.84, width / 390));
  const params = useLocalSearchParams<{ id: string }>();
  const programId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [program, setProgram] = useState<UserProgram | null>(null);
  const [details, setDetails] = useState<Record<string, RoutineDetail | null>>({});
  const [week, setWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [renamingProgram, setRenamingProgram] = useState(false);
  const [renamingDay, setRenamingDay] = useState<DayMenu>(null);
  const [dayMenu, setDayMenu] = useState<DayMenu>(null);
  const [scheduleSheet, setScheduleSheet] = useState(false);
  const [weeksSheet, setWeeksSheet] = useState(false);
  const [deloadSheet, setDeloadSheet] = useState(false);
  const [copySheet, setCopySheet] = useState(false);

  const load = useCallback(async () => {
    if (!programId) return;
    const p = await getUserProgram(programId);
    setProgram(p);
    if (p) {
      const ids = p.weekDays.flat();
      const entries = await Promise.all(ids.map(async (rid) => [rid, await getRoutine(rid)] as const));
      setDetails(Object.fromEntries(entries));
      setWeek((w) => Math.min(w, Math.max(0, p.weekDays.length - 1)));
    }
    setLoading(false);
  }, [programId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (fn: () => Promise<UserProgram | void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await fn();
      if (next) setProgram(next);
      await load();
    } catch (e) {
      Alert.alert('Could not do that', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.muted} />
      </SafeAreaView>
    );
  }
  if (!program) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <EmptyState
          message="Program not found."
          action={<Button title="Back" variant="secondary" onPress={() => router.back()} />}
        />
      </SafeAreaView>
    );
  }

  const weekIdx = program.schedule === 'repeating' ? 0 : Math.min(week, program.weekDays.length - 1);
  const days = program.weekDays[weekIdx] ?? [];
  const issues = programIssues(program);
  const titleSize = Math.round(t.size.screen * Math.min(1.05, Math.max(0.86, scale)) * 2) / 2;
  const pillW = Math.round(54 * scale);
  const repsW = Math.round(68 * scale);

  const equip = equipmentFilterFor(detailsOf(program).equipment);
  const openAdd = (rid: string): void =>
    router.push(`/plans/${rid}/add-exercise${equip.length ? `?equip=${encodeURIComponent(equip.join(','))}` : ''}` as Href);

  const startProgram = async (): Promise<void> => {
    if (issues.length > 0) {
      Alert.alert('Not ready yet', issues[0]);
      return;
    }
    try {
      const gate = await getParqGateStatus();
      if (!gate.open) {
        router.push('/programs/parq');
        return;
      }
      await startUserProgram(program);
      Alert.alert('Program started', 'Your next session is waiting on the Train tab.', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (e) {
      Alert.alert('Could not start program', e instanceof ProgramError || e instanceof Error ? e.message : 'Try again.');
    }
  };

  const confirmDeleteProgram = (): void => {
    Alert.alert('Delete program?', `"${program.name}" and its days will be removed. Logged workouts are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteUserProgram(program.id)
            .then(() => router.back())
            .catch((e: unknown) => Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.'));
        },
      },
    ]);
  };

  const dayName = (rid: string): string => details[rid]?.routine.name ?? 'Workout';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      {/* top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} testID="header-back">
          <Text style={{ color: c.text, fontSize: t.size.icon }}>←</Text>
        </Pressable>
        <Pressable
          testID="program-finish"
          onPress={() => router.back()}
          accessibilityRole="button"
          style={{ backgroundColor: c.accent, borderRadius: theme.radius.md, paddingVertical: 8, paddingHorizontal: theme.spacing.md }}
        >
          <Text style={{ color: c.accentText, fontSize: t.size.body, fontWeight: t.weight.bold }} maxFontSizeMultiplier={1.1}>
            Finish
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.xl * 2, gap: theme.spacing.md }} keyboardShouldPersistTaps="handled">
        {/* title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Text
            testID="program-title"
            style={{ color: c.text, fontSize: titleSize, fontWeight: t.weight.bold, flexShrink: 1 }}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {program.name}
          </Text>
          <Pressable
            testID="program-rename"
            onPress={() => router.push(`/programs/${program.id}/details` as Href)}
            accessibilityRole="button"
            accessibilityLabel="Edit program details"
            hitSlop={10}
          >
            <Text style={{ color: c.muted, fontSize: t.size.icon }}>✎</Text>
          </Pressable>
        </View>

        {(() => {
          const d = detailsOf(program);
          const bits = [d.focus.join(', '), d.equipment, d.difficulty.join(', '), `${d.minutesPerWorkout} min`].filter(Boolean);
          return (
            <View style={{ gap: 2 }}>
              {d.tagline ? <Text style={{ color: c.text, fontSize: t.size.body }}>{d.tagline}</Text> : null}
              <Text style={{ color: c.faint, fontSize: t.size.meta }} numberOfLines={2}>
                {bits.join(' · ')}
              </Text>
            </View>
          );
        })()}

        {/* schedule + duration */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {(
            [
              ['program-schedule', program.schedule === 'repeating' ? 'Repeating Weeks' : 'Different Weeks', () => setScheduleSheet(true)],
              ['program-weeks', `${program.weeks} Week${program.weeks === 1 ? '' : 's'}`, () => setWeeksSheet(true)],
              ['program-deload', program.deloadWeek != null ? `Deload wk ${program.deloadWeek}` : 'No deload', () => setDeloadSheet(true)],
            ] as const
          ).map(([id, label, onPress]) => (
            <Pressable
              key={id}
              testID={id}
              onPress={onPress}
              accessibilityRole="button"
              style={{
                flexShrink: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.xs,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: theme.radius.pill,
                paddingVertical: theme.spacing.sm + 2,
                paddingHorizontal: theme.spacing.md,
              }}
            >
              <Text style={{ color: c.text, fontSize: t.size.body, fontWeight: t.weight.semibold, flexShrink: 1 }} numberOfLines={1}>
                {label}
              </Text>
              <Text style={{ color: c.muted, fontSize: t.size.meta }}>⌄</Text>
            </Pressable>
          ))}
        </View>

        {/* week selector (different-weeks mode) */}
        {program.schedule === 'custom' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
            {program.weekDays.map((_, i) => {
              const on = i === weekIdx;
              return (
                <Pressable
                  key={i}
                  testID={`program-week-${i + 1}`}
                  onPress={() => setWeek(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.pill,
                    borderWidth: 1,
                    borderColor: on ? c.accent : c.border,
                    backgroundColor: on ? c.surfaceMuted : 'transparent',
                  }}
                >
                  <Text style={{ color: on ? c.text : c.muted, fontSize: t.size.meta + 1, fontWeight: on ? t.weight.bold : t.weight.regular }}>
                    Week {i + 1}{program.deloadWeek === i + 1 ? ' ↓' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {program.schedule === 'custom' && program.weekDays.length > 1 ? (
          <Pressable
            testID="program-copy-week"
            onPress={() => setCopySheet(true)}
            accessibilityRole="button"
            style={{ alignSelf: 'flex-start' }}
          >
            <Text style={{ color: c.accent, fontSize: t.size.body, fontWeight: t.weight.semibold }}>
              Copy week {weekIdx + 1} to…
            </Text>
          </Pressable>
        ) : null}

        {/* days */}
        {days.map((rid, dayIdx) => {
          const d = details[rid];
          const items = d?.items ?? [];
          return (
            <Card key={rid}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Text
                  testID={`day-title-${dayIdx + 1}`}
                  style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold, flexShrink: 1 }}
                  numberOfLines={1}
                >
                  Day {dayIdx + 1} · {dayName(rid)}
                </Text>
                <Pressable
                  testID={`day-rename-${dayIdx + 1}`}
                  onPress={() => setRenamingDay({ weekIdx, dayIdx })}
                  accessibilityRole="button"
                  accessibilityLabel="Rename day"
                  hitSlop={10}
                >
                  <Text style={{ color: c.muted, fontSize: t.size.row }}>✎</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable
                  testID={`day-menu-${dayIdx + 1}`}
                  onPress={() => setDayMenu({ weekIdx, dayIdx })}
                  accessibilityRole="button"
                  accessibilityLabel="Day options"
                  hitSlop={10}
                >
                  <Text style={{ color: c.muted, fontSize: t.size.card }}>⋯</Text>
                </Pressable>
              </View>

              {/* table header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: theme.spacing.xs }}>
                <Text style={{ width: 28, color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>#</Text>
                <Text style={{ flex: 1, color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>EXERCISE</Text>
                <Text style={{ width: pillW, textAlign: 'center', color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>SETS</Text>
                <Text style={{ width: repsW, textAlign: 'center', color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>REPS</Text>
              </View>

              {items.map((it, i) => (
                <SwipeableRow
                  key={it.routineExercise.id}
                  backgroundColor={c.surface}
                  rightLabel="+ Add exercise"
                  onSwipeRight={() => openAdd(rid)}
                  onDelete={async () => {
                    await removeRoutineExercise(it.routineExercise.id);
                    await load();
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ width: 28, color: c.highlight, fontSize: t.size.row, fontWeight: t.weight.bold }}>{i + 1}</Text>
                    <Text style={{ flex: 1, color: c.text, fontSize: t.size.row, fontWeight: t.weight.medium, paddingRight: theme.spacing.sm }} numberOfLines={1}>
                      {displayName(it.exercise)}
                    </Text>
                    <TargetPill
                      testID={`day-${dayIdx + 1}-sets-${i + 1}`}
                      numeric
                      width={pillW}
                      value={it.routineExercise.targetSets != null ? String(it.routineExercise.targetSets) : ''}
                      onCommit={(v) => {
                        const n = parseInt(v, 10);
                        void updateRoutineExercise(it.routineExercise.id, { targetSets: Number.isFinite(n) && n >= 0 ? n : undefined })
                          .then(() => load())
                          .catch(() => undefined);
                      }}
                    />
                    <View style={{ width: theme.spacing.xs }} />
                    <TargetPill
                      testID={`day-${dayIdx + 1}-reps-${i + 1}`}
                      width={repsW}
                      value={it.routineExercise.targetReps ?? ''}
                      onCommit={(v) => {
                        void updateRoutineExercise(it.routineExercise.id, { targetReps: v === '' ? null : v })
                          .then(() => load())
                          .catch(() => undefined);
                      }}
                    />
                  </View>
                </SwipeableRow>
              ))}

              <Pressable
                testID={`day-add-exercise-${dayIdx + 1}`}
                onPress={() => openAdd(rid)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: c.muted, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: c.muted, fontSize: t.size.row, lineHeight: t.size.row + 2, fontWeight: t.weight.bold }}>+</Text>
                </View>
                <Text style={{ color: c.text, fontSize: t.size.row, fontWeight: t.weight.medium }}>Add Exercise</Text>
              </Pressable>
            </Card>
          );
        })}

        {days.length < MAX_DAYS_PER_WEEK ? (
          <Button
            title="+ Add day"
            variant="secondary"
            testID="program-add-day"
            onPress={() => void run(() => addDay(program, weekIdx))}
          />
        ) : null}

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <Text style={{ color: c.faint, fontSize: t.size.caption }}>
            {daysPerWeekOf(program)} day{daysPerWeekOf(program) === 1 ? '' : 's'} a week · {program.weeks} week
            {program.weeks === 1 ? '' : 's'}. Changes save automatically.
          </Text>
          {issues.length > 0 ? <Text style={{ color: c.warning, fontSize: t.size.meta }}>{issues[0]}</Text> : null}
          <Button title="Start this program" size="large" testID="program-start" onPress={() => void startProgram()} />
          <Button title="Delete program" variant="danger" testID="program-delete" onPress={confirmDeleteProgram} />
        </View>
      </ScrollView>

      {/* sheets & prompts */}
      <OptionSheet<ProgramSchedule>
        visible={scheduleSheet}
        title="Schedule"
        testID="schedule-sheet"
        selected={program.schedule}
        options={[
          { value: 'repeating', label: 'Repeating weeks', hint: 'One week, repeated for the whole program' },
          { value: 'custom', label: 'Different weeks', hint: 'Plan every week separately' },
        ]}
        onClose={() => setScheduleSheet(false)}
        onSelect={(v) => {
          if (v === program.schedule) return;
          if (v === 'repeating' && program.weeks > 1) {
            Alert.alert('Use one repeating week?', 'Week 1 is kept and repeated. The other weeks are removed.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Switch', style: 'destructive', onPress: () => void run(() => setSchedule(program, v)) },
            ]);
          } else {
            void run(() => setSchedule(program, v));
          }
        }}
      />
      <OptionSheet<number>
        visible={weeksSheet}
        title="Duration"
        testID="weeks-sheet"
        selected={program.weeks}
        options={Array.from(new Set([...WEEK_CHOICES, program.weeks]))
          .sort((a, b) => a - b)
          .map((w) => ({ value: w, label: `${w} week${w === 1 ? '' : 's'}` }))}
        onClose={() => setWeeksSheet(false)}
        onSelect={(w) => {
          if (w === program.weeks) return;
          if (program.schedule === 'custom' && w < program.weeks) {
            Alert.alert('Shorten program?', `Weeks ${w + 1}–${program.weeks} will be removed.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Shorten', style: 'destructive', onPress: () => void run(() => setWeeks(program, w)) },
            ]);
          } else {
            void run(() => setWeeks(program, w));
          }
        }}
      />
      <OptionSheet<number>
        visible={deloadSheet}
        title="Deload week (half volume)"
        testID="deload-sheet"
        selected={program.deloadWeek ?? 0}
        options={[
          { value: 0, label: 'No deload' },
          ...Array.from({ length: program.weeks }, (_, i) => ({
            value: i + 1,
            label: `Week ${i + 1}`,
            hint: i + 1 === program.weeks ? 'Final week' : undefined,
          })),
        ]}
        onClose={() => setDeloadSheet(false)}
        onSelect={(w) => void run(() => setDeloadWeek(program, w === 0 ? null : w))}
      />
      <OptionSheet<number>
        visible={copySheet}
        title={`Copy week ${weekIdx + 1} to`}
        testID="copy-week-sheet"
        options={[
          { value: -1, label: 'All other weeks', destructive: true, hint: 'Replaces their days' },
          ...program.weekDays.map((_, i) => ({ value: i, label: `Week ${i + 1}`, disabled: i === weekIdx })),
        ]}
        onClose={() => setCopySheet(false)}
        onSelect={(to) => {
          const targets = to === -1 ? program.weekDays.map((_, i) => i).filter((i) => i !== weekIdx) : [to];
          Alert.alert('Replace week?', `${targets.length === 1 ? `Week ${targets[0] + 1}` : 'All other weeks'} will be replaced with a copy of week ${weekIdx + 1}.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Copy', style: 'destructive', onPress: () => void run(() => copyWeek(program, weekIdx, targets)) },
          ]);
        }}
      />
      <OptionSheet<string>
        visible={dayMenu != null}
        title={dayMenu ? `Day ${dayMenu.dayIdx + 1}` : undefined}
        testID="day-sheet"
        options={[
          { value: 'rename', label: 'Rename day' },
          { value: 'duplicate', label: 'Duplicate day', disabled: days.length >= MAX_DAYS_PER_WEEK },
          { value: 'up', label: 'Move up', disabled: !dayMenu || dayMenu.dayIdx === 0 },
          { value: 'down', label: 'Move down', disabled: !dayMenu || dayMenu.dayIdx >= days.length - 1 },
          { value: 'delete', label: 'Delete day', destructive: true, disabled: days.length <= 1 },
        ]}
        onClose={() => setDayMenu(null)}
        onSelect={(v) => {
          const m = dayMenu;
          if (!m) return;
          if (v === 'rename') setRenamingDay(m);
          else if (v === 'duplicate') void run(() => duplicateDay(program, m.weekIdx, m.dayIdx));
          else if (v === 'up') void run(() => moveDay(program, m.weekIdx, m.dayIdx, -1));
          else if (v === 'down') void run(() => moveDay(program, m.weekIdx, m.dayIdx, 1));
          else if (v === 'delete') {
            Alert.alert('Delete day?', `Day ${m.dayIdx + 1} and its exercises will be removed from this program.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => void run(() => removeDay(program, m.weekIdx, m.dayIdx)) },
            ]);
          }
        }}
      />
      <TextPromptModal
        visible={renamingProgram}
        title="Program name"
        testID="program-name-input"
        initial={program.name}
        onClose={() => setRenamingProgram(false)}
        onSubmit={(v) => void run(() => renameUserProgram(program, v))}
      />
      <TextPromptModal
        visible={renamingDay != null}
        title="Day name"
        testID="day-name-input"
        initial={renamingDay ? dayName(program.weekDays[renamingDay.weekIdx]?.[renamingDay.dayIdx] ?? '') : ''}
        onClose={() => setRenamingDay(null)}
        onSubmit={(v) => {
          const m = renamingDay;
          const rid = m ? program.weekDays[m.weekIdx]?.[m.dayIdx] : undefined;
          if (rid) void run(async () => { await updateRoutine(rid, { name: v }); });
        }}
      />
    </SafeAreaView>
  );
}
