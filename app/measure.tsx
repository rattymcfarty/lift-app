/**
 * Measurements — log and track body metrics over time.
 *
 * Preset metrics (body weight, waist, chest, body fat %, resting HR) plus
 * custom metrics. Each metric shows latest/previous/delta, a mini trend of
 * the last 10 entries, and a full history with edit + delete. All storage
 * goes through the measurements repository — screens never touch Drizzle.
 *
 * Edit is implemented as soft-delete + re-log with the original timestamp:
 * tombstone discipline is preserved, nothing is ever rewritten in place.
 */

import { useCallback, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listMeasurements,
  logMeasurement,
  softDeleteMeasurement,
} from '../src/data/repositories';
import type { Measurement } from '../src/db/schema';
import { useTheme } from '../src/theme';
import { formatWorkoutDay, parseUserNumber, trimNumber } from '../src/components/workout/format';
import { Button, Card, EmptyState, NumberInput, ScreenHeader } from '../src/components/workout/ui';

interface MetricPreset {
  type: string;
  label: string;
  unit: string;
}

const PRESETS: MetricPreset[] = [
  { type: 'body_weight', label: 'Body weight', unit: 'kg' },
  { type: 'waist', label: 'Waist', unit: 'cm' },
  { type: 'chest', label: 'Chest', unit: 'cm' },
  { type: 'body_fat_pct', label: 'Body fat', unit: '%' },
  { type: 'resting_hr', label: 'Resting HR', unit: 'bpm' },
];

const CUSTOM = '__custom';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40);
}

function TrendStrip({ entries, unit }: { entries: Measurement[]; unit: string }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  // entries arrive newest-first; display oldest-first.
  const last = entries.slice(0, 10).reverse();
  if (last.length < 2) return <></>;
  const values = last.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
        LAST {last.length} · {unit}
      </Text>
      <View style={[styles.strip, { height: 56 }]}>
        {last.map((e) => (
          <View
            key={e.id}
            style={[
              styles.bar,
              {
                height: 8 + (40 * (e.value - min)) / span,
                backgroundColor: theme.colors.muted,
                borderRadius: theme.radius.sm,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function EntryRow({
  entry,
  unit,
  onEdit,
  onDelete,
}: {
  entry: Measurement;
  unit: string;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.colors.border, paddingVertical: theme.spacing.sm },
      ]}
    >
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Edit entry ${trimNumber(entry.value)} ${unit}`}
        style={({ pressed }) => [styles.rowText, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
          {trimNumber(entry.value)} {unit}
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          {formatWorkoutDay(new Date(entry.measuredAt))}
          {entry.notes ? ` · ${entry.notes}` : ''}
        </Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete entry"
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
      >
        <Text style={{ color: theme.colors.danger, fontSize: t.size.body }}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function MeasureScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;

  const [selected, setSelected] = useState<string>(PRESETS[0].type);
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [valueStr, setValueStr] = useState('');
  const [notesStr, setNotesStr] = useState('');
  const [entries, setEntries] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Measurement | null>(null);

  const isCustom = selected === CUSTOM;
  const preset = PRESETS.find((p) => p.type === selected);
  const activeType = isCustom ? slugify(customName) : selected;
  const activeUnit = isCustom ? customUnit.trim() : (preset?.unit ?? '');
  const activeLabel = isCustom ? customName.trim() || 'Custom' : (preset?.label ?? '');

  const load = useCallback(async () => {
    if (!activeType) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEntries(await listMeasurements(activeType));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useFocusEffect(
    useCallback(() => {
      setEditing(null);
      setError(null);
      void load();
    }, [load]),
  );

  const startEdit = (entry: Measurement) => {
    setEditing(entry);
    setValueStr(String(entry.value));
    setNotesStr(entry.notes ?? '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setValueStr('');
    setNotesStr('');
    setError(null);
  };

  const save = async () => {
    setError(null);
    if (!activeType) {
      setError('Name your custom metric first.');
      return;
    }
    if (!activeUnit) {
      setError('Add a unit (e.g. kg, cm, %).');
      return;
    }
    const value = parseUserNumber(valueStr);
    if (value === undefined || !Number.isFinite(value) || value <= 0) {
      setError('Enter a valid positive number.');
      return;
    }
    if (selected === 'body_fat_pct' && value > 100) {
      setError('Body fat % can\u2019t exceed 100.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        // Edit = tombstone the old row, log a fresh one with the original
        // timestamp. History stays append-only; nothing is rewritten.
        await softDeleteMeasurement(editing.id);
        await logMeasurement({
          type: editing.type,
          value,
          unit: editing.unit,
          measuredAt: new Date(editing.measuredAt),
          notes: notesStr.trim() || undefined,
        });
      } else {
        await logMeasurement({
          type: activeType,
          value,
          unit: activeUnit,
          notes: notesStr.trim() || undefined,
        });
      }
      cancelEdit();
      await load();
    } catch {
      setError('Couldn\u2019t save — try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (entry: Measurement) => {
    Alert.alert(
      'Delete entry?',
      `${trimNumber(entry.value)} ${entry.unit} — this can\u2019t be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await softDeleteMeasurement(entry.id);
              if (editing?.id === entry.id) cancelEdit();
              await load();
            })();
          },
        },
      ],
    );
  };

  const latest = entries[0];
  const previous = entries[1];
  const delta =
    latest && previous ? latest.value - previous.value : undefined;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="Measurements" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.xl,
          gap: theme.spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.type}
                onPress={() => {
                  setSelected(p.type);
                  cancelEdit();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === p.type }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected === p.type ? theme.colors.text : theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    paddingVertical: theme.spacing.xs,
                    paddingHorizontal: theme.spacing.sm,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected === p.type ? theme.colors.background : theme.colors.text,
                    fontSize: t.size.body,
                    fontWeight: t.weight.medium,
                  }}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setSelected(CUSTOM);
                cancelEdit();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isCustom }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isCustom ? theme.colors.text : theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  paddingVertical: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: isCustom ? theme.colors.background : theme.colors.text,
                  fontSize: t.size.body,
                  fontWeight: t.weight.medium,
                }}
              >
                + Custom
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {isCustom ? (
          <Card>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="Metric name (e.g. Neck)"
              placeholderTextColor={theme.colors.faint}
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  fontSize: t.size.body,
                },
              ]}
            />
            <TextInput
              value={customUnit}
              onChangeText={setCustomUnit}
              placeholder="Unit (e.g. cm)"
              placeholderTextColor={theme.colors.faint}
              autoCapitalize="none"
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  fontSize: t.size.body,
                },
              ]}
            />
          </Card>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.muted} />
          </View>
        ) : (
          <>
            {latest ? (
              <Card>
                <View style={styles.statsRow}>
                  <View style={styles.statCell}>
                    <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>LATEST</Text>
                    <Text style={{ color: theme.colors.text, fontSize: t.size.title, fontWeight: t.weight.bold }}>
                      {trimNumber(latest.value)} {latest.unit}
                    </Text>
                    <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                      {formatWorkoutDay(new Date(latest.measuredAt))}
                    </Text>
                  </View>
                  {delta !== undefined && previous ? (
                    <View style={styles.statCell}>
                      <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>CHANGE</Text>
                      <Text style={{ color: theme.colors.muted, fontSize: t.size.title, fontWeight: t.weight.bold }}>
                        {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'}
                        {delta !== 0 ? ` ${trimNumber(Math.abs(delta))}` : ''}
                      </Text>
                      <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                        vs {formatWorkoutDay(new Date(previous.measuredAt))}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <TrendStrip entries={entries} unit={latest.unit} />
              </Card>
            ) : null}

            <Card>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
                {(editing ? 'EDIT ENTRY' : 'LOG') + ` · ${activeLabel.toUpperCase()}`}
              </Text>
              <View style={styles.logRow}>
                <NumberInput
                  value={valueStr}
                  onChangeText={setValueStr}
                  placeholder="0"
                  decimal
                  width={110}
                  label={activeUnit || 'value'}
                />
                <View style={{ flex: 1 }}>
                  <Button
                    title={editing ? 'Save changes' : `Log ${activeLabel.toLowerCase()}`}
                    onPress={() => void save()}
                    busy={saving}
                    disabled={saving}
                  />
                </View>
              </View>
              <TextInput
                value={notesStr}
                onChangeText={setNotesStr}
                placeholder="Notes (optional)"
                placeholderTextColor={theme.colors.faint}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.sm,
                    padding: theme.spacing.sm,
                    fontSize: t.size.body,
                  },
                ]}
              />
              {editing ? (
                <Button title="Cancel edit" variant="secondary" onPress={cancelEdit} />
              ) : null}
              {error ? (
                <Text style={{ color: theme.colors.danger, fontSize: t.size.body }}>{error}</Text>
              ) : null}
            </Card>

            {entries.length > 0 ? (
              <View>
                <Text
                  style={{
                    color: theme.colors.muted,
                    fontSize: t.size.caption,
                    fontWeight: t.weight.medium,
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  HISTORY
                </Text>
                {entries.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    unit={e.unit}
                    onEdit={() => startEdit(e)}
                    onDelete={() => confirmDelete(e)}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                message={`No ${activeLabel.toLowerCase()} entries yet.`}
                hint="Log your first one above — it stays on this device only."
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  chip: {
    borderWidth: 1,
  },
  textInput: {
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCell: {
    flex: 1,
    gap: 2,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bar: {
    flex: 1,
    minWidth: 8,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
