# LIFT — Longevity Intelligent Fitness Trainer

Free, MIT-licensed, local-first workout tracker with longevity-focused
programming. **No accounts, no servers — your training data never leaves your
device.** (Truthfully stated: OS-level device backups may include app data per
your own device settings. You can export a full copy anytime from Settings.)

Built from scratch with Expo (SDK 57) + TypeScript + Drizzle ORM + expo-sqlite
+ expo-router. Private by construction.

## Status

**Pre-release (0.1.0, closed-test candidate).** Workout logging, routines,
history/PRs/charts, muscle balance, measurements, calculators, 433-exercise
offline catalogue, and export/import are built. Runs in Expo Go (SDK 57);
Android release builds are produced locally (`npm run build:android`).
See `CHANGELOG.md` and `docs/release/RELEASE_CHECKLIST.md`.

## Quickstart

Prereqs: Node 22+, npm. iPhone testing uses the App Store Expo Go app (SDK 57).

```sh
npm install
npx expo start        # scan the QR code with Expo Go
npm run typecheck     # tsc --noEmit — must pass before every push
```

Android dev build (full native, primary test platform):

```sh
npx expo run:android
```

Signed Android release build (AAB + APK; one-time keystore setup first):

```sh
npm run setup:keystore
npm run build:android
```

## For AI agents and contributors

This project is built to be continued by **any** coding agent or harness
(Claude Code, OpenCode, Codex/ChatGPT, Hermes, Gemini CLI, Cursor, Copilot) or a human:

- [`AGENTS.md`](AGENTS.md) is the canonical guide: rules, map, commands, definition of done.
- [`docs/ops/HANDOFF.md`](docs/ops/HANDOFF.md) holds current state and next steps;
  [`docs/ops/AGENT_COLLABORATION.md`](docs/ops/AGENT_COLLABORATION.md) explains how agents share the repo.
- `.agents/skills/` has step-by-step playbooks (also exposed as `.claude/skills`).
- [`docs/ops/DELEGATION.md`](docs/ops/DELEGATION.md): the lead agent can hand grunt work to an
  OpenCode helper on free models (`scripts/delegate.sh`, MCP server in `.mcp.json`).

## Project structure

```
app/            expo-router screens (P1 adds feature screens)
src/
  db/           Drizzle schema + migrations + expo-sqlite client
                Sync-ready from day one: UUID keys, created_at/updated_at,
                soft deletes (deleted_at). See src/db/schema.ts.
  domain/       pure training logic (stats, records, streaks) + tests (P1)
  data/         local repository layer over Drizzle (P1)
  theme/        design tokens (light/dark/system), ThemeProvider, breakpoints
```

## Database

Migrations are generated with drizzle-kit and applied at startup via
`useMigrations` (drizzle-orm/expo-sqlite/migrator):

```sh
npm run db:generate   # after editing src/db/schema.ts
```

## Privacy

- No network calls except the public knowledge-base sync (`lift-kb`
  bundles — content only, no user data, anonymous fetch).
- No analytics, no crash reporting, no ads.
- Export/import: full JSON export (P1).

## License

MIT — see LICENSE. Knowledge-base content lives in the separate `lift-kb`
repo (CC BY 4.0 prose, CC0 media).
