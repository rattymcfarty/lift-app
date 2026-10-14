/**
 * Longevity pillars — weekly check-in for the non-lifting pillars.
 *
 * v1 model: strength (automatic, from your training) + cardio (manual
 * minutes — log a run, ride, swim, or walk here). Mobility and balance
 * tracking arrives in a later update.
 *
 * Cardio target: 150 min/week of moderate activity (WHO guideline).
 * Strength target: 2+ strength sessions/week.
 */
import { useCallback, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  cardioMinutesInRange,
  listCardioLogs,
  logCardio,
  softDeleteCardioLog,
  type CardioLog,
} from '../src/data/cardio';
import { fetchStatWorkouts } from '../src/stats/queries';
import { startOfWeekMonday } from '../src/stats/volume';
import {
  cardioPillar,
  cardioWorkoutMinutes,
  strengthPillar,
  strengthSessions,
  type PillarStatus,
} from '../src/stats/pillars';
import { useTheme } from '../src/theme';
import { Button, Card, ScreenHeader } from '../src/components/workout/ui';

const QUICK_MINUTES = [15, 30, 45, 60];

function stateColor(state: PillarStatus['state'], theme: ReturnType<typeof useTheme>['theme']): string {
  switch (state) {
    case 'met': return theme.colors.success; // confirmation — target hit
    case 'progress': return theme.colors.muted; // neutral, not warning (not safety messaging)
    default: return theme.colors.faint;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function PillarsScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [loading, setLoading] = useState(true);
  const [strength, setStrength] = useState<PillarStatus | null>(null);
  const [cardio, setCardio] = useState<PillarStatus | null>(null);
  const [logs, setLogs] = useState<CardioLog[]>([]);
  const [customMin, setCustomMin] = useState('');
  const [customActivity, setCustomActivity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref guard against double-tap: state lags a render, the ref doesn't.
  const savingRef = useRef(false);
  // Stale-response guard (same pattern as the dashboard): rapid refocuses
  // must not let an older load overwrite a newer one.
  const loadIdRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const loadId = ++loadIdRef.current;
    const alive = () => loadIdRef.current === loadId;
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      // One clock read for the whole window — weekStart and end come from
      // the same instant so a midnight boundary can't invert the range.
      // The window ends at the end of the week (not "now") so logs with
      // near-future timestamps (clock skew, restores) aren't excluded.
      const now = new Date();
      const weekStart = startOfWeekMonday(now);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const [workouts, minutes, recent] = await Promise.all([
        fetchStatWorkouts(weekStart, now),
        cardioMinutesInRange(weekStart, weekEnd),
        listCardioLogs(10),
      ]);
      if (!alive()) return;
      // Strength sessions: workouts with ≥1 completed strength-category set.
      // Cardio minutes: manual logs + cardio-workout set durations.
      const strengthSessionsCount = strengthSessions(workouts);
      const totalCardio = minutes + cardioWorkoutMinutes(workouts);
      setStrength(strengthPillar(strengthSessionsCount));
      setCardio(cardioPillar(totalCardio));
      setLogs(recent);
    } catch (e) {
      if (!alive()) return;
      setError(e instanceof Error ? e.message : 'Could not load pillars.');
    } finally {
      if (alive()) setLoading(false);
    }
  }, []);

  // First focus shows the full spinner; refocuses refresh quietly so a
  // half-typed custom-minutes form isn't wiped by a spinner.
  const firstLoadRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      const isFirst = firstLoadRef.current;
      firstLoadRef.current = false;
      void load(!isFirst);
    }, [load]),
  );

  const quickLog = useCallback(async (minutes: number, activity?: string): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await logCardio({ minutes, activity });
      await load(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [load]);

  const logCustom = useCallback(async () => {
    // Strict: the whole input must be digits — parseInt would accept "30abc".
    const trimmed = customMin.trim();
    const minutes = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      setError('Enter minutes between 1 and 1440.');
      return;
    }
    const activity = customActivity.trim() || undefined;
    // Clear inputs only on success — a failed save keeps what was typed.
    if (await quickLog(minutes, activity)) {
      setCustomMin('');
      setCustomActivity('');
    }
  }, [customMin, customActivity, quickLog]);

  const remove = useCallback((id: string, label: string) => {
    Alert.alert(
      'Delete cardio log?',
      `${label} — this removes it from your totals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await softDeleteCardioLog(id);
              await load(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not delete.');
            }
          },
        },
      ],
    );
  }, [load]);

  function pillarCard(p: PillarStatus, hint: string): JSX.Element {
    const color = stateColor(p.state, theme);
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.text, fontSize: t.size.card, fontWeight: t.weight.bold }}>
            {p.label}
          </Text>
          <Text style={{ color, fontSize: t.size.body, fontWeight: t.weight.bold }}>
            {p.summary}
          </Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.border, marginTop: theme.spacing.sm, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(p.progress * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
        </View>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, marginTop: theme.spacing.xs }}>
          {hint}
        </Text>
      </Card>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <ScreenHeader title="Longevity pillars" onBack={() => router.back()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          {error ? (
            <Text style={{ color: theme.colors.danger, fontSize: t.size.body }}>{error}</Text>
          ) : null}
          {strength ? pillarCard(strength, 'Strength sessions this week. 2+ keeps muscle with age.') : null}
          {cardio ? pillarCard(cardio, 'Moderate cardio minutes this week, including logged cardio workouts. Target 150 (WHO). Log a session once — here or as a workout, not both.') : null}

          <Card>
            <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, marginBottom: theme.spacing.sm }}>
              LOG CARDIO
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {QUICK_MINUTES.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => quickLog(m)}
                  disabled={saving}
                  style={{
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: 8,
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
                    +{m} min
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <TextInput
                value={customMin}
                onChangeText={setCustomMin}
                placeholder="Minutes"
                placeholderTextColor={theme.colors.faint}
                keyboardType="number-pad"
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.sm,
                  color: theme.colors.text,
                  fontSize: t.size.body,
                }}
              />
              <TextInput
                value={customActivity}
                onChangeText={setCustomActivity}
                placeholder="Activity (optional)"
                placeholderTextColor={theme.colors.faint}
                style={{
                  flex: 2,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.sm,
                  color: theme.colors.text,
                  fontSize: t.size.body,
                }}
              />
            </View>
            <View style={{ marginTop: theme.spacing.sm }}>
              <Button title={saving ? 'Saving…' : 'Log cardio'} onPress={logCustom} disabled={saving} />
            </View>
          </Card>

          {logs.length > 0 ? (
            <Card>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, marginBottom: theme.spacing.sm }}>
                RECENT
              </Text>
              {logs.map((l, i) => (
                <View
                  key={l.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.xs,
                    borderBottomColor: theme.colors.border,
                    borderBottomWidth: i === logs.length - 1 ? 0 : 1,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
                      {l.minutes} min{l.activity ? ` · ${l.activity}` : ''}
                    </Text>
                    <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
                      {formatDate(new Date(l.loggedAt))}
                    </Text>
                  </View>
                  <Pressable onPress={() => remove(l.id, `${l.minutes} min${l.activity ? ` · ${l.activity}` : ''}`)} hitSlop={12}>
                    <Text style={{ color: theme.colors.danger, fontSize: t.size.body }}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : null}

          <Card>
            <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
              MOBILITY · BALANCE
            </Text>
            <Text style={{ color: theme.colors.faint, fontSize: t.size.body, marginTop: theme.spacing.xs }}>
              Mobility and balance tracking arrives in a future update.
            </Text>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
