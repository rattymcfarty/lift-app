/**
 * Your profile — the persona the plan generator reads, editable any time.
 *
 * The owner asked to review/update their bio at any time *and see what each answer
 * changes*. So every question here is a row of choices with, underneath, the exact
 * consequence read from the generator's own tables (`src/lib/personaImpact.ts`):
 * sets/reps/rest, the load factor, the split names, the exercise cap, what
 * equipment excludes and which movements a limitation removes. Changing a chip
 * updates the explanation immediately, before anything is saved.
 *
 * "Save & rebuild my plans" replaces only the generated set (`My Plan · …`) via the
 * same `buildPlansFromProfile` path onboarding uses — plans the user made or
 * duplicated are never touched.
 *
 * Local-only: this screen reads and writes AsyncStorage through `getProfile` /
 * `saveProfile`; nothing leaves the phone.
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { Button, Card, ScreenHeader } from '../src/components/workout/ui';
import { ChoiceChip } from '../src/components/ui/ChoiceChip';
import { useTabBarSpace } from '../src/components/nav/TabBar';
import { getProfile, saveProfile, type Profile, type EquipmentAccess, type Experience, type Goal, type Limitation } from '../src/data/profile';
import { buildPlansFromProfile, GENERATED_PREFIX } from '../src/data/generatedPlan';
import {
  EQUIPMENT_ANSWER,
  EXPERIENCE_ANSWER,
  GOAL_ANSWER,
  LIMITATION_ANSWER,
  personaImpact,
} from '../src/lib/personaImpact';

const GOALS: Goal[] = ['longevity', 'strength', 'muscle', 'fitness'];
const EXPERIENCES: Experience[] = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT: EquipmentAccess[] = ['full', 'dumbbells', 'bodyweight'];
const LIMITATIONS: Limitation[] = ['knees', 'lowerBack', 'shoulders'];
const DAYS: Array<2 | 3 | 4 | 5> = [2, 3, 4, 5];
const MINUTES: Array<30 | 45 | 60 | 75> = [30, 45, 60, 75];

export default function PersonaScreen(): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;
  const tabBarSpace = useTabBarSpace();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getProfile().then(setProfile);
  }, []);

  const update = useCallback(<K extends keyof Profile>(key: K, value: Profile[K]): void => {
    setMessage(null);
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }, []);

  const toggleLimitation = (l: Limitation): void => {
    setMessage(null);
    setProfile((p) =>
      p
        ? {
            ...p,
            limitations: p.limitations.includes(l)
              ? p.limitations.filter((x) => x !== l)
              : [...p.limitations, l],
          }
        : p,
    );
  };

  const save = async (rebuild: boolean): Promise<void> => {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveProfile(profile);
      setProfile(saved);
      if (rebuild) {
        const out = await buildPlansFromProfile(saved, { replaceExisting: true });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setMessage(
          `Rebuilt ${out.planIds.length} ${out.planIds.length === 1 ? 'plan' : 'plans'} from this profile. Find them in Programs → Library.`,
        );
      } else {
        setMessage('Saved. Rebuild your plans when you want them to follow the changes.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
        <ScreenHeader title="Your profile" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.muted} />
        </View>
      </SafeAreaView>
    );
  }

  const impacts = personaImpact({
    experience: profile.experience,
    goal: profile.goal,
    daysPerWeek: profile.daysPerWeek,
    minutes: profile.minutes,
    equipment: profile.equipment,
    limitations: profile.limitations,
    weightKg: profile.weightKg,
  });

  const Question = ({
    id,
    label,
    children,
  }: {
    id: string;
    label: string;
    children: JSX.Element;
  }): JSX.Element => {
    const impact = impacts.find((i) => i.key === id);
    return (
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm }}>
            <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {label}
            </Text>
            <Text style={{ color: c.accent, fontSize: t.size.meta, fontWeight: t.weight.semibold }} numberOfLines={1}>
              {impact?.answer}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>{children}</View>
          {impact ? (
            <Text style={{ color: c.muted, fontSize: t.size.meta }} testID={`persona-changes-${id}`}>
              {impact.changes}
            </Text>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScreenHeader
        title="Your profile"
        subtitle="What each answer changes"
        onBack={() => router.back()}
        compact
      />
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.md,
          paddingBottom: theme.spacing.xl + tabBarSpace,
          gap: theme.spacing.md,
        }}
      >
        <Text style={{ color: c.muted, fontSize: t.size.meta }}>
          Everything here stays on this phone. Change an answer and the explanation underneath
          updates before you save, so you can see the effect first.
        </Text>

        <Question id="goal" label="Goal">
          <>
            {GOALS.map((g) => (
              <ChoiceChip
                key={g}
                label={GOAL_ANSWER[g]}
                selected={profile.goal === g}
                onPress={() => update('goal', g)}
                testID={`persona-goal-${g}`}
              />
            ))}
          </>
        </Question>

        <Question id="experience" label="Experience">
          <>
            {EXPERIENCES.map((e) => (
              <ChoiceChip
                key={e}
                label={EXPERIENCE_ANSWER[e]}
                selected={profile.experience === e}
                onPress={() => update('experience', e)}
                testID={`persona-experience-${e}`}
              />
            ))}
          </>
        </Question>

        <Question id="daysPerWeek" label="Days per week">
          <>
            {DAYS.map((d) => (
              <ChoiceChip
                key={d}
                label={`${d} days`}
                selected={profile.daysPerWeek === d}
                onPress={() => update('daysPerWeek', d)}
                testID={`persona-days-${d}`}
              />
            ))}
          </>
        </Question>

        <Question id="minutes" label="Session length">
          <>
            {MINUTES.map((m) => (
              <ChoiceChip
                key={m}
                label={`${m} min`}
                selected={profile.minutes === m}
                onPress={() => update('minutes', m)}
                testID={`persona-minutes-${m}`}
              />
            ))}
          </>
        </Question>

        <Question id="equipment" label="Equipment">
          <>
            {EQUIPMENT.map((e) => (
              <ChoiceChip
                key={e}
                label={EQUIPMENT_ANSWER[e]}
                selected={profile.equipment === e}
                onPress={() => update('equipment', e)}
                testID={`persona-equipment-${e}`}
              />
            ))}
          </>
        </Question>

        <Question id="limitations" label="Protect a joint (optional)">
          <>
            {LIMITATIONS.map((l) => (
              <ChoiceChip
                key={l}
                label={LIMITATION_ANSWER[l]}
                selected={profile.limitations.includes(l)}
                onPress={() => toggleLimitation(l)}
                role="checkbox"
                testID={`persona-limitation-${l}`}
              />
            ))}
          </>
        </Question>

        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Not set here
            </Text>
            <Text style={{ color: c.muted, fontSize: t.size.meta }}>
              Bodyweight (used only for estimated starting loads) lives in Body weight
              {profile.weightKg ? ` — currently ${profile.weightKg} kg` : ' — not set yet'}. The PAR-Q+
              safety check is part of onboarding and blocks the plans that need it.
            </Text>
            <Button
              title="Body weight"
              variant="secondary"
              testID="persona-body-weight"
              onPress={() => router.push('/measure' as Href)}
            />
          </View>
        </Card>

        {message ? (
          <Text testID="persona-message" style={{ color: c.success, fontSize: t.size.body }}>
            {message}
          </Text>
        ) : null}
        {error ? (
          <Text testID="persona-error" style={{ color: c.danger, fontSize: t.size.body }}>
            {error}
          </Text>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            title={busy ? 'Working…' : 'Save & rebuild my plans'}
            testID="persona-rebuild"
            disabled={busy}
            onPress={() => void save(true)}
          />
          <Button
            title="Save without rebuilding"
            variant="secondary"
            testID="persona-save"
            disabled={busy}
            onPress={() => void save(false)}
          />
          <Text style={{ color: c.muted, fontSize: t.size.caption, textAlign: 'center' }}>
            Rebuilding replaces plans named “{GENERATED_PREFIX}…” only. Plans you made or
            duplicated yourself are never touched.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

