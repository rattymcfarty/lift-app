# Changelog

## Unreleased (addendum)

- **A guided interview that sets up your plans.** "Set up my plans step by step" (Programs →
  Library, or from the profile screen) asks the six questions the generator needs — one per
  screen — and under each answer shows the reason it is asked *and* the live consequence
  ("Main lifts 3 × 8-12 reps, 75 s rest"). Then it shows the real plan set before anything is
  written: every day, every exercise, sets × reps, rest and estimated loads, plus a "why these
  numbers" block read from the generator's tables. "Build my N plans" writes that exact set
  through the same path onboarding and the profile editor use, replacing only `My Plan · …`.
  Deterministic and on-device — no network, no model, and the review and the build share one
  generator input, so what you approve is what you get. `scripts/test-quiz.mjs` (40
  assertions); `.maestro/quiz.yaml` answers all six, reviews, builds and finds the plans in the
  library — device PASS.

- **Your profile: change the persona, see what it changes.** A new "Your profile" screen (from
  the Programs header, the left panel's More list and Settings) shows the six answers the plan
  generator reads — goal, experience, days per week, session length, equipment, joint
  limitations — as chips, and underneath each one the exact consequence: sets, reps and rest
  for a main lift, the starting-load factor, the actual split names ("Upper A · Lower A · Upper
  B · Lower B"), the exercise cap for the session length, what the equipment excludes and which
  movements a limitation removes. The numbers are read from the generator's own tables
  (`src/lib/personaImpact.ts`), so the explanation cannot drift from the plan. Changing a chip
  updates it before saving; "Save & rebuild my plans" regenerates only the `My Plan · …` set
  (plans you made yourself are never touched), and screenshots/flow confirm four plans appear in
  the library. `scripts/test-persona.mjs` (54 assertions) pins the copy to the generator;
  `.maestro/persona.yaml` edits, saves, rebuilds and checks the result.
- **The filter chevron finally tells the truth.** With the muscle grid open, the equipment chip
  still pointed "open": the chips were independent and the glyph was inverted. Now one grid can
  be open at a time (browse, add-exercise, swap and the plan picker share
  `src/components/workout/filterPanel.ts`), and ▲ means open / ▼ means closed, as in the
  composer picker. `scripts/test-filter-panel.mjs` (14 assertions) pins both rules; browse,
  plan-picker and workout-flow pass on device.

- **The program screens use the shared header too (and stop colliding with the chrome).** With
  the floating menu/settings buttons now on every page, the two hand-rolled headers were
  drawn *under* them: the program builder's own top row and `WizardPage` (program details and
  setup) both put a back arrow in the top-bar band. Both now render the shared `ScreenHeader`
  — program name as the title, the rename pencil and Finish in its right slot, "Step 2 of 3"
  as its subtitle — so the arrow sits below the chrome band like every other page and the
  header height, type and back glyph are identical app-wide. `_wizard-shots` /
  `program-builder` flows updated for the taller header (scroll to the last form rows); device
  PASS.

- **The exercise title answers "am I doing this right?" mid-set.** Tapping the title in a
  workout card opens a sheet with what the movement trains (muscle + equipment chips), the
  KB **key cues** (capped at four), the **common mistakes**, the **safety stop line** in a
  warning-tinted block, the plan's target, last time, and one "why it matters" line — with
  the full guide one button away. It never navigates away, so a half-filled set survives,
  and with the companion on Pip says the summary line ("Keep it simple: 3 cues, and you stop
  if it hurts"). Anything the KB entry lacks is simply absent rather than an empty heading
  (`src/components/workout/exerciseInfo.ts`, pure; `scripts/test-exercise-info.mjs`, 34
  assertions). `.maestro/exercise-info.yaml` opens it, jumps to the full guide and returns
  with the set intact — device PASS alongside `workout-flow`, `wheel` and `tabs`.

- **"Plans and Programs" — the app now explains its own two words.** The owner supplied the
  copy; it lives as **content, not JSX** (`src/content/infoPages.ts`: heading, paragraph,
  bullets, a two-sided Plan/Program card, two worked examples, the one-line rule, and the
  note that the industry uses the terms interchangeably), rendered by one shared
  `InfoPageView` so every explainer in the app looks alike. It is a real route
  (`/learn/plan-vs-program`, three lines + a shared `InfoScreen` shell) rather than a sheet,
  because it is read and returned to — and the floating chrome stays on it. Entry points: the
  ⓘ in the Programs header and the left panel's More list. `scripts/test-content.mjs`
  (75 assertions) checks the shape of every page, that the Plan/Program page defines both
  sides and both examples, and that every panel link points at a route file that exists; a
  route file per page keeps `test:panel`'s dead-link check honest.
  `.maestro/learn.yaml` opens it from both entry points on a device. Moving this copy to the
  knowledge base (editable on GitHub, updatable through the existing anonymous KB channel) is
  the next step in queue 2a.

- **Numeric entry gets a scroll wheel.** Weight, reps and RPE can be picked by flicking an
  iOS-style drum — the value in a highlighted band with its unit beside it — instead of the
  numeric keypad covering half the screen mid-workout. It opens from the set number in a
  pending row, with Weight | Reps | RPE tabs; a tap on a value pill still opens the keypad,
  so nothing that worked before changed. The drum is hand-rolled in plain React Native
  (`src/components/ui/WheelPicker.tsx`) — no new dependency, because a native picker package
  would cost the Expo Go compatibility story — and it is genuinely endless: three copies of
  the rows with a silent recentre after every settle, so a flick never reaches an end. Steps
  are gym-real (2.5 kg, 5 lb, half-point RPE) and a typed value opens the wheel on the
  nearest row rather than row 0. Pure logic in `wheelModel.ts` + `workout/wheelFields.ts`,
  pinned by `scripts/test-wheel.mjs` (53 assertions) and by `.maestro/wheel.yaml`, which
  flicks the drum three rows and asserts the row keeps the value the drum settled on. Two
  bugs the device found, both now fixed: a native-driven `onScroll` on a plain `FlatList`
  crashed the workout screen, and the live band made the commit think nothing had changed —
  the drum moved and the row kept its old value. The rest of the rollout — the other
  numeric fields (warm-up weight, rest timer, plan targets, measurements) and flipping the
  default to "wheel first, keypad on request" — is queued as 2d in `docs/ops/HANDOFF.md`.

- **Every section now names itself, and all four headings sit at the same height.** The
  Programs tab led with “Explore | Library” and nothing else — no word anywhere said which
  section you were in — while the Analytics title floated ~60 dp lower than Train's and
  Browse's. Two causes, both fixed: `SegmentedTitle` gained an optional section `title`
  (“Programs”, with the segments stepping down to a switcher beneath), and the tab screens
  stopped adding their own `useTopBarInset()` spacer on top of a header that already
  reserves the top bar. `ScreenHeader` and `SegmentedTitle` now own that allowance, so
  Train, Programs, Analytics and Browse Exercises all start their title at the same y, and
  Train’s first segment is renamed **Today** (owner decision) so both tabs with sub-views
  share one title + switcher shape.
  Documented in `docs/design/TYPE.md` (“Headers: exactly one top-bar allowance”).

- **Exercise titles in a workout no longer clip on a Display-Zoomed iPhone.** The card
  title was a fixed 18 pt on one line, so “Romanian Deadlift (Dumbbell)” was cut on a
  320 pt screen. It now takes ONE size for the whole workout — `useGroupFit` over the
  longest exercise name, measured on the title row — the same “computed once from the
  available width” rule as the set table and the filter grid, never per-label shrinking.
  The 2c audit in `docs/ops/HANDOFF.md` tracks the rest of the app; `docs/design/TYPE.md`
  now carries the screen-by-screen table.

- **Full-Body and Olympic are 3D renders too.** They were the last two vector muscle icons —
  visibly the odd ones out in the taxonomy grid. Both are now baked from the same mannequin
  as the rest: Full-Body lights all seven front-facing muscles at once; Olympic is the same
  figure with a loaded barbell at the thighs (steel shaft, dark plates, collar) so the two
  never read as the same tile at 40 pt. That is 20 renders × 2 themes, all through the same
  numeric QA gate — `body_coverage` now has a documented 0.14 floor for whole-figure icons,
  because a head-to-feet figure cannot fill a square frame the way a cropped muscle can.
  `scripts/render/build-icons.py` gained `--only` (re-bake one icon, keep the other verified
  hashes), and `render-all.sh` now defaults to the shipped purple rather than the old orange.
  `test:icons` (232 assertions) covers the new PNGs and their hashes.

- **RPE explains itself where you enter it.** RPE was the one field in the set table a
  beginner could not read off the label. Tapping the RPE column header (now accent, with an
  ⓘ) opens a sheet with the scale worked out: levels 6–10 and the reps each one leaves in the
  tank, a real program line (“Bench Press — 3 sets × 10 reps @ RPE 8”) read apart, the
  distinction that it measures effort and not load, and the 7–9 range most programs target.
  With the companion on, Pip sits at the top and says the one-line summary in its own voice;
  with the companion off, a neutral 1–10 badge and plain copy — the explanation never depends
  on the companion being enabled. The same sheet opens from the RPE label in a plan's target
  editor (`NumberInput` gained an optional label button). `scripts/test-rpe.mjs` (38
  assertions) pins the scale, the copy and that both entry points stay wired;
  `.maestro/workout-flow.yaml` and `plan-picker.yaml` open the sheet on device — both PASS
  on a release APK (`/tmp/lift-e2e-rpe`).

- **Android Expo Go opens again.** `expo-notifications` 58.1.6 imports
  `ExpoTopicSubscriptionModule` at module load, and the SDK 58 Expo Go for Android
  (58.0.5) was built before that module existed — so the import threw while the router
  was evaluating `app/_layout.tsx` and the app died on launch ("Cannot find native
  module 'ExpoTopicSubscriptionModule'"). The iOS build had a newer Expo Go and never
  hit it. `expo-notifications` is now loaded on demand through
  `src/notifications/native.ts`: if the native module is absent, local notifications
  no-op (and Settings says why) instead of taking down the app. Development builds and
  the release APK bundle the module, so they behave exactly as before.
  `scripts/test-notifications.mjs` (8 assertions) pins both halves: without the module
  the loader returns null and does not throw; with it, the real API comes back.

- **One computed type size per group, app-wide — `adjustsFontSizeToFit` is gone from every
  row of peers.** Per-label shrink-to-fit was the root cause of text that looked subtly
  uneven: the two filter chips at different sizes, one stat tile smaller than its neighbour,
  “Train” and “History” at different sizes in the same title. The new
  `src/theme/adaptive.ts` does what the filter grid and the set table already did — derive
  one size from the width available and the longest label, then give that size to everyone
  in the group. Applied to the analytics tiles, the readiness options, the post-workout
  summary numbers, the segmented screen titles, the settings segments, the set-table numbers
  and its column headers, and the workout toolbar. The typography gate now fails on
  `adjustsFontSizeToFit` outside three lone dynamic headings (screen title, program name,
  onboarding title), which have no peers to mismatch with. `scripts/test-adaptive.mjs`
  (55 assertions) pins purity, bounds, monotonicity and the real design-width results;
  `test:filters` still passes unchanged, since the grid now uses the same primitive.

- **Browse Exercises keeps its controls on screen.** The search field and the muscle/equipment
  chips moved out of the list header into a pinned block, so they stay put while the results
  scroll and a filter is always one tap away. The filter grids open in place inside a bounded,
  scrollable area (42% of the window, 180–320 pt) instead of pushing the list off screen.
  `.maestro/exercise-browse.yaml` scrolls deep into the library, then asserts the controls are
  still there, filters by muscle, clears it, and searches from the scrolled position.
- **One filter chip everywhere.** Browse carried a private copy of `FilterChip` and Swap
  hand-rolled its own; the copies drifted (no clear button in Swap, different shrink rules).
  All four pickers now use `FilterChip` + `FilterChipRow`. The label has a single size and no
  longer autoshrinks, which was the visible bug: “All Muscles” stayed at 12 pt while “All
  Equipment” shrank toward 8 pt on the same row. The two chips now keep one size on one line
  (a long label truncates rather than shrinking its neighbour), and the taxonomy grid labels
  follow the same rule.
- **Exercise guide → Progression no longer spills out of its card.** “Regress to:” / “Progress
  to:” / “Loading guidance:” sat in single rows with no wrap and no shrink, so a long exercise
  name ran past the card edge. Each line is now a label above its value, both full width and
  free to wrap, matching the Overview/Why/How-to cards.
- **Icon highlight is the app's accent purple** (`#a073f0` dark, `#6c3fd1` light), not the
  warm orange and not the blue. The 20 muscle renders were re-baked with the accent in the
  muscle material, so the lit result is still a form (median `#966cde` / `#663ec3`) rather
  than a flat fill; the vector fallbacks (`All`, `Other`) and **every equipment
  icon** now take `theme.colors.accent` directly, so the two halves of the set read as one
  family. `scripts/render-icons.mjs` and `test:icons` follow the same tokens. `--color orange`
  and `--color red` remain in the renderer for comparison. The QA gate had to change with
  the colour: it recovered the painted area from raw RGB distance, which collapses in
  shadow and made the purple look like a 13–35 px feather, so it now measures chromaticity
  and its `soft_edge` band was re-calibrated (0.25–4.0 px, where a 6 px haze scores 4.8) —
  stricter than the old 1–10 px.
- **Expo SDK 58** (React Native 0.88, React 19.3): the owner's iPhone could no longer open the
  app — Expo Go on iOS only loads the newest SDK, and it cannot be rolled back — so the project
  moved up a release. Only four code changes were needed: the custom tab bar now takes
  `navigateToTab(route.key)` and `emitter` instead of `navigation`, the tab group sets
  `unstable_settings.anchor = 'index'` (the prop left `Tabs`), list slots return `undefined`
  instead of `null`, and `TextInput` refs are typed `TextInputInstance`. `expo-doctor` 20/20,
  `npm run verify` ALL GREEN, device flows `onboarding`, `tabs`, `exercise-menu` PASS on a
  release build (`/tmp/lift-e2e-104711`).
- Muscle icons are **3D mannequin renders** now, not vectors: each of the 18 groups ships as a
  288 px PNG per theme (`assets/icons-3d/{dark,light}/`, 1.7 MB total) rendered from Blender's
  CC0 *Human Base Meshes* body at 640 px / 320 spp with the muscle baked as an opaque lit pass
  and the accent sampled from the owner's reference (`#ff7a1a` family, red available via
  `--color red`). `TaxonomyIcon` picks the render for the active theme and falls back to the
  vectors for `All` / `Olympic` / `Full-Body` and for equipment; the vector muscle fallbacks
  carry the same sampled accent. Assets are SHA-256-pinned in `assets/icons-3d/qa.json` and
  `test:icons` grew to 216 assertions. Pipeline, licence and thresholds:
  `scripts/render/README.md`.
- Icon palette: a fifth authoring colour, `#4d4d4d` SHADOW, mapped at render time to
  `darken(muted, 0.28)` — a real shade of the body tone in both themes (light
  `#5c5c60` → `#424245`, dark `#a1a1a6` → `#747478`). All 31 icons now carry a shadow
  pass: a tapered band 1.0-1.6 units wide inside the right edge of each torso and pelvis,
  and a 0.7-unit offset stroke under every limb, drawn before the body stroke so only a
  crescent shows. The light direction (upper left) and the layering rules are in
  `docs/design/ICON_STYLE.md` §Shading; the sheet derives the new tone exactly as
  `src/lib/iconColors.ts` does, and `test:icons` grew to 65 assertions.
- Icon shading, second step: `#6a6a6a` SHADOW_SOFT = `darken(muted, 0.14)`, used as a
  wider copy of every shadow band (shifted 1.3 units inward) and as a 1.4-unit-wider
  limb stroke, so the falloff reads as two soft steps instead of one hard edge —
  gradients are not allowed in the art. `test:icons` 67 assertions.

- Muscle icons (detail pass): **Abs** draws the rectus abdominis as one sheet with tendon
  intersections and the linea alba, instead of six separate plates; **Front Delts** and
  **Middle Delts** sit on a rebuilt upper body — the arm now hangs from a deltoid cap
  instead of floating beside the torso as a separate ribbon, and the highlight wraps the
  joint rather than sitting on the chest like a badge; **Neck** highlights the neck column
  and the upper traps instead of two thin slivers. Original vector work, four authoring
  colours, theme colouring unchanged.
- Muscle icons (detail pass, second batch): **Adductors** put one teardrop mass on the
  inner edge of each thigh with a real gap between the legs, and the hip-crease line no
  longer runs past the silhouette; **Forearms** highlights the whole flexor segment from
  elbow to wrist instead of a stripe along one edge, which also removes the stray tail at
  the wrist.

- Equipment icons: the ten figures now share one body language — a neck, a torso that
  tapers from the shoulders to the waist, an elbow or knee in every limb, and a foot where
  the pose puts one on the floor. **Barbell** (bench press), **Bodyweight** (push-up),
  **Kettlebell** (bell raised to the chest with a visible handle) and both squats
  (**Safety Bar**, **Smith Machine**) were redrawn; **Dumbbell** got the same torso and feet.
  Original vector work on the 48 grid from the four authoring colours; the language is
  recorded in `docs/design/ICON_STYLE.md`. Theme colouring is unchanged.

- Exercise detail (bug): the KB importer never wrote `longevityNotes` — the transform
  handed it to `upsertKbExercise`, but that function's input type and its insert/update
  object both dropped it, so the **Why** card was missing on every exercise page. It is
  stored now. The `.maestro/exercise-detail.yaml` flow is what caught it: it scrolls the
  guide in fixed steps (Maestro's `scrollUntilVisible` flings ~1.5 screens on this page and
  jumps the card headers) and asserts a line from every card, Overview through Progression.

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
