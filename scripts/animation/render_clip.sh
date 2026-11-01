#!/bin/bash
# Render one LIFT exercise clip end to end on the rig, with guards: preflight (memory, disk, stray Blender), a
# check-only pass over all 72 frames (when the exercise script supports it), then the render under a watchdog
# (progress file, stall + total timeout), the 720x720 MP4 and a 12-frame contact sheet. One render at a time (a lock).
#
#   scripts/animation/render_clip.sh <exercise-script.py> <kb-id> [-- extra blender script args, e.g. yaw=120 grip=0.3]
#
# Output (never inside the repo): ~/lift/animation-work/out/<kb-id>/{<kb-id>.mp4, contact.png, physics_report.txt,
#   log.txt, progress.txt}. Watch a run with: cat ~/lift/animation-work/out/<kb-id>/progress.txt
# Exit codes: 0 ready for review | 1 a physics/motion check failed (see physics_report.txt) | 2 tooling problem
#             3 not enough memory/disk or another Blender is running | 4 render stalled or timed out (killed)
# Tunables (env): LIFT_MIN_MEM_GB=4 LIFT_MIN_DISK_GB=5 LIFT_STALL_MIN=10 LIFT_MAX_MIN=60
#   LIFT_ENCODER=ffmpeg (default) | filmcraft  (filmcraft falls back to ffmpeg if its output is off spec)
#   LIFT_PAUSE_HOGS=1 (default): freeze the Android emulator (qemu) for the run and resume it on exit, whatever happens
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CHAR="${LIFT_CHAR:-$HOME/lift/animation-work/assets/character/blender/Blender.blend}"
OUTROOT="${LIFT_ANIM_OUT:-$HOME/lift/animation-work/out}"
MIN_MEM_GB="${LIFT_MIN_MEM_GB:-4}"; MIN_DISK_GB="${LIFT_MIN_DISK_GB:-5}"; STALL_MIN="${LIFT_STALL_MIN:-10}"; MAX_MIN="${LIFT_MAX_MIN:-60}"
SCRIPT="${1:?exercise script, e.g. $HERE/lift_squat.py}"; ID="${2:?KB id}"; shift 2
[ "${1:-}" = "--" ] && shift
[[ "$ID" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "bad KB id: $ID" >&2; exit 2; }
[ -f "$SCRIPT" ] || SCRIPT="$HERE/$SCRIPT"
[ -f "$SCRIPT" ] || { echo "no such exercise script" >&2; exit 2; }
[ -f "$CHAR" ] || { echo "character file missing: $CHAR (private asset, see ~/lift/lift-skill-animation-package/private-assets)" >&2; exit 2; }
command -v blender >/dev/null && command -v ffmpeg >/dev/null || { echo "blender and ffmpeg must be on PATH" >&2; exit 2; }
OUT="$OUTROOT/$ID"; mkdir -p "$OUT"
PROG="$OUT/progress.txt"
say() { echo "$(date +%H:%M:%S) $*" | tee -a "$PROG"; }
: > "$PROG"

# ---- give Blender the machine: freeze CPU hogs (SIGSTOP is reversible: SIGCONT resumes them exactly as they were)
PAUSED=""
if [ "${LIFT_PAUSE_HOGS:-1}" = "1" ]; then
  PAUSED=$(pgrep -f "qemu-system" | tr '\n' ' ')
  [ -n "$PAUSED" ] && kill -STOP $PAUSED 2>/dev/null
fi
cleanup() { [ -n "$PAUSED" ] && kill -CONT $PAUSED 2>/dev/null; [ -n "${BPID:-}" ] && kill "$BPID" 2>/dev/null; true; }
trap cleanup EXIT INT TERM
BL="nice -n -5 blender"; nice -n -5 true 2>/dev/null || BL="blender"     # higher priority only if allowed

exec 9>/tmp/lift-render.lock
flock -w 3600 9 || { echo "another render is running (waited 1 h)" >&2; exit 2; }

# ---- preflight
mem_gb=$(awk '/MemAvailable/ {printf "%d", $2/1048576}' /proc/meminfo)
disk_gb=$(df -BG --output=avail "$OUTROOT" | tail -1 | tr -dc 0-9)
[ "$mem_gb" -ge "$MIN_MEM_GB" ] || { say "NOT STARTED: only ${mem_gb} GB memory available (need ${MIN_MEM_GB})"; exit 3; }
[ "$disk_gb" -ge "$MIN_DISK_GB" ] || { say "NOT STARTED: only ${disk_gb} GB disk free (need ${MIN_DISK_GB})"; exit 3; }
if pgrep -x blender >/dev/null; then say "NOT STARTED: another Blender is already running (pid $(pgrep -x blender | head -1))"; exit 3; fi
[ -n "$PAUSED" ] && say "paused CPU hogs for this run: pid $PAUSED (resumed on exit)"
say "preflight ok: ${mem_gb} GB mem free, ${disk_gb} GB disk free, load $(cut -d' ' -f1 /proc/loadavg)"
rm -rf "$OUT/tile_frames" "$OUT/physics_report.txt"

# ---- check-only pass (about a minute): only when the exercise script supports it
if grep -q "CHECK_ONLY" "$SCRIPT"; then
  say "checking all 72 frames (no render)"
  timeout 20m $BL -b --factory-startup --disable-autoexec "$CHAR" --python "$SCRIPT" -- "$OUT" check style=neon "$@" > "$OUT/check_log.txt" 2>&1
  rc=$?
  if [ $rc -eq 124 ]; then say "CHECK TIMED OUT after 20 min"; exit 4; fi
  if [ $rc -ne 0 ]; then say "CHECK FAILED for $ID:"; head -c 3000 "$OUT/physics_report.txt" 2>/dev/null || tail -20 "$OUT/check_log.txt"; exit 1; fi
  say "all frames pass the checks; rendering"
fi

# ---- render under a watchdog
$BL -b --factory-startup --disable-autoexec "$CHAR" --python "$SCRIPT" -- "$OUT" tile style=neon "$@" > "$OUT/log.txt" 2>&1 &
BPID=$!; START=$(date +%s); LAST_N=-1; LAST_CHANGE=$START
while kill -0 "$BPID" 2>/dev/null; do
  sleep 20
  n=$(ls "$OUT/tile_frames" 2>/dev/null | wc -l); now=$(date +%s)
  [ "$n" -ne "$LAST_N" ] && { LAST_N=$n; LAST_CHANGE=$now; }
  say "frames $n/72, elapsed $(( (now-START)/60 )) min, mem free $(awk '/MemAvailable/ {printf "%.1f", $2/1048576}' /proc/meminfo) GB, load $(cut -d' ' -f1 /proc/loadavg), top: $(ps -eo comm,pcpu --sort=-pcpu --no-headers | head -3 | awk '{printf "%s %s%% ", $1, $2}')"
  if [ $(( (now-LAST_CHANGE)/60 )) -ge "$STALL_MIN" ] && [ "$n" -gt 0 ]; then say "STALLED: no new frame for ${STALL_MIN} min; killing Blender"; kill "$BPID"; wait "$BPID" 2>/dev/null; exit 4; fi
  if [ $(( (now-START)/60 )) -ge "$MAX_MIN" ]; then say "TIMED OUT after ${MAX_MIN} min; killing Blender"; kill "$BPID"; wait "$BPID" 2>/dev/null; exit 4; fi
done
wait "$BPID"; rc=$?
if [ ! -d "$OUT/tile_frames" ] || [ "$(ls "$OUT/tile_frames" 2>/dev/null | wc -l)" -ne 72 ]; then
  say "CHECK FAILED or render incomplete for $ID (blender exit $rc):"; head -c 3000 "$OUT/physics_report.txt" 2>/dev/null || tail -20 "$OUT/log.txt"; exit 1
fi
if [ "${LIFT_ENCODER:-ffmpeg}" = "filmcraft" ] && "$HERE/lift_tile_encode_fc.sh" "$OUT/tile_frames" "$OUT/$ID.mp4"; then
  say "encoded with FilmCraft"
else
  "$HERE/lift_tile_encode.sh" "$OUT/tile_frames" "$OUT/$ID.mp4" || exit 2
  say "encoded with ffmpeg"
fi
ffmpeg -v error -y -i "$OUT/$ID.mp4" -vf "select='not(mod(n,6))',scale=360:360,tile=6x2" -frames:v 1 "$OUT/contact.png" || exit 2
rm -rf "$OUT/tile_frames"
say "READY FOR REVIEW: $OUT/$ID.mp4  (contact sheet: $OUT/contact.png)"
