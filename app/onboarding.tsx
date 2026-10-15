/**
 * Onboarding / profile wizard.
 *
 * First launch: welcome → about you → experience → goal → schedule &
 * equipment → limitations → "Build my plan". The same screen edits the
 * profile later (`?edit=1` skips the welcome). Everything is stored on the
 * device; nothing is sent anywhere.
 *
 * UX rules: one decision group per step, large tappable cards, progress
 * dots, always a way back, nothing required except picking from defaults,
 * and a visible "Skip for now" on the welcome step.
 */
import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { Button } from '../src/components/workout/ui';
import {
  getProfile,
  saveProfile,
  DEFAULT_PROFILE,
  type EquipmentAccess,
  type Experience,
  type Goal,
  type Limitation,
  type Profile,
  type Sex,
} from '../src/data/profile';
import { getSettings, setWeightUnit, type WeightUnit } from '../src/data/settings';
import { buildPlansFromProfile, GOAL_LABEL } from '../src/data/generatedPlan';
import { logMeasurement, getLatestMeasurement } from '../src/data/repositories';
import { kgToLb, lbToKg } from '../src/lib/units';

type StepKey = 'welcome' | 'about' | 'experience' | 'goal' | 'schedule' | 'limits' | 'done';
const ORDER: StepKey[] = ['welcome', 'about', 'experience', 'goal', 'schedule', 'limits', 'done'];

function OptionCard({
  title,
  body,
  selected,
  onPress,
  testID,
}: {
  title: string;
  body?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        backgroundColor: selected ? theme.colors.surfaceMuted : theme.colors.surface,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        borderWidth: selected ? 2 : 1,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        gap: 2,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.semibold }}>{title}</Text>
      {body ? <Text style={{ color: theme.colors.muted, fontSize: t.size.meta + 1 }}>{body}</Text> : null}
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}): JSX.Element {
  const { theme } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        backgroundColor: selected ? theme.colors.surfaceMuted : 'transparent',
        borderRadius: theme.radius.pill,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        minHeight: 40,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: selected ? theme.colors.text : theme.colors.muted,
          fontSize: theme.typography.size.body,
          fontWeight: selected ? theme.typography.weight.semibold : theme.typography.weight.regular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.caption, fontWeight: theme.typography.weight.medium }}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

export default function OnboardingScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';

  const [step, setStep] = useState<StepKey>(editing ? 'about' : 'welcome');
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [yearText, setYearText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builtCount, setBuiltCount] = useState(0);

  // Step transition: fade + slide in.
  const anim = useRef(new Animated.Value(1)).current;
  const go = useCallback(
    (next: StepKey) => {
      anim.setValue(0);
      setStep(next);
      Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    },
    [anim],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, s] = await Promise.all([getProfile(), getSettings()]);
      if (cancelled) return;
      setProfile(p);
      setUnit(s.weightUnit);
      if (p.weightKg) setWeightText(String(s.weightUnit === 'lb' ? Math.round(kgToLb(p.weightKg) * 10) / 10 : p.weightKg));
      if (p.heightCm) setHeightText(String(p.heightCm));
      if (p.birthYear) setYearText(String(p.birthYear));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<Profile>): void => setProfile((prev) => ({ ...prev, ...patch }));
  const toggleLimit = (l: Limitation): void =>
    update({ limitations: profile.limitations.includes(l) ? profile.limitations.filter((x) => x !== l) : [...profile.limitations, l] });

  const num = (s: string): number | null => {
    const v = parseFloat(s.replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  const commitAbout = (): Partial<Profile> => {
    const w = num(weightText);
    const h = num(heightText);
    const y = num(yearText);
    return {
      weightKg: w ? Math.round((unit === 'lb' ? lbToKg(w) : w) * 10) / 10 : null,
      heightCm: h && h > 90 && h < 250 ? Math.round(h) : null,
      birthYear: y && y > 1900 && y <= new Date().getFullYear() ? Math.round(y) : null,
    };
  };

  const skip = async (): Promise<void> => {
    await saveProfile({ onboarded: true });
    router.replace('/');
  };

  const finish = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const merged: Profile = { ...profile, ...commitAbout(), onboarded: true };
      await setWeightUnit(unit);
      const saved = await saveProfile(merged);
      // Keep the Bodyweight tile in step with the weight they just entered.
      if (saved.weightKg) {
        const latest = await getLatestMeasurement('body_weight').catch(() => null);
        if (!latest || Math.abs(latest.value - saved.weightKg) > 0.05) {
          await logMeasurement({ type: 'body_weight', value: saved.weightKg, unit: 'kg' });
        }
      }
      const out = await buildPlansFromProfile(saved, { replaceExisting: true });
      setBuiltCount(out.planIds.length);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      go('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build your plan. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const idx = ORDER.indexOf(step);
  const showProgress = step !== 'welcome' && step !== 'done';
  const next = (): void => {
    if (step === 'about') setProfile((p) => ({ ...p, ...commitAbout() }));
    go(ORDER[Math.min(idx + 1, ORDER.length - 1)]);
  };
  const back = (): void => {
    if (idx <= (editing ? 1 : 0)) {
      router.back();
      return;
    }
    go(ORDER[idx - 1]);
  };

  const input = {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    color: c.text,
    fontSize: t.size.body,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  } as const;

  const title = (text: string, sub?: string): JSX.Element => (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={{ color: c.text, fontSize: t.size.screen, fontWeight: t.weight.bold }} adjustsFontSizeToFit numberOfLines={2} minimumFontScale={0.75}>
        {text}
      </Text>
      {sub ? <Text style={{ color: c.muted, fontSize: t.size.body }}>{sub}</Text> : null}
    </View>
  );

  const body = (): JSX.Element => {
    switch (step) {
      case 'welcome':
        return (
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: c.text, fontSize: t.size.brand, fontWeight: t.weight.bold, letterSpacing: 4 }}>LIFT</Text>
              {title('Train for the long run.', 'Strength, movement and consistency — built around you, for decades, not weeks.')}
            </View>
            {[
              ['Private by design', 'No account. Your training stays on this phone.'],
              ['Built for you', 'Answer a few questions and get a plan that fits your body, level and week.'],
              ['Yours to change', 'Every plan and exercise can be edited, copied or replaced.'],
            ].map(([h, b]) => (
              <View key={h} style={{ gap: 2 }}>
                <Text style={{ color: c.accent, fontSize: t.size.row, fontWeight: t.weight.semibold }}>{h}</Text>
                <Text style={{ color: c.muted, fontSize: t.size.body }}>{b}</Text>
              </View>
            ))}
          </View>
        );
      case 'about':
        return (
          <View style={{ gap: theme.spacing.md }}>
            {title('About you', 'Used only to size your starting weights. All optional.')}
            <Field label="First name">
              <TextInput
                testID="onb-name"
                value={profile.name}
                onChangeText={(v) => update({ name: v })}
                placeholder="Optional"
                placeholderTextColor={c.faint}
                autoCapitalize="words"
                autoCorrect={false}
                style={input}
              />
            </Field>
            <Field label="Weight unit">
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Chip label="kg" selected={unit === 'kg'} onPress={() => setUnit('kg')} />
                <Chip label="lb" selected={unit === 'lb'} onPress={() => setUnit('lb')} />
              </View>
            </Field>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Field label={`Weight (${unit})`}>
                  <TextInput testID="onb-weight" value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" placeholder="e.g. 72" placeholderTextColor={c.faint} style={input} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Height (cm)">
                  <TextInput testID="onb-height" value={heightText} onChangeText={setHeightText} keyboardType="number-pad" placeholder="e.g. 175" placeholderTextColor={c.faint} style={input} />
                </Field>
              </View>
            </View>
            <Field label="Birth year">
              <TextInput testID="onb-year" value={yearText} onChangeText={setYearText} keyboardType="number-pad" maxLength={4} placeholder="e.g. 1985" placeholderTextColor={c.faint} style={input} />
            </Field>
            <Field label="Sex (optional)">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {(['female', 'male', 'other'] as Sex[]).map((s) => (
                  <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} selected={profile.sex === s} onPress={() => update({ sex: profile.sex === s ? null : s })} />
                ))}
              </View>
            </Field>
          </View>
        );
      case 'experience':
        return (
          <View style={{ gap: theme.spacing.md }}>
            {title('How experienced are you?', 'Be honest — starting a little easy is how long streaks begin.')}
            {(
              [
                ['beginner', 'Beginner', 'New to lifting, or coming back after a long break.'],
                ['intermediate', 'Intermediate', 'Training regularly for 6+ months and comfortable with the main lifts.'],
                ['advanced', 'Advanced', 'Years of consistent training; you know how to push and recover.'],
              ] as [Experience, string, string][]
            ).map(([k, h, b]) => (
              <OptionCard key={k} testID={`onb-exp-${k}`} title={h} body={b} selected={profile.experience === k} onPress={() => update({ experience: k })} />
            ))}
          </View>
        );
      case 'goal':
        return (
          <View style={{ gap: theme.spacing.md }}>
            {title('What matters most?', 'This shapes sets, reps and rest — you can change it any time.')}
            {(
              [
                ['longevity', 'Longevity', 'Strong, mobile and resilient for life. Moderate effort, great movement.'],
                ['strength', 'Strength', 'Get stronger on the big lifts with heavier, lower-rep work.'],
                ['muscle', 'Muscle', 'Build size with moderate loads and steady volume.'],
                ['fitness', 'General fitness', 'Feel better and fitter with higher-rep, shorter rests.'],
              ] as [Goal, string, string][]
            ).map(([k, h, b]) => (
              <OptionCard key={k} testID={`onb-goal-${k}`} title={h} body={b} selected={profile.goal === k} onPress={() => update({ goal: k })} />
            ))}
          </View>
        );
      case 'schedule':
        return (
          <View style={{ gap: theme.spacing.md }}>
            {title('Your week', 'Realistic beats ambitious. Two good sessions a week still change your life.')}
            <Field label="Days per week">
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                {([2, 3, 4, 5] as const).map((d) => (
                  <Chip key={d} testID={`onb-days-${d}`} label={String(d)} selected={profile.daysPerWeek === d} onPress={() => update({ daysPerWeek: d })} />
                ))}
              </View>
            </Field>
            <Field label="Time per session (minutes)">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {([30, 45, 60, 75] as const).map((m) => (
                  <Chip key={m} label={String(m)} selected={profile.minutes === m} onPress={() => update({ minutes: m })} />
                ))}
              </View>
            </Field>
            <Field label="Where do you train?">
              <View style={{ gap: theme.spacing.sm }}>
                {(
                  [
                    ['full', 'Full gym', 'Barbells, machines, cables, dumbbells.'],
                    ['dumbbells', 'Dumbbells & kettlebells', 'A home setup with some weights.'],
                    ['bodyweight', 'Bodyweight only', 'No equipment needed.'],
                  ] as [EquipmentAccess, string, string][]
                ).map(([k, h, b]) => (
                  <OptionCard key={k} testID={`onb-equip-${k}`} title={h} body={b} selected={profile.equipment === k} onPress={() => update({ equipment: k })} />
                ))}
              </View>
            </Field>
          </View>
        );
      case 'limits':
        return (
          <View style={{ gap: theme.spacing.md }}>
            {title('Anything to work around?', 'We’ll leave out movements that commonly aggravate these. Pick none, one or several.')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {([['knees', 'Knees'], ['lowerBack', 'Lower back'], ['shoulders', 'Shoulders']] as [Limitation, string][]).map(([k, l]) => (
                <Chip key={k} testID={`onb-limit-${k}`} label={l} selected={profile.limitations.includes(k)} onPress={() => toggleLimit(k)} />
              ))}
            </View>
            <Text style={{ color: c.faint, fontSize: t.size.meta + 1 }}>
              LIFT is general fitness guidance, not medical advice. If you have a health condition or pain, check with a
              clinician — a short readiness screening (PAR-Q+) also appears before you start a program.
            </Text>
            {error ? <Text style={{ color: c.danger, fontSize: t.size.meta + 1 }}>{error}</Text> : null}
          </View>
        );
      case 'done':
        return (
          <View style={{ gap: theme.spacing.md }}>
            {title(`You're set${profile.name ? `, ${profile.name}` : ''}.`, `We built ${builtCount} workouts for ${GOAL_LABEL[profile.goal].toLowerCase()} — ${profile.daysPerWeek} days a week, about ${profile.minutes} minutes each.`)}
            <Text style={{ color: c.muted, fontSize: t.size.body }}>
              Find them under Programs → Library, edit anything, or start today&apos;s session from the Train tab. Start
              lighter than the suggested weights if in doubt — you&apos;re training for decades.
            </Text>
          </View>
        );
    }
  };

  const primary =
    step === 'welcome' ? { label: 'Get started', onPress: next, testID: 'onb-next' }
    : step === 'limits' ? { label: busy ? 'Building…' : 'Build my plan', onPress: () => void finish(), testID: 'onb-build' }
    : step === 'done' ? { label: 'Start training', onPress: () => router.replace('/'), testID: 'onb-finish' }
    : { label: 'Continue', onPress: next, testID: 'onb-next' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          {step !== 'welcome' && step !== 'done' ? (
            <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} testID="onb-back">
              <Text style={{ color: c.text, fontSize: t.size.icon }}>←</Text>
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
          {showProgress ? (
            <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {ORDER.slice(1, 6).map((k, i) => (
                <View
                  key={k}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: i + 1 <= idx ? c.accent : c.border,
                  }}
                />
              ))}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {step === 'welcome' ? (
            <Pressable onPress={() => void skip()} accessibilityRole="button" hitSlop={10} testID="onb-skip">
              <Text style={{ color: c.muted, fontSize: t.size.body }}>Skip for now</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={{
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            }}
          >
            {body()}
          </Animated.View>
        </ScrollView>

        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: c.border }}>
          {step === 'done' ? (
            <Button title="Review my plans" variant="secondary" onPress={() => router.replace('/programs')} testID="onb-review" />
          ) : null}
          <Button title={primary.label} size="large" busy={busy} testID={primary.testID} onPress={primary.onPress} />
        </View>
        {busy ? <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', bottom: 90 }} color={c.muted} /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
