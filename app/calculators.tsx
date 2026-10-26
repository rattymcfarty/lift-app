/**
 * Calculators — 1RM estimator and plate loader.
 *
 * Pure math lives in src/lib/calculators.ts (unit-tested); this screen is
 * presentation only. No network.
 *
 * Both cards are seeded from what the user last trained with (`getLastWorkingWeightKg`)
 * and the saved bar weight, so the answers are on screen the moment it opens instead
 * of an empty form that looks inert. Every field is a scroll wheel (the app's default
 * numeric entry) in the user's own unit; the old screen-local kg/lb toggle is gone —
 * the unit comes from Settings, like the rest of the app.
 */
import { useEffect, useState, type JSX } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import {
  calculatePlates,
  estimateOneRepMax,
} from '../src/lib/calculators';
import { parseUserInt, parseUserNumber, trimNumber } from '../src/components/workout/format';
import { Card, EmptyState, ScreenHeader } from '../src/components/workout/ui';
import { WheelNumberField } from '../src/components/ui/WheelNumberField';
import { barItems, countItems, weightItems, type Unit } from '../src/components/ui/wheelRanges';
import { getLastWorkingSet } from '../src/data/repositories';
import { getSettings } from '../src/data/settings';
import { kgToLb, lbToKg } from '../src/lib/units';
import { useTabBarSpace } from '../src/components/nav/TabBar';

const PERCENTAGES = [100, 95, 90, 85, 80, 75, 70];

/** kg → the number shown in the user's unit. */
function displayWeight(kg: number, unit: Unit): string {
  return trimNumber(unit === 'kg' ? kg : kgToLb(kg));
}

function SectionTitle({ children }: { children: string }): JSX.Element {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.muted,
        fontSize: theme.typography.size.caption,
        fontWeight: theme.typography.weight.medium,
        letterSpacing: 1,
      }}
    >
      {children.toUpperCase()}
    </Text>
  );
}

function OneRepMaxSection({
  unit,
  initialWeight,
  initialReps,
}: {
  unit: Unit;
  initialWeight: string | null;
  initialReps: string | null;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [weightStr, setWeightStr] = useState(initialWeight ?? '');
  const [repsStr, setRepsStr] = useState(initialReps ?? '5');

  const shownWeight = parseUserNumber(weightStr);
  const reps = parseUserInt(repsStr);
  // The estimator works in kg; the field shows the user's unit.
  const weightKg = shownWeight !== undefined ? (unit === 'kg' ? shownWeight : lbToKg(shownWeight)) : undefined;
  const estimate =
    weightKg !== undefined && reps !== undefined ? estimateOneRepMax(weightKg, reps) : undefined;

  const show = (kg: number): string =>
    `${trimNumber(unit === 'kg' ? kg : kgToLb(kg))} ${unit}`;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle>One-rep max estimator</SectionTitle>
      <Card>
        <View style={styles.inputRow}>
          <WheelNumberField
            testID="calc-1rm-weight"
            label={`weight (${unit})`}
            value={weightStr}
            onChangeText={setWeightStr}
            items={weightItems(unit)}
            unit={unit}
            placeholder={unit === 'kg' ? '60' : '135'}
            decimal
          />
          <WheelNumberField
            testID="calc-1rm-reps"
            label="reps"
            value={repsStr}
            onChangeText={setRepsStr}
            items={countItems(1, 36)}
            placeholder="5"
          />
        </View>
        {estimate ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <View style={styles.resultRow}>
              <View style={styles.resultCell}>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>EPLEY</Text>
                <Text style={{ color: theme.colors.text, fontSize: t.size.section, fontWeight: t.weight.bold }}>
                  {show(estimate.epley)}
                </Text>
              </View>
              <View style={styles.resultCell}>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>BRZYCKI</Text>
                <Text style={{ color: theme.colors.text, fontSize: t.size.section, fontWeight: t.weight.bold }}>
                  {show(estimate.brzycki)}
                </Text>
              </View>
            </View>
            {reps !== undefined && reps > 12 ? (
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                Estimates get unreliable past ~12 reps — test with a heavier set for a
                better number.
              </Text>
            ) : null}
            <View style={{ gap: 4 }}>
              {PERCENTAGES.map((pct) => (
                <View key={pct} style={styles.pctRow}>
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, minWidth: 44 }}>
                    {pct}%
                  </Text>
                  <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
                    {show((estimate.epley * pct) / 100)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ color: theme.colors.faint, fontSize: t.size.caption, marginTop: theme.spacing.sm }}>
            Pick a weight and reps to estimate your max.
          </Text>
        )}
      </Card>
    </View>
  );
}

function PlateSection({ unit, initialTarget, initialBar }: { unit: Unit; initialTarget: string | null; initialBar: string | null }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [targetStr, setTargetStr] = useState(initialTarget ?? '');
  const [barStr, setBarStr] = useState(initialBar ?? '');

  const target = parseUserNumber(targetStr);
  const bar = parseUserNumber(barStr);
  const outcome =
    target !== undefined && bar !== undefined ? calculatePlates(target, unit, bar) : undefined;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle>Plate calculator</SectionTitle>
      <Card>
        <View style={styles.inputRow}>
          <WheelNumberField
            testID="calc-plate-target"
            label={`target (${unit})`}
            value={targetStr}
            onChangeText={setTargetStr}
            items={weightItems(unit)}
            unit={unit}
            placeholder={unit === 'kg' ? '100' : '225'}
            decimal
          />
          <WheelNumberField
            testID="calc-plate-bar"
            label={`bar (${unit})`}
            value={barStr}
            onChangeText={setBarStr}
            items={barItems(unit)}
            unit={unit}
            placeholder={unit === 'kg' ? '20' : '45'}
            decimal
          />
        </View>
        <View style={{ marginTop: theme.spacing.sm }}>
          {outcome === undefined ? (
            <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
              Pick a target weight to see the plates per side.
            </Text>
          ) : !outcome.ok ? (
            <Text style={{ color: theme.colors.danger, fontSize: t.size.body }}>
              {outcome.reason === 'below-bar'
                ? 'Target is below the bar weight.'
                : 'Enter a valid target weight.'}
            </Text>
          ) : outcome.result.perSide.length === 0 ? (
            <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
              Just the bar — no plates needed.
            </Text>
          ) : (
            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>PER SIDE</Text>
              {outcome.result.perSide.map((pl) => (
                <View key={pl.plate} style={styles.pctRow}>
                  <Text style={{ color: theme.colors.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
                    {pl.count} × {trimNumber(pl.plate)} {unit}
                  </Text>
                </View>
              ))}
              <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
                Loaded: {trimNumber(outcome.result.achievedTotal)} {unit}
                {outcome.result.remainder > 0
                  ? ` — closest below target (off by ${trimNumber(outcome.result.remainder)} ${unit} per side)`
                  : ''}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </View>
  );
}

export default function CalculatorsScreen(): JSX.Element {
  const tabBarSpace = useTabBarSpace();
  const { theme } = useTheme();
  const [unit, setUnit] = useState<Unit>('kg');
  const [seedWeight, setSeedWeight] = useState<string | null>(null);
  const [seedReps, setSeedReps] = useState<string | null>(null);
  const [seedBar, setSeedBar] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getSettings(), getLastWorkingSet()]).then(([settings, last]) => {
      setUnit(settings.weightUnit);
      setSeedWeight(last ? displayWeight(last.weightKg, settings.weightUnit) : null);
      setSeedReps(last?.reps != null ? String(last.reps) : null);
      setSeedBar(displayWeight(settings.barWeightKg, settings.weightUnit));
    });
  }, []);

  // `key` remounts the sections once the seed arrives, so their initial state is
  // the real number (and a later unit change re-seeds in that unit).
  const seedKey = `${unit}:${seedWeight ?? ''}:${seedReps ?? ''}:${seedBar ?? ''}`;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="Calculators" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.xl + tabBarSpace,
          gap: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <OneRepMaxSection key={`1rm-${seedKey}`} unit={unit} initialWeight={seedWeight} initialReps={seedReps} />
        <PlateSection key={`plate-${seedKey}`} unit={unit} initialTarget={seedWeight} initialBar={seedBar} />
        <EmptyState
          message="Estimates, not prescriptions."
          hint="1RM formulas and plate math stay on this device — same as everything else."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  resultRow: {
    flexDirection: 'row',
    gap: 16,
  },
  resultCell: {
    flex: 1,
    gap: 2,
  },
  pctRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
});
