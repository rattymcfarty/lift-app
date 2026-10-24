# Type sizing

How LIFT decides how big text is, and the one rule that keeps screens looking even.

## The rule

> **One size per group of peers, computed once from the width the group has to fit.**

Never let each label shrink by its own amount. `adjustsFontSizeToFit` does exactly that,
and it is why text used to look subtly wrong:

- “All Muscles” sat at 12 pt beside “All Equipment” at 10 pt on the same row.
- A stat tile showing `12,340` came out smaller than its neighbour showing `28`.
- “Train” and “History” in one segmented title rendered at two different sizes.

None of those is a font bug; each is two peers making different decisions. The fix is to
make the decision once.

## Three layers

1. **Tokens** — `src/theme/tokens.ts` (`typography.size`). The only place a size is
   written down: `display 34`, `screen 28`, `screenCompact 24`, `section 20`, `card 18`,
   `row/body 16`, `meta 13`, `caption 12`. A component picks the role, never a number.
2. **Screen scale** — `src/components/workout/setGrid.ts` (`gridMetrics`) and the filter
   grid's icon/padding: proportions and dense-table sizes derived from the window width,
   clamped to 0.84–1.1.
3. **Group fit** — `src/theme/adaptive.ts`. Given the width a group has and its longest
   label, returns the one size every peer in that group uses.

```ts
// one size for a row of three stat tiles
const fit = useGroupFit({ longest, base: t.size.section, min: t.size.meta, count: 3 });
<View onLayout={fit.onLayout} style={{ flexDirection: 'row' }}>
  {items.map((it) => <Text style={{ fontSize: fit.size }} numberOfLines={1}>{it.value}</Text>)}
</View>
```

`fitTextSize(width, { longest, base, min })` is the primitive when the available text
width is already known (a table column, the filter grid's cell).

## What “the width the group has” means

| Case | Width source | Helper |
|---|---|---|
| Two filter chips, equal halves | row measured by `onLayout` | `filterMetrics(gridWidth)` |
| 2-column filter grid | grid measured by `onLayout` | `filterMetrics(gridWidth)` |
| Analytics tiles, readiness options, summary numbers | row measured by `onLayout` | `useGroupFit` |
| Segmented screen titles | window width minus screen padding (no `onLayout` on a flex row) | `fitGroupSize` |
| Set table numbers and column headers | proportional column shares of the window width | `fitTextSize` + `GRID_FLEX` |

Sizes are whole points and clamped to a floor from the type scale (`caption` 12 is the
usual floor; dense table text uses its own floor). A 12 pt floor can be one hair too wide
on a 240 pt window — the floor wins, because unreadable isn't responsive.

## The one exception: lone dynamic headings

`adjustsFontSizeToFit` is allowed only where there is **one** text and **no siblings**:
the screen header title, a program name, the onboarding title. A long dynamic string
shrinks rather than clipping, and there is no neighbour to look inconsistent with.
`scripts/check-typography.mjs` fails the build outside the three files in `FIT_ALLOW`.

Anything in a row, grid, tab bar, table or stat strip is a group. Use the helper.

## Verifying

- `npm run test:adaptive` — purity, bounds, monotonicity, and the frozen results for the
  real screens at 390 / 320 pt.
- `npm run test:filters` — the filter grid's uniformity and fit, unchanged.
- `npm run test:ui` — no raw sizes and no stray autoshrink.
- Device shots at `wm size 1024x…` (390 dp), 840 (320 dp) and 756 (288 dp, Display Zoom).
  Nothing may wrap to a second line or clip; peers must match.
