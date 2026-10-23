/**
 * TaxonomyIcon — renders a muscle or equipment icon, tiled by default.
 * Colors come from the active theme (muted silhouette, highlight
 * blue) so icons read correctly in both light and dark mode.
 * Artwork itself lives in muscleIcons.tsx / equipmentIcons.tsx and is
 * original to LIFT — see those files for the copyright note.
 *
 * Muscle icons prefer the 3D mannequin renders (muscleRenders.generated.ts,
 * built by scripts/render/build-icons.py): the muscle is a lit pass baked per
 * theme, so the app just picks a file. Ids with no render, and all equipment
 * icons, use the vector art.
 */
import type { JSX } from 'react';
import { Image } from 'react-native';
import { useTheme } from '../../theme';
import { IconTile } from './IconTile';
import { MuscleIconArt } from './muscleIcons';
import { EquipmentIconArt } from './equipmentIcons';
import { MUSCLE_RENDERS } from './muscleRenders.generated';

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

/** The 3D renders are already padded at build time, so they fill more of the tile. */
const RENDER_SCALE = 0.9;

/**
 * Muscle highlight, sampled from the baked 3D renders (assets/icons-3d) so the
 * vector fallbacks — All, Olympic, Full-Body — sit next to them without a jump.
 * Equipment icons keep the theme's blue highlight.
 */
const MUSCLE_ACCENT = { dark: '#dd7726', light: '#bc591b' } as const;

export function TaxonomyIcon({ kind, id, size, tiled = true }: TaxonomyIconProps): JSX.Element {
  const { theme, mode } = useTheme();
  const artSize = tiled ? Math.round(size * ART_SCALE) : size;
  const render = kind === 'muscle' ? MUSCLE_RENDERS[id] : undefined;

  let art: JSX.Element;
  if (render) {
    const edge = tiled ? Math.round(size * RENDER_SCALE) : size;
    art = (
      <Image
        source={render[mode]}
        style={{ width: edge, height: edge }}
        resizeMode="contain"
        accessible={false}
      />
    );
  } else if (kind === 'muscle') {
    art = (
      <MuscleIconArt
        id={id}
        size={artSize}
        silhouette={theme.colors.muted}
        highlight={MUSCLE_ACCENT[mode]}
      />
    );
  } else {
    art = (
      <EquipmentIconArt
        id={id}
        size={artSize}
        silhouette={theme.colors.muted}
        highlight={theme.colors.highlight}
      />
    );
  }

  if (!tiled) {
    return art;
  }
  return <IconTile size={size}>{art}</IconTile>;
}
