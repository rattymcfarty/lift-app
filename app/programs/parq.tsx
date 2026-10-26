/**
 * PAR-Q+ screening route (P3 #14).
 *
 * Shown before first program enrollment (and when the previous screening
 * is stale). Flow:
 * 1. Questionnaire → completeParqScreening()
 * 2. If any "yes" → medical-clearance prompt → acknowledgeMedicalClearance()
 * 3. Gate opens → back() to the enrollment flow.
 *
 * The clearance step is a recorded acknowledgment, not a bypass — the
 * screening stays on file with its answers.
 */

import { useState, type JSX } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { ParqQuestionnaire } from '../../src/components/programs';
import { Button, Card, ScreenHeader } from '../../src/components/workout/ui';
import {
  acknowledgeMedicalClearance,
  completeParqScreening,
  getParqGateStatus,
} from '../../src/programs/safety';
import { ProgramError } from '../../src/programs/compile';
import { useTabBarSpace } from '../../src/components/nav/TabBar';

type Step = 'questionnaire' | 'clearance' | 'done';

export default function ParqScreen(): JSX.Element {
  const tabBarSpace = useTabBarSpace();
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;
  const [step, setStep] = useState<Step>('questionnaire');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (answers: boolean[]) => {
    setBusy(true);
    setError(null);
    try {
      const screening = await completeParqScreening(answers);
      if (screening.anyYes) {
        setStep('clearance');
      } else {
        // A prior unacknowledged "yes" can still close the gate even when
        // this screening is all "no" — check the gate, not just this row.
        const gate = await getParqGateStatus();
        if (gate.open) {
          setStep('done');
        } else {
          setStep('clearance');
        }
      }
    } catch (e) {
      setError(e instanceof ProgramError ? e.message : 'Could not save your answers — try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleAcknowledge = async () => {
    setBusy(true);
    setError(null);
    try {
      await acknowledgeMedicalClearance();
      setStep('done');
    } catch (e) {
      setError(e instanceof ProgramError ? e.message : 'Could not record acknowledgment — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background, paddingBottom: tabBarSpace }} edges={['top']}>
      <ScreenHeader
        title="Readiness check"
        subtitle="PAR-Q+ physical activity questionnaire"
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
      <Text style={{ color: c.faint, fontSize: t.size.caption, paddingHorizontal: theme.spacing.md }}>
        Questions © the PAR-Q+ Collaboration (parqplus.com), reproduced for screening use.
      </Text>
      {error ? (
        <View style={{ paddingHorizontal: theme.spacing.md }}>
          <Text style={{ color: c.danger, fontSize: t.size.caption }}>{error}</Text>
        </View>
      ) : null}

      {step === 'questionnaire' ? (
        <ParqQuestionnaire onSubmit={handleSubmit} busy={busy} />
      ) : step === 'clearance' ? (
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          <Card>
            <Text
              style={{
                color: c.text,
                fontSize: t.size.card,
                fontWeight: t.weight.bold,
                marginBottom: theme.spacing.sm,
              }}
            >
              Talk to your doctor first
            </Text>
            <Text style={{ color: c.muted, fontSize: t.size.body, marginBottom: theme.spacing.sm }}>
              You answered "yes" to at least one question. Before starting a training
              program, please check with your doctor or another qualified health
              professional about what activity is right for you.
            </Text>
            <Text style={{ color: c.muted, fontSize: t.size.body }}>
              If you already have medical clearance, you can acknowledge it below to
              continue. Your answers stay on record.
            </Text>
          </Card>
          <Button
            title="I have medical clearance"
            onPress={handleAcknowledge}
            busy={busy}
            testID="parq-acknowledge-clearance"
          />
          <Button
            title="I'll check with my doctor"
            variant="secondary"
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }}
            disabled={busy}
          />
        </View>
      ) : (
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          <Card>
            <Text
              style={{
                color: c.success,
                fontSize: t.size.card,
                fontWeight: t.weight.bold,
                marginBottom: theme.spacing.sm,
              }}
            >
              You're cleared to enroll
            </Text>
            <Text style={{ color: c.muted, fontSize: t.size.body }}>
              Your readiness check is on file. You can now enroll in a training program.
            </Text>
          </Card>
          <Button title="Continue" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} testID="parq-done" />
        </View>
      )}
    </SafeAreaView>
  );
}
