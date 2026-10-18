# Muscle-group and equipment icon style

Original artwork for LIFT's exercise filters and lists. The look follows the
conventions of good anatomy-chart icons (views, proportions, highlight scheme) but
**every drawing is original**: never trace, copy or auto-convert another app's art.

## Files and pipeline

- Authoring: `assets/icons-src/muscle/<id>.svg` and `assets/icons-src/equipment/<id>.svg`.
  Ids are the taxonomy ids already used by `src/components/icons/TaxonomyIcon.tsx`
  (e.g. `chest`, `front-delts`, `quadriceps`; equipment `barbell`, `dumbbell`, ...).
- `node scripts/build-icon-art.mjs` validates the SVGs and generates
  `src/components/icons/iconArt.generated.ts` (`--check` = fail if stale; part of `npm run verify`).
- `node scripts/render-icons.mjs [out.png]` renders a contact sheet (every icon on a dark
  and a light tile, labelled) with headless Chrome so you can look at the result.
- The components `MuscleIconArt` / `EquipmentIconArt` draw the generated SVG with the
  app's colors; icons without art yet fall back to the older drawing.

## SVG rules

- `viewBox="0 0 96 96"`, no width/height, transparent background (the tile is drawn by the app).
- Only: `svg g path circle ellipse rect line polyline polygon`. No text, image, style,
  script, filter, gradient, mask, clipPath, use, foreignObject, no external references.
- **Only these four colors** (the app substitutes theme colors for them):
  - `#4a4a50` BODY: body fill (the part that is not highlighted)
  - `#85858c` LINE: thin separation / detail lines on the body (stroke 0.8-1.2)
  - `#ff7a1a` HI: the highlighted muscle (or the equipment accent) fill
  - `#b34700` HI_LINE: outline and fiber lines on the highlighted muscle (stroke 0.8-1.2)
  `fill="none"` is allowed. Nothing else.
- Keep every file under 6 KB; round coordinates to one decimal.

## Muscle icons

- A muscular, gender-neutral anatomical figure, simplified, seen from the FRONT or BACK
  as listed; the icon is a *window* (crop) onto the figure, zoomed so the target muscle
  fills about 60% of the tile and the surrounding anatomy gives context.
- Body base in BODY with LINE separation lines (ribs, abs grid, muscle seams); the target
  muscle group in HI with HI_LINE outline and 3-5 fibre lines; other muscles stay BODY.
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
