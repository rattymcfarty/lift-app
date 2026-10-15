/**
 * Public surface of the theming system.
 * Screens and components import from this barrel ('../src/theme'), never
 * reach into individual theme files — and never hard-code colors/spacing.
 */
export * from './tokens';
export * from './ThemeProvider';
export * from './breakpoints';
export { withAlpha } from './color';
