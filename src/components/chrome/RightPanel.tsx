/**
 * RightPanel — the slide-in settings panel (top-right sliders button).
 *
 * Renders the same block as the full Settings screen (`SettingsBody`), so the
 * two can't drift. The body is told to close the panel before it navigates
 * (e.g. "Edit profile"), otherwise the panel would sit over the new screen.
 */
import type { JSX } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { ActionIcon } from '../icons';
import { GlassButton } from '../ui/Glass';
import { SettingsBody } from '../settings/SettingsBody';
import { usePanels } from '../../chrome/panels';

export function RightPanel(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { closePanel } = usePanels();

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <Text style={{ color: c.text, fontSize: t.size.section, fontWeight: t.weight.bold }}>Settings</Text>
        <GlassButton
          testID="panel-close"
          icon={<ActionIcon name="close" color={c.text} size={22} />}
          accessibilityLabel="Close settings"
          onPress={closePanel}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
      >
        <SettingsBody onLeave={closePanel} />
      </ScrollView>
    </View>
  );
}
