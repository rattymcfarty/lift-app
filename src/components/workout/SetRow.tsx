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
 * Style (reference): set numbers orange once logged, the log action is an
 * orange-outline empty circle, a logged set shows a filled orange circle
 * with a dark check. The focused input gets the orange border (see
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
  View,
  useWindowDimensions,
} from 'react-native';
import type { LoggedSet } from '../../db/schema';
import { useTheme } from '../../theme';
import { formatWeight, parseWeightInput } from '../../lib/units';
import { parseUserInt, parseUserNumber } from './format';
import { Button, NumberInput } from './ui';
import { FONT_WEIGHT } from '../../theme/tokens';
import { SET_GRID } from './setGrid';

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
  /** Live edits, so the parent can carry them to the next added set. */
  onValuesChange?: (values: { reps: string; weightKg: string; rpe: string }) => void;
  // Not used in pending mode
  onDelete?: never;
}

export type SetRowProps = LoggedSetRowProps | PendingSetRowProps;

/** One compact numeric cell used by logged rows. */
function Cell({ width, children, color, bold }: { width: number; children: string; color: string; bold?: boolean }): JSX.Element {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        width,
        textAlign: 'center',
        color,
        fontSize: theme.typography.size.body,
        fontWeight: bold ? FONT_WEIGHT.bold : FONT_WEIGHT.regular,
        fontVariant: ['tabular-nums'],
      }}
      numberOfLines={1}
      maxFontSizeMultiplier={SET_GRID.maxFontScale}
    >
      {children}
    </Text>
  );
}

/** The flexible "Target" (previous performance) column. */
function PrevCell({ text, testID, hidden }: { text: string; testID: string; hidden: boolean }): JSX.Element | null {
  const { theme } = useTheme();
  if (hidden) return null;
  return (
    <Text
      testID={testID}
      style={{
        flex: 1,
        minWidth: 0,
        textAlign: 'center',
        color: theme.colors.faint,
        fontSize: theme.typography.size.meta,
        fontVariant: ['tabular-nums'],
      }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={SET_GRID.maxFontScale}
    >
      {text}
    </Text>
  );
}

export function SetRow(props: SetRowProps): JSX.Element {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const hidePrev = windowWidth < SET_GRID.hidePrevBelow;
  return props.mode === 'logged'
    ? <LoggedRow {...props} theme={theme} hidePrev={hidePrev} />
    : <PendingRow {...props} theme={theme} hidePrev={hidePrev} />;
}

type ThemeT = ReturnType<typeof useTheme>['theme'];

function WarmupBadge({ theme, setNumber }: { theme: ThemeT; setNumber: number }): JSX.Element {
  return (
    <View style={[styles.warmupBadge, { backgroundColor: theme.colors.surfaceMuted }]} testID={`set-warmup-badge-${setNumber}`}>
      <Text style={{ color: theme.colors.muted, fontSize: theme.typography.size.caption, fontWeight: FONT_WEIGHT.bold }} maxFontSizeMultiplier={SET_GRID.maxFontScale}>
        W
      </Text>
    </View>
  );
}

function LoggedRow(props: LoggedSetRowProps & { theme: ThemeT; hidePrev: boolean }): JSX.Element {
  const { theme, hidePrev, loggedSet, displayUnit, previousText, onDelete, setNumber } = props;
  const t = theme.typography;
  const isWarmup = loggedSet.isWarmup === true;
  const dim = isWarmup ? theme.colors.muted : theme.colors.text;
  const weightDisplay = loggedSet.weightKg != null
    ? formatWeight(loggedSet.weightKg, displayUnit).replace(/ (kg|lb)$/, '')
    : '';
  const repsDisplay = loggedSet.reps != null ? String(loggedSet.reps) : '';
  const rpeDisplay = loggedSet.rpe != null ? String(loggedSet.rpe) : '';
  // A logged row eases in, so a freshly logged set visibly "lands".
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <Animated.View
      style={[
        styles.row,
        { gap: SET_GRID.gap, paddingVertical: theme.spacing.xs },
        isWarmup && styles.warmupRow,
        { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
      ]}
    >
      <Cell width={SET_GRID.set} color={isWarmup ? theme.colors.muted : theme.colors.highlight} bold>
        {String(loggedSet.setNumber)}
      </Cell>
      <PrevCell text={previousText} testID={`exercise-previous-${setNumber}`} hidden={hidePrev} />
      {hidePrev ? <View style={{ flex: 1 }} /> : null}
      <Cell width={SET_GRID.weight} color={dim}>{weightDisplay}</Cell>
      <Cell width={SET_GRID.reps} color={dim}>{repsDisplay}</Cell>
      <Cell width={SET_GRID.rpe} color={theme.colors.faint}>{rpeDisplay}</Cell>
      <View
        style={[
          styles.checkCircle,
          { backgroundColor: isWarmup ? theme.colors.surfaceMuted : theme.colors.highlight },
        ]}
      >
        {isWarmup ? <WarmupBadge theme={theme} setNumber={setNumber} /> : (
          <Text style={{ color: theme.colors.highlightText, fontSize: t.size.meta, fontWeight: FONT_WEIGHT.bold }} maxFontSizeMultiplier={SET_GRID.maxFontScale}>✓</Text>
        )}
      </View>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete set ${loggedSet.setNumber}`}
        hitSlop={10}
        style={styles.removeButton}
      >
        <Text style={{ color: theme.colors.faint, fontSize: t.size.body }} maxFontSizeMultiplier={SET_GRID.maxFontScale}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

function PendingRow(props: PendingSetRowProps & { theme: ThemeT; hidePrev: boolean }): JSX.Element {
  const { theme, hidePrev, setNumber, displayUnit, previousText, initial, isWarmup, busy, error, onLog, onCancel, onValuesChange } = props;
  const t = theme.typography;
  const [reps, setRepsState] = useState(initial.reps);
  const [weightKg, setWeightState] = useState(initial.weightKg);
  const [rpe, setRpeState] = useState(initial.rpe);
  const [localError, setLocalError] = useState<string | null>(null);

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
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={[styles.row, { gap: SET_GRID.gap }]}>
        <View style={{ width: SET_GRID.set, alignItems: 'center' }}>
          {isWarmup ? <WarmupBadge theme={theme} setNumber={setNumber} /> : (
            <Text style={{ color: theme.colors.muted, fontSize: t.size.body, fontWeight: FONT_WEIGHT.bold }} maxFontSizeMultiplier={SET_GRID.maxFontScale}>
              {setNumber}
            </Text>
          )}
        </View>
        <PrevCell text={previousText} testID={`exercise-previous-${setNumber}`} hidden={hidePrev} />
        {hidePrev ? <View style={{ flex: 1 }} /> : null}
        <NumberInput
          value={weightKg}
          testID={`set-weight-${setNumber}`}
          onChangeText={setWeight}
          placeholder="0"
          decimal
          width={SET_GRID.weight}
          compact
          editable={!busy}
        />
        <NumberInput
          value={reps}
          testID={`set-reps-${setNumber}`}
          onChangeText={setReps}
          placeholder="0"
          width={SET_GRID.reps}
          compact
          editable={!busy}
        />
        <NumberInput
          value={rpe}
          onChangeText={setRpe}
          placeholder="–"
          decimal
          width={SET_GRID.rpe}
          compact
          editable={!busy}
        />
        <View style={styles.checkCircle}>
          <Pressable
            testID={`log-set-${setNumber}`}
            onPress={handleLog}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Logging…' : `Log set ${setNumber}`}
            hitSlop={8}
            style={[styles.circle, { borderColor: busy ? theme.colors.border : theme.colors.highlight }]}
          >
            {busy ? <ActivityIndicator color={theme.colors.highlight} size="small" /> : null}
          </Pressable>
        </View>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={10}
          style={styles.removeButton}
        >
          <Text style={{ color: theme.colors.faint, fontSize: t.size.body }} maxFontSizeMultiplier={SET_GRID.maxFontScale}>×</Text>
        </Pressable>
      </View>
      {shownError ? (
        <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>{shownError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  checkCircle: {
    width: SET_GRID.action,
    height: SET_GRID.action,
    borderRadius: SET_GRID.action / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    width: SET_GRID.remove,
    height: SET_GRID.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupRow: { opacity: 0.75 },
  warmupBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
});
