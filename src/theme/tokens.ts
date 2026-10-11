/**
 * Design tokens for LIFT — the single source of truth for color, spacing,
 * type, radius, and breakpoints.
 *
 * Aesthetic: monochrome precision instrument. Near-black surfaces, hairline
 * borders, sharp type that stays legible mid-set with sweaty hands.
 *
 * Accent discipline: there is exactly ONE accent color (green), reserved for
 * the primary action (completing a set). Semantic colors (success/danger/
 * warning) exist for confirmations and safety messaging only — never for
 * decoration. Success is a distinct teal so it can't be mistaken for the
 * accent action color. Screens must consume these tokens; never hard-code
 * colors or spacing.
 *
 * Contrast: text colors target WCAG AA (4.5:1) against their backgrounds —
 * this app is read mid-workout, often at arm's length.
 *
 * Modes: `lightTheme` and `darkTheme` are fully specified here. The
 * ThemeProvider resolves which one is active from the user's preference
 * ('light' | 'dark' | 'system'). No network, no analytics — pure local UI.
 */

import type { TextStyle } from 'react-native';

/** How the user wants the theme chosen. 'system' follows the OS setting. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** The resolved mode after applying the preference. */
export type ResolvedThemeMode = 'light' | 'dark';

export interface ColorTokens {
  /** App background. */
  background: string;
  /** Cards, sheets, raised surfaces. */
  surface: string;
  /** Pressed states, disabled surfaces, subtle fills. */
  surfaceMuted: string;
  /** Primary text. */
  text: string;
  /** Secondary text (labels, metadata). */
  muted: string;
  /** Tertiary text (captions, timestamps). Meets 4.5:1 on background
   *  and muted surfaces. */
  faint: string;
  /** Hairline borders and dividers. Decorative only — never the sole visible
   *  boundary of an interactive control (WCAG 1.4.11 wants 3:1 there);
   *  add a dedicated token if a control needs a high-contrast edge. */
  border: string;
  /**
   * THE accent color — reserved for the primary action (completing a set).
   * Do not use it for decoration, charts, or secondary buttons.
   */
  accent: string;
  /** Text drawn on top of the accent color (contrast-safe). */
  accentText: string;
  /** Destructive actions and errors. */
  danger: string;
  /** Confirmations (PRs, completed syncs). Teal — distinct from accent. */
  success: string;
  /** Safety notices (RPE caps, deloads). Meets 4.5:1 for safety text. */
  warning: string;
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
  /**
   * Font family override. `undefined` = platform system font (recommended:
   * zero native config, Expo Go compatible). Set a family name here only
   * if a custom font is ever bundled.
   */
  family: string | undefined;
  weight: {
    regular: TextStyle['fontWeight'];
    medium: TextStyle['fontWeight'];
    bold: TextStyle['fontWeight'];
  };
  size: {
    /** 12 — metadata, timestamps, captions. */
    caption: number;
    /** 16 — primary reading text. */
    body: number;
    /** 22 — section titles. */
    title: number;
    /** 40 — hero numbers (total volume, PRs). */
    display: number;
  };
}

export interface RadiusTokens {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

/**
 * Responsive breakpoints as min-width thresholds (dp).
 * phone: <430 · largePhone: 430–599 · tablet: 600+.
 * The 600dp tablet threshold follows Android's sw600dp convention and covers
 * iPad mini in portrait (744pt) plus most Android tablets (600–767dp).
 * Layouts must be flexible — never fixed phone frames (R17).
 */
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

/** Mode-independent tokens, defined once so the two themes can't drift. */
const shared: {
  spacing: SpacingTokens;
  typography: TypographyTokens;
  radius: RadiusTokens;
  breakpoints: BreakpointTokens;
} = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  typography: {
    family: undefined,
    weight: { regular: '400', medium: '500', bold: '700' },
    size: { caption: 12, body: 16, title: 22, display: 40 },
  },
  radius: { sm: 4, md: 8, lg: 16, pill: 999 },
  breakpoints: { phone: 0, largePhone: 430, tablet: 600 },
};

export const lightTheme: Theme = {
  colors: {
    background: '#fafafa',
    surface: '#ffffff',
    surfaceMuted: '#f4f4f5',
    text: '#09090b',
    muted: '#52525b',
    faint: '#6b6b73',
    border: '#e4e4e7',
    accent: '#15803d',
    accentText: '#ffffff',
    danger: '#c81e1e',
    success: '#0f766e',
    warning: '#b45309',
  },
  ...shared,
};

export const darkTheme: Theme = {
  colors: {
    background: '#09090b',
    surface: '#111113',
    surfaceMuted: '#1b1b1f',
    text: '#fafafa',
    muted: '#a1a1a1',
    faint: '#86868e',
    border: '#26262b',
    accent: '#22c55e',
    accentText: '#052e16',
    danger: '#f87171',
    success: '#2dd4bf',
    warning: '#fbbf24',
  },
  ...shared,
};
