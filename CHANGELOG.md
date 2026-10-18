# Changelog

## Unreleased (addendum)

- Icons (fidelity pass): `Calves.svg` now shows **both** lower legs with the gastrocnemius
  bellies highlighted (it was one leg, which the reference crop never was); `Forearms.svg`
  is a single arm on a diagonal with an open hand, so the flexor mass fills the tile;
  `Biceps.svg` gets a full belly from the deltoid seam to the elbow instead of a thin sliver;
  `Neck.svg` drops the floating deltoid caps that read as bolts and widens the
  sternocleidomastoid and upper-trap highlight. Original vector work throughout — the
  reference screenshots set the genre, nothing is traced or copied from them. The contact
  sheet renders in the real theme colours, so what you see is what the app draws.

- Exercise guides (E): the knowledge base gained the four movements the curated
  foundational list was missing — **Bird Dog**, **Cable Woodchops**, **Rowing
  Machine** and **Outdoor Cycling** — so all 50 names now resolve to a live page
  (`src/lib/foundational.ts` has no placeholder comments left), and the app ships
  KB bundle **0.6.0** (631 pages, 581 live) in `assets/kb/snapshot`. Six pages are
  the pilot for the rich-page rewrite: `longevityNotes` carries `### `
  subheadings (*why this matters for a long life · rhythm and tempo · keeping it
  for life*), the instructions spell out the tempo, every page has a one-line
  motivation blockquote and a safety note that says when to stop and who should
  regress. `barbell-squat` and `barbell-deadlift` also lose their imported Free
  Exercise DB prose (it referred to a "foot stances section" that does not exist)
  for clean steps, real common mistakes and a safety note. On the detail screen
  the Overview card now shows the KB steps alone — the raw steps ride in
  `kbDetailJson.instructions` — so the How-to card below it no longer repeats the
  cues, mistakes and safety note (older rows fall back to the stored composite
  text). New Maestro flow `.maestro/exercise-detail.yaml`.

- Icons (D): muscle art redrawn where the highlight was too thin or the crop
  wrong, and the whole equipment set moved into the art pipeline. **Biceps** now
  has a real belly on each upper arm instead of a stripe; **Front Delts** and
  **Middle Delts** are deltoid caps wrapped from the clavicle to the armpit at
  the same zoom `Rear Delts` uses; **Neck** is a sternocleidomastoid plus upper
  traps rather than a rectangle; **Olympic** is a grey figure with clean
  traps/delts/glutes/quads instead of overlapping blobs; **Other** is three
  separated dots; **Forearms** and **Calves** are drawn as **one limb at a larger
  scale** (a symmetric crop of the whole figure cannot make those muscles fill the
  tile) — the only two icons that are not a window onto the shared figure, and
  `docs/design/ICON_STYLE.md` now says so. All ten equipment ids render from
  `assets/icons-src/equipment/` instead of half of them silently falling back to
  the older hand-drawn React scenes: barbell (bench press), dumbbell (standing
  hold), kettlebell (held at the chest), machine (selectorised), bodyweight
  (push-up on a mat), cardio (bike), smith machine, cable and safety bar — figure
  in the theme's muted colour, implement in the theme highlight, so light and dark
  both get the app's blue and the `#ff7a1a` in the sources stays an authoring
  placeholder that never reaches a screen. `scripts/build-icon-art.mjs` now fails
  when a taxonomy id has no art file (how the equipment set drifted), and
  `scripts/render-icons.mjs` draws its contact sheet in the real light/dark theme
  colours and takes `--only=muscle|equipment`; `npm run test:icons` (63
  assertions) guards the sheet's palette against drifting from the theme tokens.
  The exercise detail page now draws each equipment entry with its icon, as the
  muscle rows already did.

- Sheets (layout redesign C follow-up): three problems the emulator caught. The
  **pull down to close was dead on Android**: inside a `Modal` the move-phase
  responder negotiation is never dispatched to a view (measured — the header gets

- Sheets (layout redesign C follow-up): three problems the emulator caught. The
  **pull down to close was dead on Android**: inside a `Modal` the move-phase
  responder negotiation is never dispatched to a view (measured — the header gets
  the raw touches and the down-phase negotiation, but `onMoveShouldSetResponder`
  and its capture twin are never called), so a move-only `PanResponder` could
  never claim the gesture; the header now claims at touch-down and follows the
  finger, and a tap still goes to the child first, so the close button keeps
  working. A **tall sheet collapsed to its content** instead of capping at
  `maxHeightRatio` — the cap moved to the wrapper `Animated.View` with
  `flexShrink: 1` on the glass. The flow's pull-down now uses real screen
  coordinates, because Maestro's "swipe from this element" only travels the
  grabber's own 4 dp.

- Sheets (layout redesign C): **every bottom sheet is now the same glass
  component**. `BottomSheet` (`src/components/ui/BottomSheet.tsx`) keeps its
  dimmed backdrop, slide-up spring and safe-area padding but draws its surface
  with the shared `Glass` (heavy), rounded at the top and square at the bottom,
  with a soft shadow; its header — grabber, title/subtitle, close — moved to
  `src/components/ui/SheetHeader.tsx` so no two sheets can drift apart. The
  drag-to-dismiss maths (claim the pull, follow the finger, dismiss past 90 dp)
  lives in the pure, unit-tested `src/components/ui/sheetModel.ts` and is shared
  by `useSheetDrag`. `OptionSheet` is now a thin wrapper over `BottomSheet`
  instead of a second hand-rolled modal: the program pickers (schedule, duration,
  deload, copy week, day actions) get the same glass and header, their option
  test ids (`schedule-sheet-custom`, `minutes-sheet-45`, …) are unchanged, and
  the redundant bottom **Cancel** button is gone — the header close, a backdrop
  tap, a pull down or Android back all dismiss. The plate calculator, the muscle
  group sheet and the rest timer were three more copies of the same chrome; they
  now render `BottomSheet` too (same ids plus a header close), and the rename
  dialog (`TextPromptModal`) uses the glass surface. New `scripts/test-sheet.mjs`
  (`npm run test:sheet`, 11 checks) and Maestro flow `.maestro/sheets.yaml`
  (opens the sheet, dismisses it by pull-down and by backdrop tap).

- Navigation (layout redesign B): the two top-bar buttons now open **side
  panels** (`src/components/chrome/SidePanels.tsx`, mounted once in
  `app/_layout.tsx` above the bar so an open panel covers the whole app).
  **Left** (`LeftPanel.tsx`, top-left button): a quick **New workout**, a
  **Search exercises** shortcut that lands on Browse Exercises with the field
  focused, the four **sections** — tap to jump, or **long-press and drag** to
  reorder the floating bar (persisted through `src/nav/tabOrder.ts`) — and a
  **More** list (History, Records, Balance, Calculators, Body weight). **Right**
  (`RightPanel.tsx`, sliders button): the Settings controls, embedded. Both are
  glass, with a dimmed scrim behind. They close on scrim tap, the panel's close
  button, any item tap or Android back — **tap only, no swipe-to-close**. The
  panel state transitions (`panelsReducer`) and the drag maths
  (`dragTargetIndex` / `shiftForIndex`) live in the pure, unit-tested
  `src/chrome/panelsModel.ts` (`scripts/test-panel.mjs`); the tab table moved to
  `src/nav/tabs.ts` so the bar and the panel read one list, and the Settings
  body was extracted to `src/components/settings/SettingsBody.tsx` so the screen
  and the panel can't drift. New Maestro flow `.maestro/panels.yaml`.

- Navigation (layout redesign A3): the standard bottom bar is replaced by a
  **floating pill of glass** (`src/components/nav/TabBar.tsx`, used through the
  `Tabs` `tabBar` prop in `app/(tabs)/_layout.tsx`). It is inset 16 dp from both
  sides, sits 8 dp above the safe-area bottom and is **icon only**: the active
  tab gets a translucent accent capsule behind its icon with the icon in the
  accent colour, inactive icons stay muted, a tap fires a selection haptic and
  the bar slides away while the keyboard is up. Accessibility labels and roles
  (`tab`) are on every item and the Maestro test ids (`tab-programs`,
  `tab-train`, `tab-analytics`, `tab-exercises`) are unchanged. Because the bar
  floats OVER the screens, the new `useTabBarSpace()` hook (bar + gap + safe-area
  bottom) is added to the bottom padding of every scrollable on the four tab
  screens and of the embedded History list, so nothing hides behind it. The
  order of the items now lives in `src/nav/tabOrder.ts` — pure, unit-tested
  `normalizeOrder` / `moveTab` plus an AsyncStorage-backed store under
  `lift:tab-order`, whitelisted in `src/data/appData.ts` so it rides in backups;
  the default order is unchanged (Programs · Train · Analytics · Exercises).

- Companion (layout redesign A2): Pip is **no longer a draggable, floating
  overlay**. It is fixed in the **centre of the TopBar**, inside a ~48 dp
  circular glass ring (`Glass`), with the mouse artwork drawn larger and clipped
  to the circle (`overflow: hidden` + `borderRadius`) so the face and upper body
  fill it; the float/breathe/blink/hop/sparkle animations still run and are
  clipped inside the ring. The speech bubble now renders **centred below the
  ring** (below the top bar) with a tail pointing up at it, at most ~80 % of the
  window wide. `TopBar` renders `<Companion/>` in its centre slot and
  `app/_layout.tsx` no longer mounts it; the drag/snap and persisted-position
  code paths (`lift:companion-pos`, the five snap anchors) and the unused
  placement helpers are removed — `src/companion/placement.ts` keeps only
  `isCompanionHiddenRoute` / `isTopLevelRoute`. Tapping the circle keeps the
  jump + wiggle reaction and dismisses the message; Settings still chooses the
  Mouse/Blob skin and On/Off. `docs/product/COMPANION.md`,
  `docs/product/FEATURE_MATRIX.md`, `scripts/test-companion.mjs` and
  `.maestro/companion.yaml` updated.

- Workout logging: finishing is now an explicit choice. The header **Finish**
  button and the footer **Finish workout** button both open one shared themed
  bottom sheet (`src/components/ui/BottomSheet.tsx`) with **Finish workout**
  (primary/accent, behaves as before and hands off to the summary),
  **Discard workout** (destructive) and **Cancel**. Discarding asks once —
  "Discard this workout?" with **Keep workout** / **Discard** — then
  soft-deletes the workout and returns to Train. A discarded workout leaves no
  trace: not in History, PRs, streaks, weekly counts, volume/analytics or the
  **Prev** column, and a program session it was started from stays scheduled
  with the enrollment pointer untouched. The discard path re-runs
  `reconcileWorkouts()` so any idle notification for the workout is cancelled,
  and it is deliberately silent — no companion cheer (that is triggered only on
  the summary screen, which discard never opens). The copy and the three choices
  live in the pure, tested module `src/workouts/exits.ts`
  (`scripts/test-workout-discard.mjs`); new Maestro flow
  `.maestro/workout-discard.yaml`.

- Companion: three device-test fixes on Android (release build, mouse skin).
  - The mouse no longer draws on a lighter "plate" the size of its box — the
    ~11 nested `Animated.View` transform wrappers collapse into ONE
    `Animated.View` with a single `transform` list (same motion, same feet
    anchoring), the ground shadow becomes a plain themed `View`, the sparkles
    and the sleepy "z" become plain `Text` glyphs mounted only while active (no
    SVG at all while idle), and the `Image` gets an explicit size,
    `resizeMode="contain"`, `backgroundColor: 'transparent'`, `fadeDuration={0}`
    and the 0.9 sleepy dim on its own style. No overlay ancestor paints a
    background either. The SVG blob skin is unchanged.
  - Default position moved from top-centre (which covered screen titles like
    "Workout · 17 Oct") to the **right edge ~38 % down the window**, clamped into
    the safe-area bounds; the bubble opens to the creature's left there. Drag
    still snaps to the nearest of the five anchors, and saved positions — a
    saved `tc` included — still win.
  - The overlay is not rendered on the onboarding wizard or the PAR-Q+ screen
    (`usePathname`/`useSegments`), so the first-launch "Skip for now" tap and the
    Maestro flows that depend on it work again. Geometry moved to a pure, tested
    `src/companion/placement.ts`; `docs/product/COMPANION.md` updated.
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
- Icons: added original muscle-group art for the back-facing groups — Rear Delts,
  Triceps, Lats, Upper Back, Lower Back, Glutes, Hamstrings, Abductors, Calves — in
  `assets/icons-src/muscle`, drawn on the 48x48 grid on one shared back figure with
  Chest.svg's LINE separation and HI/HI_LINE highlight style, and registered via
  `scripts/build-icon-art.mjs` into `src/components/icons/iconArt.generated.ts`.
  `docs/design/ICON_STYLE.md` now states the grid, palette and file-naming rules the
  validator actually enforces (they were stale: 96x96 viewBox, theme hexes).

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
