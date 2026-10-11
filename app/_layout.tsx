import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useDrizzleMigrations } from '../src/db/useMigrations';

export default function RootLayout() {
  const { success, error } = useDrizzleMigrations();

  if (error) {
    throw new Error(`Database migrations failed: ${String(error)}`);
  }

  if (!success) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
