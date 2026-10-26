/**
 * Floating glass tab bar — stage A3 of the layout redesign.
 *
 * The four main sections are navigated by a floating pill of glass, inset
 * `spacing.md` (16 dp) from both sides and sitting `TAB_BAR_MARGIN_BOTTOM`
 * above the safe-area bottom, instead of the stock bar that spanned the width
 * and carried a row of labels. It is ICON ONLY: each screen's own large title
 * already names the section, so the bar needs no shrink-to-fit label and stays
 * out of the way. The active tab gets a translucent accent capsule behind its
 * icon and the icon itself in the accent colour; inactive icons stay muted.
 *
 * The bar floats OVER the screen, so every scrollable underneath it reserves
 * `useTabBarSpace()` of bottom padding — the four tab screens do.
 *
 * Order comes from `src/nav/tabOrder.ts` (persisted, rides in backups).
 */
import type { JSX } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Keyboard, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useSegments, router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { isCompanionHiddenRoute } from '../../companion/placement';
import { APP_TABS, tabHref, tabKeyForPathname } from '../../nav/tabs';
import { useTheme, withAlpha } from '../../theme';
import { Glass } from '../ui/Glass';
import { TabIcon, type TabIconName } from './TabIcons';
import {
  getTabOrderSnapshot,
  loadTabOrder,
  subscribeTabOrder,
  type TabKey,
} from '../../nav/tabOrder';

/** Bar height (the pill itself). */
export const TAB_BAR_HEIGHT = 64;
/** Gap between the pill and the safe-area bottom. */
export const TAB_BAR_MARGIN_BOTTOM = 10;
/** Height the bar claims above the safe-area bottom, before the inset. */
const TAB_BAR_SPACE = TAB_BAR_HEIGHT + TAB_BAR_MARGIN_BOTTOM;
/** Minimum touch target per item. */
const TAB_BAR_ITEM_HEIGHT = 52;
/** Icon size at a 390 dp-wide screen, scaled a little for narrower ones. */
const TAB_ICON_SIZE = 30;

/** One entry of the bar: the tab, its route, its glyph and its Maestro test id. */
export interface TabBarTab {
  /** Stable reorder id (see `src/nav/tabOrder.ts`). */
  key: TabKey;
  /** Route name inside `app/(tabs)`. */
  name: string;
  /** Section name — the accessibility label. */
  title: string;
  icon: TabIconName;
  testID: string;
}

/**
 * Vertical space the floating bar occupies at the bottom of a tab screen:
 * bar height + gap + safe-area bottom. Add it to a scrollable's bottom padding
 * so its last row is never hidden behind the glass.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_SPACE + insets.bottom;
}

/** True while the soft keyboard is up. */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/**
 * The bar itself — mounted ONCE in the root layout, above the navigator, so it is
 * on every screen (owner decision 2026-10-26: it never disappears). It no longer
 * receives navigator state: the active door comes from the pathname, and a press
 * navigates through the router.
 *
 * A workout route highlights Train (the session belongs there) and its Train press
 * still goes to the Train tab, so the bar is never a dead end while the workout is
 * the main window.
 */
export function TabBar(): JSX.Element | null {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();
  const order = useSyncExternalStore(subscribeTabOrder, getTabOrderSnapshot);
  const keyboardShown = useKeyboardShown();

  useEffect(() => {
    void loadTabOrder();
  }, []);

  const iconSize = Math.round(TAB_ICON_SIZE * Math.min(1.1, Math.max(0.84, width / 390)));
  const space = TAB_BAR_SPACE + insets.bottom;

  // The stock bar hid itself while typing (tabBarHideOnKeyboard); a custom bar has
  // to do that for itself, so it slides down and stops taking touches.
  const hidden = useRef(new Animated.Value(keyboardShown ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(hidden, {
      toValue: keyboardShown ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [hidden, keyboardShown]);

  // Onboarding and the PAR-Q+ screening are the only bare flows, like the chrome.
  if (isCompanionHiddenRoute(pathname, segments)) return null;

  const activeKey = pathname.startsWith('/workout') ? 'train' : tabKeyForPathname(pathname);
  // `order` first, then the tab table: a stored id the table no longer knows is skipped.
  const items = order
    .map((key) => APP_TABS.find((tab) => tab.key === key))
    .filter((tab): tab is (typeof APP_TABS)[number] => tab != null);

  const select = (key: (typeof APP_TABS)[number]['key']): void => {
    Haptics.selectionAsync();
    // Train always lands on the tab itself, even when the workout is the active
    // window — a highlighted, inert door would strand the user in the session.
    router.navigate((key === 'train' ? '/' : tabHref(key)) as Href);
  };

  return (
    <Animated.View
      pointerEvents={keyboardShown ? 'none' : 'box-none'}
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom + TAB_BAR_MARGIN_BOTTOM,
          paddingHorizontal: theme.spacing.md,
          transform: [
            {
              translateY: hidden.interpolate({
                inputRange: [0, 1],
                outputRange: [0, space + theme.spacing.md],
              }),
            },
          ],
        },
      ]}
    >
      <Glass shape="pill" style={[styles.pill, { paddingHorizontal: theme.spacing.xs }]}>
        {items.map((tab) => {
          const focused = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              testID={tab.testID}
              onPress={() => select(tab.key)}
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{ selected: focused }}
              hitSlop={4}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <View
                style={[
                  styles.capsule,
                  { borderRadius: theme.radius.pill },
                  focused && { backgroundColor: withAlpha(c.accent, 0.18) },
                ]}
              >
                <TabIcon name={tab.icon} color={focused ? c.accent : c.muted} size={iconSize} focused={focused} />
              </View>
            </Pressable>
          );
        })}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
  },
  item: {
    flex: 1,
    height: TAB_BAR_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },
  capsule: {
    minWidth: 62,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
