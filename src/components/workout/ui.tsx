/**
 * Shared logging-UI primitives. Every screen in the workout flow composes
 * these — no ad-hoc buttons or cards elsewhere.
 *
 * Brand-color discipline (see src/theme/tokens.ts): gold (`accent`) is for
 * exercise titles + the Finish action; orange (`highlight`) is for set
 * numbers, the active-card border, focused inputs, and the log/check
 * circle. Button variants:
 * - 'gold'/'primary' → THE primary CTA of a screen/section (gold bg, black
 *                 text). One per zone; everything else steps down.
 * - 'accent'    → legacy alias of gold (kept for existing callers).
 * - 'secondary' → supporting actions (tonal fill + border).
 * - 'danger'    → destructive actions, ghost style (danger text).
 * All colors/spacing/type come from theme tokens — never hard-coded.
 */

import type { JSX, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useState } from 'react';
import { useTheme } from '../../theme';

type ButtonVariant =
  /** @deprecated Legacy alias of 'gold' — no callers; use 'gold'. */
  | 'accent'
  /** Primary CTA — gold filled. 'gold' is the same style. */
  | 'gold'
  | 'primary'
  | 'secondary'
  | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  /**
   * 'large' (56pt tall, bold label) is for hero/primary actions the user
   * reaches for mid-workout: home entry points, Start workout, Add Set.
   * Everything else stays 'default' (44pt) so secondary actions don't
   * compete for attention.
   */
  size?: 'default' | 'large';
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  testID,
  size = 'default',
}: ButtonProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;

  // One primary style: gold filled. Secondary is tonal; danger is ghost.
  const backgroundColor =
    variant === 'secondary'
      ? c.surfaceMuted
      : variant === 'danger'
        ? 'transparent'
        : c.accent;
  const textColor =
    variant === 'secondary'
      ? c.text
      : variant === 'danger'
        ? c.danger
        : c.accentText;

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
          // Large hero actions get a taller target + more padding; the
          // 44pt default stays for secondary actions.
          minHeight: size === 'large' ? 56 : 44,
          paddingVertical: size === 'large' ? theme.spacing.md : theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'danger' || variant === 'secondary' ? 1 : 0,
          borderColor: variant === 'danger' ? c.danger : c.border,
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
            fontWeight: size === 'large' ? t.weight.bold : t.weight.medium,
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
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  /** Optional border/background overrides (e.g. the active-card border). */
  style?: StyleProp<ViewStyle>;
}): JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        style,
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
  /** Back affordance glyph. Default '←'. Pickers-as-sheets use '✕' (close). */
  backGlyph?: '←' | '✕';
  right?: ReactNode;
}

/**
 * Screen top bar: back affordance + large title. Screens opt into back
 * explicitly. The back arrow is a large top-left '←' (44pt target) per
 * the reference layout; the title is screen-size bold, shrinking on narrow
 * windows (iOS Display Zoom = 320pt) so it fits instead of truncating.
 * Long titles may wrap to two lines rather than clip mid-word.
 */
export function ScreenHeader({ title, subtitle, onBack, backGlyph = '←', right }: ScreenHeaderProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  // Narrow windows (iOS Display Zoom = 320pt) get a smaller hero title;
  // adjustsFontSizeToFit shrinks further for long titles.
  const { width } = useWindowDimensions();
  const narrow = width < 360;
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
            testID="header-back"
            accessibilityRole="button"
            accessibilityLabel={backGlyph === '✕' ? 'Close' : 'Back'}
            hitSlop={8}
            style={styles.backButton}
          >
            <Text style={{ color: theme.colors.text, fontSize: t.size.icon, fontWeight: t.weight.medium }}>
              {backGlyph}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.headerTitleWrap}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: narrow ? t.size.screenCompact : t.size.screen,
              fontWeight: t.weight.bold,
            }}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {title}
          </Text>
          {subtitle != null ? (
            typeof subtitle === 'string' ? (
              <Text
                style={{ color: theme.colors.muted, fontSize: t.size.caption }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
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
  /**
   * Flex sizing for narrow containers (e.g. SetRow under iOS Display Zoom).
   * When flexBasis is set, the input shrinks from flexBasis down to minWidth
   * instead of holding a fixed width; otherwise it keeps the fixed `width`.
   */
  flexBasis?: number;
  minWidth?: number;
  editable?: boolean;
  label?: string;
  testID?: string;
}

/**
 * Themed numeric field. The optional label renders above the input in
 * caption type (e.g. "kg", "reps") so set rows stay legible mid-workout.
 * The focused input gets the orange highlight border (reference style).
 */
export function NumberInput({
  value,
  onChangeText,
  placeholder,
  decimal = false,
  width = 64,
  flexBasis,
  minWidth,
  editable = true,
  label,
  testID,
}: NumberInputProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [focused, setFocused] = useState(false);
  // Fixed-width callers (calculators, measure, plans) are unchanged.
  // Flex callers (SetRow) shrink from flexBasis down to minWidth.
  const containerStyle =
    flexBasis != null
      ? { flexBasis, flexShrink: 1, minWidth: minWidth ?? flexBasis, gap: 2 }
      : { width, gap: 2 };
  return (
    <View style={containerStyle}>
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
        selectTextOnFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.numberInput,
          {
            alignSelf: 'stretch',
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.text,
            borderColor: focused ? theme.colors.highlight : theme.colors.border,
            borderWidth: focused ? 2 : 1,
            fontSize: t.size.body,
            fontVariant: ['tabular-nums'],
            borderRadius: theme.radius.md,
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
    // minHeight lives in the inline style (44 default / 56 large) — do
    // NOT add one here or it will silently lose to the inline value.
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
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: 12,
    paddingVertical: 4,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  headerRight: {
    marginLeft: 8,
    flexShrink: 0,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInput: {
    // borderWidth lives in the inline style (1 idle / 2 focused).
  },
});
