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
  and a light tile, labelled) with headless Chrome so you can look at the result.
- The components `MuscleIconArt` / `EquipmentIconArt` draw the generated SVG with the
  app's colors; icons without art yet fall back to the older drawing.

## SVG rules

The art is authored on a **48x48 grid** (`x`/`y` centred on `24`). `scripts/build-icon-art.mjs`
is the authority and rejects anything that breaks these rules:

- `viewBox="x y w h"` with `w === h`, inside the grid (`x, y >= 0`, `x+w, y+h <= 48`) — a
  square *crop* (window) onto the figure, e.g. `"11 11 26 26"` for a chest, `"13 26 22 22"`
  for a hip. No `width`/`height`; the tile and the background come from the app, so the
  drawing must stay on a transparent background.
- Only: `svg g path circle ellipse rect line polyline polygon`. No text, image, style,
  script, filter, gradient, mask, clipPath, use, foreignObject, no external references.
- **Only these four authoring colors** (the app substitutes theme colors for them):
  - `#808080` BODY: body fill (the part that is not highlighted)
  - `#bfbfbf` LINE: thin separation / detail lines on the body (stroke 0.7-1.2)
  - `#ff7a1a` HI: the highlighted muscle (or the equipment accent) fill
  - `#b34700` HI_LINE: outline and fiber lines on the highlighted muscle (stroke 0.7-1.2)
  `fill="none"` is allowed. Nothing else. (`#4a4a50` / `#85858c` are the dark-theme
  *rendered* body/line colors — never author them.)
- Keep every file small: the validator allows 24 KB, current art is 1-3 KB.
  Round coordinates to one decimal.

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

## Equipment icons

- A small flat illustration: a simplified figure in BODY/LINE using the equipment, the
  equipment itself in HI with HI_LINE detail. Side or 3/4 view, centred, clear at 40 px.
- ids: barbell (lifter on a bench with a loaded bar), dumbbell (standing curl), kettlebell
  (swing/hold), machine (seated on a selectorised machine), bodyweight (push-up),
  cardio (stationary bike), smith-machine (squat in a guided-bar rack), cable (cable
  pulley station), safety-bar (back squat with a cambered bar), other (three dots),
  plus `all` (a 2x2 grid of squares/diamond, LINE colored).
