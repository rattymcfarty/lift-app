# AGENTS.md — LIFT (read this first)

This is the **canonical guide for every AI coding agent and harness** working on
LIFT: Claude Code, OpenCode, Codex / ChatGPT, Hermes, Gemini CLI, Cursor,
Copilot, Aider, or a human. Tool-specific files (`CLAUDE.md`, `GEMINI.md`,
`.github/copilot-instructions.md`, `.cursor/rules/`) only point here and add
tool quirks. **Edit rules here, not there.**

You are continuing development of **LIFT**, a free, MIT-licensed, local-first,
longevity-focused workout tracker (Expo / React Native). Assume you have **no
prior memory**: everything needed lives in this repo.

## 1. Resume in five minutes

1. Read `docs/ops/HANDOFF.md` — **current state, in-flight work (§0), next up,
   open decisions.** It is updated at the end of every session, by every agent.
2. Read `docs/ops/AGENT_COLLABORATION.md` — how several agents share this repo
   without colliding (claims, branches, review, attribution).
3. Skim `docs/ops/ENVIRONMENT.md` (toolchain), `docs/ops/RECOVERY.md` (new or
   broken machine) and `docs/ops/SECRETS_POLICY.md` (**the repos are public**).
4. `git status` and `git log --oneline -15` — confirm the tree matches HANDOFF.
5. `npm ci` (if `node_modules` is absent), then `npm run verify`. It must print
   **ALL GREEN**. If not, fixing that is your first task.
6. Take the in-flight item in HANDOFF §0, else the top of "Next up". Work in
   small, tested steps; checkpoint and push often (GitHub is the backup).

Step-by-step playbooks for recurring jobs are **skills** in `.agents/skills/`
(index in §9). Load the matching one before you start such a job.

## 2. What LIFT is (non-negotiables)

- **Longevity first:** strength, mobility, consistency, moderate effort
  (2–3 reps in reserve), movement vocabulary: squat · hinge · push · pull · lunge ·
  carry · core · mobility. Not a bodybuilding or hype app.
- **Private by construction:** everything runs on the device. No accounts, no
  servers of ours, no analytics, no crash reporting, no ads. The only network
  call is an anonymous GET of public knowledge-base JSON (`src/kb/channel.ts`,
  `src/kb/bundle.ts`). **Never add another network call or SDK that collects data.**
- **Open source, MIT.** Content in `lift-kb` is CC BY 4.0. Zero fees to users.
- **User owns their data:** full export/import (Settings → Your data), editable
  plans and programs, custom exercises, no lock-in.
- **Safety:** PAR-Q+ screening gates program enrollment; not medical advice; no
  expert/trainer names in UI or store metadata (cite publications).

## 3. Repositories (both public, GitHub user `rattymcfarty`)

| Repo | Purpose | Local path |
|---|---|---|
| `lift-app` | the Expo app (this repo) | `~/lift/lift-app` |
| `lift-kb`  | exercise/program content + bundle builder + CI | `~/lift/lift-kb` |

The app ships a **snapshot** of the KB at `assets/kb/snapshot/{bundle,channel}.json`.
Updating it is the `lift-kb-update` skill. Exercise IDs are permanent: deprecate
with `deprecated` + `replacedBy`, never rename or delete.

## 4. Stack and map

Expo SDK 57, React Native 0.86, React 19, TypeScript (strict), expo-router (file
routes, typed routes), Drizzle ORM + expo-sqlite, react-native-svg. No UI
library; styling is `StyleSheet`/inline with design tokens.

```
app/                 expo-router screens
  (tabs)/            Programs · Train(index) · Analytics · Exercises  (+ _layout.tsx)
  workout/ plans/ exercises/ programs/   detail & flow screens (stack, above tabs)
  onboarding.tsx settings.tsx history.tsx prs.tsx measure.tsx calculators.tsx ...
src/
  theme/             tokens.ts = single source of truth (colors, type scale, FONT_WEIGHT)
  db/                schema.ts, migrations/ (drizzle), client.ts
  data/              repositories.ts (writes), routines.ts, history.ts, settings.ts,
                     profile.ts, customExercises.ts, generatedPlan.ts, export/import/backup*
  kb/                knowledge-base import, snapshot, taxonomy
  workouts/          idle/lifecycle policy + reconciler (auto-finish, prompts, nudges)
  programs/          program DSL, engine, enrollment, PAR-Q+ safety, user program builder
  stats/             volume, balance, pillars, queries (pure + DB)
  lib/               planGenerator.ts (pure), calculators, units, filters
  notifications/     rest alerts + weekly workout reminders (local only)
  components/        workout/ (SetRow, ExerciseCard, ui), train/, analytics/, nav/, icons/, ui/ ...
plugins/             Expo config plugins (backup exclusion, release signing)
scripts/             tests, build, backup, recovery, delegation tooling
.maestro/            E2E flows (run on the Android emulator)
.agents/skills/      shared agent playbooks (also visible as .claude/skills)
docs/                release/ (store, privacy), product/ (feature matrix), ops/ (handoff, process)
```

Data model notes: UUID ids, `created_at/updated_at/deleted_at` on every table
(sync-ready, soft deletes). Weights are stored in **kg**; the UI converts. The
user-facing word is **Plan**; internal identifiers keep the historical name
`routine` (renaming would break backups). Device-level config (profile,
settings, reminders, theme, user programs) lives in AsyncStorage and rides in
the backup's `appData` block (`src/data/appData.ts`, whitelisted keys only).
Pure logic (`src/lib`, `src/programs/*Def.ts`, `src/workouts/policy.ts`,
`src/stats`) is unit-tested by `scripts/test-*.mjs`; keep IO out of those files.

## 5. Rules of the road

- **UI consistency is enforced:** every font size/weight comes from
  `src/theme/tokens.ts` (`npm run test:ui` fails on raw `fontSize`/`fontWeight`).
  Text scaling is capped (1.15× app-wide, 1.1× in the set table). Set-table
  columns are **proportional** (`GRID_FLEX` in `src/components/workout/setGrid.ts`;
  header and rows share it) and sizes derive from window width via `gridMetrics` —
  never add fixed-point widths to the table. Check layout changes at
  288/320/411/514 dp (see the `lift-device-test` skill).
- **Interaction conventions:** swipe **left = remove**, swipe **right = add**
  (`src/components/ui/SwipeableRow.tsx`) — everywhere: sets, exercises, days, plans.
- Colors: gold `accent` = primary actions/active tab; orange `highlight` = set
  numbers, active-card border, stats. Don't invent new brand colors.
- **This repo is PUBLIC.** Read `docs/ops/SECRETS_POLICY.md`. A pre-commit hook
  scans every commit and refuses non-noreply author emails; `npm run secrets:scan`
  / `secrets:history` run the same checks on demand. No real IPs, emails, keys or
  personal data in commits — use placeholders like `<tailscale-ip>`.
- **Never commit secrets:** keystores, `credentials.json`, `.env*`, tokens, API
  keys. They live in `~/lift/secrets/` and `~/.gradle/gradle.properties`.
- **Never push `.github/workflows/*`** from automation — the owner pastes workflow
  files via the web UI. Other files under `.github/` are fine.
- Don't run `expo install --fix` / accept Expo's "dependencies out of date"
  prompts. **Review `git diff package.json app.json` before every commit** and
  revert unintended changes.
- `npx expo prebuild` **deletes and regenerates `android/`** (gitignored). Expected.
- Don't create PRs/releases/tags, enroll in or pay for any store unless the owner
  asks (human gates — see HANDOFF).

## 6. Definition of done (every change, every agent)

1. Code matches the surrounding style; pure logic has unit tests (`scripts/test-*.mjs`,
   wired into `scripts/dev-loop.sh`).
2. `npm run verify` → **ALL GREEN** (secrets scan, typecheck, all unit tests, typography gate).
3. UI changes: the relevant Maestro flow passes (`scripts/e2e.sh <flow>`); add or
   extend a flow for new screens. Layout changes checked at the zoom widths.
4. `CHANGELOG.md` updated; `docs/product/FEATURE_MATRIX.md` if a feature changed;
   `docs/ops/HANDOFF.md` §0 + session log updated.
5. Commit: imperative subject, short "why" body, the attribution trailer your
   harness requires (see `docs/ops/AGENT_COLLABORATION.md` §4). Push to `main`
   (no PR flow yet) — or to your claimed branch if you were asked to work on one.

## 7. Commands

```bash
npm run verify              # secrets + typecheck + all unit tests (== scripts/dev-loop.sh)
npm run typecheck
npm run test:plan           # plan generator       npm run test:kb  (needs ../lift-kb/dist built)
npm run test:ui             # typography gate      npm run test:p7  # workout UX logic
npm run test:agents         # this agent foundation (files, skills, links) is intact
npm run test:backup && npm run test:backup:roundtrip   # export/import format
npm run build:android       # signed AAB + APK (needs keystore; ~5 min)
scripts/e2e.sh [--build] [flow ...]     # Maestro on the emulator, PASS/FAIL summary
scripts/delegate.sh run <slug> "<task>" # hand a task to the OpenCode helper (sandboxed)
npx expo start --lan --port 8081        # Expo Go on iPhone (skill: lift-expo-iphone)
scripts/backup-local.sh <dir> [--with-secrets]
scripts/verify-recovery.sh  # fresh clone → install → full test suite
```

## 8. Hard-won gotchas (save yourself an hour)

- **Agent sandboxes kill background processes** when a tool call ends (Claude Code
  does). Boot the emulator, install and run Maestro **inside one shell call** —
  `scripts/e2e.sh` does exactly that. Long-lived servers are capped (~2 h).
- `pkill -f "expo start"` matches your own shell's command line and kills it.
  Find the PID with `ss -ltnp | grep :8081` and kill that.
- Maestro: text selectors are full-match regexes. Select by `id`, use
  `scrollUntilVisible` for anything below the fold, `hideKeyboard` before tapping
  under the keyboard, start flows with `runFlow: _skip-onboarding.yaml`.
  Custom exercises get random UUID ids: match `id: "…row-.*"` + `index: 0`.
  The emulator sometimes drops ("0 devices connected") — just rerun the flow.
- Typed routes: a dead link fails `tsc` once Expo regenerates `.expo/types`.
  Fix the link; don't cast.
- Android autocorrect mangles exercise names — keep `autoCorrect={false}` on name fields.
- `routines.kb_id` is UNIQUE and soft-deleted rows keep theirs: release it
  before reusing (see `dropRoutines` in `src/programs/userPrograms.ts`).
- iOS can't be built on the Linux rig; iPhone testing is Expo Go only
  (no HealthKit/widgets/IAP). Android release builds are local (`build:android`).
- The KB has a few same-name exercises that are *different* (equipment variants).
  Names dedupe on live entries only; never delete deprecated ones.
- Two `opencode` installs existed on the rig; only v2 (`~/.local/node/bin/opencode`)
  is valid. `scripts/delegate.sh` pins it.

## 9. Skills (playbooks in `.agents/skills/<name>/SKILL.md`)

| Skill | Use it when |
|---|---|
| `lift-resume` | starting any session (orientation + health check) |
| `lift-feature` | building or changing a feature end to end |
| `lift-verify` | before every commit (definition of done) |
| `lift-device-test` | running/adding Maestro flows, zoom/layout checks, clock-shift tests |
| `lift-expo-iphone` | starting the Expo dev server for the owner's iPhone |
| `lift-kb-update` | changing exercise/program content and syncing the snapshot |
| `lift-android-release` | building the signed Android AAB/APK |
| `lift-handoff` | ending a session or switching agents (checkpoint) |
| `lift-delegate` | handing a self-contained task to the OpenCode helper agent |

Harnesses without skill support: just open the `SKILL.md` and follow it.

## 10. Keeping the handoff alive

At the end of **every** session — and before handing over to another agent —
run the `lift-handoff` skill: update `docs/ops/HANDOFF.md` (§0 in-flight, state,
session log, next up, decisions), `CHANGELOG.md`, run `npm run verify`, commit,
push. A future agent with zero memory, in any harness, must be able to continue
from that file plus the repo alone.
