/**
 * Calculators — 1RM estimator and plate loader.
 *
 * Pure math lives in src/lib/calculators.ts (unit-tested); this screen is
 * presentation only. No database, no network.
 */

import { useState, type JSX } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import {
  calculatePlates,
  estimateOneRepMax,
  type PlateUnit,
} from '../src/lib/calculators';
import { parseUserInt, parseUserNumber, trimNumber } from '../src/components/workout/format';
import { Button, Card, EmptyState, NumberInput, ScreenHeader } from '../src/components/workout/ui';

const PERCENTAGES = [100, 95, 90, 85, 80, 75, 70];

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

function OneRepMaxSection(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [weightStr, setWeightStr] = useState('');
  const [repsStr, setRepsStr] = useState('');

  const weight = parseUserNumber(weightStr);
  const reps = parseUserInt(repsStr);
  const estimate =
    weight !== undefined && reps !== undefined
      ? estimateOneRepMax(weight, reps)
      : undefined;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle>One-rep max estimator</SectionTitle>
      <Card>
        <View style={styles.inputRow}>
          <NumberInput
            value={weightStr}
            onChangeText={setWeightStr}
            placeholder="100"
            decimal
            width={96}
            label="weight (kg)"
          />
          <NumberInput
            value={repsStr}
            onChangeText={setRepsStr}
            placeholder="5"
            width={96}
            label="reps"
          />
        </View>
        {estimate ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View style={styles.resultRow}>
              <View style={styles.resultCell}>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>EPLEY</Text>
                <Text style={{ color: theme.colors.text, fontSize: t.size.title, fontWeight: t.weight.bold }}>
                  {trimNumber(estimate.epley)} kg
                </Text>
              </View>
              <View style={styles.resultCell}>
                <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>BRZYCKI</Text>
                <Text style={{ color: theme.colors.text, fontSize: t.size.title, fontWeight: t.weight.bold }}>
                  {trimNumber(estimate.brzycki)} kg
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
                  <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, width: 44 }}>
                    {pct}%
                  </Text>
                  <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
                    {trimNumber((estimate.epley * pct) / 100)} kg
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
            Enter a weight and reps to estimate your max.
          </Text>
        )}
      </Card>
    </View>
  );
}

function PlateSection(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [targetStr, setTargetStr] = useState('');
  const [unit, setUnit] = useState<PlateUnit>('kg');
  const [barStr, setBarStr] = useState('20');

  const target = parseUserNumber(targetStr);
  const bar = parseUserNumber(barStr);
  const outcome =
    target !== undefined && bar !== undefined
      ? calculatePlates(target, unit, bar)
      : undefined;

  const switchUnit = (u: PlateUnit) => {
    setUnit(u);
    setBarStr(u === 'kg' ? '20' : '45');
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle>Plate calculator</SectionTitle>
      <Card>
        <View style={styles.inputRow}>
          <NumberInput
            value={targetStr}
            onChangeText={setTargetStr}
            placeholder={unit === 'kg' ? '100' : '225'}
            decimal
            width={96}
            label={`target (${unit})`}
          />
          <NumberInput
            value={barStr}
            onChangeText={setBarStr}
            placeholder={unit === 'kg' ? '20' : '45'}
            decimal
            width={96}
            label={`bar (${unit})`}
          />
          <View style={styles.unitToggle}>
            {(['kg', 'lb'] as PlateUnit[]).map((u) => (
              <View key={u} style={{ flex: 1 }}>
                <Button
                  title={u}
                  variant={unit === u ? 'primary' : 'secondary'}
                  onPress={() => switchUnit(u)}
                />
              </View>
            ))}
          </View>
        </View>
        {outcome === undefined ? (
          <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
            Enter a target weight to see the plates per side.
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
            <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }}>
              PER SIDE
            </Text>
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
      </Card>
    </View>
  );
}

export default function CalculatorsScreen(): JSX.Element {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="Calculators" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.xl,
          gap: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <OneRepMaxSection />
        <PlateSection />
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
  unitToggle: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
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
