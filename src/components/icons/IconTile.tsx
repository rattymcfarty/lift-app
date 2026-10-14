/**
 * IconTile — the rounded-square tile every taxonomy icon sits in.
 * Background is the theme's inset surface, border is the hairline
 * border token, so the tile reads correctly in both light and dark
 * mode. The artwork inside is drawn by the icon modules.
 */
import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';

export interface IconTileProps {
  /** Tile edge length in pt. */
  size: number;
  children: ReactNode;
}

export function IconTile({ size, children }: IconTileProps): JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        // Corner radius is 22% of the tile edge — the reference tile corner proportion.
        borderRadius: Math.max(6, Math.round(size * 0.22)),
        backgroundColor: theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}
