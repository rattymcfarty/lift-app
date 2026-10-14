/**
 * Bottom tab bar — the app's primary navigation. Four top-level sections
 * (Programs, Train, Analytics, Exercises); everything else (workout
 * logging, detail screens, settings, calculators…) pushes on the root
 * Stack above the tabs.
 *
 * Sizing rules (Dynamic Type + iOS Display Zoom):
 * - labels use the `caption` token, capped at 1.1x so five labels always
 *   fit a 320pt-wide zoomed display; they also shrink-to-fit one line.
 * - bar height = icon + label + padding, so it grows with the cap rather
 *   than clipping.
 */
import type { JSX } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { TabIcon, type TabIconName } from '../../src/components/nav/TabIcons';

const TABS: ReadonlyArray<{ name: string; title: string; icon: TabIconName; testID: string }> = [
  { name: 'programs', title: 'Programs', icon: 'programs', testID: 'tab-programs' },
  { name: 'index', title: 'Train', icon: 'train', testID: 'tab-train' },
  { name: 'analytics', title: 'Analytics', icon: 'analytics', testID: 'tab-analytics' },
  { name: 'exercises', title: 'Exercises', icon: 'exercises', testID: 'tab-exercises' },
];

export default function TabsLayout(): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const iconSize = width < 360 ? 22 : 26;
  const labelSize = t.size.caption;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: 1,
          // Room for icon + a label that may scale to 1.1x.
          height: 56 + Math.round(labelSize * 0.6) + insets.bottom,
          paddingTop: theme.spacing.xs,
          paddingBottom: insets.bottom > 0 ? insets.bottom : theme.spacing.xs,
        },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarButtonTestID: tab.testID,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ focused }) => (
              <TabIcon name={tab.icon} color={focused ? c.accent : c.muted} size={iconSize} focused={focused} />
            ),
            tabBarLabel: ({ focused }) => (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                maxFontSizeMultiplier={1.1}
                style={{
                  color: focused ? c.accent : c.muted,
                  fontSize: labelSize,
                  fontWeight: focused ? t.weight.bold : t.weight.medium,
                  maxWidth: '100%',
                }}
              >
                {tab.title}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
