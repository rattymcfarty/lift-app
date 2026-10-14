/**
 * Bottom-tab glyphs for LIFT — original line icons on a 24x24 grid, drawn
 * with react-native-svg (already shipped in Expo Go). Stroke color comes
 * from the tab bar (active = highlight, inactive = muted) so they follow
 * the theme in both modes.
 */
import type { JSX } from 'react';
import Svg, { Line, Path, Rect } from 'react-native-svg';

export type TabIconName = 'programs' | 'train' | 'analytics' | 'exercises';

interface TabIconProps {
  name: TabIconName;
  color: string;
  size: number;
  /** Heavier stroke when the tab is focused. */
  focused?: boolean;
}

export function TabIcon({ name, color, size, focused = false }: TabIconProps): JSX.Element {
  const sw = focused ? 2.2 : 1.8;
  const common = { stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  let art: JSX.Element;
  switch (name) {
    case 'programs':
      // Three tall cards side by side.
      art = (
        <>
          <Rect x={2.8} y={5.4} width={5.2} height={13.2} rx={1.8} {...common} />
          <Rect x={9.4} y={5.4} width={5.2} height={13.2} rx={1.8} {...common} />
          <Rect x={16} y={5.4} width={5.2} height={13.2} rx={1.8} {...common} />
        </>
      );
      break;
    case 'train':
      art = (
        <>
          <Line x1={7.4} y1={12} x2={16.6} y2={12} {...common} />
          <Rect x={3.6} y={8.2} width={3.8} height={7.6} rx={1.2} {...common} />
          <Rect x={16.6} y={8.2} width={3.8} height={7.6} rx={1.2} {...common} />
          <Line x1={2} y1={12} x2={3.6} y2={12} {...common} />
          <Line x1={20.4} y1={12} x2={22} y2={12} {...common} />
        </>
      );
      break;
    case 'analytics':
      art = (
        <>
          <Rect x={3.4} y={4} width={17.2} height={16} rx={2.6} {...common} />
          <Path d="M6.4 15.6 L10.2 11.6 L13 13.8 L17.6 8.4" {...common} />
        </>
      );
      break;
    case 'exercises':
      // Open book / library list.
      art = (
        <>
          <Path d="M4.6 5.6 H10 Q12 5.6 12 7.6 V19 Q12 17.4 10 17.4 H4.6 Z" {...common} />
          <Path d="M19.4 5.6 H14 Q12 5.6 12 7.6 V19 Q12 17.4 14 17.4 H19.4 Z" {...common} />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {art}
    </Svg>
  );
}
