# KB sync (P2)

The app consumes the lift-kb knowledge base as versioned JSON bundles —
**content only, never user data**. No accounts, no auth, no analytics.

## How it works

1. **First launch:** `importSnapshotOnFirstLaunch()` imports the in-binary
   snapshot (`assets/kb/snapshot/bundle.json`) into the local database.
   The app works fully offline out of the box.
2. **Every app open:** `syncKb()` fetches `channel.json`, compares `latest`
   against the imported version, and — only when an update is available —
   downloads the bundle, verifies its sha256 (hash-pinned to the channel),
   schema-validates every item, then imports.
3. KB programs import as **routines** (one per session): they appear in the
   Routines tab and start workouts like any template. The program envelope
   (weeks, deload) is P3's domain.

## Privacy

The only network calls the app makes are the two explicit HTTPS GETs in
`channel.ts` / `bundle.ts` (channel.json, then the bundle). No cookies, no
auth headers, no query parameters, no PII. Media URLs are allowlisted to the
KB's own hosting (`assertKbMediaUrl`) so opening an exercise can't leak
IP/timing to a third party.

## Refreshing the in-binary snapshot

When lift-kb publishes a new bundle version:

```sh
# in the lift-kb checkout:
node scripts/build-bundle.mjs        # sanity-check
# in the app checkout:
node scripts/sync-kb-snapshot.mjs /path/to/lift-kb
```

This copies `dist/kb-bundle-<version>.json` → `assets/kb/snapshot/bundle.json`
and `channel.json` → `assets/kb/snapshot/channel.json`. Commit both files —
they're part of the build. The snapshot is re-validated at runtime
(`snapshot.ts`), so a stale asset can never poison the database.

## Why the validator is hand-rolled

`src/kb/validate.ts` implements the draft-07 subset the KB schemas use
instead of ajv: ajv v8 compiles schemas via `new Function()`, which Hermes
does not support. The schemas are vendored in `src/kb/schemas/` — if lift-kb
bumps `schemaVersion`, vendor the new schemas with the app update.

## Tests

`npm run test:kb` — validates the real built bundle (10 exercises + 1 program)
against the vendored schemas, verifies the sha256 contract against
channel.json, and exercises the pure transforms. Zero new dependencies
(project tsc + node:crypto only).
