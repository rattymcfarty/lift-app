---
name: lift-android-release
description: Build the signed Android release (AAB for Play, APK for testing) locally on the rig.
---

# Android release build

Needs the upload keystore at `~/lift/secrets/lift-upload.jks` and the `LIFT_UPLOAD_*`
passwords in `~/.gradle/gradle.properties` (restore: `docs/ops/RECOVERY.md`).

```bash
npm run build:android            # prebuild (regenerates gitignored android/) + signed AAB + APK, ~5 min
```

- Outputs land in `android/app/build/outputs/{bundle,apk}/release/`.
- In agent sandboxes, run it in the background and poll for completion. The
  e2e script can build too: `scripts/e2e.sh --build <flow>`.
- Bump `version`/`versionCode` in `app.json` only when the owner asks for a release.
- Never upload to a store, create tags/releases or pay fees. Those are owner
  steps (`docs/release/`).
