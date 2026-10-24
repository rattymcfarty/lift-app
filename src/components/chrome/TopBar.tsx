/**
 * TopBar — the app's persistent top chrome.
 *
 * Mounted ONCE in app/_layout.tsx above the Stack as an absolute overlay,
 * respecting safe-area top. Uses pointerEvents='box-none' so only the
 * three controls take touches.
 *
 * Layout:
 * - LEFT: GlassButton with 'panel' icon (testID: topbar-panel) → opens left panel
 *         On non-top-level routes: back button (chevron, testID: topbar-back)
 * - CENTER: the companion circle (<Companion />) — stage A2
 * - RIGHT: GlassButton with 'sliders' icon (testID: topbar-settings) → opens right panel
 *          Hidden on non-top-level routes
 *
 * Hidden on onboarding and PAR-Q routes (reuses helper from companion/placement.ts).
 */
import type { JSX, ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useSegments } from 'expo-router';
import { GlassButton } from '../ui/Glass';
import { Companion } from '../../companion/Companion';
import { usePanels } from '../../chrome/panels';
import { isCompanionHiddenRoute } from '../../companion/placement';

/** Top bar height: 44dp content + 2*8dp vertical padding = 60dp. */
export const TOP_BAR_HEIGHT = 60;

/**
 * Hook returning the top inset for content below the TopBar:
 * safe-area top + TOP_BAR_HEIGHT.
 */
export function useTopBarInset(): number {
  // Screens already pad for the safe area (SafeAreaView); only the bar is extra.
  return TOP_BAR_HEIGHT;
}

/** True while the top bar is on screen (hidden on onboarding / PAR-Q). */
export function useTopBarVisible(): boolean {
  const pathname = usePathname();
  const segments = useSegments();
  return !isCompanionHiddenRoute(pathname, segments);
}

/**
 * TopBar component.
 */
export function TopBar(): JSX.Element | null {
  const pathname = usePathname();
  const segments = useSegments();
  const { openPanel } = usePanels();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Hide on onboarding and PAR-Q routes only.
  if (isCompanionHiddenRoute(pathname, segments)) return null;

  // Both floating buttons are drawn on EVERY route that shows the chrome (owner
  // decision 2026-10-24): the panel on the left, settings on the right, beside
  // the companion — the same three anchors everywhere. Inner screens keep their
  // own back/close control in the page header, which sits below this bar (the
  // header pads past `TOP_BAR_HEIGHT`), so the two never overlap.
  return (
    <View
      style={[
        styles.container,
        { top: insets.top, width },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        <View style={styles.leftSlot}>
          <GlassButton
            testID="topbar-panel"
            icon={<PanelIcon />}
            accessibilityLabel="Open menu"
            onPress={() => openPanel('left')}
          />
        </View>
        <View style={styles.centerSlot}>
          <Companion />
        </View>
        <View style={styles.rightSlot}>
          <GlassButton
            testID="topbar-settings"
            icon={<SlidersIcon />}
            accessibilityLabel="Settings"
            onPress={() => openPanel('right')}
          />
        </View>
      </View>
    </View>
  );
}

/** Panel icon: two horizontal lines, upper line longer than lower (hamburger with two bars). */
function PanelIcon(): JSX.Element {
  const { theme } = useTheme();
  return (
    <SvgIcon>
      <Line x1={6} y1={10} x2={18} y2={10} {...strokeProps(theme.colors.text)} />
      <Line x1={6} y1={14} x2={14} y2={14} {...strokeProps(theme.colors.text)} />
    </SvgIcon>
  );
}

/** Sliders/settings icon: two horizontal tracks with round knobs at different positions. */
function SlidersIcon(): JSX.Element {
  const { theme } = useTheme();
  return (
    <SvgIcon>
      {/* Track 1 */}
      <Line x1={5} y1={8} x2={19} y2={8} {...strokeProps(theme.colors.text)} />
      {/* Knob 1 */}
      <Circle cx={10} cy={8} r={3.5} fill={theme.colors.text} />
      {/* Track 2 */}
      <Line x1={5} y1={16} x2={19} y2={16} {...strokeProps(theme.colors.text)} />
      {/* Knob 2 */}
      <Circle cx={14} cy={16} r={3.5} fill={theme.colors.text} />
    </SvgIcon>
  );
}

/** Shared SVG wrapper for consistent sizing. */
function SvgIcon({ children }: { children: ReactNode }): JSX.Element {
  const { theme } = useTheme();
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {children}
    </Svg>
  );
}

import { Svg, Line, Polyline, Circle } from 'react-native-svg';
import { useTheme } from '../../theme';

function strokeProps(color: string) {
  return {
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    // height is insets.top + TOP_BAR_HEIGHT, set inline
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: TOP_BAR_HEIGHT,
    paddingHorizontal: 8,
    gap: 8,
  },
  leftSlot: {
    width: 44,
    alignItems: 'flex-start',
  },
  centerSlot: {
    width: 56, // The companion circle (48 dp) sits centred here
    flex: 1,
    alignItems: 'center',
  },
  rightSlot: {
    width: 44,
    alignItems: 'flex-end',
  },
});