/**
 * Design tokens for LIFT — the single source of truth for color, spacing,
 * type, radius, and breakpoints.
 *
 * Aesthetic (from Matt's chosen reference screenshots, layout/hierarchy
 * direction only — no copied branding/artwork): near-black surfaces, dark
 * charcoal rounded cards, large bold white titles, purple for exercise
 * titles and the Finish action, blue for numbers, active-card borders,
 * focused inputs, and check circles, muted gray small-caps column
 * headers, values in darker inset pills.
 *
 * Color discipline: exactly TWO brand colors, each with one job.
 * - `accent` (purple) — primary actions, exercise titles, the Finish action.
 *   Nothing else.
 * - `highlight` (blue) — set numbers, the active-card border, the
 *   focused-input border, and the log/check circle. Nothing else.
 * Semantic colors (success/danger/warning) exist for confirmations and
 * safety messaging only — never for decoration. Success is a distinct
 * teal so it can't be mistaken for the purple/blue action colors.
 * Screens must consume these tokens; never hard-code colors, spacing,
 * or font sizes.
 *
 * Contrast: text colors target WCAG AA (4.5:1) against their backgrounds —
 * this app is read mid-workout, often at arm's length.
 *
 * Modes: `lightTheme` and `darkTheme` are fully specified here. The
 * ThemeProvider resolves which one is active from the user's persisted
 * preference ('light' | 'dark', default 'dark'). The dark theme IS the
 * reference look; the light theme is the same layout with light surfaces.
 * No network, no analytics — pure local UI.
 */

import type { TextStyle } from 'react-native';

/** How the user wants the theme chosen. In-app setting only — the app does
 *  not follow the OS setting; the persisted preference always wins. */
export type ThemePreference = 'light' | 'dark';

/** The resolved mode after applying the preference. */
export type ResolvedThemeMode = 'light' | 'dark';

export interface ColorTokens {
  /** App background. */
  background: string;
  /** Cards, sheets, raised surfaces. */
  surface: string;
  /** Inset pills / inputs — darker than the card in dark mode, slightly
   *  darker than the card in light mode. Values live here. */
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
   * PURPLE — exercise titles + the Finish action. Do not use it for
   * decoration, charts, or secondary buttons.
   */
  accent: string;
  /** Text drawn on top of the accent color (contrast-safe). */
  accentText: string;
  /**
   * BLUE — set numbers, the active-card border, the focused-input
   * border, and the log/check circle. Do not use it for decoration.
   */
  highlight: string;
  /** Glyph drawn on top of the highlight color (contrast-safe). */
  highlightText: string;
  /** Destructive actions and errors. */
  danger: string;
  /** Confirmations (PRs, completed syncs). Teal — distinct from purple/blue. */
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
    /** 600 — list row titles, button labels where bold is too heavy. */
    semibold: TextStyle['fontWeight'];
    bold: TextStyle['fontWeight'];
  };
  /**
   * The single type scale. Every Text in the app uses one of these roles —
   * no ad-hoc font sizes. Hierarchy comes from role + weight + color, not
   * from inventing sizes per screen (Apple HIG: 11 styles; we ship 8 text
   * roles + 1 glyph token + 1 brand token). Sizes are pt at the Default
   * Dynamic Type setting; text still scales with the OS setting.
   */
  size: {
    /** 34 — hero numbers (total volume, PRs, timer readouts). */
    display: number;
    /** 28 — top-level screen titles (ScreenHeader). */
    screen: number;
    /** 24 — screen-title size below 360pt logical width (Display Zoom). */
    screenCompact: number;
    /** 20 — section titles, stat values. */
    section: number;
    /** 18 — card titles (plan names, exercise names in cards). */
    card: number;
    /** 16, semibold at call sites — list row titles, button labels. */
    row: number;
    /** 16 — primary reading text. */
    body: number;
    /** 13 — metadata, timestamps. */
    meta: number;
    /** 12 — captions, column headers, small labels. */
    caption: number;
    /** 24 — glyph icons (back arrow). */
    icon: number;
    /** 26 — the LIFT wordmark (with letterSpacing). Brand only. */
    brand: number;
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

/**
 * Font weights as static constants — usable in StyleSheet.create() where the
 * theme hook isn't available. The ONLY place raw weight values may appear.
 */
export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

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
    weight: FONT_WEIGHT,
    size: {
      display: 34,
      screen: 28,
      screenCompact: 24,
      section: 20,
      card: 18,
      row: 16,
      body: 16,
      meta: 13,
      caption: 12,
      icon: 24,
      brand: 26,
    },
  },
  radius: { sm: 4, md: 8, lg: 20, pill: 999 },
  breakpoints: { phone: 0, largePhone: 430, tablet: 600 },
};

export const lightTheme: Theme = {
  colors: {
    background: '#f2f2f7',
    surface: '#ffffff',
    surfaceMuted: '#e9e9ee',
    text: '#111111',
    muted: '#5c5c60',
    faint: '#67676c',
    border: '#dddde2',
    accent: '#6c3fd1',
    accentText: '#ffffff',
    highlight: '#1a69c8',
    highlightText: '#ffffff',
    danger: '#c81e1e',
    success: '#0f766e',
    warning: '#b45309',
  },
  ...shared,
};

export const darkTheme: Theme = {
  colors: {
    background: '#0a0a0a',
    surface: '#1c1c1e',
    surfaceMuted: '#101012',
    text: '#ffffff',
    muted: '#a1a1a6',
    faint: '#7c7c82',
    border: '#2a2a2e',
    accent: '#a073f0',
    accentText: '#000000',
    highlight: '#4b98e8',
    highlightText: '#000000',
    danger: '#ff453a',
    success: '#2dd4bf',
    warning: '#ffb340',
  },
  ...shared,
};
