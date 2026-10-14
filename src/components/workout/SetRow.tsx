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

import { useState, type JSX } from 'react';
import {
  ActivityIndicator,
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
  // Not used in pending mode
  onDelete?: never;
}

export type SetRowProps = LoggedSetRowProps | PendingSetRowProps;

/** Logical-width breakpoint: below this, tighten gaps and cell floors. */
const COMPACT_WIDTH = 360;

export function SetRow(props: SetRowProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < COMPACT_WIDTH;

  if (props.mode === 'logged') {
    return renderLoggedRow(props, theme, t, compact);
  }
  return renderPendingRow(props, theme, t, compact);
}

function renderLoggedRow(
  props: LoggedSetRowProps,
  theme: ReturnType<typeof useTheme>['theme'],
  t: ReturnType<typeof useTheme>['theme']['typography'],
  compact: boolean,
): JSX.Element {
  const { loggedSet, displayUnit, previousText, onDelete, setNumber } = props;
  const isWarmup = loggedSet.isWarmup === true;

  // Format weight as just the number (unit is in column header)
  const weightDisplay = loggedSet.weightKg != null
    ? formatWeight(loggedSet.weightKg, displayUnit).replace(/ (kg|lb)$/, '')
    : '';
  const repsDisplay = loggedSet.reps != null ? String(loggedSet.reps) : '';
  const rpeDisplay = loggedSet.rpe != null ? `RPE ${loggedSet.rpe}` : '';
  const gap = compact ? theme.spacing.xs : theme.spacing.sm;

  return (
    <View
      style={[
        styles.row,
        { paddingVertical: theme.spacing.xs, gap },
        isWarmup && styles.warmupRow,
        compact && styles.wrapRow,
      ]}
    >
      <Text
        style={[
          styles.setNumber,
          compact && styles.setNumberCompact,
          {
            color: isWarmup ? theme.colors.muted : theme.colors.highlight,
          },
        ]}
      >
        {loggedSet.setNumber}
      </Text>
      <Text
        testID={`exercise-previous-${setNumber}`}
        style={[
          styles.previousCell,
          compact && styles.previousCellCompact,
          { color: theme.colors.muted },
        ]}
        numberOfLines={1}
      >
        {previousText}
      </Text>
      <Text
        style={[
          styles.weightCell,
          compact && styles.weightCellCompact,
          { color: isWarmup ? theme.colors.muted : theme.colors.text },
        ]}
        numberOfLines={1}
      >
        {weightDisplay}
      </Text>
      <Text
        style={[
          styles.repsCell,
          compact && styles.repsCellCompact,
          { color: isWarmup ? theme.colors.muted : theme.colors.text },
        ]}
        numberOfLines={1}
      >
        {repsDisplay}
      </Text>
      {rpeDisplay ? (
        <Text
          style={[
            styles.rpeCell,
            compact && styles.rpeCellCompact,
            { color: isWarmup ? theme.colors.muted : theme.colors.faint },
          ]}
          numberOfLines={1}
        >
          {rpeDisplay}
        </Text>
      ) : (
        <View style={[styles.rpeCell, compact && styles.rpeCellCompact]} />
      )}
      <View
        style={[
          styles.checkCircle,
          {
            backgroundColor: isWarmup ? theme.colors.surfaceMuted : theme.colors.highlight,
          },
        ]}
      >
        <Text
          style={[
            styles.checkGlyph,
            {
              color: isWarmup ? theme.colors.muted : theme.colors.highlightText,
              fontSize: t.size.row,
            },
          ]}
        >
          ✓
        </Text>
      </View>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete set ${loggedSet.setNumber}`}
        hitSlop={12}
        style={[styles.deleteButton, compact && styles.deleteButtonCompact]}
      >
        <Text
          style={[
            { fontSize: t.size.body },
            isWarmup ? { color: theme.colors.faint } : { color: theme.colors.danger },
          ]}
        >
          ×
        </Text>
      </Pressable>
      {isWarmup && (
        <View
          style={[
            styles.warmupBadge,
            { backgroundColor: theme.colors.surfaceMuted },
          ]}
          testID={`set-warmup-badge-${setNumber}`}
        >
          <Text style={[styles.warmupBadgeText, { color: theme.colors.muted, fontSize: t.size.caption }]}>WARMUP</Text>
        </View>
      )}
    </View>
  );
}

function renderPendingRow(
  props: PendingSetRowProps,
  theme: ReturnType<typeof useTheme>['theme'],
  t: ReturnType<typeof useTheme>['theme']['typography'],
  compact: boolean,
): JSX.Element {
  const {
    setNumber,
    displayUnit,
    previousText,
    initial,
    isWarmup,
    busy,
    error,
    onLog,
    onCancel,
  } = props;

  const [reps, setReps] = useState(initial.reps);
  const [weightKg, setWeightKg] = useState(initial.weightKg);
  const [rpe, setRpe] = useState(initial.rpe);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLog = (): void => {
    // Parse using the display unit for weight
    const parsedReps = parseUserInt(reps);
    const parsedWeight = parseWeightInput(weightKg, displayUnit);
    const parsedRpe = parseUserNumber(rpe);

    if (
      Number.isNaN(parsedReps) ||
      Number.isNaN(parsedWeight) ||
      Number.isNaN(parsedRpe)
    ) {
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
    onLog({ reps: parsedReps, weightKg: parsedWeight, rpe: parsedRpe });
  };

  const shownError = localError ?? error;
  const gap = compact ? theme.spacing.xs : theme.spacing.sm;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={[styles.row, { gap }, compact && styles.wrapRow]}>
        <Text
          style={{
            color: theme.colors.muted,
            fontSize: t.size.body,
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: compact ? 20 : 24,
            textAlign: 'center',
          }}
        >
          {setNumber}
        </Text>
        <Text
          testID={`exercise-previous-${setNumber}`}
          style={{
            color: theme.colors.muted,
            fontSize: t.size.body,
            flexGrow: 0,
            flexShrink: 1,
            flexBasis: compact ? 48 : 72,
            minWidth: compact ? 28 : 40,
            textAlign: 'right',
          }}
          numberOfLines={1}
        >
          {previousText}
        </Text>
        <NumberInput
          value={reps}
          testID={`set-reps-${setNumber}`}
          onChangeText={setReps}
          placeholder="0"
          label="reps"
          flexBasis={compact ? 44 : 56}
          minWidth={compact ? 36 : 40}
          editable={!busy}
        />
        <NumberInput
          value={weightKg}
          testID={`set-weight-${setNumber}`}
          onChangeText={setWeightKg}
          placeholder="0"
          decimal
          label={displayUnit === 'kg' ? 'kg' : 'lb'}
          flexBasis={compact ? 52 : 64}
          minWidth={compact ? 40 : 44}
          editable={!busy}
        />
        <NumberInput
          value={rpe}
          onChangeText={setRpe}
          placeholder="–"
          decimal
          label="RPE"
          flexBasis={compact ? 44 : 52}
          minWidth={compact ? 34 : 40}
          editable={!busy}
        />
        <View style={styles.logCircle}>
          <Pressable
            testID={`log-set-${setNumber}`}
            onPress={handleLog}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Logging…' : `Log set ${setNumber}`}
            hitSlop={12}
            style={[
              styles.circle,
              {
                borderColor: busy ? theme.colors.border : theme.colors.highlight,
                backgroundColor: 'transparent',
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.highlight} size="small" />
            ) : null}
          </Pressable>
        </View>
        {isWarmup && (
          <View
            style={[
              styles.warmupBadge,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
            testID={`set-warmup-badge-${setNumber}`}
          >
            <Text style={[styles.warmupBadgeText, { color: theme.colors.muted, fontSize: t.size.caption }]}>WARMUP</Text>
          </View>
        )}
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={12}
          style={[styles.cancelButton, compact && styles.cancelButtonCompact]}
        >
          <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>×</Text>
        </Pressable>
      </View>
      {shownError ? (
        <Text style={{ color: theme.colors.danger, fontSize: t.size.caption }}>
          {shownError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrapRow: {
    flexWrap: 'wrap',
  },
  setNumber: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 24,
    textAlign: 'center',
    fontWeight: FONT_WEIGHT.bold,
  },
  setNumberCompact: {
    flexBasis: 20,
  },
  previousCell: {
    fontVariant: ['tabular-nums'],
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 72,
    minWidth: 40,
    textAlign: 'right',
  },
  previousCellCompact: {
    flexBasis: 48,
    minWidth: 28,
  },
  weightCell: {
    fontVariant: ['tabular-nums'],
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 56,
    minWidth: 32,
    textAlign: 'center',
  },
  weightCellCompact: {
    flexBasis: 44,
  },
  repsCell: {
    fontVariant: ['tabular-nums'],
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 48,
    minWidth: 28,
    textAlign: 'center',
  },
  repsCellCompact: {
    flexBasis: 40,
  },
  rpeCell: {
    fontVariant: ['tabular-nums'],
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 52,
    minWidth: 30,
    textAlign: 'center',
  },
  rpeCellCompact: {
    flexBasis: 40,
  },
  checkCircle: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 28,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 20,
  },
  summaryCell: {
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteButtonCompact: {
    paddingHorizontal: 4,
  },
  warmupRow: {
    opacity: 0.7,
  },
  warmupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warmupBadgeText: {
    fontWeight: FONT_WEIGHT.bold,
  },
  logCircle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelButtonCompact: {
    paddingHorizontal: 4,
  },
});
