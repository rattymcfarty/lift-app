/**
 * Missed-session resolution card (P3 #14).
 *
 * Shown when a scheduled program session's date has passed with no logged
 * workout. Offers two guilt-free options: do it today (shifts this and all
 * later sessions) or skip it (no progression penalty). Copy is
 * deliberately neutral — missed is not failed.
 *
 * Themed via useTheme(); no hard-coded colors.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { ProgramSessionState } from '../../db/schema';
import { Button, Card } from '../workout/ui';
import type { MissedResolution } from '../../programs/sessions';

interface MissedSessionCardProps {
  session: ProgramSessionState;
  /** Human label for the session, e.g. "Upper A" or "Week 2 · Day 3". */
  label: string;
  onResolve: (action: MissedResolution) => void;
  busy?: boolean;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function MissedSessionCard({
  session,
  label,
  onResolve,
  busy = false,
}: MissedSessionCardProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;

  return (
    <Card>
      <View style={[styles.row, { marginBottom: theme.spacing.sm }]}>
        <Text
          style={{
            color: c.text,
            fontSize: t.size.body,
            fontWeight: t.weight.medium,
            flex: 1,
          }}
        >
          You missed {label}
        </Text>
      </View>
      <Text style={{ color: c.muted, fontSize: t.size.caption, marginBottom: theme.spacing.md }}>
        Scheduled for {formatDate(session.scheduledDate.getTime())} — no workout was
        logged. That happens; it does not affect your progression.
      </Text>
      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <View style={styles.action}>
          <Button
            title="Do it today"
            variant="primary"
            onPress={() => onResolve('do-today')}
            disabled={busy}
            testID="missed-do-today"
          />
        </View>
        <View style={styles.action}>
          <Button
            title="Skip it"
            variant="secondary"
            onPress={() => onResolve('skip')}
            disabled={busy}
            testID="missed-skip"
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
  },
  action: {
    flex: 1,
  },
});
