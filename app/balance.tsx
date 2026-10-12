/**
 * Muscle balance — where your training volume actually goes.
 *
 * Per-muscle-group volume bars (last 12 weeks), push/pull and upper/lower
 * ratios, and plain-language imbalance flags with longevity-grounded
 * guidance. Balanced musculature prevents injury and preserves function
 * with age — this screen makes the gaps visible.
 */
import { useCallback, useRef, useState, type JSX } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyzeBalance, type BalanceFlag, type BalanceReport } from '../src/stats/balance';
import { fetchStatWorkouts } from '../src/stats/queries';
import { startOfWeekMonday } from '../src/stats/volume';
import { useTheme } from '../src/theme';
import { Button, Card, EmptyState, ScreenHeader } from '../src/components/workout/ui';

const WEEKS = 12;

function flagColor(flag: BalanceFlag, theme: ReturnType<typeof useTheme>['theme']): string {
  // Watch = safety messaging (warning is appropriate). Info = neutral text,
  // never success teal (that's for confirmations, not decoration).
  return flag.severity === 'watch' ? theme.colors.warning : theme.colors.text;
}

function ratioLabel(r: { a: number; b: number; aSets: number; bSets: number; ratio: number | null; basis: 'volume' | 'sets' | 'none' }, aLabel: string, bLabel: string): string {
  // ratio is null exactly when a side has neither volume nor sets.
  // Use set counts too — bodyweight-only work (push-ups) has sets but 0 kg.
  if (r.ratio === null) {
    const aTrained = r.a > 0 || r.aSets > 0;
    const bTrained = r.b > 0 || r.bSets > 0;
    if (aTrained && !bTrained) return `All ${aLabel.toLowerCase()}`;
    if (bTrained && !aTrained) return `All ${bLabel.toLowerCase()}`;
    return 'No data';
  }
  const label = `${r.ratio.toFixed(2)} : 1`;
  // When the ratio fell back to set counts (bodyweight-only side), say so —
  // the kg figures above don't tell that story.
  return r.basis === 'sets' ? `${label} (by sets)` : label;
}

function GroupBar({ group, share, volumeKg, sets, maxShare, theme, t }: {
  group: string;
  share: number;
  volumeKg: number;
  sets: number;
  maxShare: number;
  theme: ReturnType<typeof useTheme>['theme'];
  t: ReturnType<typeof useTheme>['theme']['typography'];
}): JSX.Element {
  const label = group === 'other' ? 'Other' : group.charAt(0).toUpperCase() + group.slice(1);
  // Bodyweight-only groups have sets but 0 kg — show the set count.
  const detail = volumeKg > 0 ? `${volumeKg.toLocaleString()} kg` : `${sets} sets`;
  return (
    <View style={{ marginBottom: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>{label}</Text>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
          {Math.round(share * 100)}% · {detail}
        </Text>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
        <View
          style={{
            width: `${maxShare > 0 ? Math.round((share / maxShare) * 100) : 0}%`,
            height: '100%',
            backgroundColor: theme.colors.muted,
            borderRadius: 5,
          }}
        />
      </View>
    </View>
  );
}

export default function BalanceScreen(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<BalanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Stale-response guard (same pattern as the dashboard): rapid refocuses
  // must not let an older load overwrite a newer one.
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const alive = () => loadIdRef.current === loadId;
    setLoading(true);
    setError(null);
    try {
      // Monday-aligned buckets, same as the Progress muscle chart.
      const end = startOfWeekMonday(new Date());
      end.setDate(end.getDate() + 7);
      const start = new Date(end);
      start.setDate(start.getDate() - WEEKS * 7);
      const workouts = await fetchStatWorkouts(start, end);
      if (!alive()) return;
      setReport(analyzeBalance(workouts));
    } catch (e) {
      if (!alive()) return;
      setError(e instanceof Error ? e.message : 'Could not load balance.');
    } finally {
      if (alive()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const maxShare = report ? Math.max(...report.byGroup.map((g) => g.share), 0.001) : 0.001;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <ScreenHeader title="Muscle balance" onBack={() => router.back()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ flex: 1, padding: theme.spacing.md }}>
          <Text style={{ color: theme.colors.danger }}>{error}</Text>
          <Button title="Retry" onPress={load} />
        </View>
      ) : report && report.grandTotalKg === 0 && report.totalSets === 0 ? (
        <View style={{ flex: 1, padding: theme.spacing.md }}>
          <EmptyState
            message="No training data yet."
            hint="Log workouts for a few weeks and this screen will show where your volume goes."
          />
          <Button title="Start workout" onPress={() => router.push('/workout/new')} />
        </View>
      ) : report ? (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          <Card>
            <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, marginBottom: theme.spacing.sm }}>
              VOLUME BY MUSCLE · LAST {WEEKS} WEEKS
            </Text>
            <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, marginBottom: theme.spacing.sm }}>
              Each set is credited to every primary muscle it works — shares compare muscles, not total tonnage.
            </Text>
            {report.byGroup.map((g) => (
              <GroupBar
                key={g.group}
                group={g.group}
                share={g.share}
                volumeKg={g.volumeKg}
                sets={g.sets}
                maxShare={maxShare}
                theme={theme}
                t={t}
              />
            ))}
          </Card>

          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Card>
                <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>PUSH / PULL</Text>
                <Text style={{ color: theme.colors.text, fontSize: t.size.title, fontWeight: t.weight.bold, marginTop: 4 }}>
                  {ratioLabel(report.pushPull, 'Push', 'Pull')}
                </Text>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, marginTop: 4 }}>
                  Aim near 1 : 1
                </Text>
              </Card>
            </View>
            <View style={{ flex: 1 }}>
              <Card>
                <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>UPPER / LOWER</Text>
                <Text style={{ color: theme.colors.text, fontSize: t.size.title, fontWeight: t.weight.bold, marginTop: 4 }}>
                  {ratioLabel(report.upperLower, 'Upper', 'Lower')}
                </Text>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, marginTop: 4 }}>
                  Legs carry you for life
                </Text>
              </Card>
            </View>
          </View>

          {report.flags.length > 0 ? (
            <Card>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, marginBottom: theme.spacing.sm }}>
                INSIGHTS
              </Text>
              {report.flags.map((f, fi) => (
                <View
                  key={`${f.kind}-${f.title}`}
                  style={{
                    paddingVertical: theme.spacing.sm,
                    borderBottomColor: theme.colors.border,
                    borderBottomWidth: fi === report.flags.length - 1 ? 0 : 1,
                  }}
                >
                  <Text style={{ color: flagColor(f, theme), fontSize: t.size.body, fontWeight: t.weight.bold }}>
                    {f.title}
                  </Text>
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.body, marginTop: 2 }}>
                    {f.guidance}
                  </Text>
                </View>
              ))}
            </Card>
          ) : !report.flagsEvaluated ? (
            <Card>
              <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
                Not enough data yet
              </Text>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, marginTop: 4 }}>
                Imbalance insights need at least 4 strength workouts. Keep logging — this checks
                push/pull, upper/lower, and neglected groups.
              </Text>
            </Card>
          ) : (
            <Card>
              <Text style={{ color: theme.colors.success, fontSize: t.size.body, fontWeight: t.weight.medium }}>
                Balanced training — no meaningful imbalances detected.
              </Text>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, marginTop: 4 }}>
                Keep it up. This checks push/pull, upper/lower, and neglected groups.
              </Text>
            </Card>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
