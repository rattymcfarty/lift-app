/**
 * TaxonomyIcon — renders a muscle or equipment icon, tiled by default.
 * Colors come from the active theme (muted silhouette, highlight
 * orange) so icons read correctly in both light and dark mode.
 * Artwork itself lives in muscleIcons.tsx / equipmentIcons.tsx and is
 * original to LIFT — see those files for the copyright note.
 */
import type { JSX } from 'react';
import { useTheme } from '../../theme';
import { IconTile } from './IconTile';
import { MuscleIconArt } from './muscleIcons';
import { EquipmentIconArt } from './equipmentIcons';

export interface TaxonomyIconProps {
  kind: 'muscle' | 'equipment';
  /** Canonical id from src/kb/taxonomy.ts (or 'All'). Unknown ids render the 'Other' dots. */
  id: string;
  /** Tile edge length in pt (artwork renders at ~78% of this). Ignored when tiled is false — then size is the artwork edge. */
  size: number;
  /** Wrap the artwork in an IconTile. Default true. Pass false for bare artwork (e.g. small toolbar icons). */
  tiled?: boolean;
}

/** Artwork edge as a fraction of the tile edge — leaves tile padding + border visible. */
const ART_SCALE = 0.78;

export function TaxonomyIcon({ kind, id, size, tiled = true }: TaxonomyIconProps): JSX.Element {
  const { theme } = useTheme();
  const art =
    kind === 'muscle' ? (
      <MuscleIconArt
        id={id}
        size={tiled ? Math.round(size * ART_SCALE) : size}
        silhouette={theme.colors.muted}
        highlight={theme.colors.highlight}
      />
    ) : (
      <EquipmentIconArt
        id={id}
        size={tiled ? Math.round(size * ART_SCALE) : size}
        silhouette={theme.colors.muted}
        highlight={theme.colors.highlight}
      />
    );
  if (!tiled) {
    return art;
  }
  return <IconTile size={size}>{art}</IconTile>;
}
