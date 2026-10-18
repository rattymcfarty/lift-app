/**
 * Bottom tab bar — the app's primary navigation. Four top-level sections
 * (Programs, Train, Analytics, Exercises); everything else (workout
 * logging, detail screens, settings, calculators…) pushes on the root
 * Stack above the tabs.
 *
 * The stock bar is replaced by a floating pill of glass (`TabBar`, stage A3 of
 * the layout redesign): icon only, inset from the sides, floating above the
 * safe-area bottom. It OVERLAYS the screens, so each tab screen reserves
 * `useTabBarSpace()` at the bottom of its scrollable.
 *
 * The order of the items comes from `src/nav/tabOrder.ts` (defaults to the
 * order of this table; a saved order wins).
 */
import type { JSX } from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/theme';
import { TabBar, type TabBarTab } from '../../src/components/nav/TabBar';

const TABS: ReadonlyArray<TabBarTab> = [
  { key: 'programs', name: 'programs', title: 'Programs', icon: 'programs', testID: 'tab-programs' },
  { key: 'train', name: 'index', title: 'Train', icon: 'train', testID: 'tab-train' },
  { key: 'analytics', name: 'analytics', title: 'Analytics', icon: 'analytics', testID: 'tab-analytics' },
  { key: 'exercises', name: 'exercises', title: 'Exercises', icon: 'exercises', testID: 'tab-exercises' },
];

export default function TabsLayout(): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <TabBar {...props} tabs={TABS} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </Tabs>
  );
}
