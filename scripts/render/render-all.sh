#!/usr/bin/env bash
# Render, gate and package the 3D muscle icons.
#
#   scripts/render/render-all.sh                 # full production pass
#   COLOUR=orange scripts/render/render-all.sh   # the comparison variant
#   RES=512 SAMPLES=128 scripts/render/render-all.sh   # quick look
#
# Needs Blender 4.5 LTS and LIFT_BASE_MESH pointing at the CC0 base mesh
# bundle (see README.md). Renders land in OUT (default /tmp/lift-icons);
# the last step writes assets/icons-3d/ and src/components/icons/muscleRenders.generated.ts.
set -euo pipefail
cd "$(dirname "$0")/../.."

BLENDER="${BLENDER:-$HOME/tools/blender-4.5.15-linux-x64/blender}"
OUT="${OUT:-/tmp/lift-icons}"
COLOUR="${COLOUR:-purple}"
RES="${RES:-640}"
SAMPLES="${SAMPLES:-320}"

IDS=(
  "Chest" "Abs" "Quadriceps" "Middle Delts" "Front Delts" "Rear Delts"
  "Biceps" "Triceps" "Forearms" "Lats" "Upper Back" "Lower Back"
  "Glutes" "Hamstrings" "Calves" "Abductors" "Adductors" "Neck"
  "Full-Body" "Olympic"
)

slug_of() { echo "$1" | tr ' A-Z' '-a-z'; }

mkdir -p "$OUT"
for id in "${IDS[@]}"; do
  slug="$(slug_of "$id")"
  echo "=== $id ==="
  "$BLENDER" -b --python scripts/render/render-muscle.py -- \
    --id "$id" --color "$COLOUR" --res "$RES" --samples "$SAMPLES" \
    --out "$OUT/$slug" > "$OUT/$slug.log" 2>&1
  if ! grep -q "wrote $OUT/$slug" "$OUT/$slug.log"; then
    echo "render failed for $id — see $OUT/$slug.log" >&2
    exit 1
  fi
done

args=()
for id in "${IDS[@]}"; do
  slug="$(slug_of "$id")"
  args+=("$OUT/$slug-body.png" "$OUT/$slug-muscle-dark.png")
done
python3 scripts/render/qa.py "${args[@]}" | tee "$OUT/qa.txt"
python3 scripts/render/build-icons.py --src "$OUT"
