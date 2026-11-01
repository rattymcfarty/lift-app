# Exercise demo clips

Short, silent movement loops shown at the top of an exercise guide. The guide
shows a full-width tile with a **Demo 1 / Demo 2** switcher and a full-screen
viewer; the number of versions is whatever the app finds for that exercise.

There are two ways a clip reaches the app:

| Kind | File name | Where it comes from | Shipped in the app? |
|---|---|---|---|
| **Bundled** | `<kb-id>.mp4`, `<kb-id>__2.mp4` | approved clips registered here | yes, offline |
| **Published** | `<Exercise Name>.mp4`, `<Exercise Name> - 2.mp4` | the video agent, synced to GitHub | no, fetched at runtime |

The bundled clips today are `bench-press-powerlifting.mp4`, `barbell-squat.mp4` and
`dumbbell-bench-press.mp4` / `__2`. The video agent is filling the same folder
with display-name versions; the app discovers them automatically and matches
them to the exercise name.

## Contract

| Property | Value |
|---|---|
| Size | 720 × 720 (1:1) |
| Frame rate | 24 fps |
| Length | 3 s loop (72 frames) |
| Codec | H.264 High, level 3.1 |
| Pixel format | `yuv420p` |
| Audio | none |
| Size cap | 500 KB (aim 300–400 KB) |
| Container | MP4, `+faststart` (index at the front) |

720 px is deliberate: the tile fills the guide's content width (capped at 420 pt)
so it is crisp at 2× and upscales about 1.5× on a 3× phone — acceptable for the
soft studio render. Do not upscale an existing 720 clip to 1080: the bytes grow
without new detail.

The guide opens the clip full screen on tap (the same file, letterboxed on black
with a close button), so there is no second asset to ship.

## Publishing a clip (the video agent)

1. Drop the MP4 in `assets/exercises/demos/` using the **exercise display name**
   from the app, not the KB id:
   - `Barbell Squat.mp4` — version 1
   - `Barbell Squat - 2.mp4` — version 2
   - `Dumbbell Bench Press - Dumbbell-2.mp4` — version 2 with the equipment word
   - `Dumbbell Bench Press (2).mp4` — also version 2
2. Sync the repo to GitHub (`main`). Nothing else is needed: the app lists this
   folder through the public GitHub contents API, parses the version, normalizes
   the name (equipment and parentheticals stripped, punctuation removed), and
   matches the exercise's display name, KB id, aliases and plurals.
3. The app caches the catalogue for one hour; the next refresh picks the file up
   on every phone. No app release is required.
4. The file stays out of the app bundle: `metro.config.js` blocks published
   (non-KB-id) MP4s. The app streams the raw GitHub URL through `expo-video`.
5. The **contract above still applies** — the tile is 720², 3 s, silent.

Network/caching: the catalogue is one anonymous public GET of
`https://api.github.com/repos/rattymcfarty/lift-app/contents/assets/exercises/demos`,
cached in AsyncStorage for one hour; the videos are public raw GitHub MP4s.
This is an owner-approved addition to LIFT's network list (the KB JSON is the
other). No cookies, auth headers, query params or personal data.

**E2E:** `scripts/e2e.sh --build` sets `EXPO_PUBLIC_LIFT_E2E=1`, which disables
the remote catalogue so Maestro always tests the bundled fixtures. The normal
build keeps the GitHub catalogue on.

## Adding a bundled clip (approved, offline)

1. Render with the `lift-exercise-animation` skill.
2. Name the file after the exercise's **permanent KB id**:
   `assets/exercises/demos/<kb-id>.mp4`; later versions `<kb-id>__2.mp4`.
3. Regenerate the static registry: `node scripts/gen-exercise-demo-registry.mjs`.
4. `npm run test:exercise-demo` — registry ↔ files ↔ KB ids and the full
   codec/duration/audio/size contract.
5. `npm run test:video-catalog` — published-name parsing and exercise matching.
6. The clip must pass the animation skill's `natural_motion_check()` before it is
   committed.

## Multiple versions

Bundled versions come from the registry array (`dumbbell-bench-press__2.mp4`).
Published versions come from the GitHub file names. When published clips exist
for an exercise the app uses them; the bundled clips remain the offline fallback.
The version switcher and the full-screen viewer show every matched version.
Duplicate files are deduped by file name.

## Where future clips live

- **Published clips** are the long tail: the video agent drops them in this
  folder, syncs to GitHub, and the app streams them. Nothing is bundled.
- **Bundled clips** are the offline fallback and the E2E fixtures. The 50
  curated foundational clips (~21 MB) are the bundle target; the rest of the
  581 live exercises should not be bundled (~244 MB).
- The KB's `demoMedia.video` field remains reserved for allowlisted `https:`
  URLs; this GitHub catalogue is separate from that field.
