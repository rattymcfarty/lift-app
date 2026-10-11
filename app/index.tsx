import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * P0 placeholder screen. Phase 1 replaces this with the dashboard (R15).
 * Uses only React Native primitives so it runs inside Expo Go.
 */
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LIFT</Text>
      <Text style={styles.subtitle}>Logevity Intelligent Fitness Trainer</Text>
      <Text style={styles.note}>Phase 0 scaffold — dashboard lands in P1.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    gap: 8,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#a1a1a1',
  },
  note: {
    fontSize: 12,
    color: '#525252',
    marginTop: 16,
  },
});
