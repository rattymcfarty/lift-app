/**
 * The three main doors, in one place (owner decision 2026-10-26, Apple Health's
 * summary/sharing/browse shape): **Train · Analytics · Exercises**.
 *
 * Programs is no longer a tab: it is a menu destination (`/programs`), because
 * setting up a program is occasional while training, reviewing and looking up an
 * exercise happen every session. `app/(tabs)/_layout.tsx` registers these with the
 * tab navigator and the left panel lists the same table.
 */
import type { TabBarTab } from '../components/nav/TabBar';
import type { TabKey } from './tabOrder';

/** Train · Analytics · Exercises, the shipped order. */
export const APP_TABS: ReadonlyArray<TabBarTab> = [
  { key: 'train', name: 'index', title: 'Train', icon: 'train', testID: 'tab-train' },
  { key: 'analytics', name: 'analytics', title: 'Analytics', icon: 'analytics', testID: 'tab-analytics' },
  { key: 'exercises', name: 'exercises', title: 'Exercises', icon: 'exercises', testID: 'tab-exercises' },
];

const BY_KEY = new Map<TabKey, TabBarTab>(APP_TABS.map((tab) => [tab.key, tab]));

/** The section for a stable tab id, or undefined for an unknown one. */
export function tabByKey(key: TabKey): TabBarTab | undefined {
  return BY_KEY.get(key);
}

/** Route the panel pushes to reach a section. */
export function tabHref(key: TabKey): '/' | '/analytics' | '/exercises' {
  switch (key) {
    case 'analytics':
      return '/analytics';
    case 'exercises':
      return '/exercises';
    default:
      return '/';
  }
}

/**
 * Which section a pathname belongs to, for highlighting the current tab in the
 * panel. Only the three top-level paths match; every other route (including
 * /programs, now a pushed page) returns undefined.
 */
export function tabKeyForPathname(pathname: string): TabKey | undefined {
  const match = APP_TABS.find((tab) => (tab.name === 'index' ? '/' : `/${tab.name}`) === pathname);
  return match?.key;
}
