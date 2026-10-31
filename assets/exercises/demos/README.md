# Exercise demo clips

Short, silent movement loops shown at the top of an exercise guide. The first
two are `bench-press-powerlifting.mp4` and `dumbbell-bench-press.mp4`;
Dumbbell Bench Press also has a second version, `dumbbell-bench-press__2.mp4`,
and the guide shows a Demo 1 / Demo 2 switcher. Every other exercise currently
gets the placeholder tile (its primary-muscle icon + "Movement demo coming
soon"). The queue and priority order live in
`docs/product/ANIMATION_PLAN.md`.

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
without new detail. If a future pass wants a pixel-perfect full-width tile on
3× screens, author those clips at 1080² and relax the contract then.

The guide also opens the clip full screen on tap (the same file, letterboxed on
black with a close button), so there is no second asset to ship.

## Adding a clip

1. Render the loop with the `lift-exercise-animation` skill (the house "neon
   studio" look: dark set, matte mannequin, orange worked muscles, blue edge,
   purple neon line).
2. Name the file after the exercise's **permanent KB id**, not its display
   name: `assets/exercises/demos/<kb-id>.mp4`. The id is in
   `assets/kb/snapshot/bundle.json` and the guide resolves the clip by it.
   A second version of the same exercise is `<kb-id>__2.mp4`, a third is
   `<kb-id>__3.mp4`; the base file is version 1 and the guide shows a switcher.
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
5. Every clip must also pass the animation skill's `natural_motion_check()`:
   the implement needs a small, smooth attitude variation (e.g. a few degrees
   of inward tilt) and a slight left/right difference. A perfectly rigid or
   perfectly mirrored implement is rejected before encoding.

## Multiple demo versions

An exercise can carry more than one loop. `dumbbell-bench-press.mp4` is demo 1
and `dumbbell-bench-press__2.mp4` is demo 2. The registry stores an array per
exercise; the guide shows a **Demo 1 / Demo 2** pill row under the tile and in
the full-screen viewer. The `exercise-demo-dumbbell` Maestro flow switches
versions, expands, switches back inside the viewer, and closes. Add a version
by dropping the file and re-running the generator; no code change is needed.

## Where future clips live

- **Bundle the movement-pattern loops.** 8–12 clips (push, pull, squat, hinge,
  lunge, carry, core, mobility) at ~0.4 MB each is ~4 MB and gives every
  exercise a moving demo from day one. The KB already carries
  `movementPattern` for this mapping.
- **Do not bundle one clip per exercise.** 581 live exercises × ~0.42 MB is
  ~244 MB (the full 631 catalogue entries would be ~265 MB); app stores and users will not accept that. Bundle the 50 curated
  foundational clips first (~21 MB), then the movement-pattern loops.
- **Per-exercise overrides, when they exist, should be hosted** (the KB's own
  CDN / object storage, same trust domain as `channel.json`) with a manifest and
  downloaded on demand into `expo-file-system`, cached, with the bundled pattern
  loop as the offline fallback. That is a network call, so it needs an explicit
  owner decision — LIFT's default is no new network calls.
- The KB's `demoMedia.video` field is reserved for those hosted URLs
  (`https:` only, allowlisted by `assertKbMediaUrl`). Bundled clips stay in this
  folder + the generated registry, keyed by KB id.
