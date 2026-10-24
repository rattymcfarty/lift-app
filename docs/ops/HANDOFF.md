# LIFT — handoff (living document)

> **Update this file at the end of every working session.** A new agent with zero
> memory must be able to continue from this file + the repo alone.
> Last updated: 2026-10-24, after the RPE explainer + Full-Body/Olympic renders round.
> Repo HEAD at the time: see `git log -1`.

## 0. In-flight work (update before every commit)

> Nothing uncommitted as of 2026-10-24: the round below is committed and pushed (`git log -1`),
> `npm run verify` is ALL GREEN, and the device re-run is done (see "Verified at last session"
> in §1). The durable record of the round is §6 (session log).

- [opencode] **RPE explainer + the last two 3D icons — 2026-10-24 (committed).** Two
  independent pieces from the same session:

  1. **`Full-Body` and `Olympic` are 3D renders** (`assets/icons-3d/{dark,light}/`,
     20 renders × 2 themes). Full-Body lights all seven front-facing muscles from the
     standard mannequin; Olympic is the same figure with a rendered barbell at the thighs
     (steel shaft, dark plates, collar) so the tiles stay distinct at 40 pt. Renderer:
     `scripts/render/render-muscle.py` (`REGIONS`/`FRAMING`/`FIBRE_AXIS["Olympic"]`,
     `barbell()` prop helper); packager `scripts/render/build-icons.py` now takes `--only`
     so a single icon can be re-baked while the other 19 keep their verified hashes.
     `qa.py` gives whole-figure icons a 0.14 `body_coverage` floor (a head-to-feet figure
     cannot fill a square frame like a cropped muscle) — still a soft check, all 20 PASS.
     `render-all.sh` defaults to the shipped purple now (the old default was orange — a
     footgun for a full re-run).
     `scripts/test-icons.mjs` → 232 assertions.
  2. **RPE explains itself where it is entered.** `src/components/workout/rpeGuide.ts`
     (copy: levels 6–10 + reps left, worked example, effort ≠ load, 7–9 target) →
     `src/components/workout/RpeSheet.tsx` (BottomSheet). Trigger: the **RPE column header**
     in any set table (`ExerciseCard`, accent + new `info` ActionIcon, `testID="rpe-help"`,
     screen passes `onRpeHelp`) and the **RPE label** in a plan's target editor
     (`NumberInput` gained optional `onLabelPress`/`labelTestID` → `plan-rpe-help`).
     Companion on → Pip's avatar (`ImageSkin`/`Creature`, framed like the top-bar ring) says
     the one-liner; companion off → neutral “1–10 effort” badge and plain copy. Gate:
     `scripts/test-rpe.mjs` (38 assertions). Flows: `.maestro/workout-flow.yaml` (after
     set 1) and `.maestro/plan-picker.yaml` (after adding an exercise).

  Gate: `npm run verify` ALL GREEN (icon commit `ffe3667`→`be2f51c`). Device: **PASS** on a
  fresh release APK (`/tmp/lift-e2e-rpe`) — `workout-flow` (opens the RPE sheet from the set
  table's RPE header; `shot-rpe-sheet` captured), `plan-picker` (opens the same sheet from a
  plan's RPE target label), and a browse-grid screenshot showing Full-Body + Olympic at tile
  size. `plan-picker.yaml` needed two flow fixes on the way: collapse the muscle grid after
  clearing its filter, and match the plan row's numbered label (`.*Goblet Squat.*`).

- [opencode] **UI polish round 3: pinned browse controls, uniform filters, adaptive type —
  2026-10-24 (committed).** Three things the owner saw on the iPhone, plus the concept
  applied across the app:

  1. **Browse Exercises keeps its controls.** Search + the two filter chips moved out of
     the `SectionList` header into a pinned block above it; a filter grid opens in place
     inside a `ScrollView` capped at `max(180, min(320, windowHeight * 0.42))`
     (`app/(tabs)/exercises.tsx`).
  2. **One size per group, app-wide.** The filter-grid trick (`filterMetrics`) became
     `src/theme/adaptive.ts` — `fitTextSize` / `fitGroupSize` / `useGroupFit`. A group of
     peers gets ONE size computed from the width available and its longest label; no
     label shrinks on its own. Applied to the filter chips and grid, analytics tiles,
     readiness options, summary numbers, segmented titles, settings segments, set-table
     numbers/headers and the workout toolbar. `adjustsFontSizeToFit` remains only on
     three lone dynamic headings (screen header, program name, onboarding title) and
     `scripts/check-typography.mjs` enforces that allowlist. Rule + width table:
     `docs/design/TYPE.md`; tests: `scripts/test-adaptive.mjs` (55), `test-filters` (71).
  3. **Progression card** in the exercise guide stacks label above value, full width,
     wrapping, like the other cards (`app/exercises/[id].tsx`).

  Gate: `npm run verify` ALL GREEN; release-build flows (see the session log in
  `/tmp/lift-e2e-*`) — exercise-browse, exercise-detail, plan-picker, workout-flow, tabs.

- [opencode] **Android Expo Go could not start — fixed 2026-10-24.** Two separate causes,
  and the first masked the second:

  1. The phone had the Play Store SDK 57 Expo Go while the project (and iOS Expo Go) is
     SDK 58, because Expo Go on each platform only runs one SDK. Fixed by installing the
     SDK 58 APK (`Expo-Go-58.0.5.apk` from expo.dev/go; see ENVIRONMENT.md).
  2. With 58.0.5 installed, launch died in `requireNativeModule`:
     `Cannot find native module 'ExpoTopicSubscriptionModule'` from
     `expo-notifications/build/index.js`, imported by `src/workouts/lifecycle.ts`, which
     `app/_layout.tsx` imports while building the route tree. Expo Go's native modules
     are frozen at its publish date and 58.0.5 predates that module; our JS package is
     58.1.6. iOS Expo Go was newer, so only Android failed.

  Fix: `src/notifications/native.ts` loads `expo-notifications` with `require()` inside a
  try/catch and caches `null` when the runtime lacks it. The three callers
  (`restAlert`, `workoutReminders`, `lifecycle`) take the API object from `notifications()`
  and no-op when it is null; Settings says the build cannot schedule notifications
  instead of blaming the OS permission. Dev builds and the release APK bundle the
  module, so nothing changes there. `scripts/test-notifications.mjs` (8 assertions)
  covers both branches. **Notifications are unavailable in Expo Go 58.0.5 on Android —
  use a development build to test them.**

- **START HERE if you are taking over while Claude Code is away (2026-10-18 → Monday):** `docs/ops/HANDOFF_AGENT_TO_AGENT.md` holds the ordered queue, rules and gotchas.

- [opencode] **Muscle icons: 3D mannequin renders replaced the vectors — done 2026-10-23.**
  Owner approved the look, asked for the reference's warm accent instead of theme blue and
  for production quality. All 18 groups now render from Blender's CC0 *Human Base Meshes*
  body at 640 px / 320 spp and ship as 288 px PNGs, one per theme:
  `assets/icons-3d/{dark,light}/` (1.7 MB total). The muscle layer is an **opaque lit pass**
  — skin colour where the mask is zero — so there is no alpha compositing and no pale halo
  at the patch edge (the old artefact). Definition comes from fibre striations, anatomical
  crease lines (linea alba + three tendinous intersections, quad separations, pec lower
  border, glute fold, calf split, biceps/triceps lines) and a darker rim; the muscle is matte
  (roughness 0.55→0.68 under the mask) so highlights don't blow out at 44 pt.

  Gate: `scripts/render/qa.py` **18/18 PASS** (it recovers the painted area from the rendered
  colour difference, not from the mask), then the owner's visual check. `npm run verify` ALL
  GREEN (test:icons 216). Assets are SHA-256-pinned to `assets/icons-3d/qa.json`, so a failed
  or hand-edited render breaks the build. Pipeline + licence: `scripts/render/README.md`;
  render driver `scripts/render/render-all.sh` (~50 min on this rig at 640/320).

  The vectors stay as the fallback for `All` / `Olympic` / `Full-Body` (no render) and for
  equipment. Their highlight is now the accent sampled from the renders — `#dd7726` dark,
  `#bc591b` light — so the two sets don't clash; equipment keeps the theme's blue.
  Review sheets: `~/lift/icon-review/38-app-dark.png`, `38-app-light.png`, `39-app-small.png`,
  `34-orange-set.png`, `35-orange-vs-reference.png`, `37-qa-final.txt`.

  Known soft spots (owner accepted the set as-is): the quad crease lines are still a little
  straight (the vastus medialis should be a teardrop at the knee), the chest patch's top edge
  is a straight cut across the clavicle, and the three deltoid heads aren't separated. Arm
  regions crop the arms at the frame edge by design.

- [opencode] **Expo SDK 58 — done 2026-10-24.** The owner's iPhone could not open the app:
  Expo Go on iOS only loads SDK 58 and cannot be rolled back, so the project moved from 57.
  Versions came from Expo's own `bundledNativeModules.json` for `sdk-58`, not from guesswork:
  `expo` 58.0.19, React Native 0.88.0, React 19.3.0, 16 `expo-*` packages bumped. Four code
  changes covered the whole API delta — custom `TabBar` now takes `navigateToTab(route.key)`
  + `emitter` instead of `navigation`; `Tabs` lost `initialRouteName` (now
  `unstable_settings = { anchor: 'index' }`); list slots return `undefined` not `null`;
  `TextInput` refs are `TextInputInstance`.
  Gate: `expo-doctor` 20/20, `npm run verify` ALL GREEN, release-build flows `onboarding`,
  `tabs`, `exercise-menu` PASS (`/tmp/lift-e2e-104711`). If the owner still sees a mismatch,
  the cause is the phone caching an old manifest — reload Expo Go, do not touch the SDK.

  **Not verified on iOS:** everything above ran on Android. Expo Go 58 on the iPhone is the
  first iOS run of SDK 58 in this project; watch notifications (rest timer), sqlite
  migrations and the share sheet before trusting a release.

- [opencode] **Icons: two-step shadow — done 2026-10-22** (`f7dbaa2`). Owner asked for a
  softer falloff, so a sixth authoring colour was added: `#6a6a6a` SHADOW_SOFT →
  `darken(muted, 0.14)` (light `#515156`, dark `#828286`). Every shadow band is now
  painted twice — the soft copy translated `1.3` units further into the form — and every
  limb shadow is drawn twice, the soft stroke 1.4 units wider underneath. 36 soft fills
  and 47 soft strokes across the 31 icons. `test:icons` 67, `npm run verify` ALL GREEN,
  device `exercise-menu` PASS on a release build (`/tmp/lift-e2e-082213`). Sheet:
  `~/lift/icon-review/9-shadow-soft-pass.png`. Honest limit: the validator bans gradients,
  so this is two flat tones standing in for a falloff, not an airbrush.

  **Correction to the entries below:** the reference sheet is *not* "fully shaded". Measured
  pixel values from `reference-muscle-groups.png`: card `#1d1d1d`, body fill `#343434`
  (only ~9 % above the card), internal lines `#656565`, muscle flat `#ff7a1a`, no shadow
  step at all. The look comes from a **low-contrast body plus dense line work**, not from
  shading. Ours in dark mode is body `#a1a1a6` on a `#1c1c1e` tile (~52 % contrast), so our
  grey figure shouts where theirs whispers. Re-mapping the body toward the surface colour
  and promoting the current `muted` tone to *line* is the biggest remaining fidelity lever;
  it would also make the shadow near-invisible, so the shadow would have to be re-derived
  around the new body tone (or dropped). Not started — owner to decide.

- [opencode] **Icons: shadow tone across the set — done 2026-10-19** (`acd6380`). Owner
  approved a fifth authoring colour: `#4d4d4d` SHADOW → `darken(muted, 0.28)` at render
  time (light `#424245`, dark `#747478`). All 31 source SVGs now carry a shadow pass —
  tapered band inside the right edge of each torso/pelvis, 0.7-unit offset stroke under
  each limb, drawn before the body stroke. Light from the upper left; rules in
  `docs/design/ICON_STYLE.md` §Shading. `test:icons` 65, `npm run verify` ALL GREEN,
  device `exercise-menu` PASS on a release build. Sheet: `~/lift/icon-review/8-shadow-pass.png`.
  Honest limit: no gradients are allowed, so the shadow is a hard-edged band, not the
  reference's soft airbrush. Next if the owner wants it: a second, lighter shadow step
  (`#6a6a6a`) for a two-tone falloff, which would double the authoring work per icon.

- [opencode] **Muscle icons: detail pass, second batch — done 2026-10-19** (`23110ec`).
  **Adductors** now has one teardrop on the inner edge of each thigh with a gap between the
  legs (and the hip-crease line stops inside the silhouette); **Forearms** fills the whole
  flexor segment from elbow to wrist and loses the stray tail at the wrist. `test:icons` 63,
  `npm run verify` ALL GREEN, device `exercise-menu` PASS on a release build. Sheets
  refreshed in `~/lift/icon-review/`. Remaining weak tile: **Biceps** — its arms still read
  as bars beside a slab torso; also **Abductors** (patches sit outside the hip line).
  The wider gap to the reference is shading: it is a fully shaded anatomical drawing, ours
  is flat fill plus line work, and copying theirs is not allowed.

- [opencode] **Muscle icons: detail pass, first batch — done 2026-10-19** (`f8c76db`). **Abs**
  is one rectus sheet with tendon lines; **Front Delts** and **Middle Delts** sit on a rebuilt
  upper body (deltoid cap carries the arm, which now hangs from it and tapers, and the
  highlight wraps the joint instead of sitting on the chest); **Neck** shows the neck column
  plus the upper traps. Render: `~/lift/icon-review/7-muscle-detail-pass.png` and
  `7b-muscle-closeup.png`. `npm run verify` ALL GREEN, `test:icons` 63, device
  `exercise-menu` PASS on a release build. Still flat next to the reference (which is fully
  shaded) — the remaining candidates for a second batch are **Biceps** (arms read as bars),
  **Adductors** (a sliver) and **Forearms** (thin highlight).

- [opencode] **Equipment icons: one figure language — done 2026-10-19** (`7a1402e`). The ten
  equipment illustrations now share a figure: neck, a torso tapering from the shoulders to
  the waist, an elbow or knee in every limb, feet where the pose has them. Barbell,
  Bodyweight, Kettlebell, Safety Bar and Smith Machine were redrawn, Dumbbell got the same
  body; the language is written into `docs/design/ICON_STYLE.md`. Render for review:
  `~/lift/icon-review/6-equipment-figure-pass.png` and `6b-equipment-closeup.png`.
  `npm run verify` ALL GREEN, `test:icons` 63, device `exercise-menu` + `exercise-detail`
  PASS on a release build. Next icon step, if the owner wants it: the same detail pass on
  the muscle set (the reference is fully shaded; ours is flat) — see the handoff queue.

- [opencode] **Exercise guide page: the Why card was missing (bug) — fixed 2026-10-19**, branch main.
  The KB importer never wrote `longevityNotes`: the transform handed it over, the column
  exists, but `upsertKbExercise` neither accepted it nor copied it into its insert/update
  object, so every imported exercise stored `null` and the exercise page silently dropped
  its **Why** card (the longevity notes). Now stored; pushed as `0f209bb`/`41b3953`.
  `.maestro/exercise-detail.yaml` is what found it: the flow now scrolls the guide in
  measured 25%-of-screen steps (`_scroll-guide.yaml`) because Maestro's
  `scrollUntilVisible` flings ~1.5 screens on this page and skips the short card headers,
  and it asserts a line from every card — Overview, Why, How-to, Safety, Progression.
  `npm run verify` ALL GREEN; `scripts/e2e.sh exercise-detail` PASS on a release build.
  Re-measure the step counts if the guide copy on `barbell-squat` grows or shrinks.

- [opencode] **Queue F (Beam bake-off) — done 2026-10-19.** `opencode/beam-free` passed the
  committed 16-case `parseDuration` fixture in **17 s** (fastest in the pool), with `spec.md`
  and `test.mjs` untouched and a real regex parser (not a lookup table). The helper's shell
  was blocked by the sandbox allowlist, so the lead ran the test in the worktree (`ALL PASS`)
  and reviewed the file. Promoted to 2nd in `pool_order` and in the `code` rank, behind
  DeepSeek for its real-delegation history; table and notes in `docs/ops/DELEGATION.md` §6.
  Worktree cleaned.

- [opencode] **Exercise guides (queue item E)**, branch main, worked 2026-10-18.
  lift-kb bundle **0.6.0** (631 pages, 581 live, pushed as `d9f9e8e`): the four
  movements the curated list was missing are written — `bird-dog`,
  `cable-woodchops`, `rowing-machine`, `outdoor-cycling` — so all 50 foundational
  names resolve; `src/lib/foundational.ts` has no placeholder comments left and
  `scripts/test-foundational.mjs` asserts 50/50 (190 checks). Six pages are the
  **rich-page pilot**: `barbell-squat`, `barbell-deadlift`, `push-up`,
  `farmer-carry`, plus the two new pages `bird-dog` and `rowing-machine`. The
  shape: `### ` subheadings in `longevityNotes` (*why this matters for a long
  life · rhythm and tempo · keeping it for life*), the tempo written into the
  instructions, a one-line motivation blockquote, and a safety note that says
  when to stop and who should regress. The two imported pages also lose their
  Free Exercise DB prose. **The owner has not approved this shape yet — do not
  rewrite the other 600 pages until they have.**
  App side: the snapshot is refreshed to 0.6.0, the detail screen's Overview card
  now shows the KB steps alone (`kbDetailJson.instructions`, added in
  `src/kb/transform.ts`; older rows fall back to the composite `instructions`
  column), so the How-to card no longer repeats the cues, mistakes and safety
  note, and the new `.maestro/exercise-detail.yaml` covers the screen.
  Note for the next content pass: the lift-kb pre-commit hook and CI are the
  gates (`validate-content.mjs`, `lint-content.mjs`, `test-md-content.mjs`), and
  `scripts/test-md-content.mjs` carries the expected bundle sha256 — update it
  with `kb-version.json` whenever the content changes.
  **Next in the queue:** item F (Beam bake-off, `opencode/beam-free`), then G
  (housekeeping) — see `HANDOFF_AGENT_TO_AGENT.md` §3.

- [opencode] **Icons (queue item D)**, branch main, worked 2026-10-18, pushed as
  `a782d31`. Muscle art redrawn where the highlight was too thin or the crop
  wrong: **Biceps** (a belly on each upper arm, not a stripe), **Front/Middle
  Delts** (a deltoid cap from the clavicle to the armpit, at the zoom `Rear Delts`
  uses), **Neck** (sternocleidomastoid + upper traps, not a rectangle),
  **Olympic** (clean traps/delts/glutes/quads), **Other** (three separated dots).
  **Forearms is one limb drawn larger** — a symmetric crop of the shared figure cannot
  make it fill the tile; `docs/design/ICON_STYLE.md` records that as the only exception to
  "every icon is a window onto the one figure". **Calves was changed on 2026-10-19 to draw
  both lower legs** (the reference crop shows both), together with bigger Biceps/Forearms
  highlights and a cleaner Neck; committed `3f2176a`. All ten equipment ids now render from `assets/icons-src/equipment/*.svg`
  instead of half of them silently falling back to the older hand-drawn React
  scenes in `src/components/icons/equipmentIcons.tsx` (that file stays as the
  fallback for unknown ids and for `All`). Art is authored in four placeholder
  colours that the app swaps for the theme's muted/highlight, so the worked muscle
  and the implement are the app's blue in both modes — the `#ff7a1a` in the sources
  is never rendered.
  Pipeline: `scripts/build-icon-art.mjs` now **fails when a taxonomy id has no art
  file** (that is how the equipment set drifted out of the pipeline);
  `scripts/render-icons.mjs` draws its contact sheet in the real light/dark theme
  colours and takes `--only=muscle|equipment`; `scripts/test-icons.mjs` grew to 63
  assertions (the sheet's palette is checked against `src/theme/tokens.ts` and
  `src/lib/iconColors.ts` so it cannot drift back to orange).
  Verified: `npm run verify` ALL GREEN. The art is static, so it was reviewed on
  the contact sheet (dark + light tile, 96 px and 48 px) rather than in a device
  run; `npm run test:icons` and the build's coverage check guard it.
  **Next in the queue:** item E, rich exercise pages (repo `~/lift/lift-kb`), then
  F (Beam bake-off) and G (housekeeping) — see `HANDOFF_AGENT_TO_AGENT.md` §3.

- [opencode] **Glass sheets (layout redesign C)**, branch main, worked 2026-10-18,
  pushed as `043a39d` + the follow-up `01c8f5f`.
  Every bottom sheet is now the same component. `BottomSheet` draws its surface
  with `Glass` (heavy, top corners rounded, bottom square, soft shadow) and its
  header — grabber, title/subtitle, close — comes from the new
  `src/components/ui/SheetHeader.tsx`; the pull-down maths lives in the pure
  `src/components/ui/sheetModel.ts` (`npm run test:sheet`, 11 checks) shared by
  `useSheetDrag`. `OptionSheet` is a thin wrapper over `BottomSheet` now (the
  hand-rolled modal is gone, as is its redundant **Cancel** footer — the header
  close, backdrop tap, pull down and Android back all dismiss). The plate
  calculator, the muscle sheet and the rest timer (the last two were local
  components in `app/workout/[id].tsx`) are three more copies that now render
  `BottomSheet`; `TextPromptModal` (rename dialogs) is glass. Ids keep their
  names: a sheet's close is `<surface>-close`, option rows stay
  `<surface>-<value>`. New Maestro flow `.maestro/sheets.yaml` (open, pull-down
  dismiss, backdrop dismiss).
  **Follow-up fixes (`01c8f5f`)** — the emulator found three problems in the
  refactor: (1) **the pull-down was dead on Android**: inside a `Modal` the
  move-phase responder negotiation is never dispatched to any view, so a
  move-only `PanResponder` can never claim the touch — the header now claims at
  touch-down (`onStartShouldSetPanResponder`) and follows the finger, and a tap
  still reaches the child first, so the close button keeps working; (2) a sheet
  taller than `maxHeightRatio` collapsed to its content instead of capping — the
  cap moved to the wrapper `Animated.View` with `flexShrink: 1` on the glass;
  (3) the flow needed explicit screen coordinates for the pull-down, because
  Maestro's "swipe from this element" only travels the grabber's own 4 dp.
  Verified on the final build: `npm run verify` ALL GREEN; device flows `sheets`,
  `exercise-menu`, `workout-flow`, `program-builder` all PASS; pushed
  `7e03fec..01c8f5f`.

- [opencode] **Side panels (layout redesign B)**, branch main, worked 2026-10-18.
  The two top-bar buttons now do something. **Left** (top-left button): a glass
  menu — New workout, Search exercises (lands on Browse Exercises with the field
  focused), the four **sections** (tap to jump; **long-press and drag** to reorder
  the floating bar) and **More** (History, Records, Balance, Calculators, Body
  weight). **Right** (sliders button): the Settings controls, embedded. Both
  close on scrim tap, the close button, an item tap or Android back — **tap only,
  no swipe-to-close**. Files: `src/components/chrome/{SidePanels,LeftPanel,RightPanel,TabOrderList}.tsx`;
  pure `src/chrome/panelsModel.ts` (+ `scripts/test-panel.mjs`, wired into
  `npm run verify`); `src/components/settings/SettingsBody.tsx` (shared with
  `app/settings.tsx`); `src/nav/tabs.ts` (the section table the bar and the menu
  share, so the old `test-tab-order` check moved there); `.maestro/panels.yaml`.
  Done: `npm run verify` ALL GREEN; device flows `_warmup`, `panels`, `tabs`,
  `workout-flow`, `exercise-menu`, `_shots` all PASS; the owner confirmed the
  long-press drag on iOS (Expo Go). **Next in the queue:** stage C (glass
  sheets/menus), then the icon refinements, then rich exercise pages — see
  `HANDOFF_AGENT_TO_AGENT.md` §3.
  Gotcha for the next flow author: the top bar shows the **panel button only on
  the four section screens**; inner screens have no left button (each screen
  keeps its own back/close), so don't tap `topbar-panel` after navigating in.

- [claude-code] **Cross-agent foundation + OpenCode delegation**, branch main, started 2026-10-16.
  Done and committed: `AGENTS.md` canonical (CLAUDE.md/GEMINI.md import it; Copilot/Cursor
  pointers), `.agents/skills/` (9 playbooks, `.claude/skills` symlink), `docs/ops/AGENT_COLLABORATION.md`,
  `docs/ops/DELEGATION.md`, `scripts/delegate.sh` + `scripts/opencode/` (locked config,
  Jev router, MCP server in `.mcp.json`), `npm run test:agents`.
  Bake-off done (7/12 free models pass; ranks in `models.json`, table in DELEGATION.md §6);
  first real delegation merged (3e4e275). Portable kit: `docs/ops/agent-kit/` +
  `scripts/setup-agent-kit.sh` (installed on this rig). **Owner to do:** upload
  `~/lift/agent-kit-export/agent-delegation.skill` to claude.ai Skills and paste the
  memory text (README in agent-kit). **Next:** use delegation in normal work; re-bake when models change.
  Preserve: free models ONLY; delegated runs go through the `opencode` CLI (raw API calls
  to free models return FreeTierError); one run at a time (parallel runs wedge the service).

- [opencode-helper] **Finish-or-discard workout sheet**, branch `delegate/workout-discard`,
  started 2026-10-17. Header/footer **Finish** opens one shared themed bottom sheet
  (**Finish workout** · **Discard workout** · **Cancel**); discard confirms ("Discard this
  workout?" / **Keep workout** · **Discard**), soft-deletes and returns to Train, leaving no
  trace in history, PRs, streaks, weekly counts, analytics or **Prev**, and any idle nudge for
  it is cancelled (reconcile re-run). Discard is deliberately silent — no companion cheer.
  Copy/choices are a pure module (`src/workouts/exits.ts`). **Not committed by the helper**
  (per delegation rules) — awaiting lead review/merge. Files: `app/workout/[id].tsx`,
  `src/workouts/exits.ts`, `scripts/test-workout-discard.mjs`, `.maestro/workout-discard.yaml`;
  `.maestro/workout-flow.yaml` + `screenshots.yaml` updated (they tapped the old Finish alert).

_Nothing in flight._ Last completed: **workout lifecycle / idle handling** (2026-10-15):
`src/workouts/{policy,lifecycle,WorkoutLifecycleWatcher}`, settings (check-in thresholds),
Train resume/notice cards, workout-screen heartbeat, local nudges. Verified by
`npm run test:lifecycle` (30 assertions) and device flows
`scripts/e2e.sh _zoom-fixture +60min _idle-prompt +4h _idle-autoclose` (clock-shift).

Behaviour to preserve: last activity = max(start, set/exercise timestamps, screen
heartbeat); idle ≥ 45 min → "Still working out?" prompt (re-asked at most every 20 min);
stale ≥ 3 h → finished AT last activity (empty → discarded); extra open workouts are
closed as duplicates; closing is lazy (on launch/foreground/Train focus) with local
notifications at +45 min and 15 min before auto-finish. Thresholds: Settings → Workout
check-ins (backed up with settings).

## 1. State of the product

**Version:** 0.1.0 (closed-test candidate, never published to any store).
**Platforms:** Android (signed local release builds, tested on emulator),
iOS via Expo Go only (iOS native build needs macOS/Xcode or EAS — not available).

### Shipped phases
| Phase | What |
|---|---|
| P0–P1 | Scaffold, tokens/theming, Drizzle data model, workout logging, rest timer, export/import format |
| P1b | Routines (user term: Plans), PRs, history, charts, measurements, calculators |
| P2 | Knowledge-base sync + in-binary snapshot |
| P3 | Program DSL, progression engine, deloads, RPE caps, PAR-Q+ gate |
| P4 | Dashboard/analytics: muscle balance, longevity pillars |
| P5 | Responsive layout, font scaling cap, Maestro E2E |
| P6 | Release prep: privacy policy, Play data-safety draft, store listing draft, signed local builds, icon/feature-graphic placeholders |
| P7 | Workout UX overhaul: warm-ups, swap, supersets, plate calculator, taxonomy pickers, units |
| P8 | Catalogue: 627 exercises (577 live after dedupe), curated prose |
| P9 | Bottom-tab redesign (Programs · Train · Analytics · Exercises), refined set table + carry-over, own exercises, plan duplicate, **backup export/import UI**, onboarding + personal plan generator, week/readiness on Train, haptics + celebration, weekly reminders, backup carries profile/settings |

Full feature-by-feature status: `docs/product/FEATURE_MATRIX.md`.

### Verified at last session (2026-10-24)
- `npm run verify` ALL GREEN; `expo-doctor` 20/20 on SDK 58. **Device (release APK,
  `/tmp/lift-e2e-rpe`): `workout-flow` PASS** — it logs sets, opens the RPE explainer from the
  set table's RPE header (`shot-rpe-sheet`) and finishes; **`plan-picker` PASS** — it adds an
  exercise and opens the same RPE sheet from the plan target editor's RPE label. A muscle-grid
  screenshot confirms the two new 3D renders (Full-Body, Olympic) at tile size in the dark
  theme. A 320×693 dp audit (Display Zoom, `wm size 720x1560; wm density 360`) shows the
  four section headers aligned at the same y and a long exercise name fitting on one line.
- Purple icon set: `qa.py` 20/20 (18 cropped muscles + Full-Body/Olympic × 2 themes), and
  18/18 on the old orange set under the same (changed) metric; `exercise-menu` and
  `exercise-detail` PASS on a release build (`/tmp/lift-e2e-120444`).
- Earlier (2026-10-24, SDK 58 release build, `/tmp/lift-e2e-104711`): `onboarding`, `tabs` and
  `exercise-menu` PASS (the tab-bar rewrite + the 3D icon assets are covered there).
- Earlier (2026-10-22): `exercise-menu` PASS on a release build (`/tmp/lift-e2e-082213`);
  before that `exercise-detail`, `sheets`, `workout-flow` and `program-builder` passed.
- Not verified on a physical device: iOS layout/haptics/share sheet/notifications,
  Android physical device. **Needs the owner's hands.**

### Knowledge base (`lift-kb`)
- Bundle **0.6.0**: 631 exercise pages, **581 live** (duplicates deprecated with
  `replacedBy`), 1 program (`longevity-foundations`, 4 weeks, deload week 4).
- Six pages are the **rich-page pilot** (`barbell-squat`, `barbell-deadlift`, `push-up`,
  `farmer-carry`, `bird-dog`, `rowing-machine`): subheaded longevity notes, tempo written
  into the instructions, a motivation line, a safety note that says when to stop and who
  should regress. **Awaiting the owner's approval before the other ~600 pages are rewritten.**
- The later curated batches are still thin (4–5 steps, brief safety notes). **Not yet
  reviewed by a coach** — required before any public release (project rule).
- App snapshot (`assets/kb/snapshot`) is in sync with 0.6.0. The exercise page shows the
  longevity notes as the **Why** card; before 2026-10-19 the importer never stored them.

## 2. Next up (priority order)

00. **Owner actions from `docs/ops/SECRETS_POLICY.md` §6** — GitHub email privacy
    (a personal Gmail address is in 42 + 39 historical commits; decision A/B/C in §4),
    2FA, Dependabot, and an off-rig encrypted keystore backup.

0. **Owner-reported, awaiting a screenshot:** on the iPhone the set-row delete (×)
   appears to overlap the card's corner/edge ("doesn't fit nicely inside the box").
   The grid was tightened (set 24 / kg 58 / reps 50 / RPE 42 / check 30 / × 26) as a
   precaution, but the exact case is unconfirmed. Ask for the screenshot, reproduce at
   that width/text size (emulator: `wm size`/`density`/`font_scale`), then fix in
   `src/components/workout/SetRow.tsx` + `setGrid.ts`.

1. **Device verification pass** (owner): run on iPhone via Expo Go and a physical
   Android; report layout, haptics, share-sheet export, notifications. Fix findings.
2. **Polish the remaining screens** with the same treatment as the logging screen:
   exercise detail, history rows, plan detail/edit, measure, analytics charts. Audit
   at 1.3× text and 320 pt width (emulator: `adb shell settings put system font_scale 1.3`,
   `wm size 720x1280; wm density 360`).

2a. **"Plan vs Program" explainer — owner request 2026-10-24 (copy supplied).** An
    informational page that answers the terminology the app leans on every day: a **Plan**
    is *what/when* (the weekly schedule: Mon chest·tri, Tue back·bi, Wed rest…); a
    **Program** is *how it progresses* (a 12-week structure with sets/reps, intensity,
    progressive overload, recovery, progress tracking). Owner's framing to keep: Program =
    the higher-level structure, Plan = the schedule that organises its execution (a
    12-week muscle-building program *contains* the weekly plan, the sessions, the
    exercises); note that the fitness industry uses the two interchangeably.

    Recommendations:
    - **Copy lives in content, not JSX.** A structured module (`src/content/planVsProgram.ts`
      → blocks: intro, definition pair, schedule example, program example, key-line,
      caveat) rendered by one shared `ProsePage`/`InfoPage` component. Editing words must
      never mean editing layout.
    - **Make it updatable "from GitHub" the sanctioned way.** The app already has exactly
      one network call — an anonymous GET of public KB JSON (`src/kb/channel.ts`) — and the
      KB lives in `lift-kb` on GitHub. Put the long-form page in the KB as a *concept page*
      (new content type, shipped in the snapshot and updatable through the existing channel),
      so the owner can edit it on GitHub and (once the KB host serves the new bundle) users
      get it without an app release. No new SDK, no new endpoint. Interim if the KB schema
      is not touched yet: the local content module above, with the snapshot migration noted
      as a follow-up.
    - **Entry points:** Programs tab header (ⓘ "How programs work"), the first page of the
      program builder, the plan detail footer, the Programs empty state, and the left
      panel's More list (so it is findable from anywhere).
    - Match the app's own vocabulary in the copy (Plan = the routine the user edits;
      Program = the multi-week structure; Workout = a session) and say so explicitly.
    - Tests: a unit test for the content shape (every block has text; the two examples
      present) + a Maestro flow that opens it from the Programs header; typography gate
      applies as usual.

2b. **Programs section review — owner request 2026-10-24.** Four things the owner saw, plus
    the coherence pass they asked for ("all sections should be nicely and equally laid out…
    uniform and cohesive"):
    1. **Missing section header on Programs.** The tab opens straight into content while
       Browse/Articles lead with a title. Give every section the same header
       (title + a factual one-line subtitle, e.g. "Browse Exercises · 581 exercises in the
       library") via ONE shared component, so height, padding and type are identical.
    2. **Analytics top area takes too much room.** Review the title block + week strip
       stack and tighten it; the fix must be made in the shared header, not just there, so
       the four tabs stay equal.
    3. **Review/update the bio "persona" at any time.** A reachable "Your profile / persona"
       editor (Programs section + Settings) showing the inputs the generator uses (goal,
       experience, equipment, days/week, session length, limitations, PAR-Q+) *and* what each
       one changes (volume, reps, rest, excluded movements), with a "regenerate my program"
       action. Today the profile is set at onboarding and only reachable from Settings.
    4. **A new guided quiz that generates a fresh Program (and its Plans).** A step-by-step
       interview that (re)builds the persona, explains each question, then produces a
       multi-week program with plans inside it through the existing generator/builder — and
       shows the result for review before saving. **Constraint (decided, see §4):** LIFT is
       local-first and offline; "intelligent" here is a deterministic, explainable interview
       over the existing generator — NOT a cloud/LLM call. No new SDK, no network.
    - Also found on the device run (same pass): the muscle/equipment filter chips show a
      caret ▲ on the *equipment* chip while the *muscle* grid is open (screenshot in the
      2026-10-24 session notes) — the open/collapsed indicator should track the grid that is
      actually open.
    - Header shape, fixed 2026-10-24: Train used its segments AS the title ("Train |
      History") while Programs became title + switcher ("Programs" above "Explore |
      Library"). **Owner decision (2026-10-24): unify them** — Train now renders the title
      "Train" with the switcher "**Today** | History" beneath it, so all four sections have
      the same header shape and every one of them names itself.

2c. **Adaptive-type audit, app-wide — owner request 2026-10-24.** The owner wants the
    "one size computed once from the available width" rule (never per-label
    `adjustsFontSizeToFit`) verified everywhere, because on a Display-Zoomed iPhone they
    can still see **exercise names in an ongoing workout that are too big and get cut or
    shrunk**. Round 3 applied it to the filter chips/grid, analytics tiles, readiness
    options, summary numbers, `SegmentedTitle`, settings segments, the set-table numbers
    and headers, and the workout toolbar — this task is the sweeping review that the rest
    of the app is on the same rule, plus the reported fix.

    Method (repeatable): audit every screen that renders a *group of peers* or a lone label
    that can clip — exercise cards (workout, picker, browse, history, PR), plan and program
    rows, day/exercise lists, analytics tiles and chart labels, summary numbers, settings
    rows, buttons with long labels, empty states, onboarding steps, sheet titles. For each,
    either it uses `src/theme/adaptive.ts` (`fitTextSize`/`fitGroupSize`/`useGroupFit`), or
    it wraps to a second line deliberately, or it truncates on purpose.
    `adjustsFontSizeToFit` stays only on the three allowlisted lone headings. Check at
    288/320/390/430 dp and at 1.3× text (emulator: `adb shell wm size 720x1280; wm density
    360` and `adb shell settings put system font_scale 1.3`); `docs/design/TYPE.md` is the
    rule of record. Deliverable: the fixes + a short addendum in TYPE.md naming every
    screen and which of the three treatments it uses, so the next agent can check a new
    screen against the list.

    Known instance to fix first (the owner's case): `ExerciseCard`'s title
    (`displayName(exercise)`) is a fixed `t.size.card` on one line, so a long name such as
    "Romanian Deadlift (Dumbbell)" clips on a 320 pt Display-Zoom screen. It should take ONE
    size for the whole workout's exercise titles, computed from the card's available width
    and the longest name in the workout.

2d. **Scroll wheels for numeric entry — owner request 2026-10-24 ("instead of the numeric
    keyboard").** The owner wants weights/reps/RPE picked by flicking an iOS-style drum —
    the value in a highlighted band with its unit beside it — rather than typing on a
    numeric pad that covers half the screen mid-workout.

    Shipped as a first increment (2026-10-24 — see §6): a hand-rolled
    `WheelPicker` (no new dependency — a clock module would cost the Expo Go story),
    `wheelModel.ts` (rows, snapping, nearest-value, looping) with `test:wheel` (53), and
    `WheelSheet` (drum + unit + optional field tabs). Opened from the **set number** in a
    pending row (`edit-set-<n>`, hint glyph under the number) with Weight | Reps | RPE tabs;
    tapping a value pill still focuses the keypad, so nothing that works today regressed.

    Remaining, in order:
    1. **Make the wheel the primary path** — tapping a value pill opens the wheel, with a
       "Type" action for the keypad. That flips an interaction four Maestro flows depend on
       (`workout-flow`, `exercise-menu`, `user-content`, `screenshots` all tap `set-reps-*` /
       `set-weight-*` then type); each needs the extra step, and SetRow needs to re-focus the
       input when "Type" is chosen. Do this only with the device available.
    2. **Same wheel for the other numeric fields** — warm-up working weight, rest timer
       (the owner's screenshot is literally the timer drums: min + sec), plate calculator
       target weight, plan target sets/reps/weight/RPE, body measurements.
    3. **Polish** — show the unit inside the band only when settled vs live, a "tap the band
       to type" affordance, and per-field step rules (2.5 kg vs 5 lb is already in
       `wheelFields.ts`).
    4. Consider whether the *keyboard* should stay the default for reps (small range, fast to
       type) — an owner call once they have felt both.

2e. **Exercise info mid-workout — from the exercise title (owner request 2026-10-24).** The
    RPE explainer's sibling: while a set is in progress, tapping the exercise's name should
    show the same kind of sheet about *that exercise*. Not in the queue before now; the only
    path today is buried — the card's ⋯ actions sheet → "View Demo & History" → pushes the
    full `/exercises/<id>` screen, which takes the user out of the workout. The title itself
    does nothing (it was only ever a label; it got its adaptive size on 2026-10-24).

    Recommendations:
    - **Same shape as the RPE sheet** (`BottomSheet` + a pure content module + a Pip line),
      not a new pattern: `ExerciseInfoSheet.tsx` + `exerciseInfo.ts` (pure — picks and trims
      the fields that exist, so a thin KB page degrades instead of showing empty headers).
    - **Trigger:** the title becomes a button (accent + a small `info` glyph, exactly like
      the RPE column header) with role/label "About <exercise>"; the collapse chevron keeps
      its own job. Do not make the whole header row pressable — mid-set mis-taps would open
      a sheet instead of collapsing the card.
    - **Content, in the order a lifter needs it mid-set** (not the whole guide):
      1. name, primary muscles (taxonomy icons), equipment;
      2. **three to five key cues** from the KB (`cues`) — the one-screen answer to "am I
         doing this right?";
      3. **the safety stop line** (`safetyNotes`) — "when to stop" is the piece that matters
         mid-set;
      4. the plan's **rest + target** for this exercise when it came from a plan;
      5. **last time** for this exercise (sets × reps @ kg/RPE) — the most useful in-session
         fact and already on the row (`previous`);
      6. one longevity line (`longevityNotes`).
      Footer: **Open full guide** → the existing `/exercises/<id>` (Guide tab), and Close.
      The sheet caps at ~0.85 of the screen so 1–3 are visible with no scrolling.
    - **Offline and free:** every field is already on the exercise row / KB detail JSON;
      cache the derived object per exercise id in a module map instead of re-parsing JSON on
      each open. No new fetch, no new SDK.
    - **Companion, two voices as before:** on → Pip says the one-liner ("Chest and triceps —
      three cues, 90 s rest"); off → neutral header with the muscle icons.
    - **Reuse it afterwards** (`ExerciseInfoSheet` is generic): plan/program exercise rows,
      history detail, the post-workout summary, and Browse (its ⓘ currently pushes the screen
      directly; the sheet + "full guide" is the nicer two-step).
    - **Gates:** `scripts/test-exercise-info.mjs` for the pure module (missing fields, the
      safety line first, cue trimming) wired into `dev-loop.sh`; a Maestro flow that taps the
      title in a workout, asserts the cues, opens the full guide and returns to the workout
      with the pending set intact; typography/adaptive rules apply to the title button.
    - **Watch out:** keep the title's tap target ≥44 dp (hitSlop), and never navigate on the
      title tap — that is the current behaviour we are replacing.

2f. **Chrome on every page — the floating buttons never disappear (owner request
    2026-10-24).** The owner: some pages (e.g. the exercise guide) take the whole screen and
    the top floating buttons vanish; the left (panel) and right (settings) buttons should
    always stay visible across the app, like the companion. The in-page back arrow stays.

    Done now: `TopBar` draws both buttons on every route that shows the chrome (only
    onboarding and PAR-Q+ stay bare), so all three anchors — menu, companion, settings — are
    present everywhere and the page's own back/close control sits below them in the page
    header (it pads past `TOP_BAR_HEIGHT`, so they cannot overlap). `isTopLevelRoute` was
    left the codebase as dead weight and is gone; `exercise-browse.yaml` now asserts the two
    buttons on the exercise guide and that the panel opens/closes from there.

    Still to do — the "equal experience" half of the request, page by page:
    1. **Audit the eight screens that do not use `ScreenHeader`** (21 of 29 do): they
       hand-roll a back control (`app/programs/[id].tsx` still has its own `header-back`
       Pressable), which now sits next to a floating menu button. Unify them onto
       `ScreenHeader` (or a shared header) so title size, top padding, back glyph and the
       gap under the chrome are identical everywhere.
    2. **Decide per screen whether back goes to the left of the title or floats**: full-screen
       flows (add-exercise pickers, the workout) may deserve a back/close affordance in the
       *chrome* row as well, so the eye finds it in the same place every time — worth an
       owner look once the audit is done.
    3. **Check taps under the chrome:** anything a page drew in the top 60 dp (a page that
       skipped `useTopBarInset`) is now covered by a button; grep for screens that render
       their own top row without the header component.
    4. Re-run the affected flows on a device (`exercise-browse`, `panels`, `exercise-menu`,
       `tabs`, `workout-flow`) — the chrome is in every screenshot.

3. **Exercise content quality:** enrich the thin entries (list: live exercises with
   fewer than 4 instruction steps); add real safety notes for neck, behind-the-neck,
   plyometrics, dragon flag, Nordic curl, handstand push-ups; coach review.
4. **Save a finished workout as a plan** (freeform → template).
5. **Wake-lock during a workout** (`expo-keep-awake` is not installed; adding a module
   changes the Expo Go compatibility story — check first).
6. Progress photos (camera/photo permissions + privacy copy) — optional.
7. Health integrations post-v1 (HealthKit / Health Connect) — needs native builds.

## 3. Open human decisions (do NOT decide silently; drafts in `docs/release/DECISIONS.md`)

| Gate | Draft answer | Why it matters |
|---|---|---|
| `android.package` | `io.github.rattymcfarty.lift` (currently `app.lift.mobile`) | permanent after first Play upload |
| Version number | `0.1.0` for closed test, `1.0.0` after | tags, listings |
| Play $25 fee / Apple $99/yr | Play only when ready; GitHub Releases APK is the $0 path | money + owner's account |
| Privacy-policy URL | GitHub Pages from `docs/` | required by both stores |
| "LIFT" name clearance | keep + store title "LIFT: Private Workout Log" | trademark risk |
| Closed-test testers (12 × 14 days) | template message in DECISIONS.md | Play requirement |
| Final icon / feature graphic / screenshots | placeholders in `assets/brand/` | store listing |
| Build route | local builds (works today); EAS only if iOS is wanted | accounts |

Standing rule: **the agent does not enroll in, pay for, or submit anything to a store.**

## 4. Decisions already made (don't re-litigate)

- User-facing term is **Plan**; internal `routine` stays (backup-format compatibility).
- Weights stored in kg; display unit is a setting.
- Tabs: Programs / Train / Analytics / Exercises. No "Community" tab (no servers, by design).
- Two brand colors only: purple `accent`, blue `highlight` (see tokens.ts rules).
- Rule-based plan generation (explainable, offline) — not an opaque model. Starting
  loads are conservative bodyweight ratios, labelled as estimates.
- **No LLM in the loop, ever (owner-confirmed 2026-10-24).** The "intelligent quiz" that
  rebuilds a program will be a deterministic, explainable interview over the existing
  generator: an LLM-authored program would need a network/AI call and break the privacy
  non-negotiable. Parked as a decision, not a to-do.
- Section headers: every section names itself, and the page title + sub-view switcher shape
  is shared (Train "Train" + "Today | History", Programs "Programs" + "Explore | Library").
- KB IDs are permanent; dedupe = deprecate + `replacedBy`.
- Device config in AsyncStorage, included in backups via whitelisted `appData`.
- Media (exercise images) is **parked**; all exercises use the placeholder image.
- Third-party app screenshots in `~/lift/drive-catalog` were reference only and are
  intentionally **not** in any repo; the exercise data derived from them is original prose.

## 5. Repository & machine facts

- GitHub: `github.com/rattymcfarty/lift-app`, `github.com/rattymcfarty/lift-kb`
  (both public, `main` branch, direct pushes).
- Git identity on the rig: `rattymcfarty` / `rattymcfarty@users.noreply.github.com`
  (repo-local config; the owner's personal email is deliberately not in commits).
- Upload keystore SHA-256 (public; use to verify a restored keystore):
  `5F:9D:14:1B:56:C4:54:AA:A3:4A:33:6B:13:D6:2A:4F:B4:DC:27:39:0D:43:A4:3E:B8:7A:54:54:50:36:2E:04`
  (alias `lift-upload`, CN=LIFT Upload). The key itself is NOT in GitHub.
- Scratch/obsolete directories on the original rig (safe to ignore, not needed):
  `~/lift/lift-kb.stale-copy-nogit`, `lift-kb-drive`, `lift-kb-ci-fix`, `review-*`,
  `work/`, `drive-catalog`.

## 6. Session log (newest first)

### 2026-10-24 (later) — section headers + adaptive exercise titles (opencode)

- **Owner-reported on a Display-Zoomed iPhone:** the Programs section had no header naming
  it, the Analytics title area wasted ~60 dp, and exercise names in an ongoing workout were
  too big and got cut.
- **Root causes, both structural.** (1) `ScreenHeader` already adds
  `spacing.sm + TOP_BAR_HEIGHT`; Train/Programs added their own `useTopBarInset()` spacer
  *and* used `SegmentedTitle` (which added nothing), while Analytics added the spacer *and*
  `ScreenHeader` — so Analytics sat 60 dp lower and Train/Programs 13 dp higher than Browse.
  `SegmentedTitle` now owns the same allowance and the three screens dropped their spacers,
  so all four headings start at the same y. (2) The card title was a fixed 18 pt on one
  line, so "Romanian Deadlift (Dumbbell)" clipped at 320 dp; it is now
  `useGroupFit({ longest: the workout's longest name, base: card, min: meta })` measured on
  the title row — one size for the whole workout, never per-label shrinking.
- **`SegmentedTitle` gained an optional section `title`** (used by Programs: "Programs" with
  "Explore | Library" stepping down to a switcher beneath). Train is unchanged
  ("Train | History" already names the tab); unifying the two shapes is an owner call.
- **Device (release APK, 320×693 dp = 720×1560 @ 360):** all four headers align
  (`/home/dash/.maestro/tests/2026-10-24_151128/zoom-audit/`), the long exercise name renders
  complete on one line, and Programs shows its title. Side finding: at 320×569 dp the home
  screen's primary action is below the fold, which is why `_skip-onboarding.yaml`'s
  `home-start-workout` assertion fails on such a screen — the emulator needs the
  owner-sized height for these audits.
- Gate: `npm run verify` ALL GREEN. Rules of record: `docs/design/TYPE.md`
  ("Headers: exactly one top-bar allowance" + the screen-by-screen audit table).
- Owner's next requests are queued as 2a (Plan vs Program explainer), 2b (Programs section
  review: persona editor, guided quiz, header/uniformity), 2c (the app-wide adaptive-type
  audit that the exercise-title fix belongs to) and 2d (the scroll-wheel numeric entry).
- **Scroll wheels (owner asked to replace the numeric keypad).** Shipped the first
  increment: `src/components/ui/WheelPicker.tsx` (hand-rolled drum — `snapToInterval`, one
  `Animated` value fading the rows, three copies + silent recentre so it loops forever),
  `wheelModel.ts` (pure: rows/snapping/nearest/loop) with `test:wheel` (53), and
  `WheelSheet.tsx` (band + unit + Weight | Reps | RPE tabs). Opened from the set number in a
  pending row (`edit-set-<n>`); a tap on a value pill still opens the keypad, so no existing
  flow or habit broke. The remaining rollout (flip the default, other fields) is queue 2d.
  **Not yet seen on a device** — the Android APK has to be rebuilt for a JS change.
- **Device found a real bug in the wheel** (worth remembering): `Animated.event(...,
  { useNativeDriver: true })` on a plain `FlatList` throws — "Components based on
  VirtualizedList must be wrapped with Animated.createAnimatedComponent to support native
  onScroll events with useNativeDriver" — and it took the workout screen to the
  "Couldn't start LIFT" boundary as soon as the sheet rendered. The drum is now JS-driven
  (`onScroll` sets the `Animated.Value` directly, which a five-row drum can afford), and a
  flick keeps its momentum: settling on `onScrollEndDrag` would have cancelled the fling, so
  the drag end only arms a 260 ms fallback timer and `onMomentumScrollBegin` cancels it.

### 2026-10-24 — RPE explainer, the last two 3D icons, UI round 3 (opencode)

- **Full-Body and Olympic are 3D renders** (20 renders × 2 themes), from the same mannequin
  as the rest of the set: Full-Body lights all seven front-facing muscles; Olympic is the
  same figure with a rendered barbell at the thighs (steel shaft, dark plates, collar) so the
  two tiles stay distinct at 40 pt. `qa.py` gives whole-figure icons a documented 0.14
  `body_coverage` floor — a head-to-feet figure cannot fill a square frame the way a cropped
  muscle can; it stays a soft check and all 20 PASS. `build-icons.py --only` re-bakes a single
  icon while the other 19 keep their verified hashes; `render-all.sh` defaults to the shipped
  purple now (the old default was orange, a footgun for a full re-run). `test:icons` 232.
- **RPE explains itself where it is entered.** `src/components/workout/rpeGuide.ts` holds the
  copy (levels 6–10 with the reps left at each level, a worked program line, effort ≠ load,
  the 7–9 range most programs use); `RpeSheet.tsx` renders it in a `BottomSheet`. Two entry
  points: the set table's **RPE column header** (now accent with a new `info` ActionIcon,
  `testID="rpe-help"`, `ExerciseCard.onRpeHelp`) and the **RPE label** in a plan's target
  editor (`NumberInput` gained optional `onLabelPress`/`labelTestID` → `plan-rpe-help`).
  Companion on → Pip's avatar (same framing as the top-bar ring) says the one-line summary;
  companion off → a neutral “1–10 effort” badge and plain copy, so the sheet never depends on
  the companion. `test:rpe` (38) pins the scale, both voices and that both entry points stay
  wired.
- **UI round 3** (same batch, see §0 history): `src/theme/adaptive.ts` gives every group of
  peers ONE size computed from the width available and its longest label; Browse pins its
  search + chips; one `FilterChip` everywhere; the guide's Progression card wraps.
  `adjustsFontSizeToFit` survives on three lone dynamic headings only, enforced by
  `scripts/check-typography.mjs`. Tests: `test:adaptive` (55), `test:filters` (71);
  rule and width table in `docs/design/TYPE.md`.
- **Android Expo Go starts again**: `expo-notifications` is now loaded on demand
  (`src/notifications/native.ts`), so Expo Go 58.0.5 (which predates
  `ExpoTopicSubscriptionModule`) no-ops instead of dying at launch. `test:notifications` (8).
- Gate: `npm run verify` ALL GREEN; `test:rpe` registered in `package.json` + `dev-loop.sh`.
  **Device re-run pending** at the time of writing: `workout-flow` (opens the RPE sheet,
  `shot-rpe-sheet`) and `plan-picker` (opens it from the target field) on a fresh release
  APK, plus a look at the browse muscle grid for the two new icons.

### 2026-10-24 — icons recoloured to the app accent (opencode)

- Owner's call after seeing the set on iOS: the highlight should be the app's purple, not
  the warm orange, and the equipment icons should follow it so the whole library matches.
- The 18 muscle renders were re-baked with the accent in the muscle material (dark
  `#a073f0`, light `#6c3fd1`). The lit result lands a step darker — median `#966cde` /
  `#663ec3` — which is intended: a flat fill would look painted on, the render keeps the
  form. `TaxonomyIcon` passes `theme.colors.accent` to the vector muscle fallbacks *and* to
  every equipment icon; `scripts/render-icons.mjs` and `test:icons` follow the same tokens.
- **The QA gate had to change with the colour, and that needed care.** It recovered the
  painted area from raw RGB distance, which collapses in shadow: shadowed purple sat close
  to grey skin, so 67 % of the "soft" pixels lay deep inside the muscle and 14/18 icons
  failed `soft_edge` at 13–35 px. Measuring distance in chromaticity (each channel over the
  pixel sum) fixed it; the band was re-calibrated to 0.25–4.0 px, where the sharp set scores
  0.3–2.3, a 6 px haze 4.8 and a 10 px haze 7.4. That is stricter than the old 1–10 px.
  Both the new purple set and the old orange set pass 18/18 under the new metric.
- `--color orange` and `--color red` stay in the renderer for comparison.
- Gate: `qa.py` 18/18; `npm run verify` ALL GREEN; release-build flows `exercise-menu` and
  `exercise-detail` PASS (`/tmp/lift-e2e-120444`). The light theme is the softer of the two —
  purple on the tinted grey figure carries less luminance contrast than the orange did, though
  the shape still holds at 44 pt; that is the trade the owner chose, not a defect to "fix" by
  brightening the accent.

### 2026-10-24 — Expo SDK 58 migration (opencode)

- The owner's iPhone stopped loading the app: Expo Go on iOS ships only the newest SDK and an
  older build cannot be installed on a device, so an SDK 57 project is refused before any of
  our code runs. Restarting Metro cannot fix that — useful to know before debugging a
  "connection" problem that is really an SDK mismatch.
- Bumped straight to Expo's `sdk-58` `bundledNativeModules.json` (never guessed versions):
  `expo` 58.0.19, React Native 0.88.0, React 19.3.0, router 58.0.25, screens 4.30, svg 15.16,
  plus the 16 `expo-*` packages. `node_modules` and the lockfile were rebuilt from scratch.
- The whole API delta was four things: the custom `TabBar` gets `navigateToTab(route.key)` +
  `emitter` instead of `navigation`; `Tabs` no longer accepts `initialRouteName` (use
  `unstable_settings = { anchor: 'index' }`); list slots reject `null` (use `undefined`);
  `TextInput` refs are `TextInputInstance`.
- Gate: `expo-doctor` 20/20, `npm run verify` ALL GREEN, release-build flows `onboarding`,
  `tabs`, `exercise-menu` PASS (`/tmp/lift-e2e-104711`).
- iOS is still unproven: those flows are Android. The owner's phone is the first iOS run of
  SDK 58 here — watch notifications, sqlite migrations and the share sheet.

### 2026-10-23 — 3D muscle icons: production renders, warm accent (opencode)

- Replaced the 18 vector muscle icons with renders of a 3D mannequin (Blender 4.5 LTS,
  Cycles, CC0 base mesh). Owner's brief: match the reference's look without copying its art;
  then, after the first review, "orange instead of blue" and sharper muscle definition.
- Definition was the interesting problem. Ambient occlusion alone was too subtle at tile
  size, so the separation is *drawn*: crease polylines in `CREASES` darken the muscle colour
  along the linea alba, the tendinous intersections, the quad heads and the pec border.
  The other half of the fix was making the muscle pass opaque — the pale band across the
  biceps and triceps was semi-transparent muscle blending with the grey body, not lighting.
- Colours: `--color orange` (default) or `--color red`; the dark/light pair bakes in one run.
  Light theme gets a darker skin tint (linear ×0.235) at packaging time so the figure holds
  up on the `#e9e9ee` tile.
- Framing is still a per-region crop, not the reference's full-body tile; the owner approved
  the crops in this round.
- Not done: the three deltoid heads, the quad medialis teardrop, and the clavicle cut on the
  chest patch (listed in §0).
- Gate: `exercise-menu` PASS on a release build with the new icons (`/tmp/lift-e2e-163516`);
  `npm run verify` ALL GREEN (test:icons 216). Committed as `4d5ad63`.
- Dev-build noise worth knowing: a debug APK shows a LogBox error at launch,
  `expo-notifications: Custom sound 'default' not found in native app`, from
  `sound: 'default'` in `src/notifications/restAlert.ts`. LogBox hides the UI and makes
  Maestro fail mid-flow, so **gate on a release build** (`scripts/e2e.sh --build <flow>`),
  not a Metro-served debug APK. The notification sound itself deserves a look.
- Owner's iPhone is blocked on Expo tooling: Expo Go on iOS is SDK 58 only and cannot be
  downgraded, so an SDK 57 project refuses to load. Android release APK works. An SDK 58
  migration is a separate job (see §0).

### 2026-10-22 — two-step icon shadow, reference re-measured (opencode)
- Soft shadow step shipped (`f7dbaa2`): `#6a6a6a` → `darken(muted, 0.14)`, a translated copy
  of every shadow band plus a wider under-stroke on every limb; 36 soft fills, 47 soft
  strokes. `test:icons` 67, verify green, `exercise-menu` PASS on a release build
  (`/tmp/lift-e2e-082213`). Sheet `~/lift/icon-review/9-shadow-soft-pass.png`.
- Re-measured the reference instead of trusting the earlier description: it is flat fill +
  line work, **no shading** — card `#1d1d1d`, body `#343434`, lines `#656565`, muscle
  `#ff7a1a`. The gap to close is body contrast (ours +52 % vs theirs +9 %) and line density
  (ours 3–9 strokes per icon), not shadow. Recorded in §0 with the owner decision.

### 2026-10-19 — exercise-guide bug, queue F and G (opencode)
- Found a real content bug while making the guide flow honest: the KB importer dropped
  `longevityNotes` (the transform passed it, `upsertKbExercise` never wrote it), so the
  **Why** card was missing on every exercise page. Fixed (`0f209bb`).
- Rewrote `.maestro/exercise-detail.yaml` to scroll the guide in measured 25%-of-screen
  steps (`_scroll-guide.yaml`): `scrollUntilVisible` flings ~1.5 screens on this page and
  skips the short card headers. It now asserts a line from every card (`41b3953`).
- Queue F: `opencode/beam-free` passed the parseDuration bake-off in 17 s (fastest) and
  moved to 2nd in `pool_order` + the `code` rank (`d7e084a`, `docs/ops/DELEGATION.md` §6).
- Queue G: this checkpoint. `main` pushed through `cbf4f07`; nothing in flight.
- Equipment icons: the ten figures now share one body language (neck, tapered torso, elbows
  and knees, feet); Barbell/Bodyweight/Kettlebell/Safety Bar/Smith Machine redrawn (`7a1402e`).
  Device `exercise-menu` and `exercise-detail` PASS on a release build from that tree.
- Muscle icons, first detail batch: Abs (one rectus sheet), Front/Middle Delts (arm hangs
  from a deltoid cap; highlight wraps the joint) and Neck (column + traps) rebuilt
  (`f8c76db`). Device `exercise-menu` PASS on a release build.
- Muscle icons, second batch: Adductors (teardrops on the inner thigh, no whisker) and
  Forearms (flexor segment filled) (`23110ec`), same flow PASS.
- Icon shadow tone: fifth authoring colour `#4d4d4d` → `darken(muted, 0.28)`; every
  source SVG shaded (torso/pelvis band, limb offset strokes) (`acd6380`), flow PASS.

### 2026-10-16 — leave-program deadlock fixed (opencode helper)
- Leaving a program works again: enrolling re-took the database write lock from inside itself
  (`enrollProgram` → `ensureSessionStates`) and deadlocked, so every later write waited
  forever; enrollment now uses a lock-free `insertSessionStates`, covered by the new
  `.maestro/program-leave.yaml` flow. Owner rule: lead agent delegates first (CLAUDE.md).

### 2026-10-16 — cross-agent foundation, OpenCode helper (claude-code)
- Program builder: deload control + copy week; fixed a kb_id UNIQUE bug in dropped days.
- Found two opencode installs; v1 (`~/.opencode/bin`) retired, v2 pinned.
- Researched the OpenCode V2 docs and tested them live: free models refuse direct Inference API
  calls (FreeTierError) with or without the service-account key, and work through the `opencode`
  CLI on the owner's Console sign-in. `ask` permissions hang non-interactive runs. Parallel
  runs wedge the shared service (fix: `opencode service restart`). Jev 1.13 Free (systemone
  endpoint) works with the service-account key and is used as the task router.
- Built: AGENTS.md as canonical guide, skills, collaboration protocol, delegation wrapper +
  MCP tool `delegate_to_opencode_free`, test:agents guard (127 checks). `npm run verify` ALL GREEN.

- **2026-10-15 (details pages)** — Program Details wizard (`app/programs/[id]/{details,setup}.tsx`,
  `src/components/programs/ProgramFormBits.tsx`): create → page 1 → page 2 → builder; edit via ✎.
  Model: `UserProgram.details` (+ `normalizeDetails`, limits NAME 50 / TAGLINE 160 /
  DESCRIPTION 3000). Thumbnails live in `Paths.document/program-thumbs` — NOT in backups.
  `.maestro/_wizard-shots.yaml` captures both pages (screenshots land in ~/.maestro/tests).

- **2026-10-15 (builder)** — User program builder (`app/programs/[id].tsx`,
  `src/programs/{userProgramDef,userPrograms}.ts`): record in AsyncStorage
  `lift:user-programs` (in backups, union-merged), each day a routine with kbId
  `uprog:<id>:w<week>:d<day>`, compiled to the DSL (`source: local`). Known gaps:
  no deload UI (model supports `deloadWeek`), no per-week copy shortcut, day
  weekday mapping is fixed (`SESSION_DAYS`).

- **2026-10-15 (later)** — Workout lifecycle (see §0); proportional set table; Tailscale
  dev-server addressing (`REACT_NATIVE_PACKAGER_HOSTNAME=<tailscale-ip>`, URL
  `exp://<tailscale-ip>:8081`); `scripts/e2e.sh` one-command device loop; RESUME_PROMPT.

- **2026-10-15** — Interaction polish from the owner's iPhone screenshots: swipe LEFT removes /
  swipe RIGHT adds (`src/components/ui/SwipeableRow.tsx`; sets, exercises, plans, plan
  exercises), exercise rows with muscle icon + strong selected state
  (`ExercisePickRow`), rounded aligned remove buttons, header "Set" wrap fixed, lb prefill
  fix. E2E covers swipe add/remove. Owner-reported ×-overlap remains unconfirmed.

- **2026-10-14 (late)** — Disaster-recovery hardening: `scripts/verify-recovery.sh`
  (fresh clone → `npm ci` → all tests) found and fixed three hidden rig dependencies
  (package.json async-storage pin, KB `dist/` needed before `test:kb`, `test:p7`
  hard-coded bundle version). Set numbers now renumber on delete
  (`softDeleteSet` keeps 1..n; new sets take `max+1`; pending rows display by list
  position) — covered by `.maestro/user-content.yaml`.
- **2026-10-14** — P9 pass: matrix, onboarding, generator (+tests), Train week/readiness,
  celebration/haptics, reminders, appData in backups; set-table grid + carry-over;
  own exercises; plan duplicate; export/import UI; exercise dedupe + curation in KB;
  tabs redesign; typography gate; local signed builds; recovery tooling + this file.
- **2026-10-13** — P8 catalogue and app batch pushed; Claude Code took over from the
  earlier fallback toolchain.

### Session addendum — deload + copy week
Program builder gained deload control and Copy week (`copyWeek` in `src/programs/userPrograms.ts`); `dropRoutines` now releases `kb_id`. `.maestro/program-builder.yaml` covers both and passes on the release APK. Remaining ideas: multi-select in plan picker, thumbnails in backups, exercise-detail polish.

### 2026-10-17 — back-facing muscle icons (opencode helper, branch delegate/icons-b)
- Drew 9 original muscle-group SVGs in `assets/icons-src/muscle`: Rear Delts, Triceps,
  Lats, Upper Back, Lower Back, Glutes, Hamstrings, Abductors, Calves. All back-facing
  figures on the 48x48 grid, one shared back-figure geometry (torso, 4.2-stroke arms with
  ellipse hands, thigh/knee/shin/foot), `#bfbfbf` LINE seams and `#ff7a1a`/`#b34700`
  HI/HI_LINE highlights, square viewBox crops inside the grid so both mirrored sides stay
  visible; file names equal the taxonomy ids exactly (`Upper Back.svg`, spaces included).
  2.2-2.8 KB each.
- Crop per icon: Rear Delts `11 10 26 26`, Triceps `10 11 28 28`, Lats `11 11 26 26`,
  Upper Back `11 8 26 26`, Lower Back `11 19 26 26`, Glutes + Hamstrings `13 26 22 22`,
  Abductors `13 20 22 22`, Calves `15.5 31 17 17`.
- Regenerated `src/components/icons/iconArt.generated.ts` with `node scripts/build-icon-art.mjs`
  (13 icons). Reviewed three rendered rounds of `.opencode/renders/sheet.png` and refined
  every icon at least twice (crop, muscle silhouette, fibre direction).
- Fixed `docs/design/ICON_STYLE.md`, which still described the pre-pilot rules (96x96
  viewBox, `#4a4a50`/`#85858c` theme hexes, 6 KB, kebab-case ids) that
  `scripts/build-icon-art.mjs` has never enforced; it now states the 48 grid, the four
  authoring colors, the taxonomy file names and the shared body proportions.
- `npm run verify` → ALL GREEN (secrets, typecheck, all unit tests incl. `test:icons`,
  typography gate). Files are written but NOT committed (per task rules).
- Known trade-offs, for whoever draws the front-facing batch (Front Delts, Biceps,
  Forearms, Neck, Abs, Adductors, Olympic, Full-Body, Other): the back torso is wider at
  the ribs/waist than Chest.svg's front torso (a back view is broader, and the lats and
  glutes need the width) — keep or adjust deliberately. The calf highlight necessarily
  sits low in its crop because the calf is just above the ankle and the grid ends at 48.

