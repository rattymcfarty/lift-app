/** Small line icons for the workout toolbar (original art, 24×24 grid). */
import type { JSX } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type ToolIconName = 'timer' | 'plates';

export function ToolIcon({ name, color, size }: { name: ToolIconName; color: string; size: number }): JSX.Element {
  const c = { stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'timer' ? (
        <>
          <Circle cx={12} cy={13.5} r={7.2} {...c} />
          <Line x1={12} y1={13.5} x2={12} y2={9.4} {...c} />
          <Line x1={9.6} y1={3.4} x2={14.4} y2={3.4} {...c} />
          <Line x1={18.2} y1={6.2} x2={19.6} y2={4.8} {...c} />
        </>
      ) : (
        <>
          <Rect x={3} y={9} width={3.2} height={6} rx={1} {...c} />
          <Rect x={7} y={6} width={3.6} height={12} rx={1.2} {...c} />
          <Line x1={10.6} y1={12} x2={13.4} y2={12} {...c} />
          <Rect x={13.4} y={6} width={3.6} height={12} rx={1.2} {...c} />
          <Rect x={17.8} y={9} width={3.2} height={6} rx={1} {...c} />
        </>
      )}
    </Svg>
  );
}
