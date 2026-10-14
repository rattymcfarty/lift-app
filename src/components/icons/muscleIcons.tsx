/**
 * ORIGINAL muscle icon artwork for LIFT.
 *
 * Genre (direction only, from Matt's reference screenshots of another
 * app — no copied, traced, or extracted artwork): a small tile with a
 * simple gray body silhouette and the working muscle highlighted in
 * orange. Every shape here is an original geometric primitive drawn
 * for this file — a circle head, a tapered torso, capsule arms/legs,
 * and simple ellipses/rects/paths for the highlights. Anatomical
 * diagrams are a generic genre; these drawings are our own.
 *
 * All icons share one 48x48 grid and one body figure; the highlight
 * placement is what distinguishes front/back/left/right muscles.
 * Colors come from props (theme muted = silhouette, theme highlight =
 * orange) so the icons work in both light and dark mode.
 */
import type { JSX } from 'react';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { AllGrid, OtherDots } from './iconPrimitives';

export interface MuscleIconArtProps {
  /** Canonical muscle id from src/kb/taxonomy.ts (or 'All'). Unknown ids fall back to the 'Other' dots. */
  id: string;
  /** Artwork edge length in pt. */
  size: number;
  /** Silhouette color (theme muted). */
  silhouette: string;
  /** Highlight color (theme highlight orange). */
  highlight: string;
}

/** The shared body figure: head, neck, tapered torso, capsule arms/legs. */
function BodyFigure({ sil }: { sil: string }): JSX.Element {
  return (
    <>
      <Circle cx={24} cy={6.5} r={3.6} fill={sil} />
      <Rect x={22.2} y={10} width={3.6} height={2.8} rx={1.2} fill={sil} />
      <Path d="M15 15.5 Q24 12.5 33 15.5 L30.5 29 Q24 31 17.5 29 Z" fill={sil} />
      <Line x1={14} y1={17} x2={11} y2={30} stroke={sil} strokeWidth={3.6} strokeLinecap="round" />
      <Line x1={34} y1={17} x2={37} y2={30} stroke={sil} strokeWidth={3.6} strokeLinecap="round" />
      <Circle cx={11} cy={31.5} r={1.8} fill={sil} />
      <Circle cx={37} cy={31.5} r={1.8} fill={sil} />
      <Line x1={20.5} y1={30} x2={19} y2={44} stroke={sil} strokeWidth={4} strokeLinecap="round" />
      <Line x1={27.5} y1={30} x2={29} y2={44} stroke={sil} strokeWidth={4} strokeLinecap="round" />
    </>
  );
}

export function MuscleIconArt({ id, size, silhouette, highlight }: MuscleIconArtProps): JSX.Element {
  const sil = silhouette;
  const hl = highlight;
  let art: JSX.Element;
  switch (id) {
    case 'All':
      art = <AllGrid sil={sil} />;
      break;
    case 'Chest':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={19.5} cy={19} rx={4.2} ry={3} fill={hl} />
          <Ellipse cx={28.5} cy={19} rx={4.2} ry={3} fill={hl} />
        </>
      );
      break;
    case 'Front Delts':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Circle cx={14} cy={16.5} r={2.8} fill={hl} />
          <Circle cx={34} cy={16.5} r={2.8} fill={hl} />
        </>
      );
      break;
    case 'Middle Delts':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={12.3} cy={19.5} rx={2} ry={3.4} fill={hl} />
          <Ellipse cx={35.7} cy={19.5} rx={2} ry={3.4} fill={hl} />
        </>
      );
      break;
    case 'Rear Delts':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={12.8} cy={20} rx={2} ry={3.2} fill={hl} />
          <Ellipse cx={35.2} cy={20} rx={2} ry={3.2} fill={hl} />
        </>
      );
      break;
    case 'Biceps':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={12.6} cy={23} rx={1.9} ry={3.2} fill={hl} />
          <Ellipse cx={35.4} cy={23} rx={1.9} ry={3.2} fill={hl} />
        </>
      );
      break;
    case 'Triceps':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={12.2} cy={23.5} rx={1.9} ry={3.2} fill={hl} />
          <Ellipse cx={35.8} cy={23.5} rx={1.9} ry={3.2} fill={hl} />
        </>
      );
      break;
    case 'Forearms':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={11.3} cy={32.5} rx={1.7} ry={2.8} fill={hl} />
          <Ellipse cx={36.7} cy={32.5} rx={1.7} ry={2.8} fill={hl} />
        </>
      );
      break;
    case 'Lats':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Path d="M16 19 L21 19 L19.5 28 L16.5 27 Z" fill={hl} />
          <Path d="M32 19 L27 19 L28.5 28 L31.5 27 Z" fill={hl} />
        </>
      );
      break;
    case 'Upper Back':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={24} cy={17.5} rx={6.5} ry={3.6} fill={hl} />
        </>
      );
      break;
    case 'Lower Back':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Rect x={19.5} y={24.5} width={9} height={4} rx={2} fill={hl} />
        </>
      );
      break;
    case 'Neck':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Rect x={21.5} y={10.5} width={5} height={3.6} rx={1.8} fill={hl} />
        </>
      );
      break;
    case 'Abs':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Rect x={20.5} y={17.5} width={7} height={11} rx={3} fill={hl} />
        </>
      );
      break;
    case 'Glutes':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={20} cy={30.5} rx={3.2} ry={2.6} fill={hl} />
          <Ellipse cx={28} cy={30.5} rx={3.2} ry={2.6} fill={hl} />
        </>
      );
      break;
    case 'Hamstrings':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={19.8} cy={36.5} rx={2.3} ry={4.2} fill={hl} />
          <Ellipse cx={28.2} cy={36.5} rx={2.3} ry={4.2} fill={hl} />
        </>
      );
      break;
    case 'Quadriceps':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={19.8} cy={36} rx={2.5} ry={4.4} fill={hl} />
          <Ellipse cx={28.2} cy={36} rx={2.5} ry={4.4} fill={hl} />
        </>
      );
      break;
    case 'Abductors':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={17.2} cy={35.5} rx={1.6} ry={4} fill={hl} />
          <Ellipse cx={30.8} cy={35.5} rx={1.6} ry={4} fill={hl} />
        </>
      );
      break;
    case 'Adductors':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={22.3} cy={36} rx={1.6} ry={4} fill={hl} />
          <Ellipse cx={25.7} cy={36} rx={1.6} ry={4} fill={hl} />
        </>
      );
      break;
    case 'Calves':
      art = (
        <>
          <BodyFigure sil={sil} />
          <Ellipse cx={19} cy={41} rx={2.1} ry={2.8} fill={hl} />
          <Ellipse cx={29} cy={41} rx={2.1} ry={2.8} fill={hl} />
        </>
      );
      break;
    case 'Olympic':
      // Barbell across the shoulders over the gray figure (clean / snatch position).
      art = (
        <>
          <BodyFigure sil={sil} />
          <Line x1={12} y1={13} x2={36} y2={13} stroke={hl} strokeWidth={2.5} strokeLinecap="round" />
          <Rect x={12} y={9.5} width={2.5} height={7} rx={1} fill={hl} />
          <Rect x={33.5} y={9.5} width={2.5} height={7} rx={1} fill={hl} />
        </>
      );
      break;
    case 'Full-Body':
      // Whole figure in the highlight color.
      art = <BodyFigure sil={hl} />;
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
