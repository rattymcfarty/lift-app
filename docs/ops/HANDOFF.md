# LIFT — handoff (living document)

> **Update this file at the end of every working session.** A new agent with zero
> memory must be able to continue from this file + the repo alone.
> Last updated: 2026-10-18, after the exercise-guide pass (queue item E). Repo HEAD
> at the time: see `git log -1`.

## 0. In-flight work (update before every commit)

- **START HERE if you are taking over while Claude Code is away (2026-10-18 → Monday):** `docs/ops/HANDOFF_AGENT_TO_AGENT.md` holds the ordered queue, rules and gotchas.

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

### Verified at last session (2026-10-19)
- `npm run verify` ALL GREEN. Device: `exercise-detail` PASS on a release build from this
  tree (it now scrolls and asserts every guide card); earlier on the same tree `sheets`,
  `exercise-menu`, `workout-flow` and `program-builder` passed.
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

