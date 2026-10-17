# LIFT — handoff (living document)

> **Update this file at the end of every working session.** A new agent with zero
> memory must be able to continue from this file + the repo alone.
> Last updated: 2026-10-14, after the P9 personalisation pass and the
> disaster-recovery hardening. Repo HEAD at the time: see `git log -1`.

## 0. In-flight work (update before every commit)

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

### Verified at last session
- `npm run verify` ALL GREEN. Counts: kb 29, p7 96, plan 167, backup 91 + roundtrip 23,
  calculators 23, programs 48, progression 45, stats 71, typography gate ok.
- Maestro on the signed release APK (emulator `lift-test`): `onboarding`, `tabs`,
  `user-content`, `workout-flow` all pass.
- Not verified on a physical device: iOS layout/haptics/share sheet/notifications,
  Android physical device. **Needs the owner's hands.**

### Knowledge base (`lift-kb`)
- Bundle **0.5.1**: 627 exercise files, **577 live** (50 duplicates deprecated with
  `replacedBy`), 1 program (`longevity-foundations`, 4 weeks, deload week 4).
- 194 exercises (added in 0.5.0) have curated, exercise-specific prose, but the
  later batches are thin (4–5 steps, brief safety notes). **Not yet reviewed by a
  coach** — required before any public release (project rule).
- App snapshot (`assets/kb/snapshot`) is in sync with 0.5.1.

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
