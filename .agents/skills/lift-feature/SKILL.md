---
name: lift-feature
description: Build or change a LIFT feature end to end, from pure logic and data to UI, tests, device flow and docs, following the project's conventions.
---

# Build a feature

1. **Shape it.** Find the closest existing feature and copy its structure
   (`grep -rn` in `app/` and `src/`). User-facing word: *Plan* (code: `routine`).
2. **Pure logic first.** Put rules and calculations in a pure module (no React,
   no DB), e.g. `src/programs/*Def.ts`, `src/workouts/policy.ts`, `src/lib/*`.
   Add or extend `scripts/test-<area>.mjs` and wire new scripts into
   `package.json` and `scripts/dev-loop.sh`.
3. **Data.** Writes go through `src/data/repositories.ts` (`withWriteLock`).
   Schema change = Drizzle migration in `src/db/migrations` plus a backup-format
   check (`npm run test:backup && npm run test:backup:roundtrip`). Device config
   goes in AsyncStorage *and* must be whitelisted in `src/data/appData.ts` to be
   backed up.
4. **UI.** Theme tokens only (`useTheme()`; sizes from `theme.typography`).
   Use `SwipeableRow` (left = remove, right = add), `OptionSheet`,
   `TextPromptModal`, `Button`/`Card` from `src/components/workout/ui.tsx`.
   Give every tappable element a stable `testID`. No fixed widths in the set table.
5. **Verify.** Run the `lift-verify` skill. For new screens, add or extend a
   Maestro flow (`lift-device-test` skill).
6. **Document.** Update `CHANGELOG.md`, `docs/product/FEATURE_MATRIX.md` and
   HANDOFF (§0 + session log). Commit and push.

Never add network calls, analytics, accounts or data-collecting SDKs (`AGENTS.md` §2).
