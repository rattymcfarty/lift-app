/**
 * ActionIcons — small line icons (24×24 grid, original art, stroke=currentColor)
 * for the in-workout actions sheet, the reorder sheet and the exercise-card
 * footer. No emoji: consistent 1.9px rounded strokes so every affordance reads
 * as part of the same set.
 */
import type { JSX } from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export type ActionIconName =
  | 'timer'
  | 'warmup'
  | 'note'
  | 'progression'
  | 'reorder'
  | 'search'
  | 'history'
  | 'scale'
  | 'link'
  | 'unlink'
  | 'swap'
  | 'trash'
  | 'plus'
  | 'more'
  | 'chevron-down'
  | 'close'
  | 'chevron-right'
  | 'expand'
  | 'arrow-up'
  | 'arrow-down'
  | 'grip'
  | 'info'
  | 'person'
  | 'check';

export function ActionIcon({ name, color, size = 22 }: { name: ActionIconName; color: string; size?: number }): JSX.Element {
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
      ) : name === 'warmup' ? (
        <>
          <Line x1={5} y1={19} x2={19} y2={19} {...c} />
          <Polyline points="8 14 12 10 16 14" {...c} />
          <Line x1={12} y1={10} x2={12} y2={4.5} {...c} />
        </>
      ) : name === 'note' ? (
        <>
          <Rect x={5} y={4} width={14} height={16} rx={2.5} {...c} />
          <Line x1={8.5} y1={9} x2={15.5} y2={9} {...c} />
          <Line x1={8.5} y1={12.5} x2={15.5} y2={12.5} {...c} />
          <Line x1={8.5} y1={16} x2={12.5} y2={16} {...c} />
        </>
      ) : name === 'progression' ? (
        <>
          <Polyline points="4 16.5 9.5 11 13 14.5 20 7.5" {...c} />
          <Polyline points="14.8 7.5 20 7.5 20 12.7" {...c} />
        </>
      ) : name === 'reorder' ? (
        <>
          <Polyline points="8 9 12 5 16 9" {...c} />
          <Line x1={12} y1={5} x2={12} y2={13} {...c} />
          <Polyline points="8 15 12 19 16 15" {...c} />
          <Line x1={12} y1={11} x2={12} y2={19} {...c} />
        </>
      ) : name === 'search' ? (
        <>
          <Circle cx={11} cy={11} r={6.2} {...c} />
          <Line x1={15.6} y1={15.6} x2={20} y2={20} {...c} />
        </>
      ) : name === 'history' ? (
        <>
          <Polyline points="4.5 5.5 4.5 9.5 8.5 9.5" {...c} />
          <Path d="M5.2 9.2 A7.6 7.6 0 1 1 4.6 14.4" {...c} />
          <Line x1={12} y1={12.5} x2={12} y2={8.8} {...c} />
          <Line x1={12} y1={12.5} x2={14.8} y2={13.8} {...c} />
        </>
      ) : name === 'scale' ? (
        <>
          <Line x1={12} y1={4} x2={12} y2={8} {...c} />
          <Line x1={5} y1={8} x2={19} y2={8} {...c} />
          <Path d="M5 8 L2.6 14.5 A2.9 2.9 0 0 0 7.4 14.5 Z" {...c} />
          <Path d="M19 8 L16.6 14.5 A2.9 2.9 0 0 0 21.4 14.5 Z" {...c} />
          <Line x1={9.5} y1={20} x2={14.5} y2={20} {...c} />
        </>
      ) : name === 'link' ? (
        <>
          <Path d="M10.2 13.8 a3.4 3.4 0 0 0 4.8 0 l3-3 a3.4 3.4 0 0 0 -4.8 -4.8 l-1.2 1.2" {...c} />
          <Path d="M13.8 10.2 a3.4 3.4 0 0 0 -4.8 0 l-3 3 a3.4 3.4 0 0 0 4.8 4.8 l1.2 -1.2" {...c} />
        </>
      ) : name === 'unlink' ? (
        <>
          <Path d="M10.5 13.5 a3 3 0 0 0 4.2 0 l2 -2" {...c} />
          <Path d="M13.5 10.5 a3 3 0 0 0 -4.2 0 l-2 2" {...c} />
          <Line x1={4.5} y1={4.5} x2={7} y2={7} {...c} />
          <Line x1={19.5} y1={19.5} x2={17} y2={17} {...c} />
        </>
      ) : name === 'swap' ? (
        <>
          <Polyline points="5 8 8 5 11 8" {...c} />
          <Line x1={8} y1={5} x2={8} y2={16} {...c} />
          <Polyline points="13 16 16 19 19 16" {...c} />
          <Line x1={16} y1={19} x2={16} y2={8} {...c} />
        </>
      ) : name === 'trash' ? (
        <>
          <Line x1={4.5} y1={7} x2={19.5} y2={7} {...c} />
          <Path d="M6.5 7 l1 12 a1.6 1.6 0 0 0 1.6 1.5 h5.8 a1.6 1.6 0 0 0 1.6 -1.5 l1 -12" {...c} />
          <Line x1={9.5} y1={7} x2={10} y2={4.5} {...c} />
          <Line x1={14.5} y1={7} x2={14} y2={4.5} {...c} />
          <Line x1={10.5} y1={10.5} x2={10.8} y2={16.5} {...c} />
          <Line x1={13.5} y1={10.5} x2={13.2} y2={16.5} {...c} />
        </>
      ) : name === 'plus' ? (
        <>
          <Circle cx={12} cy={12} r={8} {...c} />
          <Line x1={12} y1={8.2} x2={12} y2={15.8} {...c} />
          <Line x1={8.2} y1={12} x2={15.8} y2={12} {...c} />
        </>
      ) : name === 'more' ? (
        <>
          <Circle cx={5.5} cy={12} r={1.6} fill={color} />
          <Circle cx={12} cy={12} r={1.6} fill={color} />
          <Circle cx={18.5} cy={12} r={1.6} fill={color} />
        </>
      ) : name === 'chevron-down' ? (
        <Polyline points="6 9.5 12 15.5 18 9.5" {...c} />
      ) : name === 'close' ? (
        <>
          <Line x1={6.5} y1={6.5} x2={17.5} y2={17.5} {...c} />
          <Line x1={17.5} y1={6.5} x2={6.5} y2={17.5} {...c} />
        </>
      ) : name === 'chevron-right' ? (
        <Polyline points="9.5 6 15.5 12 9.5 18" {...c} />
      ) : name === 'expand' ? (
        <>
          <Polyline points="4.5 9 4.5 4.5 9 4.5" {...c} />
          <Polyline points="15 4.5 19.5 4.5 19.5 9" {...c} />
          <Polyline points="19.5 15 19.5 19.5 15 19.5" {...c} />
          <Polyline points="9 19.5 4.5 19.5 4.5 15" {...c} />
        </>
      ) : name === 'arrow-up' ? (
        <>
          <Line x1={12} y1={19} x2={12} y2={5} {...c} />
          <Polyline points="7 10 12 5 17 10" {...c} />
        </>
      ) : name === 'arrow-down' ? (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} {...c} />
          <Polyline points="7 14 12 19 17 14" {...c} />
        </>
      ) : name === 'grip' ? (
        <>
          <Circle cx={9} cy={7} r={1.3} fill={color} />
          <Circle cx={15} cy={7} r={1.3} fill={color} />
          <Circle cx={9} cy={12} r={1.3} fill={color} />
          <Circle cx={15} cy={12} r={1.3} fill={color} />
          <Circle cx={9} cy={17} r={1.3} fill={color} />
          <Circle cx={15} cy={17} r={1.3} fill={color} />
        </>
      ) : name === 'person' ? (
        <>
          <Circle cx={12} cy={8.4} r={3.4} {...c} />
          <Path d="M4.8 19.5c.7-3.6 3.5-5.6 7.2-5.6s6.5 2 7.2 5.6" {...c} />
        </>
      ) : name === 'info' ? (
        <>
          <Circle cx={12} cy={12} r={8.6} {...c} />
          <Line x1={12} y1={11.2} x2={12} y2={16.4} {...c} />
          <Circle cx={12} cy={8.2} r={0.95} fill={color} />
        </>
      ) : (
        <Polyline points="5 12.5 10 17.5 19 7.5" {...c} />
      )}
    </Svg>
  );
}
