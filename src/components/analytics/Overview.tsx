/**
 * Analytics overview — "Lifetime" and "This Week" stat triplets (big blue
 * numbers in an inset pill), Latest PRs, and links to the deeper views.
 * Loads its own data so it can sit at the top of the Analytics scroll.
 */
import { useCallback, useState, type JSX } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme';
import { fetchStatWorkouts, getDashboardStats } from '../../stats/queries';
import { startOfWeekMonday, workoutVolume } from '../../stats/volume';
import { listPRsWithExercises, type PRWithExercise } from '../../data/repositories';
import { getSettings, type WeightUnit } from '../../data/settings';
import { kgToLb } from '../../lib/units';
import { prKindLabel } from '../dashboard/prLabels';
import { trimNumber } from '../workout/format';
import { Card } from '../workout/ui';

interface Totals {
  workouts: number;
  volumeKg: number;
  records: number;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${trimNumber(Math.round(n / 100_000) / 10)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${trimNumber(Math.round(n / 100) / 10)}k`;
  return trimNumber(Math.round(n));
}

function StatTriplet({ items }: { items: ReadonlyArray<{ value: string; label: string }> }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.lg,
        paddingVertical: theme.spacing.md,
      }}
    >
      {items.map((it, i) => (
        <View
          key={it.label}
          style={{
            flex: 1,
            alignItems: 'center',
            gap: theme.spacing.xs,
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: theme.colors.border,
            paddingHorizontal: theme.spacing.xs,
          }}
        >
          <Text
            style={{ color: theme.colors.highlight, fontSize: t.size.section, fontWeight: t.weight.bold }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {it.value}
          </Text>
          <Text
            style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ children }: { children: string }): JSX.Element {
  const { theme } = useTheme();
  return (
    <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.section, fontWeight: theme.typography.weight.bold }}>
      {children}
    </Text>
  );
}

function LinkRow({ label, to, last, testID }: { label: string; to: string; last?: boolean; testID?: string }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(to as never)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ flex: 1, color: theme.colors.text, fontSize: t.size.row, fontWeight: t.weight.medium }}>{label}</Text>
      <Text style={{ color: theme.colors.faint, fontSize: t.size.body }}>›</Text>
    </Pressable>
  );
}

export function AnalyticsOverview(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const [life, setLife] = useState<Totals>({ workouts: 0, volumeKg: 0, records: 0 });
  const [week, setWeek] = useState<Totals>({ workouts: 0, volumeKg: 0, records: 0 });
  const [latest, setLatest] = useState<PRWithExercise[]>([]);
  const [unit, setUnit] = useState<WeightUnit>('kg');

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const weekStart = startOfWeekMonday(now);
      const [stats, all, prs, settings] = await Promise.all([
        getDashboardStats(now),
        fetchStatWorkouts(new Date(0), now),
        listPRsWithExercises(),
        getSettings(),
      ]);
      setUnit(settings.weightUnit);
      setLife({
        workouts: stats.totalWorkouts,
        volumeKg: all.reduce((sum, w) => sum + workoutVolume(w), 0),
        records: prs.length,
      });
      setWeek({
        workouts: stats.thisWeekWorkouts,
        volumeKg: stats.thisWeekVolumeKg,
        records: prs.filter((p) => p.achievedAt >= weekStart).length,
      });
      setLatest(prs.slice(0, 3));
    } catch (e) {
      console.warn('[analytics] overview failed', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const vol = (kg: number): string => compact(unit === 'lb' ? kgToLb(kg) : kg);
  const lifted = `Lifted (${unit})`;

  return (
    <View style={{ gap: theme.spacing.md, paddingHorizontal: theme.spacing.md }}>
      <SectionTitle>Lifetime</SectionTitle>
      <Card>
        <StatTriplet
          items={[
            { value: String(life.workouts), label: 'Workouts' },
            { value: vol(life.volumeKg), label: lifted },
            { value: String(life.records), label: 'Records' },
          ]}
        />
      </Card>

      <SectionTitle>This Week</SectionTitle>
      <Card>
        <StatTriplet
          items={[
            { value: String(week.workouts), label: 'Workouts' },
            { value: vol(week.volumeKg), label: lifted },
            { value: String(week.records), label: 'Records' },
          ]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.xs }}>
          <Text style={{ flex: 1, color: c.muted, fontSize: t.size.body, fontWeight: t.weight.medium }}>Latest PRs</Text>
          <Pressable onPress={() => router.push('/prs')} accessibilityRole="button" hitSlop={8} testID="analytics-view-prs">
            <Text style={{ color: c.text, fontSize: t.size.body }}>View All ›</Text>
          </Pressable>
        </View>
        {latest.length === 0 ? (
          <Text style={{ color: c.faint, fontSize: t.size.caption }}>
            Beat your best on a set and it lands here automatically.
          </Text>
        ) : (
          latest.map((pr) => (
            <View key={pr.id} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: t.size.row, fontWeight: t.weight.medium }} numberOfLines={1}>
                  {pr.exerciseName}
                </Text>
                <Text style={{ color: c.faint, fontSize: t.size.caption }} numberOfLines={1}>
                  {prKindLabel(pr.kind)}
                </Text>
              </View>
              <Text style={{ color: c.text, fontSize: t.size.row }}>
                {trimNumber(Math.round(pr.value * 10) / 10)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <SectionTitle>Insights</SectionTitle>
      <Card>
        <LinkRow label="Muscle balance" to="/balance" testID="analytics-balance" />
        <LinkRow label="Longevity pillars" to="/pillars" />
        <LinkRow label="Personal records" to="/prs" />
        <LinkRow label="Measurements" to="/measure" last />
      </Card>

      <SectionTitle>Trends</SectionTitle>
    </View>
  );
}
