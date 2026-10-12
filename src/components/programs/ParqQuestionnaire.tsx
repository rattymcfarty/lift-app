/**
 * PAR-Q+ questionnaire UI (P3 #14).
 *
 * Presents the 7 PAR-Q+ general-health questions (© PAR-Q+ Collaboration)
 * with Yes/No toggles. Emits the completed boolean array on submit — the
 * caller persists it via completeParqScreening(). This is a screening
 * questionnaire, not medical advice.
 *
 * Themed via useTheme(); no hard-coded colors.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { PARQ_QUESTIONS, PARQ_QUESTION_COUNT } from '../../programs/safetyRules';
import { Button, Card } from '../workout/ui';

interface ParqQuestionnaireProps {
  /** Called with the 7 answers (in PARQ_QUESTIONS order) on submit. */
  onSubmit: (answers: boolean[]) => void;
  busy?: boolean;
}

/** Append a hex alpha suffix only when the token is 6-digit hex. */
function withAlpha(hex: string, alpha: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex;
}

export function ParqQuestionnaire({ onSubmit, busy = false }: ParqQuestionnaireProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;
  const [answers, setAnswers] = useState<Array<boolean | null>>(
    Array(PARQ_QUESTION_COUNT).fill(null),
  );

  const setAnswer = (index: number, value: boolean) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const complete = answers.every((a) => a !== null);
  const anyYes = answers.some((a) => a === true);

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
      accessibilityLabel="Physical activity readiness questionnaire"
    >
      <Text style={{ color: c.muted, fontSize: t.size.body }}>
        Please answer each question honestly. This helps keep your training safe —
        it is a screening questionnaire, not medical advice.
      </Text>
      <Text style={{ color: c.faint, fontSize: t.size.caption }}>
        Questions © the PAR-Q+ Collaboration (parqplus.com), reproduced for screening use.
      </Text>

      {PARQ_QUESTIONS.map((question, i) => {
        const answer = answers[i];
        return (
          <Card key={i}>
            <Text
              style={{
                color: c.text,
                fontSize: t.size.body,
                marginBottom: theme.spacing.sm,
              }}
            >
              <Text style={{ fontWeight: t.weight.bold }}>{i + 1}. </Text>
              {question}
            </Text>
            <View style={[styles.toggleRow, { gap: theme.spacing.sm }]}>
              {([true, false] as const).map((value) => {
                const selected = answer === value;
                return (
                  <Pressable
                    key={String(value)}
                    onPress={() => setAnswer(i, value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={value ? `Yes, question ${i + 1}` : `No, question ${i + 1}`}
                    style={[
                      styles.toggle,
                      {
                        borderColor: selected
                          ? value
                            ? c.warning
                            : c.success
                          : c.border,
                        // 10% tint of the semantic color; falls back to the
                        // solid color if the token isn't 6-digit hex.
                        backgroundColor: selected
                          ? withAlpha(value ? c.warning : c.success, '1a')
                          : 'transparent',
                        borderRadius: theme.radius.md,
                        paddingVertical: theme.spacing.sm,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? c.text : c.muted,
                        fontSize: t.size.body,
                        fontWeight: selected ? t.weight.medium : t.weight.regular,
                        textAlign: 'center',
                      }}
                    >
                      {value ? 'Yes' : 'No'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}

      {anyYes ? (
        <Text style={{ color: c.warning, fontSize: t.size.caption }}>
          You answered "yes" to at least one question. You can still continue after
          acknowledging you have medical clearance on the next screen.
        </Text>
      ) : null}

      <Button
        title="Submit answers"
        onPress={() => onSubmit(answers as boolean[])}
        disabled={!complete || busy}
        busy={busy}
        testID="parq-submit"
      />
      {!complete ? (
        <Text style={{ color: c.faint, fontSize: t.size.caption, textAlign: 'center' }}>
          Please answer all {PARQ_QUESTION_COUNT} questions to continue.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
  },
  toggle: {
    flex: 1,
    borderWidth: 1.5,
  },
});
