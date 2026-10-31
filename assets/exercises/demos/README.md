# Exercise demo clips

Short, silent movement loops shown at the top of an exercise guide. The first
one is `bench-press-powerlifting.mp4`; every other exercise currently gets the
placeholder tile (its primary-muscle icon + "Movement demo coming soon").

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

720 px is deliberate: the tile is 120 pt, so 720 covers a 3× screen and still
leaves headroom for a 160 pt hero later. 1080 is wasted bytes; 480 is soft when
previewed on a desktop.

## Adding a clip

1. Render the loop with the `lift-exercise-animation` skill (the house "neon
   studio" look: dark set, matte mannequin, orange worked muscles, blue edge,
   purple neon line).
2. Name the file after the exercise's **permanent KB id**, not its display
   name: `assets/exercises/demos/<kb-id>.mp4`. The id is in
   `assets/kb/snapshot/bundle.json` and the guide resolves the clip by it.
3. Regenerate the static registry (Metro cannot `require()` a dynamic path):

   ```bash
   node scripts/gen-exercise-demo-registry.mjs
   ```

4. Run the contract test:

   ```bash
   npm run test:exercise-demo
   ```

   It checks the registry against the files, that every id is a real KB
   exercise, and the size/codec/duration/audio limits.

## Where future clips live

- **Bundle the movement-pattern loops.** 8–12 clips (push, pull, squat, hinge,
  lunge, carry, core, mobility) at ~0.4 MB each is ~4 MB and gives every
  exercise a moving demo from day one. The KB already carries
  `movementPattern` for this mapping.
- **Do not bundle one clip per exercise.** 433 exercises × ~0.45 MB is ~195 MB;
  app stores and users will not accept that.
- **Per-exercise overrides, when they exist, should be hosted** (the KB's own
  CDN / object storage, same trust domain as `channel.json`) with a manifest and
  downloaded on demand into `expo-file-system`, cached, with the bundled pattern
  loop as the offline fallback. That is a network call, so it needs an explicit
  owner decision — LIFT's default is no new network calls.
- The KB's `demoMedia.video` field is reserved for those hosted URLs
  (`https:` only, allowlisted by `assertKbMediaUrl`). Bundled clips stay in this
  folder + the generated registry, keyed by KB id.
