/**
 * Create or edit a custom exercise. `?id=<exerciseId>` edits an existing
 * custom exercise; without it the form creates a new one. Custom exercises
 * live only on this device and are included in the exported backup.
 */
import { useEffect, useState, type JSX } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { Button, ScreenHeader } from '../../src/components/workout/ui';
import { ComposerTaxonomyPicker } from '../../src/components/workout/ComposerTaxonomyPicker';
import { createCustomExercise, getExercise } from '../../src/data/repositories';
import { updateCustomExercise } from '../../src/data/customExercises';
import { decodeStringArray, EXERCISE_CATEGORIES, type ExerciseCategory } from '../../src/db/schema';

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  mobility: 'Mobility',
  balance: 'Balance',
  other: 'Other',
};

export default function ExerciseFormScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string' && id.length > 0;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('strength');
  const [muscles, setMuscles] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    void (async () => {
      const ex = await getExercise(id as string);
      if (cancelled) return;
      if (!ex || !ex.isCustom) {
        setError('Only your own exercises can be edited.');
      } else {
        setName(ex.name);
        setCategory((EXERCISE_CATEGORIES as readonly string[]).includes(ex.category) ? (ex.category as ExerciseCategory) : 'strength');
        setMuscles(decodeStringArray(ex.primaryMuscles));
        setEquipment(decodeStringArray(ex.equipment));
        setInstructions(ex.instructions ?? '');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, id]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string): void =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async (): Promise<void> => {
    if (name.trim() === '') {
      setError('Give the exercise a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateCustomExercise(id as string, {
          name,
          category,
          primaryMuscles: muscles,
          equipment,
          instructions,
        });
        router.back();
      } else {
        const newId = await createCustomExercise({
          name: name.trim(),
          category,
          primaryMuscles: muscles,
          equipment,
          instructions: instructions.trim() || undefined,
        });
        router.replace(`/exercises/${newId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the exercise.');
      setSaving(false);
    }
  };

  const cancel = (): void => {
    if (name.trim() === '' && instructions.trim() === '') {
      router.back();
      return;
    }
    Alert.alert('Discard changes?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const inputStyle = {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    color: c.text,
    fontSize: t.size.body,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title={editing ? 'Edit exercise' : 'New exercise'} onBack={cancel} compact />
        {loading ? null : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>NAME</Text>
              <TextInput
                testID="exercise-form-name"
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setError(null);
                }}
                placeholder="e.g. Cable Face Pull"
                placeholderTextColor={c.faint}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
                style={inputStyle}
              />
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>TYPE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                {EXERCISE_CATEGORIES.map((cat) => {
                  const on = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={{
                        borderWidth: 1,
                        borderColor: on ? c.accent : c.border,
                        backgroundColor: on ? c.surfaceMuted : 'transparent',
                        borderRadius: theme.radius.pill,
                        paddingVertical: theme.spacing.xs + 2,
                        paddingHorizontal: theme.spacing.md,
                      }}
                    >
                      <Text style={{ color: on ? c.text : c.muted, fontSize: t.size.meta + 1, fontWeight: on ? t.weight.semibold : t.weight.regular }}>
                        {CATEGORY_LABEL[cat]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <ComposerTaxonomyPicker
              muscles={muscles}
              equipment={equipment}
              onToggleMuscle={(v) => toggle(muscles, setMuscles, v)}
              onToggleEquipment={(v) => toggle(equipment, setEquipment, v)}
            />

            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>NOTES (OPTIONAL)</Text>
              <TextInput
                testID="exercise-form-notes"
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Setup, cues, anything you want to remember"
                placeholderTextColor={c.faint}
                multiline
                style={{ ...inputStyle, minHeight: 88, textAlignVertical: 'top' }}
              />
            </View>

            {error ? <Text style={{ color: c.danger, fontSize: t.size.meta }}>{error}</Text> : null}

            <Button
              title={editing ? 'Save changes' : 'Create exercise'}
              testID="exercise-form-save"
              size="large"
              busy={saving}
              onPress={() => void save()}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
