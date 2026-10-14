/**
 * ORIGINAL equipment icon artwork for LIFT.
 *
 * Same genre rule as muscleIcons.tsx (direction only from Matt's
 * reference screenshots of another app — no copied, traced, or
 * extracted artwork): minimal illustrations on a 48x48 grid, gray
 * structure with the implement itself in orange. Every shape here is
 * an original geometric primitive drawn for this file.
 *
 * Colors come from props (theme muted = structure, theme highlight =
 * orange implement) so the icons work in both light and dark mode.
 */
import type { JSX } from 'react';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { AllGrid, OtherDots } from './iconPrimitives';

export interface EquipmentIconArtProps {
  /** Canonical equipment id from src/kb/taxonomy.ts (or 'All'). Unknown ids fall back to the 'Other' dots. */
  id: string;
  /** Artwork edge length in pt. */
  size: number;
  /** Structure color (theme muted). */
  silhouette: string;
  /** Implement color (theme highlight orange). */
  highlight: string;
}

/** Barbell plates shared by Barbell and Safety Bar. */
function BarbellPlates({ hl }: { hl: string }): JSX.Element {
  return (
    <>
      <Rect x={10.5} y={16} width={3} height={16} rx={1.5} fill={hl} />
      <Rect x={14.5} y={19} width={2.5} height={10} rx={1} fill={hl} />
      <Rect x={34.5} y={16} width={3} height={16} rx={1.5} fill={hl} />
      <Rect x={30.5} y={19} width={2.5} height={10} rx={1} fill={hl} />
    </>
  );
}

export function EquipmentIconArt({ id, size, silhouette, highlight }: EquipmentIconArtProps): JSX.Element {
  const sil = silhouette;
  const hl = highlight;
  let art: JSX.Element;
  switch (id) {
    case 'All':
      art = <AllGrid sil={sil} />;
      break;
    case 'Barbell':
      art = (
        <>
          <Line x1={8} y1={24} x2={40} y2={24} stroke={sil} strokeWidth={2.5} strokeLinecap="round" />
          <BarbellPlates hl={hl} />
        </>
      );
      break;
    case 'Dumbbell':
      // Vertical dumbbell: handle + one weight block at each end.
      art = (
        <>
          <Line x1={24} y1={14} x2={24} y2={34} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Rect x={18.5} y={10} width={11} height={6} rx={1.5} fill={hl} />
          <Rect x={18.5} y={32} width={11} height={6} rx={1.5} fill={hl} />
        </>
      );
      break;
    case 'Kettlebell':
      art = (
        <>
          <Circle cx={24} cy={30} r={9.5} fill={hl} />
          <Rect x={17.5} y={13.5} width={13} height={3} rx={1.5} fill={sil} />
          <Line x1={17.5} y1={15} x2={17.5} y2={24} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Line x1={30.5} y1={15} x2={30.5} y2={24} stroke={sil} strokeWidth={3} strokeLinecap="round" />
        </>
      );
      break;
    case 'Machine':
      // Seated machine frame: two posts, top bar, seat, weight stack.
      art = (
        <>
          <Line x1={12} y1={12} x2={12} y2={38} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Line x1={36} y1={12} x2={36} y2={38} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Line x1={12} y1={12} x2={36} y2={12} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Rect x={20} y={30} width={8} height={3.5} rx={1.75} fill={sil} />
          <Rect x={30} y={26} width={5} height={10} rx={1} fill={hl} />
        </>
      );
      break;
    case 'Bodyweight':
      // Push-up side view: horizontal body, one arm to the floor, floor line.
      // Deliberately gray-only: bodyweight has no implement to highlight.
      art = (
        <>
          <Line x1={17} y1={18} x2={31} y2={18} stroke={sil} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={34} cy={15} r={2.8} fill={sil} />
          <Line x1={21} y1={18} x2={21} y2={31} stroke={sil} strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={17} y1={18} x2={11} y2={31} stroke={sil} strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={8} y1={31.5} x2={38} y2={31.5} stroke={sil} strokeWidth={2} strokeLinecap="round" />
        </>
      );
      break;
    case 'Cardio':
      // Bicycle: gray wheels, orange frame.
      art = (
        <>
          <Circle cx={13} cy={32} r={6} stroke={sil} strokeWidth={2.5} fill="none" />
          <Circle cx={35} cy={32} r={6} stroke={sil} strokeWidth={2.5} fill="none" />
          <Line x1={13} y1={32} x2={22} y2={19} stroke={hl} strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={22} y1={19} x2={35} y2={32} stroke={hl} strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={22} y1={19} x2={27} y2={32} stroke={hl} strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={22} y1={19} x2={19} y2={15} stroke={hl} strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={27} y1={20} x2={30} y2={18} stroke={hl} strokeWidth={2.5} strokeLinecap="round" />
        </>
      );
      break;
    case 'Smith Machine':
      // Guided rails + top bar + base, orange bar with plates.
      art = (
        <>
          <Line x1={12} y1={10} x2={12} y2={38} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Line x1={36} y1={10} x2={36} y2={38} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Line x1={12} y1={10} x2={36} y2={10} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Line x1={10} y1={38} x2={38} y2={38} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Line x1={14} y1={22} x2={34} y2={22} stroke={hl} strokeWidth={2.5} strokeLinecap="round" />
          <Rect x={15} y={16} width={3} height={12} rx={1} fill={hl} />
          <Rect x={30} y={16} width={3} height={12} rx={1} fill={hl} />
        </>
      );
      break;
    case 'Cable':
      // Pulley tower: post, overhead arm, cable, handle.
      art = (
        <>
          <Rect x={12} y={10} width={4} height={28} rx={1.5} fill={sil} />
          <Line x1={14} y1={10} x2={30} y2={10} stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Line x1={30} y1={10} x2={30} y2={26} stroke={sil} strokeWidth={1.5} />
          <Rect x={27.5} y={26} width={5} height={8} rx={2.5} fill={hl} />
        </>
      );
      break;
    case 'Safety Bar':
      // Barbell with a center pad and two short handles (safety squat bar).
      art = (
        <>
          <Line x1={8} y1={24} x2={40} y2={24} stroke={sil} strokeWidth={2.5} strokeLinecap="round" />
          <BarbellPlates hl={hl} />
          <Rect x={20} y={19.5} width={8} height={4.5} rx={2} fill={hl} />
          <Line x1={22} y1={24} x2={22} y2={28} stroke={hl} strokeWidth={2} strokeLinecap="round" />
          <Line x1={26} y1={24} x2={26} y2={28} stroke={hl} strokeWidth={2} strokeLinecap="round" />
        </>
      );
      break;
    case 'Other':
      art = <OtherDots sil={sil} />;
      break;
    default:
      art = <OtherDots sil={sil} />;
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {art}
    </Svg>
  );
}
