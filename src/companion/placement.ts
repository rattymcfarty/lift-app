/**
 * Route helpers shared by the TopBar and the companion — pure, no React and no
 * native imports, so `scripts/test-companion.mjs` can exercise them directly.
 *
 * Since stage A2 of the layout redesign the companion is fixed in the TopBar
 * centre, so the only screen geometry left here is which routes show the chrome
 * at all (the onboarding wizard and the PAR-Q+ questionnaire hide it).
 */

/** Routes the top bar (and therefore the companion) is never drawn on. */
const HIDDEN_ROUTE_SEGMENTS: readonly string[] = ['onboarding', 'parq'];

/**
 * True on the routes the chrome must stay off: the onboarding / profile wizard
 * (its buttons own the whole first launch) and the PAR-Q+ screening
 * questionnaire (nothing floats over a safety question).
 *
 * `pathname` and `segments` are both accepted so the caller can pass whatever
 * expo-router reports; dynamic groups are covered because the pathname is
 * split on `/` before matching.
 */
export function isCompanionHiddenRoute(pathname: string, segments: readonly string[]): boolean {
  const parts = pathname.split('/').filter((p) => p.length > 0);
  return [...segments, ...parts].some((s) => HIDDEN_ROUTE_SEGMENTS.includes(s));
}

/**
 * True on the four main (tab) screens, which show the panel and settings
 * buttons; inner screens ('/workout/..', '/exercises/abc', '/settings') do not.
 * expo-router reports tab routes without their group: '/', '/programs',
 * '/analytics', '/exercises'. The pathname alone is exact, so segments are ignored.
 */
export function isTopLevelRoute(pathname: string, _segments?: readonly string[]): boolean {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return path === '/' || path === '/programs' || path === '/analytics' || path === '/exercises';
}
