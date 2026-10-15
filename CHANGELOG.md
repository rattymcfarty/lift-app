# Changelog

## 0.1.0 — unreleased (closed-test candidate)

### Added
- Workout logging: sets, warm-ups (excluded from volume), supersets, exercise
  swap, recent exercises, plate calculator, timestamp-based rest timer
- 433-exercise offline catalogue with muscle/equipment/movement filters;
  public KB bundle sync via `channel.json`
- Routines (plans), history, PRs, progression charts, muscle balance, pillars
- Body measurements, calculators, PAR-Q+ screening
- Full JSON export/import; DB excluded from Android auto-backup and iOS backup
- Light/dark/system themes, font scaling capped at 1.3×
- Local signed Android release builds (`npm run build:android`)
- Placeholder app icon and adaptive icon

### Changed
- Navigation redesigned around a bottom tab bar: Programs (Explore | Library,
  start/leave KB programs), Train (Train | History, quick actions),
  Analytics (lifetime / this-week stats, latest PRs, insights, trends) and
  Exercises. Settings via the Train gear; detail screens push above.
- Typography audit: all sizes/weights come from theme tokens (new
  `FONT_WEIGHT`, `semibold`), enforced by `npm run test:ui`; stat values and
  tab labels shrink-to-fit for Dynamic Type 1.3x / 320pt zoomed displays.
- Muscle-group and equipment icons redrawn.
- Catalogue deduped: 577 live exercises (bundle 0.5.0).

### Added (refinement pass)
- Set logging table rebuilt on a shared column grid (labels always align, one
  line per set at any text size); new sets inherit the previous set's
  numbers, and untouched waiting rows inherit a set when it is logged.
- Compact "+ Add set" / "Swap" actions; smaller, calmer type scale and a
  1.15x text-scaling cap (set table 1.1x).
- Create, edit and delete your own exercises (Exercises tab → New).
- Duplicate any plan into your own editable copy.
- Settings → Your data: export a backup (share sheet / Save to Files) and
  import one back, with a preview before anything is changed.

### Notes
- Media is parked: all exercises use the standard placeholder image.
- Icon is a placeholder; final artwork pending.
