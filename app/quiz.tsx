/**
 * Set up my plans — the guided interview.
 *
 * Six questions, one per screen, each with the reason it is asked. Then a review
 * screen showing the exact plan set the generator would build (day by day, with
 * sets, reps, rest and estimated loads) *before* anything is written. "Build my
 * program" saves the profile and writes the plans through the same
 * `buildPlansFromProfile` path onboarding and the persona editor use, replacing
 * only `My Plan · …`.
 *
 * Local-first and offline, by design: the interview is deterministic, the plan is
 * produced by the existing rule-based generator on the device, and the review is
 * read from `previewPlans` — the same input the writer uses. No network, no model.
 */
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { withAlpha } from '../src/theme/color';
import { Button, Card, ScreenHeader } from '../src/components/workout/ui';
import { ChoiceChip } from '../src/components/ui/ChoiceChip';
import { useTabBarSpace } from '../src/components/nav/TabBar';
import {
  getProfile,
  saveProfile,
  type EquipmentAccess,
  type Experience,
  type Goal,
  type Limitation,
  type Profile,
} from '../src/data/profile';
import { buildPlansFromProfile, previewPlans, type PreviewDay } from '../src/data/generatedPlan';
import { getSettings } from '../src/data/settings';
import { formatWeight } from '../src/lib/units';
import {
  EQUIPMENT_ANSWER,
  EXPERIENCE_ANSWER,
  GOAL_ANSWER,
  LIMITATION_ANSWER,
  personaImpact,
} from '../src/lib/personaImpact';
import { QUIZ_STEPS, personaSummary } from '../src/lib/quiz';

const GOALS: Goal[] = ['longevity', 'strength', 'muscle', 'fitness'];
const EXPERIENCES: Experience[] = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT: EquipmentAccess[] = ['full', 'dumbbells', 'bodyweight'];
const LIMITATIONS: Limitation[] = ['knees', 'lowerBack', 'shoulders'];
const DAYS: Array<2 | 3 | 4 | 5> = [2, 3, 4, 5];
const MINUTES: Array<30 | 45 | 60 | 75> = [30, 45, 60, 75];

const REVIEW = QUIZ_STEPS.length;

export default function QuizScreen(): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;
  const tabBarSpace = useTabBarSpace();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getProfile(), getSettings()]).then(([p, s]) => {
      setProfile(p);
      setUnit(s.weightUnit);
    });
  }, []);

  const update = useCallback(<K extends keyof Profile>(key: K, value: Profile[K]): void => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }, []);

  const toggleLimitation = (l: Limitation): void => {
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

  // The review is the generator's own output, computed when it is shown.
  const preview: PreviewDay[] = useMemo(() => (profile && step === REVIEW ? previewPlans(profile) : []), [profile, step]);

  const changes = useMemo(
    () =>
      profile
        ? personaImpact({
            experience: profile.experience,
            goal: profile.goal,
            daysPerWeek: profile.daysPerWeek,
            minutes: profile.minutes,
            equipment: profile.equipment,
            limitations: profile.limitations,
            weightKg: profile.weightKg,
          })
        : [],
    [profile],
  );

  if (!profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
        <ScreenHeader title="Set up my plans" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.muted} />
        </View>
      </SafeAreaView>
    );
  }

  const onReview = step === REVIEW;
  const current = QUIZ_STEPS[Math.min(step, REVIEW - 1)];
  const stepChanges = changes.find((i) => i.key === current?.key);

  const back = (): void => {
    if (step > 0) setStep((s) => s - 1);
    else router.back();
  };

  const build = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const saved = await saveProfile(profile);
      const out = await buildPlansFromProfile(saved, { replaceExisting: true });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setBuilt(out.planIds.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the program. Try again.');
    } finally {
      setBusy(false);
    }
  };

  /* ---- the built confirmation -------------------------------------------- */

  if (built !== null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
        <ScreenHeader title="Your plans are ready" onBack={() => router.back()} />
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.md,
            paddingBottom: theme.spacing.xl + tabBarSpace,
            gap: theme.spacing.md,
          }}
        >
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <Text testID="quiz-built" style={{ color: c.text, fontSize: t.size.body, fontWeight: t.weight.semibold }}>
                Built {built} {built === 1 ? 'plan' : 'plans'} from your answers.
              </Text>
              <Text style={{ color: c.muted, fontSize: t.size.meta }}>
                They are in Programs → Library as “My Plan · Day 1…” and are fully editable — swap exercises,
                change sets, weights and rest. Your old generated plans were replaced; plans you made yourself
                were left alone.
              </Text>
            </View>
          </Card>
          <Button title="Open Programs" testID="quiz-open-programs" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---- the review --------------------------------------------------------- */

  if (onReview) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
        <ScreenHeader
          title="Review your plans"
          subtitle="Nothing is saved until you tap Build"
          onBack={back}
          compact
        />
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.md,
            paddingBottom: theme.spacing.xl + tabBarSpace,
            gap: theme.spacing.md,
          }}
        >
          <Card>
            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Your answers
              </Text>
              <Text style={{ color: c.text, fontSize: t.size.body }} testID="quiz-summary">
                {personaSummary(profile)}
              </Text>
            </View>
          </Card>

          {preview.map((day, i) => (
            <Card key={`${day.name}-${i}`}>
              <View style={{ gap: theme.spacing.sm }} testID={`quiz-day-${i + 1}`}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm }}>
                  <Text style={{ color: c.text, fontSize: t.size.row, fontWeight: t.weight.semibold }}>{day.name}</Text>
                  <Text style={{ color: c.muted, fontSize: t.size.caption }}>{day.items.length} exercises</Text>
                </View>
                {day.items.map((item) => (
                  <View key={item.name} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm }}>
                    <Text style={{ flex: 1, color: c.text, fontSize: t.size.meta }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: t.size.meta }}>
                      {item.sets} × {item.reps}
                      {item.weightKg !== undefined ? ` · ${formatWeight(item.weightKg, unit)}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ))}

          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Why these numbers
              </Text>
              {changes.map((line) => (
                <Text key={line.key} style={{ color: c.muted, fontSize: t.size.meta }}>
                  <Text style={{ color: c.text, fontWeight: t.weight.semibold }}>{line.label}: </Text>
                  {line.changes}
                </Text>
              ))}
            </View>
          </Card>

          <Text style={{ color: c.muted, fontSize: t.size.caption }}>
            Estimated loads are a starting point, not a prescription — adjust to feel, keeping two or three reps
            in reserve. Building replaces plans named “My Plan · …” only.
          </Text>

          {error ? (
            <Text testID="quiz-error" style={{ color: c.danger, fontSize: t.size.body }}>
              {error}
            </Text>
          ) : null}

          <Button
            title={busy ? 'Building…' : `Build my ${preview.length} ${preview.length === 1 ? 'plan' : 'plans'}`}
            testID="quiz-build"
            disabled={busy}
            onPress={() => void build()}
          />
          <Button title="Change an answer" variant="secondary" testID="quiz-back" onPress={back} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---- one question ------------------------------------------------------- */

  const question = (
    <>
      {current.key === 'goal'
        ? GOALS.map((g) => (
            <ChoiceChip key={g} label={GOAL_ANSWER[g]} selected={profile.goal === g} onPress={() => update('goal', g)} testID={`quiz-goal-${g}`} />
          ))
        : null}
      {current.key === 'experience'
        ? EXPERIENCES.map((e) => (
            <ChoiceChip key={e} label={EXPERIENCE_ANSWER[e]} selected={profile.experience === e} onPress={() => update('experience', e)} testID={`quiz-experience-${e}`} />
          ))
        : null}
      {current.key === 'daysPerWeek'
        ? DAYS.map((d) => (
            <ChoiceChip key={d} label={`${d} days`} selected={profile.daysPerWeek === d} onPress={() => update('daysPerWeek', d)} testID={`quiz-days-${d}`} />
          ))
        : null}
      {current.key === 'minutes'
        ? MINUTES.map((m) => (
            <ChoiceChip key={m} label={`${m} min`} selected={profile.minutes === m} onPress={() => update('minutes', m)} testID={`quiz-minutes-${m}`} />
          ))
        : null}
      {current.key === 'equipment'
        ? EQUIPMENT.map((e) => (
            <ChoiceChip key={e} label={EQUIPMENT_ANSWER[e]} selected={profile.equipment === e} onPress={() => update('equipment', e)} testID={`quiz-equipment-${e}`} />
          ))
        : null}
      {current.key === 'limitations'
        ? LIMITATIONS.map((l) => (
            <ChoiceChip
              key={l}
              label={LIMITATION_ANSWER[l]}
              selected={profile.limitations.includes(l)}
              onPress={() => toggleLimitation(l)}
              role="checkbox"
              testID={`quiz-limitation-${l}`}
            />
          ))
        : null}
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScreenHeader title="Set up my plans" subtitle={`Step ${step + 1} of ${QUIZ_STEPS.length}`} onBack={back} compact />
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.md,
          paddingBottom: theme.spacing.xl + tabBarSpace,
          gap: theme.spacing.md,
        }}
      >
        {/* Progress, six segments. */}
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="progressbar">
          {QUIZ_STEPS.map((s, i) => (
            <View
              key={s.key}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= step ? c.accent : withAlpha(c.muted, 0.25),
              }}
            />
          ))}
        </View>

        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Text style={{ color: c.text, fontSize: t.size.row + 2, fontWeight: t.weight.bold }} testID={`quiz-question-${current.key}`}>
              {current.question}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>{question}</View>
            <Text style={{ color: c.muted, fontSize: t.size.meta }}>{current.why}</Text>
            {stepChanges ? (
              <Text style={{ color: c.accent, fontSize: t.size.meta }} testID="quiz-impact">
                {stepChanges.changes}
              </Text>
            ) : null}
          </View>
        </Card>

        <Text style={{ color: c.muted, fontSize: t.size.caption }}>
          {step === 0
            ? 'Six quick questions. You will see the whole plan set before anything is saved — one editable plan per training day.'
            : 'You can change any answer on the review screen.'}
        </Text>

        <Button
          title={step === REVIEW - 1 ? 'Review my program' : 'Continue'}
          testID="quiz-continue"
          onPress={() => {
            void Haptics.selectionAsync().catch(() => undefined);
            setStep((s) => Math.min(REVIEW, s + 1));
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
