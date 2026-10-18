/**
 * The four main sections, in one place.
 *
 * `app/(tabs)/_layout.tsx` registers these with the tab navigator, and the
 * left panel lists them (to jump to a section and to reorder the bar). Keeping
 * a single table means a section can never be named one way on the bar and
 * another in the menu.
 */
import type { TabBarTab } from '../components/nav/TabBar';
import type { TabKey } from './tabOrder';

/** Programs · Train · Analytics · Exercises, the shipped order. */
export const APP_TABS: ReadonlyArray<TabBarTab> = [
  { key: 'programs', name: 'programs', title: 'Programs', icon: 'programs', testID: 'tab-programs' },
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
export function tabHref(key: TabKey): '/' | '/programs' | '/analytics' | '/exercises' {
  switch (key) {
    case 'programs':
      return '/programs';
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
 * panel. Only the four top-level paths match; every other route returns
 * undefined.
 */
export function tabKeyForPathname(pathname: string): TabKey | undefined {
  const match = APP_TABS.find((tab) => (tab.name === 'index' ? '/' : `/${tab.name}`) === pathname);
  return match?.key;
}
