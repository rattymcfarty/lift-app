# Exercise animation plan

**Status 2026-11-01:** 4 of **581 live** exercises (631 catalogue entries; deprecated duplicates are not animated) have an approved, bundled movement clip.

| KB id | Exercise | Status |
|---|---|---|
| `bench-press-powerlifting` | Bench Press - Powerlifting | approved / bundled |
| `barbell-squat` | Barbell Squat | approved / bundled |
| `barbell-deadlift` | Barbell Deadlift | approved / bundled (owner override of two smoothness checks) |
| `dumbbell-bench-press` | Dumbbell Bench Press | approved / bundled — 2 demo versions |

Every other exercise shows the placeholder tile (primary-muscle icon + "Movement demo coming soon"). An exercise may carry several demo versions; the guide adds a Demo 1 / Demo 2 switcher.

> **Owner workflow change — 2026-11-01.** The video agent now produces the clips and syncs them to
> `assets/exercises/demos`/GitHub. This app lists that folder at runtime, matches each published
> file to the exercise by display name/KB id/aliases/plurals, and shows every version automatically
> (one-hour cache; bundled clips are the offline fallback). This plan remains the **production
> priority for the video agent**; it is no longer a generation queue for this agent. The video agent
> names files by exercise display name (`Barbell Squat.mp4`, `... - 2.mp4`, `... - Dumbbell-2.mp4`);
> no app release is needed when a clip lands.
This document is the queue, the priority order and the review contract for the remaining 577 live exercises.

## What to animate: the KB entry decides

The exercise's file in `lift-kb` (`content/exercises/<kb-id>.md`) is the **only** source of truth for what a clip
shows: the implement (`equipment`), the worked muscles (`muscles.primary` orange, secondary per the brief), the
pattern, the instructions, cues and common mistakes. Read it before writing a brief or a script and **build exactly
what it says; never ask the owner a question the entry already answers.** Where the entry lists several implements
(`overhead-press`: Dumbbell, Kettlebell), animate the first one; the others are later versions (`<kb-id>__2.mp4`).
The name alone is not enough: `overhead-press` is the **dumbbell** press (its *progression* is the barbell press,
which is `military-press-barbell`), and `dumbbell-overhead-press` is a separate dumbbell entry that reuses the same
motion. Every brief starts with the line "Facts below are taken from the KB entry `<kb-id>`".

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
| Floor + barbell, straight arms | `scripts/animation/lift_deadlift.py` | `barbell-deadlift` (done) |

## Deadlift: how it was solved (2026-11-01, notes for the hinge family)

Shipped with an **owner override** of two smoothness checks (knee reversal 2.3°/frame² vs 1.6, bar-speed jerk
0.007 vs 0.006); everything else passes on all 72 frames. What made it work, in `lift_deadlift.py`:
- Shoulders a few cm ahead of the bar, the back angle (`lean1=66`) sets the hips; the hip height is then raised by the
  measured elbow shortfall (elbow feedback) so both arms stay ≈ 15°. The trunk rolls with the bar tilt.
- The knee-clearance nudge (`kneeclear=0.09`) moves the bar only, not the shoulder target, so the knees don't follow it.
- The back angle holds off the floor (`hold=0.8`) and the bar rises linearly in depth.
- Tempo: steady speed mid-pull with half-cosine speed ramps (`ramp=0.25` at the floor, `ramptop=0.45` at lockout);
  cosine easing stopped the knee dead at lockout.
- Open trade-off: softening the knee's second bend (`hold` 0.85–1.0) puts the bar 1 cm into the shins. A direct
  shin-angle solve (knee placed so the shin stays behind the bar) is the next idea for the hinge family.

## Priority order

The owner's curated order is `src/lib/foundational.ts` (50 exercises). It is the spine: those are
the movements the app promises first. We produce the **pattern anchors** first so every movement
pattern has a credible demo, then the rest of the 50 in the owner's order, then the long tail.

### Tier 0 — movement-pattern anchors (10 clips)

| # | KB id | Exercise | Pattern | Equipment (KB) | Status |
|---|---|---|---|---|---|
| 1 | `barbell-squat` | Barbell Squat | squat | Barbell | **done** |
| 2 | `barbell-deadlift` | Barbell Deadlift | hinge | Barbell | **done** (owner override of two smoothness checks) |
| 3 | `bench-press-powerlifting` | Bench Press - Powerlifting | horizontal push | Barbell + bench | **done** |
| 4 | `overhead-press` | Overhead Press | vertical push | Dumbbells (standing); kettlebell = later version | queued · brief ready |
| 5 | `pull-up-bodyweight` | Pull-Up | vertical pull | Bodyweight, pull-up bar | queued · brief ready |
| 6 | `bent-over-barbell-row` | Bent-Over Barbell Row | horizontal pull | Barbell | queued · brief ready |
| 7 | `barbell-walking-lunge` | Barbell Walking Lunge | lunge | Barbell | queued · brief ready |
| 8 | `plank` | Plank | core | Bodyweight, mat | queued |
| 9 | `farmer-carry` | Farmer Carry | carry | Dumbbells; kettlebell = later version | queued |
| 10 | `worlds-greatest-stretch` | World's Greatest Stretch | mobility | Bodyweight, mat | queued |

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
| Rack + barbell | squat / barbell press family | back squat, front squat, military press (barbell) |
| Floor + barbell | hinge / row / curl family | deadlift, RDL, bent-over row, curl |
| Pull-up bar | vertical pull / hanging core | pull-up, chin-up, hanging knee raise |
| Mat | core / mobility / bodyweight | plank, side plank, dead bug, bird dog, push-up, glute bridge, stretches |
| Dumbbells | dumbbell variants | overhead press, incline press, goblet squat, split squat, lateral raise, reverse fly, farmer carry |
| Cable tower | cable family | pulldown, seated row, face pull, pushdown, woodchop, Pallof |
| Machines | machine family | leg press, leg curl, leg extension, calf raise |
| Cardio | Tier 3b | treadmill, bike, rower, elliptical, stair, jump rope |

## Production batching (the efficient order)

The priority tiers say **what**; the set kits say **how**. The first batches:

1. **Rack batch (2):** `barbell-squat` → `front-barbell-squat`.
2. **Floor + barbell (4):** `barbell-deadlift` → `romanian-deadlift` → `bent-over-barbell-row` →
   `barbell-curl`.
3. **Pull-up bar (3):** `pull-up-bodyweight` → `chin-up` → `hanging-knee-raise`.
4. **Mat (7):** `plank` → `side-plank` → `dead-bug` → `bird-dog` → `push-up` →
   `glute-bridge-bw` → `worlds-greatest-stretch`.
5. **Dumbbells (8):** `overhead-press` (next, Tier 0 anchor) → `incline-dumbbell-press` → `goblet-squat` → `bulgarian-split-squat-bw` →
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

**Render `overhead-press` (Overhead Press)** — vertical push anchor, **standing with two dumbbells** per the KB entry;
brief ready (`docs/product/animation/overhead-press.md`). Post the MP4 + contact sheet here for review.
