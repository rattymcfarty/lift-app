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
| `lift_tile_encode.sh` | PNG frames → 720² H.264 (ffmpeg only). |

## Make a clip

```bash
scripts/animation/render_clip.sh scripts/animation/lift_squat.py barbell-squat
# -> ~/lift/animation-work/out/barbell-squat/{barbell-squat.mp4, contact.png, physics_report.txt, log.txt}
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
