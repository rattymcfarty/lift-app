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
 * Which sections exist comes from `src/nav/tabs.ts` (the left panel lists the
 * same table); the order of the items comes from `src/nav/tabOrder.ts`.
 */
import type { JSX } from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/theme';
import { TabBar } from '../../src/components/nav/TabBar';
import { APP_TABS } from '../../src/nav/tabs';

/** Opening route of the tab group (expo-router 58 moved this off the Tabs prop). */
export const unstable_settings = { anchor: 'index' };

export default function TabsLayout(): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} tabs={APP_TABS} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      {APP_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </Tabs>
  );
}
