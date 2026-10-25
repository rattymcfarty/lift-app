/**
 * One set row. Three modes:
 * - "logged": compact summary (set number, previous, weight, reps, ✓) + delete affordance.
 * - "pending": editable weight + reps + RPE inputs with a log circle (○).
 *   The parent controls prefill, validation, and the log action.
 *
 * The parent remounts this row (via `key`) after every logged set so the
 * inputs reset to the new prefill values — no clobbering of in-progress
 * typing. Inline editing of logged sets is out of scope for P1 (delete +
 * re-log covers corrections); P1b may add it.
 *
 * Responsive: the row must fit a 320pt logical width (iOS Display Zoom).
 * Fixed-width cells overflowed the card, so cells use flexBasis +
 * flexShrink with minWidth floors, the gap tightens below 360pt, and the
 * row may wrap so the WARMUP badge drops to a second line instead of
 * clipping. Behavior (prefill, RPE, warmup flag, log flow) is unchanged.
 *
 * Style (reference): set numbers blue once logged, the log action is a
 * blue-outline empty circle, a logged set shows a filled blue circle
 * with a dark check. The focused input gets the blue border (see
 * NumberInput).
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LoggedSet } from '../../db/schema';
import { useTheme } from '../../theme';
import { fitTextSize } from '../../theme/adaptive';
import { formatWeight, parseWeightInput } from '../../lib/units';
import { parseUserInt, parseUserNumber } from './format';
import { Button, NumberInput } from './ui';
import { FONT_WEIGHT } from '../../theme/tokens';
import { GRID_FLEX, GRID_MAX_FONT_SCALE, gridMetrics } from './setGrid';
import { SwipeableRow } from '../ui/SwipeableRow';
import { WheelSheet } from '../ui/WheelSheet';
import {
  WHEEL_FIELDS,
  wheelFieldLabel,
  wheelFieldUnit,
  wheelIndex,
  wheelItems,
  type WheelField,
} from './wheelFields';

export interface SetInputValues {
  reps?: number;
  weightKg?: number;
  rpe?: number;
}

export type SetRowMode = 'logged' | 'pending';

interface LoggedSetRowProps {
  setNumber: number;
  mode: 'logged';
  loggedSet: LoggedSet;
  displayUnit: 'kg' | 'lb';
  previousText: string;
  onDelete: () => void;
  /** Swipe right: add a set pre-filled from this one (values in the display unit). */
  onAddSet?: (values: { reps: string; weightKg: string; rpe: string }) => void;
  // Not used in logged mode
  initial?: never;
  isWarmup?: never;
  busy?: never;
  error?: never;
  onLog?: never;
  onCancel?: never;
  onValuesChange?: never;
}

interface PendingSetRowProps {
  setNumber: number;
  mode: 'pending';
  loggedSet?: never;
  displayUnit: 'kg' | 'lb';
  previousText: string;
  initial: { reps: string; weightKg: string; rpe: string };
  isWarmup: boolean;
  busy: boolean;
  error: string | null;
  onLog: (values: SetInputValues) => void;
  onCancel: () => void;
  /** Swipe right: add a set pre-filled from this row's current values. */
  onAddSet?: (values: { reps: string; weightKg: string; rpe: string }) => void;
  /** Live edits, so the parent can carry them to the next added set. */
  onValuesChange?: (values: { reps: string; weightKg: string; rpe: string }) => void;
  // Not used in pending mode
  onDelete?: never;
}

export type SetRowProps = LoggedSetRowProps | PendingSetRowProps;

type ThemeT = ReturnType<typeof useTheme>['theme'];

/** A flexible column cell: always a fixed proportion of the row. */
function Col({ flex, children, align = 'center' }: { flex: number; children?: React.ReactNode; align?: 'center' | 'flex-start' | 'flex-end' }): JSX.Element {
  return <View style={{ flex, minWidth: 0, alignItems: align, justifyContent: 'center' }}>{children}</View>;
}

function WarmupBadge({ theme, setNumber, size }: { theme: ThemeT; setNumber: number; size: number }): JSX.Element {
  return (
    <View
      style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}
      testID={`set-warmup-badge-${setNumber}`}
    >
      <Text style={{ color: theme.colors.muted, fontSize: size, fontWeight: FONT_WEIGHT.bold }} maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}>
        W
      </Text>
    </View>
  );
}

/** Round, aligned remove button that closes every row. */
function RemoveButton({ onPress, label, theme, size, testID }: { onPress: () => void; label: string; theme: ThemeT; size: number; testID?: string }): JSX.Element {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.colors.danger : theme.colors.surfaceMuted,
      })}
    >
      <Text style={{ color: theme.colors.muted, fontSize: Math.round(size * 0.62), lineHeight: Math.round(size * 0.72), fontWeight: FONT_WEIGHT.medium }} maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}>
        ×
      </Text>
    </Pressable>
  );
}

/**
 * The merged kg | reps | RPE input pill. One rounded surface with hairline
 * dividers — the focused segment lights up with the highlight border — so the
 * three numbers read as one unit at any width.
 */
/**
 * The three value cells (weight | reps | RPE).
 *
 * The wheel is the default path: a tap on any cell opens the drum for that field
 * (owner request 2026-10-25 — infinity wheels instead of the keypad). The keypad
 * is still there, one tap deeper: "Type instead" in the sheet turns the chosen
 * cell into a focused TextInput, and blurring it returns to the wheel behaviour.
 * That keeps typing available for a big jump ("60" instead of a long flick)
 * without making it the way in.
 */
function InputPill(props: {
  theme: ThemeT;
  fontSize: number;
  height: number;
  editable: boolean;
  weight: { value: string; onChange: (v: string) => void; testID: string };
  reps: { value: string; onChange: (v: string) => void; testID: string };
  rpe: { value: string; onChange: (v: string) => void };
  /** The cell currently in keypad mode; null means every tap opens the wheel. */
  typing: 'weight' | 'reps' | 'rpe' | null;
  onOpenWheel: (field: 'weight' | 'reps' | 'rpe') => void;
  onTypingChange: (field: 'weight' | 'reps' | 'rpe' | null) => void;
}): JSX.Element {
  const { theme, fontSize, height, editable } = props;
  const [focus, setFocus] = useState<'w' | 'r' | 'p' | null>(null);

  const seg = (
    field: 'weight' | 'reps' | 'rpe',
    key: 'w' | 'r' | 'p',
    flex: number,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    decimal: boolean,
    label: string,
    testID?: string,
  ): JSX.Element => {
    const typing = props.typing === field;
    return (
      <View
        style={{
          flex,
          height: height - 2,
          borderLeftWidth: key === 'w' ? 0 : 1,
          borderLeftColor: theme.colors.border,
          borderRadius: focus === key ? 8 : 0,
          borderWidth: focus === key ? 2 : 0,
          borderColor: theme.colors.highlight,
        }}
      >
        {typing ? (
          <TextInput
            testID={testID ? `${testID}-input` : undefined}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.faint}
            keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
            returnKeyType="done"
            editable={editable}
            autoFocus
            selectTextOnFocus
            maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
            onFocus={() => setFocus(key)}
            onBlur={() => {
              setFocus((f) => (f === key ? null : f));
              props.onTypingChange(null);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: 0,
              color: theme.colors.text,
              fontSize,
              fontVariant: ['tabular-nums'],
              fontWeight: FONT_WEIGHT.semibold,
              textAlign: 'center',
            }}
          />
        ) : (
          <Pressable
            testID={testID ? `${testID}-pill` : undefined}
            disabled={!editable}
            onPress={() => props.onOpenWheel(field)}
            accessibilityRole="button"
            accessibilityLabel={`${label}${value ? `, ${value}` : ''} for this set`}
            accessibilityHint="Opens the scroll wheel. Tap Type instead in the sheet to use the keypad."
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            {/* The text keeps the row's testID so flows can both tap it (the press
                bubbles to the pill) and assert the value it shows. */}
            <Text
              testID={testID}
              style={{
                color: value ? theme.colors.text : theme.colors.faint,
                fontSize,
                fontVariant: ['tabular-nums'],
                fontWeight: FONT_WEIGHT.semibold,
                textAlign: 'center',
              }}
              maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
              numberOfLines={1}
            >
              {value || placeholder}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View
      style={{
        flex: GRID_FLEX.weight + GRID_FLEX.reps + GRID_FLEX.rpe,
        minWidth: 0,
        height,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      {seg('weight', 'w', GRID_FLEX.weight, props.weight.value, props.weight.onChange, '0', true, 'Weight', props.weight.testID)}
      {seg('reps', 'r', GRID_FLEX.reps, props.reps.value, props.reps.onChange, '0', false, 'Reps', props.reps.testID)}
      {seg('rpe', 'p', GRID_FLEX.rpe, props.rpe.value, props.rpe.onChange, '–', true, 'RPE')}
    </View>
  );
}

export function SetRow(props: SetRowProps): JSX.Element {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const m = gridMetrics(width);
  // Columns are proportional (setGrid), so a column's width is its flex share of
  // the row. The row's numbers get ONE size, computed from those widths — never
  // per-cell shrinking, which could print "80" bigger than "227.5" beside it.
  const rowWidth = Math.max(200, width - 64);
  return props.mode === 'logged'
    ? <LoggedRow {...props} theme={theme} m={m} rowWidth={rowWidth} />
    : <PendingRow {...props} theme={theme} m={m} rowWidth={rowWidth} />;
}

/** Width of one table column, less a point of breathing room on each side. */
function columnWidth(rowWidth: number, flex: number): number {
  return Math.max(0, (rowWidth * flex) / 100 - 2);
}

/** One size for the previous column's text ("80 × 10"). */
function previousSize(rowWidth: number, text: string, m: ReturnType<typeof gridMetrics>): number {
  return fitTextSize(columnWidth(rowWidth, GRID_FLEX.prev), {
    longest: text || '–',
    base: m.fontMeta,
    min: Math.min(m.fontMeta, 12),
  });
}

function Prev({ text, testID, theme, fontSize }: { text: string; testID: string; theme: ThemeT; fontSize: number }): JSX.Element {
  return (
    <Col flex={GRID_FLEX.prev}>
      <Text
        testID={testID}
        style={{ color: theme.colors.muted, fontSize, fontVariant: ['tabular-nums'], textAlign: 'center' }}
        numberOfLines={1}
        maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
      >
        {text || '–'}
      </Text>
    </Col>
  );
}

function LoggedRow(props: LoggedSetRowProps & { theme: ThemeT; m: ReturnType<typeof gridMetrics>; rowWidth: number }): JSX.Element {
  const { theme, m, loggedSet, displayUnit, previousText, onDelete, setNumber, rowWidth } = props;
  const isWarmup = loggedSet.isWarmup === true;
  const valueColor = isWarmup ? theme.colors.muted : theme.colors.text;
  const weightDisplay = loggedSet.weightKg != null
    ? formatWeight(loggedSet.weightKg, displayUnit).replace(/ (kg|lb)$/, '')
    : '';
  const repsDisplay = loggedSet.reps != null ? String(loggedSet.reps) : '';
  const rpeDisplay = loggedSet.rpe != null ? String(loggedSet.rpe) : '';
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }).start();
  }, [pop]);

  const numberSize = Math.min(
    ...[
      [GRID_FLEX.weight, weightDisplay],
      [GRID_FLEX.reps, repsDisplay],
      [GRID_FLEX.rpe, rpeDisplay],
    ].map(([flex, v]) =>
      fitTextSize(columnWidth(rowWidth, flex as number), {
        longest: (v as string) || '–',
        base: m.fontBody,
        min: Math.min(m.fontBody, 12),
      }),
    ),
  );

  const num = (v: string, flex: number, color: string): JSX.Element => (
    <Col flex={flex}>
      <Text
        style={{ color, fontSize: numberSize, fontVariant: ['tabular-nums'], fontWeight: FONT_WEIGHT.semibold }}
        numberOfLines={1}
        maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
      >
        {v || '–'}
      </Text>
    </Col>
  );

  return (
    <SwipeableRow
      backgroundColor={theme.colors.surface}
      onDelete={onDelete}
      rightLabel="+ Add set"
      onSwipeRight={() => props.onAddSet?.({ reps: repsDisplay, weightKg: weightDisplay, rpe: rpeDisplay })}
    >
      <Animated.View
        testID={`logged-set-${loggedSet.setNumber}`}
        style={[
          styles.row,
          {
            minHeight: m.rowHeight,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            opacity: isWarmup ? 0.75 : 1,
          },
          { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] },
        ]}
      >
        <Col flex={GRID_FLEX.set}>
          <Text
            style={{ color: isWarmup ? theme.colors.muted : theme.colors.highlight, fontSize: m.fontBody, fontWeight: FONT_WEIGHT.bold }}
            maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
            numberOfLines={1}
          >
            {loggedSet.setNumber}
          </Text>
        </Col>
        <Prev
          text={previousText}
          testID={`exercise-previous-${setNumber}`}
          theme={theme}
          fontSize={previousSize(rowWidth, previousText, m)}
        />
        {num(weightDisplay, GRID_FLEX.weight, valueColor)}
        {num(repsDisplay, GRID_FLEX.reps, valueColor)}
        {num(rpeDisplay, GRID_FLEX.rpe, theme.colors.faint)}
        <Col flex={GRID_FLEX.check}>
          <View
            style={{
              width: m.circle,
              height: m.circle,
              borderRadius: m.circle / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isWarmup ? theme.colors.surfaceMuted : theme.colors.highlight,
            }}
          >
            {isWarmup ? <WarmupBadge theme={theme} setNumber={setNumber} size={m.fontHeader} /> : (
              <Text style={{ color: theme.colors.highlightText, fontSize: m.fontMeta, fontWeight: FONT_WEIGHT.bold }} maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}>✓</Text>
            )}
          </View>
        </Col>
        <Col flex={GRID_FLEX.remove}>
          <RemoveButton
            testID={`delete-set-${loggedSet.setNumber}`}
            onPress={onDelete}
            label={`Delete set ${loggedSet.setNumber}`}
            theme={theme}
            size={Math.round(m.circle * 0.9)}
          />
        </Col>
      </Animated.View>
    </SwipeableRow>
  );
}

function PendingRow(props: PendingSetRowProps & { theme: ThemeT; m: ReturnType<typeof gridMetrics>; rowWidth: number }): JSX.Element {
  const { theme, m, setNumber, displayUnit, previousText, initial, isWarmup, busy, error, onLog, onCancel, onValuesChange, rowWidth } = props;
  const [reps, setRepsState] = useState(initial.reps);
  const [weightKg, setWeightState] = useState(initial.weightKg);
  const [rpe, setRpeState] = useState(initial.rpe);
  const [localError, setLocalError] = useState<string | null>(null);
  /**
   * The scroll wheel sheet: which field it is editing, or null when closed.
   * Opened by tapping a value cell (weight, reps or RPE) or the set number. The
   * keypad is reached from the sheet's "Type instead" action, which switches the
   * chosen cell to a focused TextInput until it blurs.
   */
  const [wheelField, setWheelField] = useState<WheelField | null>(null);
  /** The cell in keypad mode (null: taps open the wheel). */
  const [typingField, setTypingField] = useState<WheelField | null>(null);

  const openWheel = (field: WheelField): void => {
    setTypingField(null);
    setWheelField(field);
  };

  /**
   * "Type instead": close the sheet, then hand that cell to the keypad. The
   * delay lets the sheet's modal finish closing first — focusing the input while
   * it is still covered left the keyboard hidden on Android.
   */
  const typeInstead = (): void => {
    const field = wheelField;
    setWheelField(null);
    if (!field) return;
    setTimeout(() => setTypingField(field), 320);
  };

  const report = (next: { reps: string; weightKg: string; rpe: string }): void => onValuesChange?.(next);
  const setReps = (v: string): void => { setRepsState(v); report({ reps: v, weightKg, rpe }); };
  const setWeight = (v: string): void => { setWeightState(v); report({ reps, weightKg: v, rpe }); };
  const setRpe = (v: string): void => { setRpeState(v); report({ reps, weightKg, rpe: v }); };

  const handleLog = (): void => {
    const parsedReps = parseUserInt(reps);
    const parsedWeight = parseWeightInput(weightKg, displayUnit);
    const parsedRpe = parseUserNumber(rpe);
    if (Number.isNaN(parsedReps) || Number.isNaN(parsedWeight) || Number.isNaN(parsedRpe)) {
      setLocalError('Enter valid numbers.');
      return;
    }
    if (parsedRpe !== undefined && (parsedRpe < 1 || parsedRpe > 10)) {
      setLocalError('RPE must be between 1 and 10.');
      return;
    }
    // A set needs a load or a rep count — RPE alone is not a set.
    if (parsedReps === undefined && parsedWeight === undefined) {
      setLocalError('Enter reps or weight to log a set.');
      return;
    }
    setLocalError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onLog({ reps: parsedReps, weightKg: parsedWeight, rpe: parsedRpe });
  };

  const shownError = localError ?? error;
  const pillHeight = Math.round(40 * m.scale);
  return (
    <SwipeableRow
      backgroundColor={theme.colors.surface}
      onDelete={onCancel}
      rightLabel="+ Add set"
      onSwipeRight={() => props.onAddSet?.({ reps, weightKg, rpe })}
    >
      <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <View style={[styles.row, { minHeight: m.rowHeight }]}>
          <Col flex={GRID_FLEX.set}>
            {isWarmup ? <WarmupBadge theme={theme} setNumber={setNumber} size={m.fontHeader} /> : (
              <Pressable
                testID={`edit-set-${setNumber}`}
                onPress={() => openWheel('weight')}
                accessibilityRole="button"
                accessibilityLabel={`Enter set ${setNumber} with the wheel`}
                accessibilityHint="Opens the scroll wheel for weight, reps and RPE"
                hitSlop={6}
                style={{ alignItems: 'center' }}
              >
                <Text style={{ color: theme.colors.muted, fontSize: m.fontBody, fontWeight: FONT_WEIGHT.bold }} maxFontSizeMultiplier={GRID_MAX_FONT_SCALE} numberOfLines={1}>
                  {setNumber}
                </Text>
                <Text style={{ color: theme.colors.faint, fontSize: Math.max(8, m.fontHeader - 3), lineHeight: Math.max(8, m.fontHeader - 3) }} maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}>
                  ⌃⌄
                </Text>
              </Pressable>
            )}
          </Col>
          <Prev
            text={previousText}
            testID={`exercise-previous-${setNumber}`}
            theme={theme}
            fontSize={previousSize(rowWidth, previousText, m)}
          />
          <InputPill
            theme={theme}
            fontSize={m.fontBody}
            height={pillHeight}
            editable={!busy}
            weight={{ value: weightKg, onChange: setWeight, testID: `set-weight-${setNumber}` }}
            reps={{ value: reps, onChange: setReps, testID: `set-reps-${setNumber}` }}
            rpe={{ value: rpe, onChange: setRpe }}
            typing={typingField}
            onOpenWheel={openWheel}
            onTypingChange={setTypingField}
          />
          <Col flex={GRID_FLEX.check}>
            <Pressable
              testID={`log-set-${setNumber}`}
              onPress={handleLog}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={busy ? 'Logging…' : `Log set ${setNumber}`}
              hitSlop={8}
              style={{
                width: m.circle,
                height: m.circle,
                borderRadius: m.circle / 2,
                borderWidth: 2,
                borderColor: busy ? theme.colors.border : theme.colors.highlight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {busy ? <ActivityIndicator color={theme.colors.highlight} size="small" /> : null}
            </Pressable>
          </Col>
          <Col flex={GRID_FLEX.remove}>
            <RemoveButton onPress={onCancel} label="Remove set" theme={theme} size={Math.round(m.circle * 0.9)} />
          </Col>
        </View>
        {shownError ? (
          <Text style={{ color: theme.colors.danger, fontSize: m.fontHeader, paddingBottom: theme.spacing.xs }}>{shownError}</Text>
        ) : null}
      </View>

      {/* The wheel sheet — one drum per field, opened from the set number. */}
      <WheelSheet
        visible={wheelField !== null}
        onClose={() => setWheelField(null)}
        title={wheelField ? wheelFieldLabel(wheelField) : 'Set value'}
        subtitle={`Set ${setNumber}`}
        tabs={WHEEL_FIELDS.map((f) => ({ key: f, label: wheelFieldLabel(f), testID: `wheel-tab-${f}` }))}
        activeTab={wheelField ?? undefined}
        onTabChange={(key) => setWheelField(key as WheelField)}
        items={wheelField ? wheelItems(wheelField, displayUnit) : []}
        index={wheelField ? wheelIndex(wheelItems(wheelField, displayUnit), wheelField === 'weight' ? weightKg : wheelField === 'reps' ? reps : rpe) : 0}
        unit={wheelField ? wheelFieldUnit(wheelField, displayUnit) : undefined}
        onSelect={(value) => {
          if (wheelField === 'weight') setWeight(value);
          else if (wheelField === 'reps') setReps(value);
          else if (wheelField === 'rpe') setRpe(value);
        }}
        onClear={() => {
          if (wheelField === 'weight') setWeight('');
          else if (wheelField === 'reps') setReps('');
          else if (wheelField === 'rpe') setRpe('');
        }}
        onType={typeInstead}
        testID="wheel-sheet"
      />
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
