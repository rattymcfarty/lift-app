# LIFT — Longevity Intelligent Fitness Trainer

Free, MIT-licensed, local-first workout tracker with longevity-focused
programming. **No accounts, no servers — your training data never leaves your
device.** (Truthfully stated: OS-level device backups may include app data per
your own device settings. You can export a full copy anytime from Settings.)

Built from scratch with Expo (SDK 57) + TypeScript + Drizzle ORM + expo-sqlite
+ expo-router. Private by construction.

## Status

**Phase 0 scaffold.** Runs in Expo Go (SDK 57) and rig-built Android dev builds.
Feature screens land in Phase 1. Full plan: `IMPLEMENTATION_PLAN_v0.4.md`
(internal).

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
