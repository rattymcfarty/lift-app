/**
 * Program Details — page 2: time per workout, focus, equipment, difficulty.
 * These are not decoration: equipment pre-filters the exercise picker for
 * the program's days, and time-per-workout sets each day's estimated length.
 */
import { useCallback, useState, type JSX } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useTheme } from '../../../src/theme';
import { ChipGroup, Section, WizardPage } from '../../../src/components/programs/ProgramFormBits';
import { OptionSheet } from '../../../src/components/ui/OptionSheet';
import { detailsOf, getUserProgram, updateProgramDetails } from '../../../src/programs/userPrograms';
import {
  DIFFICULTY_OPTIONS,
  EQUIPMENT_OPTIONS,
  FOCUS_OPTIONS,
  MINUTES_CHOICES,
  type ProgramDetails,
  type UserProgram,
} from '../../../src/programs/userProgramDef';

export default function ProgramSetupPage(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const params = useLocalSearchParams<{ id: string; flow?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const creating = params.flow === 'create';

  const [program, setProgram] = useState<UserProgram | null>(null);
  const [d, setD] = useState<ProgramDetails | null>(null);
  const [minutesSheet, setMinutesSheet] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getUserProgram(id).then((p) => {
        if (!p) return;
        setProgram(p);
        setD((cur) => cur ?? detailsOf(p));
      });
    }, [id]),
  );

  if (!program || !d) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.muted} />
      </View>
    );
  }

  const update = (patch: Partial<ProgramDetails>): void => {
    setD({ ...d, ...patch });
    void updateProgramDetails(program, patch).then(setProgram);
  };

  return (
    <WizardPage
      title="Program Details"
      progress={creating ? 'Step 2 of 3' : undefined}
      nextTestID="setup-next"
      nextLabel={creating ? 'Next' : 'Save'}
      onNext={() => {
        if (creating) {
          // Clear the wizard pages and land on the builder (weeks + days).
          try {
            router.dismissAll();
          } catch {
            // no stack to dismiss
          }
          router.push(`/programs/${program.id}` as Href);
        } else {
          try {
            router.dismiss(2);
          } catch {
            router.replace(`/programs/${program.id}` as Href);
          }
        }
      }}
    >
      <Section label="Time per Workout">
        <Pressable
          testID="setup-minutes"
          onPress={() => setMinutesSheet(true)}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: theme.radius.md,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            backgroundColor: c.surface,
          }}
        >
          <Text style={{ flex: 1, color: c.text, fontSize: t.size.row + 1 }}>{d.minutesPerWorkout} mins</Text>
          <Text style={{ color: c.muted, fontSize: t.size.body }}>⌄</Text>
        </Pressable>
      </Section>

      <Section label="Focus" hint="Select Multiple">
        <ChipGroup options={FOCUS_OPTIONS} selected={d.focus} multiple onChange={(focus) => update({ focus })} testIDPrefix="focus" />
      </Section>

      <Section label="Equipment" hint="Select One">
        <ChipGroup
          options={EQUIPMENT_OPTIONS}
          selected={d.equipment}
          onChange={(v) => update({ equipment: v[0] })}
          testIDPrefix="equipment"
        />
        <Text style={{ color: c.faint, fontSize: t.size.meta }}>
          Used to narrow the exercise list while you build this program&apos;s days.
        </Text>
      </Section>

      <Section label="Difficulty" hint="Select Multiple">
        <ChipGroup
          options={DIFFICULTY_OPTIONS}
          selected={d.difficulty}
          multiple
          onChange={(difficulty) => update({ difficulty })}
          testIDPrefix="difficulty"
        />
      </Section>

      <OptionSheet<number>
        visible={minutesSheet}
        title="Time per workout"
        testID="minutes-sheet"
        selected={d.minutesPerWorkout}
        options={MINUTES_CHOICES.map((m) => ({ value: m, label: `${m} mins` }))}
        onClose={() => setMinutesSheet(false)}
        onSelect={(m) => update({ minutesPerWorkout: m })}
      />
    </WizardPage>
  );
}
