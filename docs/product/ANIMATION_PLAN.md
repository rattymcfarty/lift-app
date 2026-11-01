# Exercise animation plan

**Status 2026-11-01:** 3 of **581 live** exercises (631 catalogue entries; deprecated duplicates are not animated) have an approved, bundled movement clip.

| KB id | Exercise | Status |
|---|---|---|
| `bench-press-powerlifting` | Bench Press - Powerlifting | approved / bundled |
| `barbell-squat` | Barbell Squat | approved / bundled |
| `dumbbell-bench-press` | Dumbbell Bench Press | approved / bundled — 2 demo versions |

Every other exercise shows the placeholder tile (primary-muscle icon + "Movement demo coming soon"). An exercise may carry several demo versions; the guide adds a Demo 1 / Demo 2 switcher.

> **Owner workflow change — 2026-11-01.** The video agent now produces the clips and syncs them to
> `assets/exercises/demos`/GitHub. This app lists that folder at runtime, matches each published
> file to the exercise by display name/KB id/aliases/plurals, and shows every version automatically
> (one-hour cache; bundled clips are the offline fallback). This plan remains the **production
> priority for the video agent**; it is no longer a generation queue for this agent. The video agent
> names files by exercise display name (`Barbell Squat.mp4`, `... - 2.mp4`, `... - Dumbbell-2.mp4`);
> no app release is needed when a clip lands.
This document is the queue, the priority order and the review contract for the remaining 578 live exercises.

## The review gate (one clip at a time)

1. The **video agent** renders the loop and validates it (physics, natural motion, 720², 24 fps,
   3 s, H.264 yuv420p, silent, ≤ 500 KB, fast-start).
2. The video agent drops the approved MP4 in `assets/exercises/demos` using the exercise display
   name and syncs GitHub. The **app** lists the folder, matches by name/aliases/plurals and shows
   every matching version; the one-hour cache picks it up.
3. Optional bundled/offline clips are copied under the permanent KB id and registered
   (`node scripts/gen-exercise-demo-registry.mjs`); they must pass `npm run test:exercise-demo` and
   the natural-motion rule.
4. `npm run test:video-catalog` pins the published-file naming and matching rules.

**Non-negotiable validation:** the clip must show natural human motion. Equipment cannot be
perfectly rigid, perfectly straight or perfectly mirrored; `natural_motion_check()` requires a
small smooth attitude variation (a few degrees of inward tilt, a slight left/right difference) and
rejects twitch. The physics report is attached to every review.

## Production team and handoff (Claude Code + OpenCode)

Two agents produce the clips on this rig (one machine, one Blender at a time). The owner is the only reviewer.

| Role | Who | Does | Never does |
|---|---|---|---|
| **Lead / renderer** | Claude Code | Writes and debugs exercise scripts, runs `scripts/animation/render_clip.sh`, posts the MP4 + contact sheet, and after the owner's approval registers, tests, documents, commits and pushes | Pushes a clip the owner has not approved |
| **Helper** | OpenCode (free models, `scripts/delegate.sh`) | Prepares everything that is safe without Blender: exercise **briefs** (`docs/product/animation/<kb-id>.md`, template `_TEMPLATE.md`), KB checks (id, aliases, equipment, primary muscles), queue/plan upkeep, doc and test updates after an approval | Run Blender (its shell is deny-by-default), push, or merge; any non-free model |
| **Reviewer** | The owner | Approves or rejects each clip from the posted MP4; says what to change | — |

**Why this split:** the helper's sandbox cannot (and should not) run arbitrary code such as Blender scripts. Briefs make
each exercise a short, well-specified edit of a reference script, so the lead's time goes into pose debugging, not research.

### Handoff rules

1. **One render at a time.** `render_clip.sh` holds `/tmp/lift-render.lock`. A tile takes ~7 min. Do not start a second Blender.
2. **Claims.** The *Status* cell in the queue tables is the claim: "in progress (claude)" = being scripted/rendered, "brief (opencode)" = brief being
   written, "queued" = free. Take a free row by writing your name in its Status cell in your commit; never work a row someone else holds.
3. **Order.** Follow the tier order below. Briefs run **ahead** of the renderer by about 10 exercises so the lead never waits.
4. **A brief is done** when every template field is filled from the KB entry (`~/lift/lift-kb`) and the closest done clip is named.
   Brief status goes to `brief`; the lead flips it to `scripted` / `rendered` / `in review` / `approved`.
5. **Review gate unchanged** (above). On approval the lead copies the MP4 to `assets/exercises/demos/<kb-id>.mp4`,
   runs `node scripts/gen-exercise-demo-registry.mjs`, `npm run test:exercise-demo`, `npm run verify`, updates this file,
   CHANGELOG, HANDOFF and FEATURE_MATRIX, commits and pushes to `main`. Only bundled clips (the 50 foundational) take the registry step;
   later clips are published under their display name (see `assets/exercises/demos/README.md`).
6. **Free models only** for OpenCode; keep its sessions (owner can open them); one delegation at a time.
7. **The character model is private.** It stays in `~/lift/animation-work/assets/character/` and is never committed or described to external services.

### How to hand a task to OpenCode (lead)

```bash
scripts/delegate.sh run briefs-tier0-a "Write animation briefs for barbell-deadlift, overhead-press, pull-up-bodyweight \
  using docs/product/animation/_TEMPLATE.md, the KB entries in ~/lift/lift-kb, scripts/animation/README.md and the two reference \
  scripts. One file per exercise in docs/product/animation/. Do not edit anything else." -t 20
```

The lead reviews the branch (`scripts/delegate.sh diff <slug>`), runs `npm run verify`, and merges. If the owner wants to continue a
task in OpenCode, leave its worktree (`cd ~/lift/delegations/<slug> && opencode -c`).

### What the lead needs from a brief (so scripting is mostly editing)

Pattern and kit; the reference script to copy; start and end pose in joint angles; where the implement travels; the supports that must
touch; grip; worked muscles; the camera that shows them; any rule that must be added or relaxed *with the reason*.

### Reference scripts and kits built so far

| Kit | Script | Clips |
|---|---|---|
| Bench + rack | skill `lift_toon_scene.py` (bench, in the private package) | `bench-press-powerlifting`, `dumbbell-bench-press` |
| Rack + barbell on the back | `scripts/animation/lift_squat.py` | `barbell-squat` (done) |
| Floor + barbell, straight arms | `scripts/animation/lift_deadlift.py` | `barbell-deadlift` (in progress — see "Deadlift: where it stands") |

## Deadlift: where it stands (2026-11-01, for the next agent)

Not rendered yet; nothing to review. Run the fast check, never the full render, until it passes:
`blender -b --factory-startup --disable-autoexec ~/lift/animation-work/assets/character/blender/Blender.blend --python scripts/animation/lift_deadlift.py -- /tmp/chk check style=neon`
(≈ 6 min with the emulator paused; report in `/tmp/chk/physics_report.txt`). Stills: `-- /tmp/s 0.55 nolayers --debug` (depth 1 = floor, 0 = lockout).

Fixed: grip, fingers, hand-roll flips, foot contact; **both elbows now stay ≈ 15°** (trunk rolls with the bar tilt
and the hip height is solved for both arms); knees now straighten steadily off the floor (`hold=0.6`).

Still failing (last check: 37 entries):
1. **Bar 0.8–1.4 cm into the shins/knees** at the floor (frames 1–9, 66–72, knee ≈ 116°) and as it passes the knees
   (frames 16–19, 56–58). `--debug` shows the nearest vertex is the front of the knee/shin, so the test is right.
   Root cause: hip height is solved from arm reach, so pushing the bar out lowers the hips and the knees follow it.
   Tried and rejected: more `kneeclear` (no effect), `barfwd` (noisy), steeper `lean1` (worse), an automatic
   per-frame hip setback (`adapt`, opt-in now: it made the floor frames worse). **Next idea:** solve the shin angle
   directly: put the knee where the shin stays ~1 cm behind the bar (two-bone leg from ankle to hip with the knee
   constrained), then derive the hip; or start shallower (bar higher on the shin is not allowed — plates fix it).
2. **Trunk lean changes too fast** around frames 20–26 / 52–55 (`lean jumps 8°/frame`, arm twist steps 4°): the
   `hold` curve compresses the back-angle change into depth 0–0.6. Spread it (e.g. `hold=0.8` or a gentler curve).
3. Elbows reach 25° for one frame at 25 and 52 (same cause as 2).

## Priority order

The owner's curated order is `src/lib/foundational.ts` (50 exercises). It is the spine: those are
the movements the app promises first. We produce the **pattern anchors** first so every movement
pattern has a credible demo, then the rest of the 50 in the owner's order, then the long tail.

### Tier 0 — movement-pattern anchors (10 clips)

| # | KB id | Exercise | Pattern | Status |
|---|---|---|---|---|
| 1 | `barbell-squat` | Barbell Squat | squat | **done** |
| 2 | `barbell-deadlift` | Barbell Deadlift | hinge | **in progress** (claude) — checks failing, see "Deadlift: where it stands" |
| 3 | `bench-press-powerlifting` | Bench Press - Powerlifting | horizontal push | **done** |
| 4 | `overhead-press` | Overhead Press | vertical push | queued · brief ready |
| 5 | `pull-up-bodyweight` | Pull-Up | vertical pull | queued · brief ready |
| 6 | `bent-over-barbell-row` | Bent-Over Barbell Row | horizontal pull | queued · brief ready |
| 7 | `barbell-walking-lunge` | Barbell Walking Lunge | lunge | queued · brief ready |
| 8 | `plank` | Plank | core | queued |
| 9 | `farmer-carry` | Farmer Carry | carry | queued |
| 10 | `worlds-greatest-stretch` | World's Greatest Stretch | mobility | queued |

`dumbbell-bench-press` (the horizontal-push dumbbell variant) is also **done**; it is the model for
equipment variants of an anchor.

### Tier 1 — the rest of the 50 foundational

Skip the 2 done and the 8 anchors above; produce the rest in owner order:

1. `front-barbell-squat` — Front Squat
2. `romanian-deadlift` — Romanian Deadlift
3. `incline-dumbbell-press` — Incline Dumbbell Press
4. `chin-up` — Chin-Up
5. `goblet-squat` — Goblet Squat
6. `bulgarian-split-squat-bw` — Bulgarian Split Squat
7. `leg-press` — Leg Press
8. `leg-curl` — Leg Curl
9. `leg-extensions` — Leg Extension
10. `barbell-hip-thrust` — Hip Thrust
11. `glute-bridge-bw` — Glute Bridge
12. `standing-calf-raises` — Standing Calf Raises
13. `weighted-step-up` — Step-Up
14. `push-up` — Push-Up
15. `wide-grip-lat-pulldown` — Lat Pulldown
16. `seated-cable-rows` — Seated Cable Row
17. `side-lateral-raise` — Lateral Raise
18. `face-pull` — Face Pull
19. `barbell-curl` — Bicep Curl
20. `triceps-pushdown` — Triceps Pushdown
21. `dips-triceps-version` — Dips
22. `reverse-flyes` — Reverse Flyes
23. `side-plank` — Side Plank
24. `dead-bug` — Dead Bug
25. `bird-dog` — Bird Dog
26. `hanging-knee-raise` — Hanging Knee Raise
27. `cable-woodchops` — Cable Woodchops
28. `pallof-press` — Pallof Press
29. `back-extension` — Back Extension
30. `kettlebell-swing` — Kettlebell Swing

The 10 cardio entries in the 50 (`treadmill`, `run`, `cycling`, `outdoor-cycling`, `rowing-machine`,
`elliptical`, `stair-climber`, `jump-rope`, `burpee`, `mountain-climbers`) need a different scene
from the strength rig; they are **Tier 3b** and not part of the first 40.

### Tier 2 — the next 100 common non-foundational exercises

After the 50, rank the remaining 531 non-foundational live exercises by:

1. the same movement pattern as an approved anchor (a variant of a shelf-ready pose);
2. equipment family (barbell, dumbbell, bodyweight, cable, machine, kettlebell);
3. common name keywords and aliases (press, row, pulldown, curl, extension, raise, lunge, squat,
   deadlift, plank, crunch, carry);
4. a live, non-deprecated KB entry.

The generated order is reviewed in 10–15 clip batches. A variant reuses its anchor's set kit,
camera and physics rules; only the implement path, support points and worked muscles change.

### Tier 3 — the long tail (the remaining 431)

Produced by set kit, not one-by-one from scratch. Set kits, in build order:

| Kit | Serves | Examples |
|---|---|---|
| Rack + barbell | squat / press family | back squat, front squat, overhead press |
| Floor + barbell | hinge / row / curl family | deadlift, RDL, bent-over row, curl |
| Pull-up bar | vertical pull / hanging core | pull-up, chin-up, hanging knee raise |
| Mat | core / mobility / bodyweight | plank, side plank, dead bug, bird dog, push-up, glute bridge, stretches |
| Dumbbells | dumbbell variants | incline press, goblet squat, split squat, lateral raise, reverse fly, farmer carry |
| Cable tower | cable family | pulldown, seated row, face pull, pushdown, woodchop, Pallof |
| Machines | machine family | leg press, leg curl, leg extension, calf raise |
| Cardio | Tier 3b | treadmill, bike, rower, elliptical, stair, jump rope |

## Production batching (the efficient order)

The priority tiers say **what**; the set kits say **how**. The first batches:

1. **Rack batch (3):** `barbell-squat` → `front-barbell-squat` → `overhead-press`.
2. **Floor + barbell (4):** `barbell-deadlift` → `romanian-deadlift` → `bent-over-barbell-row` →
   `barbell-curl`.
3. **Pull-up bar (3):** `pull-up-bodyweight` → `chin-up` → `hanging-knee-raise`.
4. **Mat (7):** `plank` → `side-plank` → `dead-bug` → `bird-dog` → `push-up` →
   `glute-bridge-bw` → `worlds-greatest-stretch`.
5. **Dumbbells (7):** `incline-dumbbell-press` → `goblet-squat` → `bulgarian-split-squat-bw` →
   `side-lateral-raise` → `reverse-flyes` → `farmer-carry` → `weighted-step-up`.
6. **Cable (6):** `wide-grip-lat-pulldown` → `seated-cable-rows` → `face-pull` →
   `triceps-pushdown` → `cable-woodchops` → `pallof-press`.
7. **Machines (4):** `leg-press` → `leg-curl` → `leg-extensions` → `standing-calf-raises`.
8. **Bench (2):** `barbell-hip-thrust` → `kettlebell-swing` (the bench/floor kit is already built).

Each batch is submitted for review **in the foundational order**, even when produced by set kit.

## Storage and release

- **Bundle the 50 foundational clips** (~21 MB at ~0.42 MB each). That covers the app's promise
  and keeps the guide offline with no new network call.
- **Do not bundle all 581 live** (~244 MB; 631 catalogue entries would be ~265 MB). App stores and users will not accept it.
- **Tier 2/3 clips are hosted** on the KB's own CDN (same trust domain as `channel.json`) with a
  manifest, downloaded on demand into `expo-file-system` and cached. The bundled pattern anchor is
  the offline fallback.
  - This adds a network call for users who open a long-tail guide; LIFT's default is no new network
    calls, so the owner must approve this explicitly before Tier 2/3 ships.
  - The KB's `demoMedia.video` field is reserved for those `https:` URLs (allowlisted by
    `assertKbMediaUrl`); bundled clips stay in `assets/exercises/demos/<kb-id>.mp4`.

## Cadence and effort

- One 72-frame tile is ~6–8 minutes of render on the rig, plus the physics/natural-motion pass and
  human review. Post 1–2 clips per review round.
- The 10 pattern anchors are the highest-value work: they cover every movement pattern and make the
  long tail a series of variants.
- 581 live clips is a long programme (roughly 4–6 months at 4–6 approved clips per day, including
  reviews). The pattern anchors and the 50 foundational are the near-term deliverable.

## Current next step

**Render `barbell-deadlift` (Barbell Deadlift)** — the hinge anchor, floor + barbell kit. The rack kit,
the Linux render pipeline (`lift_squat.py` as the template) and `natural_motion_check()` now exist.
Post the MP4 + contact sheet here for review.
