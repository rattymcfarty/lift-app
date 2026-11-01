# Animation production system — how we make 580 clips without reinventing the wheel

Status: **proposal, 2026-11-01** (owner asked for it). Not built yet; the rollout order is at the end.
Applies to every agent (Claude Code, OpenCode, Sonnet, Codex…). The queue itself stays in
`docs/product/ANIMATION_PLAN.md`; the per-exercise briefs stay in `docs/product/animation/<kb-id>.md`.

## The problem with today's way

Each exercise is a ~1,300-line copy of a reference script (`lift_squat.py`, `lift_deadlift.py`). Every copy
rebuilds the scene, the materials, the lights, the camera, the compositor, the neon line, the equipment and
its own pose solver, and repeats the physics checker. A new exercise therefore means new mechanics code,
and a pose bug (the deadlift's bar-through-the-shins) costs hours of 40-second Blender restarts.
At 580 clips that does not scale. Three things are slow: **authoring** a new motion, **iterating** on a pose,
and the **render** (≈ 7 min of GPU per clip, ≈ 68 h for the whole catalogue — acceptable if it runs unattended).

## The system: build once, describe each clip as data

```
lift-anim/ (one library, versioned)            per exercise (small)
├── template.blend   character + look + camera  ├── spec  <kb-id>.yaml   kit, implement, grip, supports,
├── equipment.blend  every implement, once      │                          key poses, tempo, muscles, camera
├── poses.blend      named key poses (assets)   └── (optional) <family>.py hook for unusual mechanics
├── lift_anim/       Python package
│   ├── scene.py     open template, link kit, frame camera
│   ├── rig.py       Rigify FK/IK helpers, true-length solvers
│   ├── motion.py    key poses → 72 frames (tempo curves, constraints)
│   ├── checks.py    physics + natural-motion rules, driven by the spec
│   └── export.py    render, encode, contact sheet, review stills
└── families/        squat · hinge · press · row · pull · lunge · carry · core · mobility · curl …
```

### 1. One scene template (`template.blend`)
The character, lights, background, floor, materials (palette), compositor (bloom, neon line layer, holdouts),
render settings and the tile camera rig are set up **once** and saved. A run opens the template instead of
building the scene in Python: faster start-up, and the look can never drift between clips.

### 2. Equipment library (`equipment.blend`)
Every implement modelled once at real dimensions with palette materials: Olympic barbell + plates (bumper and
iron sizes), EZ bar, dumbbells (graded sizes), kettlebells, flat/incline/decline bench, squat rack with J-hooks
and safeties, pull-up/dip station, cable stack with handles, box, mat, bands, landmine, trap bar, sled.
Each asset carries **named empties for its contact points** (grip zones, sleeve ends, seat, foot plate), so a
spec says "left hand on `barbell.grip_L` at 0.27 m" instead of computing it. Kits (rack kit, bench kit,
floor kit…) are collections linked into the template, never copied.

### 3. Rigify used the way it is meant to be
The metarig stays the blueprint; we animate the generated rig.
- **Feet and hands pinned with Rigify IK, IK Stretch = 0**, pole targets for knees/elbows. The "never IK" rule
  came from stretch squashing bones by ~9 %; with stretch off, bone lengths are fixed and the checker proves it
  every frame. This removes the custom two-bone solvers and ankle/grip calibration from every script.
- **Torso, hips and head** are driven by the `torso`/`hips`/`chest` controls; fingers by stored grip poses.
- To be validated first by re-making the approved squat with IK and comparing it frame by frame with the
  shipped clip. If Rigify IK flips or snaps near full extension, the library keeps the FK solver as a fallback
  per limb (already proven).

### 4. Key poses as assets (`poses.blend`)
Named poses saved in Blender's pose library: `hinge.setup`, `hinge.lockout`, `squat.bottom`, `press.rack`,
`row.top`, `lunge.bottom`, `grip.overhand`, `grip.neutral`… Authored once (interactively, see §6), reused
by every exercise of that family. A motion is then: key poses at phase points + the tempo curve + the
constraints (feet on floor, hands on implement, bar path) that the motion module enforces between them.

### 5. Families, not exercises
The 580 live exercises collapse into roughly 30–40 motion families with parameters:
- **hinge:** conventional/sumo/Romanian/stiff-leg deadlift, good morning, trap-bar, single-leg RDL
- **squat:** back/front/goblet/box/split/Bulgarian, with implement and depth parameters
- **press, row, pull, curl, extension, raise, lunge, carry, core, mobility, plyometric**
Implement swaps (barbell → dumbbell → kettlebell), stance, grip width and camera side are spec parameters.
The deadlift work done now becomes the hinge family's mechanics (shoulders over the bar, back angle sets the
hips, elbow feedback), written once.

### 6. Blender MCP for authoring and debugging (not for final renders)
Blender Lab's MCP server (add-on ≥ 1.0.3, Blender 5.1+) keeps **one Blender session open** that the agent drives:
set a pose, read gaps and joint angles, adjust, re-read in seconds instead of 40-second restarts — and the
owner can watch it in the desktop Blender over RDP. Use it to author key poses and debug failures.
**Final renders always come from the scripted pipeline** (spec + library + `render_clip.sh`) so every clip is
reproducible by any agent. Safety: the MCP runs model-generated code unguarded, so it runs as the normal
user against a copy of the character file, never with access to `~/lift/secrets`. Owner approval needed to install.

### 7. Checks driven by the spec
`checks.py` reads the spec's supports and contacts (feet on floor, bar on back, hands on handle, back on bench)
and applies the house rules (rigid bones ≤ 2 %, joint ranges, float ≤ 0.5 cm / sink ≤ 1.5 cm, grip, twist
smoothness, natural motion). No per-exercise copy of the checker. Every failure names the frame, the rule and the
nearest body part (`--debug` prints the vertex), so a fix starts from facts.

### 8. A conveyor, with the owner as the only gate
1. **OpenCode** writes the spec (YAML) from the brief and the KB — data only, no Blender.
2. **Claude Code** runs `check` (≈ 1 min), fixes, renders (`render_clip.sh`: emulator paused, watchdog, exit codes),
   and posts the MP4 + contact sheet + side/front stills.
3. **Owner** reviews. Only an approval moves the clip on.
4. `approve_clip.sh <kb-id>` (to be written) does the rest in one step: copy, registry, tests, verify, docs, commit, push.
Optional, only if the owner agrees: while a clip waits for review, the *next* clip's check and render may run, so
review never waits on the GPU. Nothing is ever pushed without approval.

### 9. Regression safety
Each approved clip keeps its spec and a few golden stills. When the library changes, a nightly-style
`regress.sh` re-checks every approved spec and compares stills, so a library fix can't silently break shipped clips.

## Rollout (each step ends with something the owner can see)

| Step | Work | Proof it worked |
|---|---|---|
| 0 | Finish and ship the deadlift (in progress) | owner approves the clip |
| 1 | Extract the library from the squat + deadlift scripts; build `template.blend` | both approved clips re-render frame-identical |
| 2 | Equipment library with contact empties (barbell, plates, rack, bench, dumbbells, kettlebell first) | squat/deadlift/bench use linked assets |
| 3 | Rigify IK (stretch 0) test on the squat | checker passes all frames, side-by-side matches the shipped clip |
| 4 | Install Blender MCP (owner go-ahead) and author the first pose assets | live pose session demonstrated |
| 5 | Spec format + `approve_clip.sh`; OpenCode writes specs instead of prose briefs | next Tier 0 clip made from a spec |
| 6 | Families one by one in plan order; each new family proven on its anchor clip | clips flow at ~1 review per sitting |

Expected effect: a new exercise inside an existing family becomes a spec of ~40 lines and one check run, not a new
script; a new family is a few hours once; the GPU render stays ≈ 7 min per clip and can run unattended.
