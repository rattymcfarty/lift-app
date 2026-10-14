/**
 * Shared icon primitives: the 'All' grid and 'Other' dots used by both
 * muscle and equipment icon sets. Kept here so the two art files do
 * not duplicate the same shapes.
 */
import type { JSX } from 'react';
import { Circle, Rect } from 'react-native-svg';

/** The 2x2 grid used for 'All'. */
export function AllGrid({ sil }: { sil: string }): JSX.Element {
  return (
    <>
      <Rect x={14} y={14} width={8} height={8} rx={2} fill={sil} />
      <Rect x={26} y={14} width={8} height={8} rx={2} fill={sil} />
      <Rect x={14} y={26} width={8} height={8} rx={2} fill={sil} />
      <Rect x={26} y={26} width={8} height={8} rx={2} fill={sil} />
    </>
  );
}

/** Three dots used for 'Other' and as the unknown-id fallback. */
export function OtherDots({ sil }: { sil: string }): JSX.Element {
  return (
    <>
      <Circle cx={18} cy={24} r={2} fill={sil} />
      <Circle cx={24} cy={24} r={2} fill={sil} />
      <Circle cx={30} cy={24} r={2} fill={sil} />
    </>
  );
}
