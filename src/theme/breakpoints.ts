/**
 * Responsive breakpoints — phone / large phone / tablet — so layouts adapt
 * across iPhone, iPad, and Android screen sizes (R17: flexible layouts,
 * never fixed phone frames).
 *
 * Thresholds come from the theme tokens (single source of truth).
 * Uses only React Native core APIs (useWindowDimensions) — no new native
 * modules, Expo Go compatible.
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTheme } from './ThemeProvider';
import type { BreakpointTokens } from './tokens';

export type BreakpointName = 'phone' | 'largePhone' | 'tablet';

/**
 * Pure function: classify a width (dp) into a breakpoint bucket.
 * Exported separately so it is unit-testable without React.
 */
export function getBreakpointName(
  width: number,
  breakpoints: BreakpointTokens,
): BreakpointName {
  if (width >= breakpoints.tablet) return 'tablet';
  if (width >= breakpoints.largePhone) return 'largePhone';
  return 'phone';
}

export interface BreakpointInfo {
  name: BreakpointName;
  /** Current window width in dp; re-renders on rotation/resize. */
  width: number;
  isPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  /** True at tablet width and up — use for multi-column layouts. */
  isWide: boolean;
}

/**
 * Reactive breakpoint info for the current window. Re-renders on window size
 * changes (foldables, tablet split-screen/multitasking, web resize).
 */
export function useBreakpoint(): BreakpointInfo {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  return useMemo<BreakpointInfo>(() => {
    const name = getBreakpointName(width, theme.breakpoints);
    return {
      name,
      width,
      isPhone: name === 'phone',
      isLargePhone: name === 'largePhone',
      isTablet: name === 'tablet',
      isWide: name === 'tablet',
    };
    // Depend on breakpoints (shared across modes), not the whole theme,
    // so a light/dark toggle doesn't recompute this.
  }, [width, theme.breakpoints]);
}

/**
 * Pick a value for the current breakpoint. Example — column counts:
 *
 *   const columns = useResponsiveValue({ phone: 1, largePhone: 2, tablet: 3 });
 */
export function useResponsiveValue<T>(
  values: Record<BreakpointName, T>,
): T {
  const { name } = useBreakpoint();
  return values[name];
}
