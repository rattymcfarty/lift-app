/**
 * Building blocks for the multi-page "Program Details" flow: the page frame
 * (centred title, back arrow, sticky purple Next), labelled sections with an
 * optional "(Select One)" hint, character-counted fields, and chip groups
 * whose selected state is a purple-tinted pill.
 */
import type { JSX, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, withAlpha } from '../../theme';
import { Button, ScreenHeader } from '../workout/ui';
import { useTabBarSpace } from '../nav/TabBar';

export function WizardPage({
  title,
  onBack,
  nextLabel = 'Next',
  nextDisabled = false,
  onNext,
  nextTestID = 'wizard-next',
  progress,
  children,
}: {
  title: string;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext: () => void;
  nextTestID?: string;
  /** e.g. "Step 1 of 3" */
  progress?: string;
  children: ReactNode;
}): JSX.Element {
  const { theme } = useTheme();
  const tabBarSpace = useTabBarSpace();
  const t = theme.typography;
  const c = theme.colors;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* The shared header, like every other page: it reserves the top-bar band
            itself, so the back arrow cannot sit under the floating menu button
            (the hand-rolled row here did, once the chrome went everywhere). */}
        <ScreenHeader
          title={title}
          subtitle={progress}
          onBack={onBack ?? (() => router.back())}
        />
        <ScrollView
          style={{ flex: 1, backgroundColor: c.surface }}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.xl + tabBarSpace, gap: theme.spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        <View
          style={{
            padding: theme.spacing.md,
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          <Button title={nextLabel} size="large" variant="gold" testID={nextTestID} disabled={nextDisabled} onPress={onNext} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Section({
  label,
  hint,
  required,
  counter,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** e.g. "15/50" */
  counter?: string;
  children: ReactNode;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
        <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }}>{label}</Text>
        {required ? <Text style={{ color: c.danger, fontSize: t.size.card }}>*</Text> : null}
        {hint ? <Text style={{ color: c.muted, fontSize: t.size.meta + 1 }}>({hint})</Text> : null}
        <View style={{ flex: 1 }} />
        {counter ? <Text style={{ color: c.muted, fontSize: t.size.meta }}>{counter}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function TextArea({
  value,
  onChangeText,
  maxLength,
  placeholder,
  multiline = false,
  minHeight,
  testID,
  autoCapitalize = 'sentences',
}: {
  value: string;
  onChangeText: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  testID?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}): JSX.Element {
  const { theme } = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      maxLength={maxLength}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.faint}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      autoCorrect={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      maxFontSizeMultiplier={1.2}
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        color: theme.colors.text,
        fontSize: theme.typography.size.body,
        paddingVertical: theme.spacing.md - 2,
        paddingHorizontal: theme.spacing.md,
        minHeight: minHeight ?? (multiline ? 96 : 52),
        backgroundColor: theme.colors.surface,
      }}
    />
  );
}

/**
 * Chips that wrap onto as many lines as needed. `multiple` toggles several;
 * otherwise exactly one stays selected (radio behaviour).
 */
export function ChipGroup<T extends string>({
  options,
  selected,
  onChange,
  multiple = false,
  testIDPrefix,
}: {
  options: ReadonlyArray<T>;
  selected: ReadonlyArray<T> | T;
  onChange: (next: T[]) => void;
  multiple?: boolean;
  testIDPrefix?: string;
}): JSX.Element {
  const { theme } = useTheme();
  const tabBarSpace = useTabBarSpace();
  const t = theme.typography;
  const c = theme.colors;
  const sel: ReadonlyArray<T> = Array.isArray(selected) ? (selected as ReadonlyArray<T>) : [selected as T];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {options.map((o) => {
        const on = sel.includes(o);
        return (
          <Pressable
            key={o}
            testID={testIDPrefix ? `${testIDPrefix}-${o.replace(/[^A-Za-z0-9]+/g, '-')}` : undefined}
            onPress={() => {
              if (multiple) onChange(on ? sel.filter((x) => x !== o) : [...sel, o]);
              else onChange([o]);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              borderRadius: theme.radius.md + 2,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? withAlpha(c.accent, 0.55) : 'transparent',
              backgroundColor: on ? withAlpha(c.accent, 0.22) : withAlpha(c.text, 0.08),
              paddingVertical: theme.spacing.md - 2,
              paddingHorizontal: theme.spacing.md + 2,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: on ? c.text : c.text,
                fontSize: t.size.row + 1,
                fontWeight: on ? t.weight.bold : t.weight.regular,
              }}
              maxFontSizeMultiplier={1.15}
            >
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
