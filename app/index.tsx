import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../src/theme';

/**
 * P0 placeholder screen. Phase 1 replaces this with the dashboard (R15).
 * Colors, spacing and the caption size come from theme tokens; the display
 * title treatment predates the token scale and goes away with the P1
 * dashboard. Runs on React Native primitives only (Expo Go compatible).
 */
export default function Index() {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>LIFT</Text>
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
        Longevity Intelligent Fitness Trainer
      </Text>
      <Text
        style={{
          color: theme.colors.faint,
          fontSize: theme.typography.size.caption,
          marginTop: theme.spacing.md,
        }}
      >
        Phase 0 scaffold — dashboard lands in P1.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 14,
  },
});
