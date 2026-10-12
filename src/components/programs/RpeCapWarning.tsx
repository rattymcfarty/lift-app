/**
 * RPE/RIR cap warning banner (P3 #14).
 *
 * Non-blocking, explicit warning shown in the logging flow when a set
 * exceeds the program's RPE cap or drops below its RIR floor.
 * Longevity-first: the app flags pushing toward failure, never forbids
 * logging the truth. Dismissible — the set is already logged.
 *
 * Themed via useTheme(); no hard-coded colors.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { RpeCapViolation } from '../../programs/safetyRules';

interface RpeCapWarningProps {
  violations: RpeCapViolation[];
  onDismiss: () => void;
}

/** Append a hex alpha suffix only when the token is 6-digit hex. */
function withAlpha(hex: string, alpha: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex;
}

export function RpeCapWarning({ violations, onDismiss }: RpeCapWarningProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;

  if (violations.length === 0) return <></>;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: withAlpha(c.warning, '1a'),
          borderColor: c.warning,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={{
            color: c.warning,
            fontSize: t.size.body,
            fontWeight: t.weight.medium,
            flex: 1,
          }}
        >
          Intensity cap reached
        </Text>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss warning"
          hitSlop={12}
        >
          <Text style={{ color: c.muted, fontSize: t.size.body }}>✕</Text>
        </Pressable>
      </View>
      {violations.map((v, i) => (
        <Text key={`${v.type}-${i}`} style={{ color: c.text, fontSize: t.size.caption }}>
          {v.message}
        </Text>
      ))}
      <Text style={{ color: c.faint, fontSize: t.size.caption }}>
        Your set was logged as-is. This program caps intensity to keep training
        in the longevity zone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
