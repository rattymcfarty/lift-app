/**
 * Bottom-tab glyphs for LIFT — original line icons on a 24x24 grid, drawn
 * with react-native-svg (already shipped in Expo Go). Stroke color comes
 * from the tab bar (active = highlight, inactive = muted) so they follow
 * the theme in both modes.
 */
import type { JSX } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type TabIconName = 'home' | 'plans' | 'exercises' | 'history' | 'progress';

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
    case 'home':
      art = (
        <>
          <Path d="M3.5 11 L12 3.8 L20.5 11" {...common} />
          <Path d="M5.8 9.6 V19.6 H10 V14.4 H14 V19.6 H18.2 V9.6" {...common} />
        </>
      );
      break;
    case 'plans':
      art = (
        <>
          <Rect x={5} y={4.2} width={14} height={16.6} rx={2.4} {...common} />
          <Line x1={8.6} y1={9.2} x2={15.4} y2={9.2} {...common} />
          <Line x1={8.6} y1={13} x2={15.4} y2={13} {...common} />
          <Line x1={8.6} y1={16.6} x2={12.6} y2={16.6} {...common} />
        </>
      );
      break;
    case 'exercises':
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
    case 'history':
      art = (
        <>
          <Circle cx={12} cy={12} r={8.4} {...common} />
          <Path d="M12 7.2 V12 L15.2 14" {...common} />
        </>
      );
      break;
    case 'progress':
      art = (
        <>
          <Path d="M3.8 19.6 H20.4" {...common} />
          <Path d="M5.4 15.4 L10 10.6 L13.2 13.4 L19 6.6" {...common} />
          <Path d="M15 6.6 H19 V10.6" {...common} />
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
