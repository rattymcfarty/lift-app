# Muscle icon renders

The muscle icons in the app are renders of a 3D mannequin, baked to PNG at
build time. Each icon ships two files — the muscle is a lit pass, not a tint, so
the dark and light themes are rendered separately.

The vector artwork in `assets/icons-src/muscle/` is still the fallback for ids
with no render (`All`, `Olympic`, `Full-Body`, `Other`) and for equipment.

## What produces the art

| Piece | File | What it does |
| --- | --- | --- |
| Renderer | `render-muscle.py` | Blender/Cycles. Prepares the body, projects the masks, paints the muscle, writes three PNGs per icon. |
| Gate | `qa.py` | Objective checks on the renders (see below). Fails the build. |
| Packager | `build-icons.py` | Trims, downsamples to 288 px, tints the light-theme skin, writes `assets/icons-3d/` and the generated TS map. |
| Driver | `render-all.sh` | Runs all 18 icons, then the gate, then the packager. |

### The body

[Blender's Human Base Meshes bundle](https://www.blender.org/download/demo-files/)
— the *realistic male* body, CC0. It is a build-time input only: the app ships
our renders, not the mesh.

```bash
# once
curl -LO https://download.blender.org/demo/.../human_base_meshes_bundle.zip   # see the demo files page
unzip human_base_meshes_bundle.zip
export LIFT_BASE_MESH="$PWD/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend"
```

The bundle is CC0 per Blender's demo-file licensing. We use it as a base mesh
and bake our own surface treatment on top; the renders are original artwork and
do not reproduce anything from another app.

### The muscle layer

`REGIONS` in `render-muscle.py` holds a hand-authored 2D outline per muscle,
in metres on the front (or back) projection of the body. Each vertex of the
167k-vertex mesh is tested against the outline, the mask is smoothed twice, and
the weight drives:

- **colour** — skin grey at 0, muscle at 1, mixed across a ~2 px feather;
- **surface detail** — fibre striations (`FIBRE_AXIS`), anatomical creases
  (`CREASES`: linea alba, tendinous intersections, quad separations, pec
  border, glute fold, …) and a darker rim;
- **material** — matte roughness inside the mask, so highlights don't blow out
  at tile size.

The muscle pass is **opaque**: where the mask is zero it renders the same skin
as the body pass. That is why the icon is a single image, with no alpha
compositing and no pale halo at the patch edge.

### Colours

`--color orange` (default) is the warm highlight used in the app.
`--color red` is available for comparison. The theme pair is baked in one run
as `<out>-muscle-dark.png` and `<out>-muscle-light.png`.

## The gate

`qa.py` measures each render and prints the value, so "looks good" is not the
test. It always derives the painted area from the rendered colour difference
between the body pass and the muscle pass, rather than trusting the mask.

| Check | Meaning | Bounds |
| --- | --- | --- |
| `body_coverage` | share of the frame the figure fills | 0.22–0.90 |
| `mask_ratio` | painted area / body area | 0.03–0.62 |
| `mask_outside` | painted pixels with no body under them | ≤ 0.002 |
| `soft_edge` | mean feather width, px | 1.0–10.0 |
| `contrast48` | muscle vs skin distance at 48 px | ≥ 25 |
| `mask_clip` | painted area cut off by the frame | ≤ 0.005 |

The human gate is the reference comparison sheet: the set at 200 px in both
themes plus 96 px and 48 px, next to the owner's reference tiles.

## Build

```bash
export LIFT_BASE_MESH=/path/to/human_base_meshes_bundle.blend
scripts/render/render-all.sh          # ≈50 min on a 16-core CPU at 640 px / 320 spp
```

Then `scripts/test-icons.mjs` (part of `npm run verify`) checks that the shipped
PNGs are still the ones the gate passed: `assets/icons-3d/qa.json` records the
SHA-256 of every file, and the check fails if a file is missing, resized,
edited, or the generated TS map is stale.

To re-check without rendering:

```bash
python3 scripts/render/build-icons.py --check
```

## Framing

Each region has its own orthographic crop (`FRAMING`), so the chest icon shows
the torso, the quad icon the legs, and so on — matching the reference set's
habit of zooming to the working muscle. Back-view regions render from behind
with mirrored lights.
