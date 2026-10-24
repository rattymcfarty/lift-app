/**
 * ORIGINAL equipment icon artwork for LIFT.
 *
 * Same genre rule as muscleIcons.tsx (direction only from Matt's
 * reference screenshots of another app — no copied, traced, or
 * extracted artwork): small illustrated scenes on a 48x48 grid — a
 * gray figure using the equipment, with the implement itself in the
 * accent. Every shape here is an original primitive drawn
 * for this file.
 *
 * Colors come from props (theme muted = figure/structure, theme
 * highlight = accent implement) so the icons work in both light and
 * dark mode. Fine detail uses a translucent black stroke.
 *
 * Ids that have a file in assets/icons-src/equipment are rendered from the
 * generated art instead (iconArt.generated.ts, built by
 * scripts/build-icon-art.mjs, style guide in docs/design/ICON_STYLE.md);
 * everything else falls back to the hand-drawn scenes below.
 */
import type { JSX } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, SvgXml } from 'react-native-svg';
import { themedIconArt } from '../../lib/iconColors';
import { AllGrid, OtherDots } from './iconPrimitives';
import { EQUIPMENT_ART } from './iconArt.generated';

export interface EquipmentIconArtProps {
  /** Canonical equipment id from src/kb/taxonomy.ts (or 'All'). Unknown ids fall back to the 'Other' dots. */
  id: string;
  /** Artwork edge length in pt. */
  size: number;
  /** Structure / figure color (theme muted). */
  silhouette: string;
  /** Implement color (theme accent). */
  highlight: string;
}

const LINE = '#000000';

/** A rounded limb segment. */
function Limb(p: { x1: number; y1: number; x2: number; y2: number; c: string; w?: number }): JSX.Element {
  return <Line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.c} strokeWidth={p.w ?? 4} strokeLinecap="round" />;
}

/** A barbell plate pair seen edge-on, centred at (cx, cy). */
function Plate({ cx, cy, hl, h = 16 }: { cx: number; cy: number; hl: string; h?: number }): JSX.Element {
  return (
    <>
      <Rect x={cx - 2.2} y={cy - h / 2} width={4.4} height={h} rx={1.6} fill={hl} />
      <Rect x={cx - 2.2} y={cy - h / 2 + 0.8} width={1.2} height={h - 1.6} rx={0.6} fill={LINE} fillOpacity={0.18} />
    </>
  );
}

/** Standing figure facing the viewer: head, torso, legs; arms are drawn per icon. */
function Standing({ sil, y = 0 }: { sil: string; y?: number }): JSX.Element {
  return (
    <G transform={`translate(0 ${y})`}>
      <Circle cx={24} cy={9} r={3.6} fill={sil} />
      <Path d="M17.5 14 Q24 12 30.5 14 L29.4 27 L18.6 27 Z" fill={sil} />
      <Limb x1={20.6} y1={27} x2={20} y2={42} c={sil} w={4.2} />
      <Limb x1={27.4} y1={27} x2={28} y2={42} c={sil} w={4.2} />
    </G>
  );
}

export function EquipmentIconArt({ id, size, silhouette, highlight }: EquipmentIconArtProps): JSX.Element {
  const sil = silhouette;
  const hl = highlight;

  // Generated art from assets/icons-src wins; the rest is drawn here.
  const generated = themedIconArt(EQUIPMENT_ART, id, sil, hl);
  if (generated) {
    // SvgXml returns Element | null, hence the fragment.
    return (
      <>
        <SvgXml xml={generated} width={size} height={size} />
      </>
    );
  }

  let art: JSX.Element;
  switch (id) {
    case 'All':
      art = <AllGrid sil={sil} />;
      break;

    case 'Barbell':
      // Bench press: bench, lying figure, loaded bar above the chest.
      art = (
        <>
          <Rect x={8} y={31} width={30} height={4.4} rx={2} fill={sil} />
          <Limb x1={12} y1={35} x2={12} y2={42} c={sil} w={3} />
          <Limb x1={34} y1={35} x2={34} y2={42} c={sil} w={3} />
          <Circle cx={11.6} cy={26.4} r={3.2} fill={sil} />
          <Path d="M16 27 Q26 24.4 33 27 L33 31 L16 31 Z" fill={sil} />
          <Limb x1={36} y1={30} x2={42} y2={36} c={sil} w={3.6} />
          <Limb x1={21} y1={26} x2={21} y2={15} c={sil} w={3.2} />
          <Limb x1={5} y1={13} x2={43} y2={13} c={hl} w={2.4} />
          <Plate cx={7.6} cy={13} hl={hl} h={14} />
          <Plate cx={11.8} cy={13} hl={hl} h={9} />
          <Plate cx={40.4} cy={13} hl={hl} h={14} />
          <Plate cx={36.2} cy={13} hl={hl} h={9} />
        </>
      );
      break;

    case 'Dumbbell':
      // Standing figure with a dumbbell in each hand.
      art = (
        <>
          <Standing sil={sil} />
          <Limb x1={17.6} y1={15.4} x2={12} y2={28} c={sil} w={3.4} />
          <Limb x1={30.4} y1={15.4} x2={36} y2={28} c={sil} w={3.4} />
          <G transform="rotate(-12 11 29)">
            <Rect x={6.4} y={28} width={9.4} height={2.2} rx={1} fill={sil} />
            <Rect x={4.4} y={25.6} width={3} height={7} rx={1.2} fill={hl} />
            <Rect x={14.8} y={25.6} width={3} height={7} rx={1.2} fill={hl} />
          </G>
          <G transform="rotate(12 37 29)">
            <Rect x={32.2} y={28} width={9.4} height={2.2} rx={1} fill={sil} />
            <Rect x={30.2} y={25.6} width={3} height={7} rx={1.2} fill={hl} />
            <Rect x={40.6} y={25.6} width={3} height={7} rx={1.2} fill={hl} />
          </G>
        </>
      );
      break;

    case 'Kettlebell':
      // Kettlebell: round bell, thick arched handle, highlight, floor.
      art = (
        <>
          <Ellipse cx={24} cy={41.6} rx={13} ry={2} fill={sil} fillOpacity={0.5} />
          <Path
            d="M16.4 20 Q16 9.4 24 9.4 Q32 9.4 31.6 20"
            stroke={hl}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={24} cy={30} r={11.4} fill={hl} />
          <Rect x={18} y={19.6} width={12} height={3.2} rx={1.6} fill={hl} />
          <Path d="M17.4 26 Q18.6 21.8 22.6 21.2" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          <Path d="M20 30.2 L28 30.2" stroke={LINE} strokeOpacity={0.25} strokeWidth={1.6} strokeLinecap="round" />
        </>
      );
      break;

    case 'Machine':
      // Seated figure on a selectorized machine: pad, handles, weight stack.
      art = (
        <>
          <Rect x={34} y={12} width={8} height={26} rx={1.6} fill={hl} />
          {[16, 20, 24, 28, 32].map((y) => (
            <Line key={y} x1={34.4} y1={y} x2={41.6} y2={y} stroke={LINE} strokeOpacity={0.3} strokeWidth={1} />
          ))}
          <Line x1={36} y1={5} x2={36} y2={12} stroke={sil} strokeWidth={1.4} />
          <Rect x={30} y={4} width={2.4} height={36} rx={1} fill={sil} />
          <Rect x={7} y={36} width={26} height={4} rx={2} fill={sil} />
          <Rect x={9} y={22} width={4} height={14} rx={2} fill={sil} />
          <Circle cx={21} cy={12.4} r={3.4} fill={sil} />
          <Path d="M17.6 17 L26 17 L26 28 L17.6 28 Z" fill={sil} />
          <Limb x1={19} y1={28} x2={19} y2={36} c={sil} w={4.4} />
          <Limb x1={22.6} y1={17.4} x2={29} y2={11} c={sil} w={3.2} />
          <Limb x1={28.4} y1={8} x2={30.8} y2={14} c={hl} w={2.4} />
        </>
      );
      break;

    case 'Bodyweight':
      // Push-up, side view, on a mat. Gray figure only; the mat is the accent.
      art = (
        <>
          <Rect x={3} y={35.4} width={42} height={3.4} rx={1.7} fill={hl} />
          <Circle cx={38} cy={20.4} r={3.4} fill={sil} />
          <Path d="M10 26.4 Q22 21.8 34 22.6 L34 28.4 Q22 28.6 10 31 Z" fill={sil} />
          <Limb x1={33} y1={25} x2={35} y2={35} c={sil} w={3.6} />
          <Limb x1={11} y1={29} x2={7} y2={35} c={sil} w={3.6} />
          <Limb x1={13} y1={29} x2={11} y2={35} c={sil} w={3.6} />
        </>
      );
      break;

    case 'Cardio':
      // Exercise bike: accent flywheel/frame, gray rider.
      art = (
        <>
          <Limb x1={7} y1={41} x2={36} y2={41} c={sil} w={3} />
          <Circle cx={15} cy={31} r={8} fill={hl} />
          <Circle cx={15} cy={31} r={3.2} fill={LINE} fillOpacity={0.28} />
          <Path d="M15 31 L24 15" stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Path d="M24 15 L21 11" stroke={sil} strokeWidth={3} strokeLinecap="round" />
          <Path d="M24 15 L34 20 L36 15" stroke={sil} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx={30} cy={7.6} r={3.2} fill={sil} />
          <Path d="M28 11 L22 11 L23.6 22 L28.4 14 Z" fill={sil} />
          <Limb x1={26} y1={13} x2={34} y2={20} c={sil} w={3.2} />
          <Limb x1={23} y1={21} x2={30} y2={30} c={sil} w={4} />
          <Limb x1={30} y1={30} x2={25} y2={38} c={sil} w={3.6} />
        </>
      );
      break;

    case 'Smith Machine':
      // Squat inside a Smith frame: gray rails, accent bar and plates.
      art = (
        <>
          <Rect x={5} y={4} width={3} height={36} rx={1.2} fill={sil} />
          <Rect x={40} y={4} width={3} height={36} rx={1.2} fill={sil} />
          <Rect x={4} y={39} width={40} height={3} rx={1.2} fill={sil} />
          <Limb x1={8} y1={13} x2={40} y2={13} c={hl} w={2.4} />
          <Plate cx={11} cy={13} hl={hl} h={13} />
          <Plate cx={37} cy={13} hl={hl} h={13} />
          <Circle cx={24} cy={8.4} r={3.2} fill={sil} />
          <Path d="M19 14.4 Q24 12.6 29 14.4 L28 25 L20 25 Z" fill={sil} />
          <Limb x1={20.8} y1={25} x2={17.4} y2={33} c={sil} w={4.4} />
          <Limb x1={27.2} y1={25} x2={30.6} y2={33} c={sil} w={4.4} />
          <Limb x1={17.4} y1={33} x2={20.4} y2={40} c={sil} w={3.8} />
          <Limb x1={30.6} y1={33} x2={27.6} y2={40} c={sil} w={3.8} />
        </>
      );
      break;

    case 'Cable':
      // Cable tower with a blue stack, pulley and handle; figure pulls.
      art = (
        <>
          <Rect x={4} y={4} width={8} height={36} rx={1.6} fill={hl} />
          {[9, 14, 19, 24, 29, 34].map((y) => (
            <Line key={y} x1={4.4} y1={y} x2={11.6} y2={y} stroke={LINE} strokeOpacity={0.3} strokeWidth={1} />
          ))}
          <Rect x={12} y={3} width={2.6} height={38} rx={1} fill={sil} />
          <Circle cx={13.4} cy={8} r={2.6} fill={sil} />
          <Line x1={13.4} y1={8} x2={30} y2={20} stroke={LINE} strokeOpacity={0.55} strokeWidth={1} />
          <Circle cx={34} cy={16} r={3.4} fill={sil} />
          <Path d="M30 21 Q35 19 40 21 L39 32 L31 32 Z" fill={sil} />
          <Limb x1={31} y1={22} x2={28} y2={20} c={sil} w={3.2} />
          <Rect x={26} y={19} width={4.4} height={2.4} rx={1.2} fill={hl} />
          <Limb x1={32.6} y1={32} x2={32} y2={42} c={sil} w={4} />
          <Limb x1={37.6} y1={32} x2={38.4} y2={42} c={sil} w={4} />
        </>
      );
      break;

    case 'Safety Bar':
      // Safety squat bar: blue bar and padded yoke with forward handles.
      art = (
        <>
          <Circle cx={24} cy={9.6} r={3.4} fill={sil} />
          <Path d="M18.6 17.4 Q24 15.6 29.4 17.4 L28.4 28 L19.6 28 Z" fill={sil} />
          <Limb x1={20.6} y1={28} x2={17.2} y2={35.4} c={sil} w={4.4} />
          <Limb x1={27.4} y1={28} x2={30.8} y2={35.4} c={sil} w={4.4} />
          <Limb x1={17.2} y1={35.4} x2={20.4} y2={42} c={sil} w={3.8} />
          <Limb x1={30.8} y1={35.4} x2={27.6} y2={42} c={sil} w={3.8} />
          <Limb x1={4} y1={16} x2={44} y2={16} c={hl} w={2.4} />
          <Plate cx={7.4} cy={16} hl={hl} h={15} />
          <Plate cx={11.6} cy={16} hl={hl} h={9.4} />
          <Plate cx={40.6} cy={16} hl={hl} h={15} />
          <Plate cx={36.4} cy={16} hl={hl} h={9.4} />
          <Rect x={18} y={13} width={12} height={5.4} rx={2.6} fill={hl} />
          <Path d="M19 18 L16 23 M29 18 L32 23" stroke={hl} strokeWidth={2.2} strokeLinecap="round" fill="none" />
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
