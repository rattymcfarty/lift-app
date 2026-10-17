# Changelog

## Unreleased (addendum)

- Companion skins: Pip now wears the owner's illustrated mouse by default —
  `src/companion/ImageSkin.tsx` animates the one flat PNG with transforms only
  (built-in `Animated`, native driver, no new dependency): idle float +
  breathing, a periodic blink, mood hop/wiggle/droop/drifting-"z", cheer/PR
  sparkles and a ground shadow that shrinks as it hops. The procedural SVG
  creature stays as the alternative skin; Settings → Companion → Style (Mouse
  default / Blob) persists as `companionStyle` and rides in backups. The overlay
  box grew 64 → 80 dp and the speech bubble still points at the character;
  `docs/product/COMPANION.md`, `scripts/test-companion.mjs` (skin selection).
- Workout logging: the per-exercise "⋯" actions menu is reworked into a shared
  full-width bottom sheet (`src/components/ui/BottomSheet.tsx`) — dimmed backdrop,
  slide-up spring, tap-backdrop / swipe-header-down to dismiss, safe-area padding,
  line icons (no emoji) and theme tokens only. Rows: Add Warmup Sets, Add Exercise
  Note, Rest Timer (30/45/60/90/120/180/300s + Use default), Auto Progression
  (Auto/On/Off with an explanation), Reorder Exercises, View Demo & History,
  Weight Unit (inline lb|kg, accent = active), Create Superset, Swap, Remove.
  Several rows previously did nothing (Reorder, View Demo & History, Weight Unit,
  Create Superset) and now work. Add Warmup Sets builds a ramp at 50/70/85% of the
  first working set (reps 5/3/2), or two empty rows when no weight is known,
  idempotently and without touching logged sets. Reorder opens a full sheet
  (REFERENCE B) that persists `workout_exercises.position` in one transaction under
  `withWriteLock` (up/down + haptics; logged sets stay attached). Create Superset
  uses the existing `workout_exercises.superset_id` column (no migration); grouped
  cards keep the accent container and the rest timer fires after the group's last
  exercise. The exercise-card footer is now a single light-text row — "(+) Add Set"
  and "Swap" on the left, "⋯" on the right — and the card header shows the index
  number and a collapse/expand chevron. New pure logic `src/lib/exerciseMenu.ts`
  (`moveItem`, `warmupRamp`, `REST_PRESETS`) with `scripts/test-exercise-menu.mjs`
  (wired into `scripts/dev-loop.sh`) and `.maestro/exercise-menu.yaml`.
- Exercises tab: a "Core & foundational" section now heads the library — the owner's
  curated 46 movements, in the owner's order, then "All exercises". Search and the
  muscle/equipment filters apply to both groups (a group with no matches hides its
  header). Ids: `src/lib/foundational.ts` (per-id display-name comments; four of the
  owner's 50 names have no live catalogue entry); sectioning: `src/lib/exerciseSections.ts`;
  test: `scripts/test-foundational.mjs` (wired into `scripts/dev-loop.sh`).
- Companion foundation: a small floating avatar ("Pip") over every screen —
  `src/companion/` (pure message queue with priority/dedupe/eviction/expiry,
  `say()` API, SVG placeholder `Creature`, themed speech bubble, draggable
  overlay that snaps to a corner and remembers its position). Settings →
  Companion toggle (default ON) hides it completely; reduce-motion respected;
  messages announced to screen readers. Wired to a few existing events only
  (set logged, workout finished, PRs, session-ready). New: `npm run
  test:companion` (`.maestro/companion.yaml`), `docs/product/COMPANION.md`.
- Cross-agent foundation: `AGENTS.md` is the canonical guide for any harness
  (Claude Code, OpenCode, Codex/ChatGPT, Hermes, Gemini CLI, Cursor, Copilot); shared
  playbooks in `.agents/skills/`; `docs/ops/AGENT_COLLABORATION.md`; `npm run test:agents`.
- Delegation to an OpenCode helper agent on free models (`scripts/delegate.sh`, MCP tool
  `delegate_to_opencode_free`, Jev-based model router): `docs/ops/DELEGATION.md`.

- Program builder: deload-week control (half volume, marked ↓ on the week chip) and "Copy week N to…" (one week or all others).
- Fix: starting a workout from a plan or a program day now pre-fills the exercise
  cards with the plan's set rows (sets × reps, plus planned weight/RPE). Previously
  every card opened empty ("+ Add set" only) because `startWorkoutFromRoutine` copies
  only the rest override and notes — `workout_exercises` has no set/reps columns, so the
  plan's targets never reached the logging screen. The rows are ordinary *unlogged*
  pending rows seeded from the routine item (`src/data/plannedSets.ts`), so history,
  stats and auto-finish still count only sets the user actually logs. Cards only seed
  when the workout came from a routine, nothing is logged yet, and the item declares
  `targetSets`; templates that never had targets open exactly as before.
  Unit test: `scripts/test-planned-sets.mjs`.
- Fix: removing/replacing program days left their `kb_id` held by soft-deleted routines (UNIQUE error on renumber).
- Fix: leaving a program works again. Enrolling re-took the database write lock
  from inside itself (`enrollProgram` → `ensureSessionStates`), which deadlocked;
  every later write, including Leave program, then waited forever. Enrollment now
  uses a lock-free `insertSessionStates`. New Maestro flow
  `.maestro/program-leave.yaml` covers enroll then leave.

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

### Added (program details pages, 2026-10-15)
- Create/edit flow with the multi-page "Program Details" layout: page 1 name
  (50), tagline (160), description (3000), thumbnail; page 2 time per workout,
  focus (multi), equipment (one), difficulty (multi); then the weeks/days
  builder. Editing re-opens the same pages from the ✎ next to the title.
- The choices are functional: equipment pre-filters the exercise picker while
  building days; time per workout sets each day's estimated minutes; tagline
  becomes the program goal; thumbnail is copied into app storage (device only,
  not in backups).

### Added (program builder, 2026-10-15)
- Build your own multi-week programs: name, duration (1–52 weeks), "Repeating
  weeks" or "Different weeks" (plan every week), up to 7 days per week, each day
  a full plan with sets/reps targets. Day actions: rename, duplicate, move,
  delete. Start it like any program (PAR-Q+ gate, scheduling and progression
  reuse the program engine). Programs are included in backups.
- Library: "My programs" (Start / Edit, swipe to delete) separate from "My plans".

### Fixed
- Plan builder's Add exercise picker now has the same Muscles / Equipment
  filters (with clear buttons and a filtered empty state) as the workout picker;
  the filter chip is a shared component.

### Added (workout lifecycle, 2026-10-15)
- LIFT now tracks workout activity. A workout that goes quiet triggers a
  "Still working out?" prompt (Resume / Finish / Discard-if-empty), local
  notifications nudge in between, and an abandoned workout is finished
  automatically **at your last activity** (empty ones are discarded; duplicates
  are closed). Train shows "paused" state and a "finished automatically" notice.
- Settings → Workout check-ins: ask after 30/45/60/90 min, finish after
  2/3/4 h or never.

### Changed (proportional layout, 2026-10-15)
- Set table rebuilt on proportional columns (they always total 100% of the
  row), a merged kg | reps | RPE input pill, hairline row separators and sizes
  derived from window width — identical structure at any iOS Display Zoom or
  phone width (verified from ~288 dp to ~514 dp and at 1.3x text).
- Workout toolbar: icon-over-label buttons; header titles and tab icons scale
  continuously with width instead of a single breakpoint.

### Changed (interaction polish, 2026-10-15)
- Swipe LEFT to remove, swipe RIGHT to add: a set row adds a pre-filled set, an
  exercise card opens Add exercise, a plan duplicates, a plan exercise row adds
  an exercise; swipe left also removes workouts, measurements and your own
  exercises (confirmed whenever more than one row goes).
- Prefilled weights now honour the display unit (lb users no longer get kg
  numbers carried into lb fields).
- Exercise lists show the muscle icon and the muscles trained; multi-select
  rows get a gold bar, tint, bold name and a filled check; the add button
  reads "Add N exercises".
- Rounded, aligned remove buttons on set rows; header columns no longer wrap.

### Added (P9 — personalisation & feel)
- First-launch onboarding: profile (name, weight, height, birth year,
  experience, goal, days, session length, equipment, limitations) and a
  rule-based plan generator that builds editable "My Plan · Day N" workouts
  with conservative, body-sized starting loads. Edit anytime in Settings.
- Train: week strip + weekly goal bar, one-tap readiness check-in with effort
  advice, suggested next workout (rotation), greeting.
- Motion & feedback: haptics on logging, logged sets ease in, animated
  progress bar, workout celebration with the records you set.
- Workout reminders (local notifications, per weekday and time).
- Backup now also carries profile, settings, reminders and theme.

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
