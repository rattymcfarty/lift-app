/**
 * Theming tokens — STRUCTURE ONLY (P0 scaffold).
 *
 * Real token values (light/dark palettes, type scale, spacing, radius,
 * breakpoints) land in Phase 1, before any feature screens are built.
 * Screens must consume these tokens — never hard-code colors/spacing.
 */

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  muted: string;
  accent: string;
  danger: string;
  success: string;
}

export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface TypographyTokens {
  /** font family names; families land in P1 */
  family: { regular: string; medium: string; bold: string };
  size: { caption: number; body: number; title: number; display: number };
}

export interface RadiusTokens {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

/** Responsive breakpoints (P1: phone / large-phone / tablet layouts). */
export interface BreakpointTokens {
  phone: number;
  largePhone: number;
  tablet: number;
}

export interface Theme {
  colors: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  radius: RadiusTokens;
  breakpoints: BreakpointTokens;
}

/**
 * Placeholder themes so structure type-checks.
 * TODO(P1): replace with the designed light/dark token sets.
 */
const placeholder = (mode: 'light' | 'dark'): Theme => ({
  colors: {
    background: mode === 'dark' ? '#0a0a0a' : '#ffffff',
    surface: mode === 'dark' ? '#171717' : '#f5f5f5',
    surfaceMuted: mode === 'dark' ? '#262626' : '#e5e5e5',
    text: mode === 'dark' ? '#fafafa' : '#0a0a0a',
    muted: mode === 'dark' ? '#a1a1a1' : '#737373',
    accent: '#22c55e',
    danger: '#ef4444',
    success: '#22c55e',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  typography: {
    family: { regular: 'System', medium: 'System', bold: 'System' },
    size: { caption: 12, body: 16, title: 24, display: 40 },
  },
  radius: { sm: 4, md: 8, lg: 16, pill: 999 },
  breakpoints: { phone: 0, largePhone: 430, tablet: 768 },
});

export const lightTheme: Theme = placeholder('light');
export const darkTheme: Theme = placeholder('dark');
