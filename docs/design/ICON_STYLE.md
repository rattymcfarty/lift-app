# Muscle-group and equipment icon style

Original artwork for LIFT's exercise filters and lists. The look follows the
conventions of good anatomy-chart icons (views, proportions, highlight scheme) but
**every drawing is original**: never trace, copy or auto-convert another app's art.

## Files and pipeline

- Authoring: `assets/icons-src/muscle/<id>.svg` and `assets/icons-src/equipment/<id>.svg`.
  `<id>` is the file name and must equal the taxonomy id in `src/kb/taxonomy.ts`
  exactly, spaces and hyphens included (`Chest.svg`, `Upper Back.svg`,
  `Full-Body.svg`; equipment `Barbell.svg`, `Smith Machine.svg`). The generated
  registry is keyed by that id, which is what `src/components/icons/muscleIcons.tsx`
  looks up.
- `node scripts/build-icon-art.mjs` validates the SVGs and generates
  `src/components/icons/iconArt.generated.ts` (`--check` = fail if stale; part of `npm run verify`).
- `node scripts/render-icons.mjs [out.png]` renders a contact sheet (every icon on a dark
  and a light tile, labelled) with headless Chrome so you can look at the result. It uses the
  **real app theme colors** (light/dark `muted` + `highlight` from `src/theme/tokens.ts`, with
  `line`/`hiLine` derived exactly as `src/lib/iconColors.ts` derives them), so the sheet shows
  what the app draws — `#ff7a1a` is an authoring placeholder, not a screen colour
  (muscle icons ship the sampled warm accent; see below). Add `--only=muscle` or
  `--only=equipment` while redrawing one half of the set.
- The components `MuscleIconArt` / `EquipmentIconArt` draw the generated SVG with the
  app's colors; icons without art yet fall back to the older drawing.

## 3D muscle renders

Muscle icons are rendered from a 3D mannequin at build time rather than drawn as
SVG. Each of the 18 muscle groups ships two 288 px PNGs, one per theme, in
`assets/icons-3d/{dark,light}/`. `TaxonomyIcon` picks the file by theme; the SVG
art is still the fallback for ids with no render (`All`, `Olympic`, `Full-Body`)
and for every equipment icon.

- Render, gate and packaging: `scripts/render/render-all.sh`; details and the
  QA thresholds are in `scripts/render/README.md`.
- The renders are pinned to their gate result: `assets/icons-3d/qa.json` stores
  the QA verdict and the SHA-256 of every PNG, and `test:icons` fails if a file
  is missing, resized, edited, or the generated map is stale.
- The muscle accent (`#dd7726` dark, `#bc591b` light) is sampled from the renders
  and passed to the remaining vector muscle icons, so `All`/`Olympic`/`Full-Body`
  sit next to the 3D set without a colour jump. Equipment icons keep the theme's
  blue highlight.

## SVG rules

The art is authored on a **48x48 grid** (`x`/`y` centred on `24`). `scripts/build-icon-art.mjs`
is the authority and rejects anything that breaks these rules:

- `viewBox="x y w h"` with `w === h`, inside the grid (`x, y >= 0`, `x+w, y+h <= 48`) — a
  square *crop* (window) onto the figure, e.g. `"11 11 26 26"` for a chest, `"13 26 22 22"`
  for a hip. No `width`/`height`; the tile and the background come from the app, so the
  drawing must stay on a transparent background.
- Only: `svg g path circle ellipse rect line polyline polygon`. No text, image, style,
  script, filter, gradient, mask, clipPath, use, foreignObject, no external references.
- **Only these six authoring colors** (the app substitutes theme colors for them):
  - `#808080` BODY: body fill (the part that is not highlighted)
  - `#bfbfbf` LINE: thin separation / detail lines on the body (stroke 0.7-1.2)
  - `#4d4d4d` SHADOW: the shaded side of a body form (fill only, never a stroke and
    never an outline)
  - `#6a6a6a` SHADOW_SOFT: the step between SHADOW and BODY — half as dark
  - `#ff7a1a` HI: the highlighted muscle (or the equipment accent) fill
  - `#b34700` HI_LINE: outline and fiber lines on the highlighted muscle (stroke 0.7-1.2)
  `fill="none"` is allowed. Nothing else. (`#4a4a50` / `#85858c` are the dark-theme
  *rendered* body/line colors — never author them.)
- Keep every file small: the validator allows 24 KB, current art is 1-3 KB.
  Round coordinates to one decimal.

## Shading

The light comes from the **upper left**, the same way in every icon. The shadow is
two steps of the body tone — `SHADOW` = `darken(muted, 0.28)` and `SHADOW_SOFT` =
`darken(muted, 0.14)` — so the falloff reads as a soft edge without gradients (the
validator allows none). It is what stops the figure reading as a flat silhouette.

- Shade the form, not the drawing: a band 1.0-1.6 units wide inside the **right**
  edge of a torso or pelvis, following that edge's curve and tapering at both ends,
  with a SHADOW_SOFT copy of the same band shifted 1.3 units further in. On paired
  limbs the left form carries the band on its inner edge and the mirror puts it on
  the outer edge of the right form — draw it once and mirror.
- Limbs drawn with a `#808080` stroke get a SHADOW stroke of the same width and a
  SHADOW_SOFT stroke 1.4 units wider, both offset ~0.7 units perpendicular to the
  limb (toward the lower right) and drawn **before** the body stroke. The body
  stroke covers all but the crescents. Same for arms, legs, and equipment handles.
- Order in the file: body fills, then SHADOW_SOFT, then SHADOW, then LINE anatomy,
  then HI/HI_LINE. A shadow under a highlight is invisible and harmless; do not put
  it on top.
- Never use SHADOW as an outline, for a whole limb, or for the highlighted muscle:
  that is HI_HI_LINE's job, and a shadow outline reads as a second silhouette.
- The head is small and usually cropped: shade it only when it is more than ~6
  units across, and then only as a crescent on the right.

## Muscle icons

- A muscular, gender-neutral anatomical figure, simplified, seen from the FRONT or BACK
  as listed; the icon is a *window* (crop) onto the figure, zoomed so the target muscle
  fills about 60% of the tile and the surrounding anatomy gives context.
- Body base in BODY with LINE separation lines (ribs, abs grid, muscle seams); the target
  muscle group in HI with HI_LINE outline and 3-5 fibre lines; other muscles stay BODY.
- Keep one set of body proportions across the whole set (Chest / Quadriceps are the
  reference; the back-facing icons in `assets/icons-src/muscle/` share one figure):
  shoulders 10.4 either side of the centre line at y=15, waist ~7.4, hips ~9,
  neck `M21.8 8.4 L26.2 8.4 L27.4 12.8`, upper arm as a `#808080` stroke of width 4.2
  hanging outside the torso plus an ellipse hand, thigh `M17.4 33 ... 23.6 33.2`, knee
  circle r 2.4, shin `M17.4 40.2 ... 22.6 40.4`, foot wedge ending at y=47.9. Limbs and
  paired highlights are drawn once on the left of the centre line and mirrored with
  `<g transform="translate(48 0) scale(-1 1)">`; a muscle that straddles the spine (traps)
  is drawn once across it. Hip and leg crops leave the arms out.
- Crops and views: chest (front, torso from collarbone to ribs, upper arms cut off),
  front-delts / middle-delts (front / side, shoulders), rear-delts (back, shoulders),
  biceps (front, upper arms), triceps (back, upper arms), forearms (front, lower arms),
  lats (back, torso: V-shape), upper-back (back, traps and rhomboids, with neck),
  lower-back (back, lumbar area), neck (front, neck and traps), abs (front, torso mid),
  glutes (back, hips), hamstrings (back, legs), quadriceps (front, legs),
  abductors (side/back hips), adductors (front, inner thighs), calves (back, lower legs),
  olympic (full figure, front, traps/shoulders/glutes/quads highlighted), full-body
  (whole figure small, everything highlighted), other (three round dots, LINE colored, no figure).
- One icon zooms onto **one limb drawn at a larger scale** instead of cropping the whole
  figure: `Forearms.svg` (one front arm, shoulder to hand, on a diagonal so the flexor mass
  fills the tile). Keep the limb's own proportions and its hand/elbow shapes consistent with
  the shared figure above; only the scale changes. `Calves.svg` is the other exception and
  draws **both** lower legs close together, because the reference crop shows both calves and
  the shared figure stands with the feet too far apart to crop. Everything else stays a
  window onto the one figure.

## Equipment icons

- A small flat illustration: a simplified figure in BODY/LINE using the equipment, the
  equipment itself in HI with HI_LINE detail. Side or 3/4 view, centred, clear at 40 px.
- ids: barbell (lifter on a bench with a loaded bar), dumbbell (standing hold), kettlebell
  (held at the chest), machine (seated on a selectorised machine), bodyweight (push-up on a
  mat — the mat is the accent), cardio (stationary bike), smith-machine (squat in a guided-bar
  rack), cable (cable pulley station), safety-bar (back squat under the cambered yoke bar),
  other (three dots).
- One figure language across all ten (2026-10-19 pass): a head with a neck, a torso that
  tapers from the shoulders to the waist, limbs with an elbow or knee rather than one
  straight stroke, and a foot where the pose puts one on the floor. The `LINE_LIGHTEN`
  strokes are anatomy — collarbone, sternum, rib line, shoulder blade — never whole-body
  outlines. All ten taxonomy ids in `src/kb/taxonomy.ts` have a source file, so the
  whole equipment set renders from this pipeline; `all` (a 2x2 grid of squares) stays a shared
  React primitive in `src/components/icons/iconPrimitives.tsx`, like the muscle set's `all` and
  `other` fallbacks.
