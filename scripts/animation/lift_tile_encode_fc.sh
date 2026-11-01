#!/bin/bash
# Encode a LIFT app tile with FilmCraft (headless, /usr/bin/filmcraft-cli): rendered PNG frames -> H.264 MP4.
# Linux/bash port of the skill's zsh encoder. Spec from lift_palette.json "tile": 720x720, 3 s at 24 fps (72 frames),
# H.264 yuv420p, CRF 16, no audio, fast start, hard cap 500 KB.
#
# FilmCraft (0.14) reads PNG sequences at a fixed 30 fps and has no setting to change that, so it samples them
# unevenly at 24 fps. A quick probe (numbered marker frames) measures which input slot each output frame takes, and
# the real frames are linked into exactly those slots: every output frame is then one rendered frame. The script
# verifies the result (frame count, size) and exits non-zero if anything is off; render_clip.sh falls back to the
# plain ffmpeg encoder (lift_tile_encode.sh) in that case.
#
# Usage: lift_tile_encode_fc.sh FRAMES_DIR OUT.mp4
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FC="${FILMCRAFT_CLI:-$(command -v filmcraft-cli || true)}"
[ -x "$FC" ] || { echo "filmcraft-cli not found" >&2; exit 2; }
read -r SIZE FPS CRF SECS <<< "$(python3 -c "import json,sys; t=json.load(open(sys.argv[1]))['tile']; print(t['size'], t['fps'], t['crf'], int(float(t['seconds'])))" "$HERE/lift_palette.json")"
FRAMES="$(cd "$1" && pwd)"; OUT="$(realpath -m "$2")"
NIN=$(( SECS * 30 )); NOUT=$(( SECS * FPS ))
[ -f "$FRAMES/frame_0001.png" ] || { echo "no frames in $FRAMES (did the physics check stop the render?)" >&2; exit 1; }
NFR=$(ls "$FRAMES"/frame_*.png | wc -l)
[ "$NFR" -eq "$NOUT" ] || { echo "found $NFR frames, expected $NOUT" >&2; exit 1; }
WORK=$(mktemp -d -t lift_tile_XXXX); trap 'rm -rf "$WORK"' EXIT

# 1. Probe: slot i is black with a white bar at x = 8*i; read back which slot each output frame shows.
PW=$(( (NIN + 2) * 8 )); mkdir -p "$WORK/probe"
for i in $(seq 1 $NIN); do
  ffmpeg -v error -y -f lavfi -i "color=c=black:s=${PW}x16" -vf "drawbox=x=$(( i * 8 )):y=0:w=8:h=16:color=white:t=fill" \
    -frames:v 1 "$WORK/probe/frame_$(printf %04d "$i").png"
done
cat > "$WORK/probe.jsonl" <<JSON
{"id": "file.importImageSequence", "params": {"path": "$WORK/probe/frame_0001.png"}}
{"id": "file.newSequence", "params": {"name": "probe", "width": $PW, "height": 16, "fps": $FPS, "fromItem": 1}}
{"id": "file.exportMedia", "params": {"path": "$WORK/probe.mp4", "format": "h264", "fps": $FPS, "bitrateMode": "crf", "crf": 1, "audio": false, "wait": true}}
JSON
"$FC" --compact run "$WORK/probe.jsonl" > "$WORK/probe.log" 2>&1 || { cat "$WORK/probe.log" >&2; exit 2; }
SLOTS=($(ffmpeg -v error -i "$WORK/probe.mp4" -vf "crop=iw:2:0:7" -f rawvideo -pix_fmt gray - | python3 -c "
import sys
w = $PW; b = sys.stdin.buffer.read(); rows = [b[i:i + w] for i in range(0, len(b), w * 2)]
print(' '.join(str(max(range(w), key=lambda x: r[x]) // 8) for r in rows))"))
[ "${#SLOTS[@]}" -eq "$NOUT" ] || { echo "probe gave ${#SLOTS[@]} frames, expected $NOUT" >&2; exit 2; }

# 2. Lanczos + light unsharp down to the tile size first (FilmCraft's own resize looked soft on a 720 tile).
mkdir -p "$WORK/sharp" "$WORK/seq"
ffmpeg -v error -i "$FRAMES/frame_%04d.png" -vf "scale=${SIZE}:${SIZE}:flags=lanczos,unsharp=5:5:0.6" -start_number 1 "$WORK/sharp/frame_%04d.png"
# 3. Link rendered frame k into the slot output frame k reads (bash arrays are 0-based); fill unused slots.
for k in $(seq 1 $NOUT); do
  ln -sf "$WORK/sharp/frame_$(printf %04d "$k").png" "$WORK/seq/frame_$(printf %04d "${SLOTS[$((k - 1))]}").png"
done
last="$WORK/sharp/frame_0001.png"
for i in $(seq 1 $NIN); do
  f="$WORK/seq/frame_$(printf %04d "$i").png"
  if [ -e "$f" ]; then last=$(readlink "$f"); else ln -s "$last" "$f"; fi
done

# 4. Encode (GPU export where available), then a lossless re-wrap with the index first (fast start).
cat > "$WORK/encode.jsonl" <<JSON
{"id": "file.importImageSequence", "params": {"path": "$WORK/seq/frame_0001.png"}}
{"id": "file.newSequence", "params": {"name": "tile", "width": $SIZE, "height": $SIZE, "fps": $FPS, "fromItem": 1}}
{"id": "file.exportMedia", "params": {"path": "$WORK/tile.mp4", "format": "h264", "width": $SIZE, "height": $SIZE, "fps": $FPS, "bitrateMode": "crf", "crf": $CRF, "audio": false, "range": "custom", "startSeconds": 0, "endSeconds": $SECS, "wait": true}}
JSON
"$FC" --compact run "$WORK/encode.jsonl" > "$WORK/log.txt" 2>&1 || { cat "$WORK/log.txt" >&2; exit 2; }
ffmpeg -v error -y -i "$WORK/tile.mp4" -c copy -movflags +faststart -an "$OUT"

# 5. Verify: frame count, size, pixel format, byte cap.
INFO=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=codec_name,pix_fmt,width,height,nb_read_frames -of csv=p=0 "$OUT")
echo "$INFO  $(stat -c %s "$OUT") bytes  (filmcraft)"
IFS=, read -r C W H PF N <<< "$INFO"
[ "$W" = "$SIZE" ] && [ "$H" = "$SIZE" ] && [ "$N" = "$NOUT" ] || { echo "FilmCraft output is off spec: $INFO" >&2; exit 2; }
[ "$(stat -c %s "$OUT")" -le 500000 ] || { echo "OVER the 500 KB hard cap" >&2; exit 2; }
