# LIFT exercise animation pipeline (Linux rig)

Renders the neon-studio exercise loops (720², 3 s, 24 fps, H.264) with one rigged character in Blender 5.x.
Everything needed is on this box; nothing is uploaded anywhere. **The character model is a private,
licensed asset: it lives only in `~/lift/animation-work/assets/character/` and is never committed.**

| File | What it is |
|---|---|
| `render_clip.sh` | One command: Blender (checks + 72 frames) → MP4 → contact sheet. Takes a lock; one render at a time. |
| `lift_squat.py` | Reference script: **rack + barbell on the back** (squat family: back/front squat, overhead press with edits). |
| `lift_deadlift.py` | Reference script: **floor + barbell, straight arms** (hinge/pull family: deadlift, RDL, row, curl with edits). |
| `lift_palette.json` | Every colour, light and the tile spec. Never hand-pick colours. |
| `lift_tile_encode.sh` | PNG frames → 720² H.264 with ffmpeg/libx264. **Default encoder.** |
| `lift_tile_encode_fc.sh` | Same with **FilmCraft** (`/usr/bin/filmcraft-cli`), bash port of the skill's zsh encoder (slot probe + verify). `LIFT_ENCODER=filmcraft`. |

## Toolchain on this rig (verified 2026-11-01 — read before changing anything)

| Tool | Where | Role in the pipeline | Notes |
|---|---|---|---|
| Blender 5.2.2 (snap) | `blender` on PATH | poses the rig, runs the checks, renders EEVEE | **EEVEE already renders on the GTX 1070** (OpenGL by default; `--gpu-backend vulkan` also works). The GPU is not the bottleneck. |
| ffmpeg / ffprobe | PATH | Lanczos downscale, H.264 encode, contact sheet, checks | no `drawtext` (built without freetype) |
| FilmCraft 0.14 | `/usr/bin/filmcraft-cli` | optional tile encoder | still reads PNG sequences at a fixed 30 fps (no import fps setting), so the slot probe is still needed. On the squat test it matched ffmpeg's quality (PSNR 31.1 vs 31.1, frame order exact) but the file was larger (656 KB vs 494 KB, over the cap) and slower, so ffmpeg stays the default. Re-test on real Blender frames before switching. |
| EffectCraft 0.18 | `/usr/bin/effectcraft-cli` | not in the tile pipeline | compositions, titles, lower thirds; 307 effects. Candidate for the glow/neon post pass only if a side-by-side matches the approved look. |
| VectorCraft 0.18 | `/usr/bin/vectorcraft-cli` | app UI art only (muscle chips, labels) | **never text or overlays on tiles** |
| python3 | system | helpers | **no numpy outside Blender**; Blender's own Python has it |
| zsh, sips, `~/.local/share/craft-cli` | absent | — | the skill's macOS paths; this folder's scripts are the Linux ports |

**Where the time goes** (deadlift, Ryzen 1800X): the pose solve + checks are single-threaded Python
inside Blender (≈ 4–8 s/frame for the deadlift, twice with the two-pass clearance); the 72-frame EEVEE
render is ≈ 7 min on the GPU; encoding < 10 s. So: **iterate with stills and `check` mode, render once.**

**CPU hogs:** the Android emulator (`qemu-system-x86 … -avd lift-test`, software GPU) can take ~10 of 16
cores. `render_clip.sh` freezes it with SIGSTOP for the run and resumes it with SIGCONT on exit
(`LIFT_PAUSE_HOGS=0` to disable). Do not kill it: Maestro/e2e work may be using it.

## Make a clip

```bash
scripts/animation/render_clip.sh scripts/animation/lift_squat.py barbell-squat
# -> ~/lift/animation-work/out/barbell-squat/{barbell-squat.mp4, contact.png, physics_report.txt, log.txt, progress.txt}
```

What it does, in order: preflight (≥ 4 GB RAM, ≥ 5 GB disk, no other Blender, pause the emulator) →
**check pass** over all 72 frames with no render (only for scripts that define `CHECK_ONLY`; ~1–10 min) →
render under a watchdog (progress line every 20 s in `progress.txt` with frames, memory, load and the top
3 processes; killed after 10 min with no new frame or 60 min total) → encode → contact sheet.
Exit codes: **0** ready for review · **1** a physics/motion check failed (`physics_report.txt` lists frames
and reasons — the gate working, not a crash) · **2** tooling · **3** not enough memory/disk or another
Blender running · **4** stalled/timed out. Watch a run: `cat ~/lift/animation-work/out/<kb-id>/progress.txt`.

Check only, no render (fast loop while fixing a pose):

```bash
blender -b --factory-startup --disable-autoexec ~/lift/animation-work/assets/character/blender/Blender.blend \
  --python scripts/animation/lift_deadlift.py -- /tmp/chk check style=neon      # exit 0 = all 72 frames pass
```

Stills for review while building (one frame, ~25 s): run Blender directly, `-- OUT 0.5 yaw=90 pitch=0`
(depth 0 = top, 1 = bottom/floor; `yaw`/`pitch` move the camera; `--debug` prints the numbers).

```bash
blender -b --factory-startup --disable-autoexec ~/lift/animation-work/assets/character/blender/Blender.blend \
  --python scripts/animation/lift_squat.py -- /tmp/stills 0.5 yaw=90 pitch=0
```

## What an exercise script must do (copy the closest reference, then change only these)

1. **Set**: the equipment (rack, bench, bar, platform) built from boxes/cylinders in world metres, floor at z = 0.
2. **Motion**: `rep(t)` (tempo, depth 0..1 over the 3 s loop), the body plan per depth (hips, trunk lean, ankles fixed),
   legs by two-bone solve at TRUE bone lengths (never IK: it squashes bones), arms by `arm_fk`/`solve_side`.
3. **Supports** (feet on floor, bar on back, hand on bench...): measured on the deformed mesh, float ≤ 0.5 cm, sink ≤ 1.5 cm.
4. **`physics_check()`**: bones keep length (≤ 2 %), joint ranges (knee/elbow 0–150°), supports, grip (bar on palm ≤ 0.7 cm,
   fingers ≤ 1 cm, thumb ≤ 2 cm, wrist ≤ 32°), balance (bar over the foot), arm twist ≤ 4°/frame.
5. **`natural_motion_check()`**: a few degrees of bar attitude that varies smoothly, no twitch (step/jerk limits).
6. **`worked_mask()`**: the prime movers (they glow orange, edged blue). **`neon_points()`**: the line of force.
7. Camera: pick the side that shows the worked muscles; the tile is auto-framed (orthographic square).

Never loosen a rule to make a clip pass; fix the pose. A failing run writes `physics_report.txt` and renders nothing.

## Gotchas (learned the hard way)

- The mannequin's back is deep, so "bar over mid-foot" is impossible upright; the squat balances the bar over the rear of the foot.
- Two-bone legs clamp at 0.998 of their length: plan standing poses below max reach or the knee jerks.
- When a hand roll is chosen per frame, keep its sign from the first solve (a flip = 180° twist step).
- `--debug` does NOT stop before rendering; use stills for quick iteration.
- Never `pkill -f <pattern>` with a pattern that matches your own shell.
- Fingers wrap once, at the grip pose; the bar is fixed in the hand.
- A new script copied from a reference must keep the `check` mode: `CHECK_ONLY` + `ANIM` includes "check" + tile
  timing `if (TILE or CHECK_ONLY)` (without that last part the check solves 156 frames at 30 fps instead of 72).
- Straight-arm lifts (deadlift family): the hip height is solved from arm reach, so **moving the bar out drags
  the knees with it**. Clear the knees by moving the hips back (`hipx`/per-frame setback), hold the back angle
  off the floor (`hold=`), and roll the trunk with the bar tilt or the higher hand's elbow bends past 20°.
- Debug a contact failure with `--debug` on a still: `GAPDBG` prints the nearest body vertex (rest and world).
