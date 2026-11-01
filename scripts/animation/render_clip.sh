#!/bin/bash
# Render one LIFT exercise clip end to end on the rig: Blender (physics + natural-motion checks, then 72 frames)
# -> 720x720 MP4 -> 12-frame contact sheet. One render at a time (a lock), because Blender uses the whole machine.
#
#   scripts/animation/render_clip.sh <exercise-script.py> <kb-id> [-- extra blender script args, e.g. yaw=120 grip=0.3]
#
# Output (never inside the repo): ~/lift/animation-work/out/<kb-id>/{<kb-id>.mp4, contact.png, physics_report.txt, log.txt}
# Exit 0 = clip ready for review; 1 = a check failed (see physics_report.txt) ; 2 = tooling problem.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CHAR="${LIFT_CHAR:-$HOME/lift/animation-work/assets/character/blender/Blender.blend}"
OUTROOT="${LIFT_ANIM_OUT:-$HOME/lift/animation-work/out}"
SCRIPT="${1:?exercise script, e.g. $HERE/lift_squat.py}"; ID="${2:?KB id}"; shift 2
[ "${1:-}" = "--" ] && shift
[[ "$ID" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "bad KB id: $ID" >&2; exit 2; }
[ -f "$SCRIPT" ] || SCRIPT="$HERE/$SCRIPT"
[ -f "$SCRIPT" ] || { echo "no such exercise script" >&2; exit 2; }
[ -f "$CHAR" ] || { echo "character file missing: $CHAR (private asset, see ~/lift/lift-skill-animation-package/private-assets)" >&2; exit 2; }
command -v blender >/dev/null && command -v ffmpeg >/dev/null || { echo "blender and ffmpeg must be on PATH" >&2; exit 2; }
OUT="$OUTROOT/$ID"; mkdir -p "$OUT"
exec 9>/tmp/lift-render.lock
flock -w 3600 9 || { echo "another render is running (waited 1 h)" >&2; exit 2; }
rm -rf "$OUT/tile_frames" "$OUT/physics_report.txt"
blender -b --factory-startup --disable-autoexec "$CHAR" --python "$SCRIPT" -- "$OUT" tile style=neon "$@" > "$OUT/log.txt" 2>&1
if [ ! -d "$OUT/tile_frames" ] || [ "$(ls "$OUT/tile_frames" 2>/dev/null | wc -l)" -ne 72 ]; then
  echo "CHECK FAILED (or render incomplete) for $ID:"; head -c 3000 "$OUT/physics_report.txt" 2>/dev/null || tail -20 "$OUT/log.txt"; exit 1
fi
"$HERE/lift_tile_encode.sh" "$OUT/tile_frames" "$OUT/$ID.mp4" || exit 2
ffmpeg -v error -y -i "$OUT/$ID.mp4" -vf "select='not(mod(n,6))',scale=360:360,tile=6x2" -frames:v 1 "$OUT/contact.png" || exit 2
rm -rf "$OUT/tile_frames"
echo "READY FOR REVIEW: $OUT/$ID.mp4  (contact sheet: $OUT/contact.png)"
