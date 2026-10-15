# CLAUDE.md — LIFT (read this first)

You are continuing development of **LIFT**, a free, MIT-licensed, local-first,
longevity-focused workout tracker (Expo / React Native). This file is loaded
automatically by Claude Code. It is the entry point for any AI agent resuming
work **with no prior memory**. Follow the reading order below, then continue.

## 1. Resume in five minutes

1. Read `docs/ops/HANDOFF.md` — **current state, what was done last, what is next,
   open decisions.** This is the living file; it is updated at the end of every session.
2. Skim `docs/ops/ENVIRONMENT.md` (toolchain) and `docs/ops/RECOVERY.md`
   (if the machine is new or broken).
3. Run `git log --oneline | head -20` and `git status` to confirm the tree matches HANDOFF.
4. Run `npm ci` (if `node_modules` is absent) then `npm run verify`.
   It must print **ALL GREEN**. If it does not, fix that before anything else.
5. Pick the top item under "Next up" in HANDOFF. Work in small, tested steps;
   commit and push often (GitHub is the backup — see Rules).

If this machine is brand new: run `scripts/bootstrap-rig.sh`, restore secrets
per `docs/ops/RECOVERY.md`, then `scripts/verify-recovery.sh`.

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
  plans, custom exercises, no lock-in.
- Safety: PAR-Q+ screening gates program enrollment; not medical advice; no
  expert/trainer names in UI or store metadata (cite publications).

## 3. Repositories (both public, GitHub user `rattymcfarty`)

| Repo | Purpose | Local path |
|---|---|---|
| `lift-app` | the Expo app (this repo) | `~/lift/lift-app` |
| `lift-kb`  | exercise/program content + bundle builder + CI | `~/lift/lift-kb` |

The app ships a **snapshot** of the KB at `assets/kb/snapshot/{bundle,channel}.json`.
To update it: bump `kb-version.json` in `lift-kb`, `node scripts/build-bundle.mjs
--write-channel`, commit/push `lift-kb`, then copy `dist/kb-bundle-<v>.json` →
`assets/kb/snapshot/bundle.json` and `channel.json` → `assets/kb/snapshot/channel.json`
here — `node scripts/sync-kb-snapshot.mjs ~/lift/lift-kb` does the copy. Exercise IDs are permanent:
deprecate with `deprecated` + `replacedBy`, never rename or delete.

## 4. Stack and map

Expo SDK 57, React Native 0.86, React 19, TypeScript (strict), expo-router (file
routes), Drizzle ORM + expo-sqlite, react-native-svg. No UI library; styling is
`StyleSheet`/inline with design tokens.

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
  programs/          program DSL, engine, enrollment, PAR-Q+ safety
  stats/             volume, balance, pillars, queries (pure + DB)
  lib/               planGenerator.ts (pure), calculators, units, filters
  notifications/     rest alerts + weekly workout reminders (local only)
  components/        workout/ (SetRow, ExerciseCard, ui), train/, analytics/, nav/, icons/ ...
plugins/             Expo config plugins (backup exclusion, release signing)
scripts/             tests, build, backup, recovery tooling
.maestro/            E2E flows (run on the emulator)
docs/                release/ (store, privacy, checklist), product/ (feature matrix), ops/ (this handoff)
```

Data model notes: UUID ids, `created_at/updated_at/deleted_at` on every table
(sync-ready, soft deletes). Weights are stored in **kg**; the UI converts. The
user-facing word is **Plan**; internal identifiers keep the historical name
`routine` (renaming would break backups). Device-level config (profile,
settings, reminders, theme) lives in AsyncStorage and rides in the backup's
`appData` block (`src/data/appData.ts`, whitelisted keys only).

## 5. Rules of the road

- **UI consistency is enforced:** every font size/weight comes from
  `src/theme/tokens.ts` (`npm run test:ui` fails on raw `fontSize`/`fontWeight`).
  Text scaling is capped (1.15× app-wide, 1.1× in the set table). Set-table
  columns come from `src/components/workout/setGrid.ts` — header and rows share it.
- Colors: gold `accent` = primary actions/active tab; orange `highlight` = set
  numbers, active-card border, stats. Don't invent new brand colors.
- **Never commit secrets:** keystores, `credentials.json`, `.env*`, tokens. The
  upload keystore lives at `~/lift/secrets/` and its passwords in
  `~/.gradle/gradle.properties` (see RECOVERY). `.gitignore` already blocks them.
- **Never push `.github/workflows/*`** with the GitHub App/automation path — a past
  restriction; the owner pastes workflow files via the web UI. (A normal `git push`
  by the logged-in user is fine for everything else.)
- Don't run `expo install --fix` / accept Expo's "dependencies out of date"
  prompts: it rewrites `package.json`/`app.json` side effects. Expo tooling has
  touched those files before; **review `git diff package.json app.json` before
  every commit** and revert unintended changes.
- `npx expo prebuild` **deletes and regenerates `android/`** (gitignored). That's
  expected; the release-signing plugin re-applies.
- Commit style: imperative subject, a short "why" body, end with the
  `Co-Authored-By` trailer given by the harness. Push to `main` (no PR flow yet).
- Don't create PRs/releases/tags unless the owner asks. Don't enroll in or pay for
  any store (human gates — see HANDOFF).

## 6. Commands

```bash
npm run verify              # typecheck + all unit tests (== scripts/dev-loop.sh)
npm run typecheck
npm run test:plan           # plan generator       npm run test:kb   # KB import
npm run test:ui             # typography gate      npm run test:p7   # workout UX logic
npm run test:backup && npm run test:backup:roundtrip   # export/import format
npm run build:android       # signed AAB + APK (needs keystore; ~5 min)
npm run test:e2e            # Maestro workout flow (emulator + release APK)
maestro test .maestro/<flow>.yaml
npx expo start --lan --port 8081     # Expo Go on iPhone: exp://<lan-ip>:8081
scripts/backup-local.sh <dir> [--with-secrets]
scripts/verify-recovery.sh  # fresh clone → install → full test suite
```

## 7. Hard-won gotchas (save yourself an hour)

- **Emulator lifetime (Claude Code sandbox):** background processes die when a tool
  call ends. Boot the emulator, install, and run Maestro **inside one shell call**:
  `nohup setsid $ANDROID_HOME/emulator/emulator -avd lift-test -gpu host -no-window
  -no-audio -no-boot-anim -no-snapshot -wipe-data &` then poll
  `adb shell getprop sys.boot_completed`. A release build takes ~5 min — start it
  in the background and poll for a `done` marker in one call.
- `pkill -f "expo start"` matches your own shell's command line and kills it. Don't.
- Background commands are capped at 2 h; the Expo dev server dies then. Restart it.
- Maestro: text selectors are regexes (full match). The catalogue has many similar
  names — select by `id` (`add-exercise-row-<kbId>`), use `scrollUntilVisible` for
  long lists, call `hideKeyboard` before tapping controls under the keyboard, and
  start flows with `runFlow: _skip-onboarding.yaml` (first launch shows onboarding).
  Custom exercises get random UUID ids, so match them with `id: "…row-.*"` + `index: 0`.
- Typed routes: a dead link fails `tsc` once Expo regenerates `.expo/types`
  (it caught `/plans` after the tab restructure). Fix the link; don't cast.
- Android autocorrect mangles exercise names — keep `autoCorrect={false}` on name fields.
- iOS can't be built on this Linux rig; iPhone testing is Expo Go only
  (no HealthKit/widgets/IAP). Android release builds are local (`build:android`).
- The KB has a few same-name exercises that are *different* (equipment variants).
  Names dedupe on live entries only; do not delete deprecated ones (IDs are permanent).

## 8. Keeping the handoff alive

At the end of **every** session: update `docs/ops/HANDOFF.md` (state, last
session summary, next up, decisions), update `CHANGELOG.md`, run `npm run verify`,
commit and push. A future agent with zero memory must be able to continue from
that file plus the repo alone.
