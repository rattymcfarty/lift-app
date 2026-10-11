/**
 * One set row. Two modes:
 * - input mode (loggedSet === null): reps / weight / RPE fields + the LOG
 *   button. The LOG button is THE accent-color moment in the app.
 * - logged mode: compact summary + delete affordance (soft-delete).
 *
 * The parent remounts this row (via `key`) after every logged set so the
 * inputs reset to the new prefill values — no clobbering of in-progress
 * typing. Inline editing of logged sets is out of scope for P1 (delete +
 * re-log covers corrections); P1b may add it.
 */

import { useState, type JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LoggedSet } from '../../db/schema';
import { useTheme } from '../../theme';
import { formatSetSummary, parseUserInt, parseUserNumber } from './format';
import { Button, NumberInput } from './ui';

export interface SetInputValues {
  reps?: number;
  weightKg?: number;
  rpe?: number;
}

interface SetRowProps {
  setNumber: number;
  /** Null = input mode; a row = logged mode. */
  loggedSet: LoggedSet | null;
  /** Prefill for input mode (copy-forward from last set / last time). */
  initial: { reps: string; weightKg: string; rpe: string };
  busy: boolean;
  error: string | null;
  onLog: (values: SetInputValues) => void;
  onDelete: () => void;
}

export function SetRow({
  setNumber,
  loggedSet,
  initial,
  busy,
  error,
  onLog,
  onDelete,
}: SetRowProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [reps, setReps] = useState(initial.reps);
  const [weightKg, setWeightKg] = useState(initial.weightKg);
  const [rpe, setRpe] = useState(initial.rpe);
  const [localError, setLocalError] = useState<string | null>(null);

  if (loggedSet) {
    return (
      <View
        style={[
          styles.row,
          { paddingVertical: theme.spacing.xs, gap: theme.spacing.sm },
        ]}
      >
        <Text
          style={{
            color: theme.colors.success,
            fontSize: t.size.body,
            fontWeight: t.weight.bold,
            width: 20,
            textAlign: 'center',
          }}
        >
          ✓
        </Text>
        <Text
          style={{ color: theme.colors.muted, fontSize: t.size.body, width: 24 }}
        >
          {loggedSet.setNumber}
        </Text>
        <Text
          style={{ color: theme.colors.text, fontSize: t.size.body, flex: 1 }}
          numberOfLines={1}
        >
          {formatSetSummary(loggedSet)}
        </Text>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete set ${loggedSet.setNumber}`}
          hitSlop={12}
          style={styles.deleteButton}
        >
          <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>×</Text>
        </Pressable>
      </View>
    );
  }

  const handleLog = (): void => {
    const parsedReps = parseUserInt(reps);
    const parsedWeight = parseUserNumber(weightKg);
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

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <Text
          style={{
            color: theme.colors.muted,
            fontSize: t.size.body,
            width: 24,
            textAlign: 'center',
          }}
        >
          {setNumber}
        </Text>
        <NumberInput
          value={reps}
          onChangeText={setReps}
          placeholder="0"
          label="reps"
          width={56}
          editable={!busy}
        />
        <NumberInput
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="0"
          decimal
          label="kg"
          width={64}
          editable={!busy}
        />
        <NumberInput
          value={rpe}
          onChangeText={setRpe}
          placeholder="–"
          decimal
          label="RPE"
          width={52}
          editable={!busy}
        />
        <View style={styles.logButton}>
          <Button
            title="Log"
            variant="accent"
            onPress={handleLog}
            busy={busy}
            testID={`log-set-${setNumber}`}
          />
        </View>
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
  logButton: {
    flex: 1,
    marginLeft: 4,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
