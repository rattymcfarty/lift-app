/**
 * ORIGINAL muscle icon artwork for LIFT.
 *
 * Genre (direction only, from Matt's reference screenshots of another
 * app — no copied, traced, or extracted artwork): a small tile with a
 * gray anatomical-style figure and the working muscle highlighted in
 * blue. Every shape here is an original path drawn for this file on
 * a 48x48 grid: one front figure and one back figure share a body
 * outline; muscle highlights are separate paths layered on top, and a
 * per-muscle viewBox zooms the crop (shoulders, forearms, abs, neck).
 *
 * Colors come from props (theme muted = silhouette, theme highlight =
 * blue) so the icons work in both light and dark mode. Fine
 * definition lines use a translucent black stroke so they read on both.
 *
 * Ids that have a file in assets/icons-src/muscle are rendered from the
 * generated art instead (iconArt.generated.ts, built by
 * scripts/build-icon-art.mjs, style guide in docs/design/ICON_STYLE.md);
 * everything else falls back to the hand-drawn paths below.
 */
import type { JSX } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, SvgXml } from 'react-native-svg';
import { themedIconArt } from '../../lib/iconColors';
import { AllGrid, OtherDots } from './iconPrimitives';
import { MUSCLE_ART } from './iconArt.generated';

export interface MuscleIconArtProps {
  /** Canonical muscle id from src/kb/taxonomy.ts (or 'All'). Unknown ids fall back to the 'Other' dots. */
  id: string;
  /** Artwork edge length in pt. */
  size: number;
  /** Silhouette color (theme muted). */
  silhouette: string;
  /** Highlight color (theme highlight blue). */
  highlight: string;
}

const LINE = '#000000';
const LINE_OPACITY = 0.28;

/** Mirror a left-side shape to the right half of the 48-wide grid. */
function Pair({ children }: { children: JSX.Element | JSX.Element[] }): JSX.Element {
  return (
    <>
      <G>{children}</G>
      <G transform="translate(48 0) scale(-1 1)">{children}</G>
    </>
  );
}

/** Head, neck, torso, arms and legs shared by the front and back figures. */
function Body({ sil, back }: { sil: string; back?: boolean }): JSX.Element {
  return (
    <>
      <Ellipse cx={24} cy={5.4} rx={3.3} ry={3.8} fill={sil} />
      <Path d="M21.5 8.5 L26.5 8.5 L27.2 12.5 L20.8 12.5 Z" fill={sil} />
      {/* torso: shoulder line tapering to the hips */}
      <Path
        d="M13.2 14.6 Q17.5 12 20.8 12.2 L27.2 12.2 Q30.5 12 34.8 14.6 L33.6 20.5 Q32.8 26 31.4 31.6 L28.6 32.6 Q24 33.4 19.4 32.6 L16.6 31.6 Q15.2 26 14.4 20.5 Z"
        fill={sil}
      />
      <Pair>
        {/* shoulder cap, upper arm, forearm */}
        <Circle cx={12.4} cy={16.4} r={3.4} fill={sil} />
        <Path d="M9.2 17 Q7.6 18.6 7.2 22 L6.6 27 Q8.6 28 10.8 27.4 L11.8 22 Q12.4 19 12 17 Z" fill={sil} />
        <Path d="M6.6 27 L5.2 36 Q4.8 37.6 6.4 38 Q8.2 38.2 8.8 36.4 L10.8 27.4 Q8.6 28 6.6 27 Z" fill={sil} />
        {/* thigh and calf */}
        <Path d="M16.6 31 Q14.8 37 16.4 41.4 L22 41.4 Q23.6 36.6 23.4 31.4 Z" fill={sil} />
        <Path d="M16.8 41.4 Q16 44.6 17.4 46.8 L20.6 46.8 Q22 44.4 21.8 41.4 Z" fill={sil} />
      </Pair>
      {/* fine definition lines */}
      <G stroke={LINE} strokeOpacity={LINE_OPACITY} strokeWidth={0.6} fill="none" strokeLinecap="round">
        {back ? (
          <>
            <Line x1={24} y1={12.5} x2={24} y2={32} />
            <Path d="M18.5 15.5 Q24 18.5 29.5 15.5" />
            <Path d="M24 32.4 L24 41" />
          </>
        ) : (
          <>
            <Line x1={24} y1={14} x2={24} y2={30} />
            <Path d="M17.4 21.2 Q24 23.4 30.6 21.2" />
            <Path d="M24 33 L24 41" />
            <Path d="M17.4 40.2 Q19.3 41.2 21.2 40.2 M26.8 40.2 Q28.7 41.2 30.6 40.2" />
          </>
        )}
      </G>
    </>
  );
}

interface Variant {
  /** Square viewBox "x y w w" — crop/zoom for this muscle. */
  box: string;
  back?: boolean;
  /** Highlight layer, drawn on top of the figure. */
  hl: (c: string) => JSX.Element;
}

const FULL = '0 0 48 48';

function variantFor(id: string): Variant | null {
  switch (id) {
    case 'Chest':
      return {
        box: '6 4 36 36',
        hl: (c) => (
          <Pair>
            <Path d="M23.4 15 Q18.4 13.6 14.6 16.2 Q14.2 20.2 17 22 Q21 23 23.4 21.2 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Front Delts':
      return {
        box: '0 6 30 30',
        hl: (c) => <Path d="M13.8 13.2 Q16.4 15.2 15.8 19.6 Q13.6 20.4 11.6 18.4 Q11.4 15.2 13.8 13.2 Z" fill={c} />,
      };
    case 'Middle Delts':
      return {
        box: '0 6 30 30',
        hl: (c) => <Path d="M10.6 13.4 Q7.2 15.2 7.4 19.8 Q9.2 21.2 11.4 19.4 Q12.6 15.8 10.6 13.4 Z" fill={c} />,
      };
    case 'Rear Delts':
      return {
        box: '0 6 30 30',
        back: true,
        hl: (c) => <Path d="M11.6 13.2 Q15.4 14.4 15.8 18.8 Q13.4 20.4 10.6 19 Q9.4 15.6 11.6 13.2 Z" fill={c} />,
      };
    case 'Biceps':
      return {
        box: '0 8 36 36',
        hl: (c) => (
          <Pair>
            <Path d="M9.6 17.8 Q7.8 20.6 8 24.4 Q9.6 25.8 11 24.6 Q11.8 21 11.2 18 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Triceps':
      return {
        box: '0 8 36 36',
        back: true,
        hl: (c) => (
          <Pair>
            <Path d="M9.6 17.8 Q7.4 21 7.8 25 Q9.6 26.4 11.2 25 Q12.2 21 11.4 18 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Forearms':
      return {
        box: '0 18 30 30',
        hl: (c) => <Path d="M7 28 L5.8 35.4 Q5.8 37 7.2 36.8 Q8.4 36.6 9 35 L10.4 28.4 Q8.6 28.8 7 28 Z" fill={c} />,
      };
    case 'Lats':
      return {
        box: '4 6 40 40',
        back: true,
        hl: (c) => (
          <Pair>
            <Path d="M22.6 18 L18.2 16.8 Q15.6 21 17 27.4 L21.8 28 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Upper Back':
      return {
        box: '6 2 36 36',
        back: true,
        hl: (c) => <Path d="M24 11.4 L30 14.6 Q29 19.4 24 23.6 Q19 19.4 18 14.6 Z" fill={c} />,
      };
    case 'Lower Back':
      return {
        box: '6 12 36 36',
        back: true,
        hl: (c) => <Path d="M24 21.6 Q29.4 23.6 30 28.8 Q27.6 32 24 32.4 Q20.4 32 18 28.8 Q18.6 23.6 24 21.6 Z" fill={c} />,
      };
    case 'Neck':
      return {
        box: '8 0 32 32',
        hl: (c) => (
          <>
            <Path d="M21.4 8.4 L26.6 8.4 L27 12.4 L21 12.4 Z" fill={c} />
            <Path d="M20.8 12.4 Q16.8 12.4 14.4 14.4 L17 15.4 Q19.4 13.8 21 13.6 Z" fill={c} />
            <Path d="M27.2 12.4 Q31.2 12.4 33.6 14.4 L31 15.4 Q28.6 13.8 27 13.6 Z" fill={c} />
          </>
        ),
      };
    case 'Abs':
      return {
        box: '8 10 32 32',
        hl: (c) => (
          <>
            {[0, 1, 2].map((i) => (
              <G key={i}>
                <Rect x={19.6} y={18 + i * 3.8} width={3.8} height={3} rx={1.2} fill={c} />
                <Rect x={24.6} y={18 + i * 3.8} width={3.8} height={3} rx={1.2} fill={c} />
              </G>
            ))}
            <Path d="M20.4 29.6 Q24 31.4 27.6 29.6 L27.2 31.2 Q24 32.4 20.8 31.2 Z" fill={c} />
          </>
        ),
      };
    case 'Glutes':
      return {
        box: '6 12 36 36',
        back: true,
        hl: (c) => (
          <Pair>
            <Path d="M23.6 28.6 Q18 27.8 15.8 31.8 Q16.6 36.6 21 36.8 Q24 35.8 23.6 28.6 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Hamstrings':
      return {
        box: '6 12 36 36',
        back: true,
        hl: (c) => (
          <Pair>
            <Path d="M17.6 33 Q15.6 38 17.2 41 Q20 41.6 21.6 40.6 Q22.8 37 22 33 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Quadriceps':
      return {
        box: '6 12 36 36',
        hl: (c) => (
          <Pair>
            <Path d="M18.6 31.8 Q15.6 37 17.4 40.6 Q20.4 41.2 22 39.8 Q23 36 22.4 32 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Abductors':
      return {
        box: '6 12 36 36',
        hl: (c) => (
          <Pair>
            <Path d="M17.6 31.8 Q15.2 36.6 16.6 40.6 L18.8 40.6 Q18.6 36 19.4 31.8 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Adductors':
      return {
        box: '6 12 36 36',
        hl: (c) => (
          <Pair>
            <Path d="M21 32 Q20.2 36.6 20.8 40.6 L22.4 40.6 Q23.6 36 23.2 32 Z" fill={c} />
          </Pair>
        ),
      };
    case 'Calves':
      return {
        box: '8 16 32 32',
        back: true,
        hl: (c) => (
          <Pair>
            <Path d="M17.2 42 Q16.2 44.6 17.4 46.6 L20.6 46.6 Q21.8 44.4 21.4 42 Q19.4 41.2 17.2 42 Z" fill={c} />
          </Pair>
        ),
      };
    default:
      return null;
  }
}

/** All the front-view muscle highlights at once (Full-Body, Olympic). */
function everyMuscle(c: string): JSX.Element {
  const ids = ['Chest', 'Front Delts', 'Biceps', 'Forearms', 'Abs', 'Quadriceps', 'Calves'];
  return (
    <>
      {ids.map((m) => {
        const v = variantFor(m);
        return v ? <G key={m}>{v.hl(c)}</G> : null;
      })}
    </>
  );
}

export function MuscleIconArt({ id, size, silhouette, highlight }: MuscleIconArtProps): JSX.Element {
  const sil = silhouette;
  const hl = highlight;

  // Generated art from assets/icons-src wins; the rest is drawn here.
  const generated = themedIconArt(MUSCLE_ART, id, sil, hl);
  if (generated) {
    // SvgXml returns Element | null, hence the fragment.
    return (
      <>
        <SvgXml xml={generated} width={size} height={size} />
      </>
    );
  }

  if (id === 'All') {
    return (
      <Svg width={size} height={size} viewBox={FULL}>
        <AllGrid sil={sil} />
      </Svg>
    );
  }

  let box = FULL;
  let art: JSX.Element;
  const v = variantFor(id);
  if (v) {
    box = v.box;
    art = (
      <>
        <Body sil={sil} back={v.back} />
        {v.hl(hl)}
      </>
    );
  } else if (id === 'Olympic') {
    // Overhead barbell with plates; legs and shoulders worked.
    art = (
      <>
        <Body sil={sil} />
        <Pair>
          <Path d="M18.6 31.8 Q15.6 37 17.4 40.6 Q20.4 41.2 22 39.8 Q23 36 22.4 32 Z" fill={hl} />
        </Pair>
        <Line x1={4} y1={4.5} x2={44} y2={4.5} stroke={hl} strokeWidth={1.6} strokeLinecap="round" />
        <Rect x={2.4} y={1} width={2.6} height={7} rx={1} fill={hl} />
        <Rect x={43} y={1} width={2.6} height={7} rx={1} fill={hl} />
        <Rect x={6} y={2.2} width={2} height={4.6} rx={0.8} fill={hl} />
        <Rect x={40} y={2.2} width={2} height={4.6} rx={0.8} fill={hl} />
      </>
    );
  } else if (id === 'Full-Body') {
    art = (
      <>
        <Body sil={sil} />
        {everyMuscle(hl)}
      </>
    );
  } else {
    art = <OtherDots sil={sil} />;
  }

  return (
    <Svg width={size} height={size} viewBox={box}>
      {art}
    </Svg>
  );
}
