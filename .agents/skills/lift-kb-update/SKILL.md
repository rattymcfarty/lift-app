---
name: lift-kb-update
description: Change exercise or program content in the lift-kb repo, rebuild the bundle, and sync the snapshot that ships inside the app.
---

# Knowledge-base content update

1. Edit content in `~/lift/lift-kb/content/` (Markdown pages, the only source: `exercises/<id>.md`, `programs/<id>.md`; CC BY 4.0), then `node scripts/validate-content.mjs` there.
   **IDs are permanent:** never rename or delete. Retire with
   `deprecated: true` + `replacedBy: <id>`.
2. Bump `kb-version.json`, then `cd ~/lift/lift-kb && node scripts/build-bundle.mjs --write-channel`.
   Run lift-kb's own checks, then commit and push lift-kb.
3. Sync into the app: `cd ~/lift/lift-app && node scripts/sync-kb-snapshot.mjs ~/lift/lift-kb`
   (copies to `assets/kb/snapshot/{bundle,channel}.json`).
4. `npm run test:kb` (needs `../lift-kb/dist` built) and `npm run verify`.
5. Note the new bundle version in HANDOFF §1 and `CHANGELOG.md`. Commit and push lift-app.

Content rules: longevity framing (2–3 reps in reserve, movement patterns), cite
publications, never name experts or trainers, and coach review is required before public release.
