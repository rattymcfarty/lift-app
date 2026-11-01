#!/bin/bash
# Linux encoder for LIFT tiles: PNG frames -> 720x720 H.264 (plain ffmpeg; FilmCraft is not needed here,
# since ffmpeg reads the sequence at exactly the target fps there is no slot mapping to fix).
# Usage: lift_tile_encode.sh FRAMES_DIR OUT.mp4 [SIZE] [FPS] [CRF]
set -e
D=$(dirname "$(readlink -f "$0")")
read DSIZE DFPS DCRF < <(python3 -c "import json,sys; t=json.load(open(sys.argv[1]))['tile']; print(t['size'], t['fps'], t['crf'])" "$D/lift_palette.json")
FR=$(readlink -f "$1"); OUT=$(readlink -f "$2"); SIZE=${3:-$DSIZE}; FPS=${4:-$DFPS}; CRF=${5:-$DCRF}
[ -f "$FR/frame_0001.png" ] || { echo "no frames in $FR" >&2; exit 1; }
ffmpeg -v error -y -framerate $FPS -i "$FR/frame_%04d.png" \
  -vf "scale=${SIZE}:${SIZE}:flags=lanczos,unsharp=5:5:0.6,format=yuv420p" \
  -c:v libx264 -crf $CRF -preset veryslow -an -movflags +faststart "$OUT"
ffprobe -v error -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames:format=duration,size -of compact=p=0:nk=0 "$OUT"
B=$(stat -c %s "$OUT"); [ "$B" -le 500000 ] || { echo "OVER 500 KB cap: $B" >&2; exit 2; }
