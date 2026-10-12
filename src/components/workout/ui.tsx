/**
 * Shared logging-UI primitives. Every screen in the workout flow composes
 * these — no ad-hoc buttons or cards elsewhere.
 *
 * Accent discipline (see src/theme/tokens.ts): the green accent is reserved
 * for the primary action of completing a set. Button variants:
 * - 'accent'   → ONLY the log-set action.
 * - 'primary'  → main CTAs (start/finish workout): inverted monochrome.
 * - 'secondary'→ supporting actions.
 * - 'danger'   → destructive actions, ghost style (danger text).
 * All colors/spacing/type come from theme tokens — never hard-coded.
 */

import type { JSX, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../theme';

type ButtonVariant = 'accent' | 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  testID,
}: ButtonProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;

  const backgroundColor =
    variant === 'accent'
      ? c.accent
      : variant === 'primary'
        ? c.text
        : variant === 'secondary'
          ? c.surfaceMuted
          : 'transparent';
  const textColor =
    variant === 'accent'
      ? c.accentText
      : variant === 'primary'
        ? c.background
        : variant === 'danger'
          ? c.danger
          : c.text;

  const inactive = disabled || busy;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'danger' ? 0 : variant === 'secondary' ? 1 : 0,
          borderColor: c.border,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={{
            color: textColor,
            fontSize: t.size.body,
            fontWeight: t.weight.medium,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Raised surface container for exercise cards, resume banners, etc. */
export function Card({ children }: { children: ReactNode }): JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
      ]}
    >
      {children}
    </View>
  );
}

interface ScreenHeaderProps {
  title: string;
  /** Plain string or a live component (e.g. the elapsed-time ticker). */
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}

/** Screen top bar: back affordance + title. Screens opt into back explicitly. */
export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View
      style={[
        styles.header,
        {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.backButton}
          >
            <Text style={{ color: theme.colors.muted, fontSize: t.size.title, fontWeight: t.weight.medium }}>
              {'‹'}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.headerTitleWrap}>
          <Text
            style={{ color: theme.colors.text, fontSize: t.size.title, fontWeight: t.weight.bold }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle != null ? (
            typeof subtitle === 'string' ? (
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )
          ) : null}
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
    </View>
  );
}

/** Centered empty/loading/error block. Exactly one of the props wins. */
export function EmptyState({
  message,
  hint,
  action,
}: {
  message: string;
  hint?: string;
  action?: ReactNode;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View
      style={[
        styles.empty,
        { padding: theme.spacing.xl, gap: theme.spacing.sm },
      ]}
    >
      <Text style={{ color: theme.colors.muted, fontSize: t.size.body, textAlign: 'center' }}>
        {message}
      </Text>
      {hint ? (
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, textAlign: 'center' }}>
          {hint}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

interface NumberInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  decimal?: boolean;
  width?: number;
  editable?: boolean;
  label?: string;
  testID?: string;
}

/**
 * Themed numeric field. The optional label renders above the input in
 * caption type (e.g. "kg", "reps") so set rows stay legible mid-workout.
 */
export function NumberInput({
  value,
  onChangeText,
  placeholder,
  decimal = false,
  width = 64,
  editable = true,
  label,
  testID,
}: NumberInputProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View style={{ width, gap: 2 }}>
      {label ? (
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, textAlign: 'center' }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        testID={testID}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.faint}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        returnKeyType="done"
        editable={editable}
        textAlign="center"
        style={[
          styles.numberInput,
          {
            width,
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.text,
            borderColor: theme.colors.border,
            fontSize: t.size.body,
            borderRadius: theme.radius.sm,
            paddingVertical: theme.spacing.xs,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  card: {
    borderWidth: 1,
  },
  header: {
    // No bottom border: hairlines are decorative; screens add dividers.
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerRight: {
    marginLeft: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInput: {
    borderWidth: 1,
  },
});
