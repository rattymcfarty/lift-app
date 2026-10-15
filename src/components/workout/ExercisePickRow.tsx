/**
 * One exercise in a picker / library list: muscle icon tile, name, the
 * muscles it trains, an info button, and a trailing state indicator.
 *
 * Selection (multi-select pickers) is deliberately loud: the row gets a gold
 * accent bar and tint, the name goes bold, and the trailing "+" becomes a
 * filled gold check — so a glance down the list shows exactly what's chosen.
 */
import type { JSX, ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { decodeStringArray, type Exercise } from '../../db/schema';
import { displayName, muscleLabel } from '../../kb/taxonomy';
import { useTheme } from '../../theme';
import { TaxonomyIcon } from '../icons';

export interface ExercisePickRowProps {
  exercise: Exercise;
  /** 'select' = multi-select with check, 'add' = tap-to-add "+", 'browse' = chevron. */
  mode: 'select' | 'add' | 'browse';
  selected?: boolean;
  busy?: boolean;
  onPress: () => void;
  testID?: string;
  /** testID for the ⓘ button (flows rely on stable ids). */
  infoTestID?: string;
  /** Extra trailing content (rare). */
  trailing?: ReactNode;
}

export function ExercisePickRow({
  exercise,
  mode,
  selected = false,
  busy = false,
  onPress,
  testID,
  infoTestID,
  trailing,
}: ExercisePickRowProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const primary = decodeStringArray(exercise.primaryMuscles);
  const muscles = primary.slice(0, 3).map((m) => muscleLabel(m)).join(', ');
  const iconId = primary[0] ?? 'Other';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${displayName(exercise)}${selected ? ', selected' : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingRight: theme.spacing.sm,
        paddingLeft: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        borderLeftWidth: 4,
        borderLeftColor: selected ? c.accent : 'transparent',
        backgroundColor: selected ? c.surface : 'transparent',
        opacity: pressed || busy ? 0.75 : 1,
      })}
    >
      <TaxonomyIcon kind="muscle" id={iconId} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{
            color: selected ? c.accent : c.text,
            fontSize: t.size.row,
            fontWeight: selected ? t.weight.bold : t.weight.medium,
          }}
          numberOfLines={2}
        >
          {displayName(exercise)}
        </Text>
        <Text style={{ color: c.faint, fontSize: t.size.meta }} numberOfLines={1}>
          {muscles || exercise.category}
          {exercise.isCustom ? ' · custom' : ''}
        </Text>
      </View>
      <Pressable
        testID={infoTestID}
        onPress={() => router.push(`/exercises/${exercise.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`About ${displayName(exercise)}`}
        hitSlop={8}
        style={{ padding: 4 }}
      >
        <Text style={{ color: c.faint, fontSize: t.size.body }}>ⓘ</Text>
      </Pressable>
      {trailing}
      {busy ? (
        <ActivityIndicator color={c.muted} size="small" />
      ) : mode === 'select' ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? c.accent : 'transparent',
            borderWidth: selected ? 0 : 2,
            borderColor: c.border,
          }}
        >
          {selected ? (
            <Text style={{ color: c.accentText, fontSize: t.size.meta + 1, fontWeight: t.weight.bold }}>✓</Text>
          ) : null}
        </View>
      ) : mode === 'add' ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surfaceMuted,
          }}
        >
          <Text style={{ color: c.text, fontSize: t.size.body, fontWeight: t.weight.bold }}>+</Text>
        </View>
      ) : (
        <Text style={{ color: c.faint, fontSize: t.size.body }}>›</Text>
      )}
    </Pressable>
  );
}
