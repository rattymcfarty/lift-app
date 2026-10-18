# Companion (fixed avatar)

A small, friendly creature — "Pip" — that lives in the top bar, keeps the user
company and speaks short, warm messages: a cheer at the end of a workout, the
odd nudge mid-set, a personal-record note, a reminder that a program session is
waiting. It is local-only: no network, no analytics, nothing leaves the device.

Pip ships with **two skins** (Settings → Companion → Style):

- **Mouse** (default) — the owner-supplied illustrated mouse, a single flat
  512×492 PNG (`assets/companion/mouse.png`) animated with transforms only.
- **Blob** — the procedural SVG creature, the original placeholder.

The character's name is still a placeholder. A future Lottie/Rive/image-sequence
skin can drop in without touching the queue, the ring or the settings.

## Architecture

```
app/_layout.tsx            mounts <TopBar/> ONCE, above the Stack + tabs
  src/components/chrome/
    TopBar.tsx             left panel / right settings buttons + the companion
                           circle in its centre slot (renders <Companion/>)
  src/companion/
    queue.ts               pure message store: priority, dedupe, eviction, expiry
    messages.ts            every copy string + SayInput builders
    triggers.ts            the few, safe call sites: setLogged / finished / records / sessionWaiting
    enabled.ts             reactive on/off bridge to the persisted setting + hook
    style.ts               reactive skin-selection bridge + hook
    useCompanion.ts        useSyncExternalStore binding for the queue
    skin.ts                CompanionSkin interface + the style union/labels/guard (pure)
    placement.ts           route helpers: hidden routes + top-level routes (pure)
    ImageSkin.tsx          default skin: the mouse picture (transforms only)
    Creature.tsx           alternative skin: the SVG blob
    Bubble.tsx             themed speech bubble
    Companion.tsx          the fixed circle: clip/zoom, tap, bubble, announce
    index.ts               public surface
app/settings.tsx           Companion On/Off + Style (Mouse / Blob)
src/data/settings.ts       companionEnabled (default ON) + companionStyle (default 'mouse')
```

The queue is the single source of truth. `Companion.tsx` is a thin renderer that
reads the current message and the mood; features only ever hand the queue
something to say.

### The circle (fixed in the top bar)

- Since stage A2 of the layout redesign Pip is **no longer draggable and no
  longer free-floating**. It is fixed in the **centre of the TopBar**, inside a
  ~48 dp circular **glass ring** (`Glass` from `src/components/ui/Glass.tsx`, so
  iOS gets Liquid Glass / BlurView and Android gets a themed translucent
  surface).
- The artwork is drawn **larger than the ring and clipped to the circle**
  (`overflow: hidden` + `borderRadius`). The mouse PNG is drawn at 64 dp and
  offset up/left so the face — which sits in the upper half of the art — and the
  upper body fill the ring; the blob is already centred in its box. The
  constants live at the top of `Companion.tsx` (`CIRCLE`, `MOUSE_FRAME`,
  `BLOB_FRAME`).
- Every skin animation (float, breathe, blink, hop, sparkles) still runs, scaled
  to the ring and **clipped** — a hop simply leaves the circle rather than the
  creature flying off the screen. There is no drag, no snap and no remembered
  position: the old `lift:companion-pos` AsyncStorage key and the five snap
  anchors are gone.
- The ring is a button (`testID="companion"`, `accessibilityRole="button"`).
  **Tap = a jump + a wiggle and dismiss the visible message.** Under
  reduce-motion a tap only dismisses the bubble.

### The speech bubble

- The bubble appears **centred below the ring** (just below the top bar) with a
  small tail pointing up at the creature. It is at most ~80 % of the window wide.
- It is `pointerEvents="none"` as before, so it never blocks the screen
  underneath; the creature's tap is the dismiss affordance (and the message
  still auto-expires after its `durationMs`).

### Routes

- The whole chrome — the top bar **and** the circle — is **not rendered** on
  the onboarding / profile wizard (`app/onboarding.tsx`) or the PAR-Q+ screening
  questionnaire (`app/programs/parq.tsx`). The route comes from expo-router's
  `usePathname`/`useSegments` and is matched by the pure
  `isCompanionHiddenRoute` helper in `placement.ts`, and is unit-tested in
  `scripts/test-companion.mjs`.

### One transformed view, one picture, no SVG (mouse)

An Android release build once showed a lighter "plate" the size of the creature's
box behind the mouse — an artefact of compositing, not of the artwork (the PNG is
fully transparent outside the mouse). The fixes stay in place:

- **One `Animated.View` with one `transform` list.** The old skin nested ~11
  transform wrappers via a `nest()` helper. They are now the entries of a single
  `style.transform` array, in the same order, so the motion is identical with
  one view.
- **No opacity above the picture.** The sleepy 0.9 dim lives on the `Image`.
- **The `Image` is explicit**: fixed `width`/`height`, `resizeMode="contain"`,
  `backgroundColor: 'transparent'`, `fadeDuration={0}`.
- **No SVG while idle.** The ground shadow is a plain themed `View`, and the
  sparkles / sleepy "z" are plain `Text` star glyphs mounted only while active.
  (`Creature.tsx`, the SVG blob, is unchanged.)
- **No plate from the ring.** `Companion.tsx` paints no background of its own;
  only the `Glass` ring and the bubble body are filled.

Transform origin: scaling stays anchored at the feet by translating by
`height × (1 − scale) / 2` in an entry *before* the scale, and rotation is
anchored at the feet with `translateY(+h/2) → rotate → translateY(−h/2)` — both
as neighbouring entries of the same list. The circle then clips whatever fits
outside it.

Reduce-motion: no loops and no hops. What remains is the mood's static pose (the
droop, the lean, the 0.9 dim), fade-only sparkles and the static "z"; a tap only
dismisses the bubble.

## The `say()` API

```ts
import { say } from '../companion/queue';
// or a trigger helper:
import { companionSetLogged } from '../companion/triggers';

say({
  text: 'Left a couple in the tank? Good.',
  kind: 'tip',            // 'tip' | 'cheer' | 'reminder' | 'pr' | 'info'
  mood: 'focused',        // 'idle' | 'happy' | 'excited' | 'sleepy' | 'focused'
  durationMs: 6000,       // default per kind
  priority: 40,           // default per kind; higher shows first
  dedupeKey: 'post-set-tip', // same key replaces while queued,
                             // and is dropped if shown within the cooldown
});
```

Rules enforced by the queue:

- higher `priority` first; ties are oldest-first (FIFO);
- a `dedupeKey` already in the queue is **replaced**; a key shown within
  `cooldownMs` (default 60 s) is **dropped**;
- at most `maxSize` (default 4) messages; when full, the weakest (lowest
  priority, then oldest) is evicted — and only if the incoming message is at
  least as important;
- the visible message expires automatically after `durationMs`.

`say()` returns the queued `CompanionMessage` or `null` (dropped). When the
companion is off it is a no-op.

## Wiring new messages

1. Put the copy in `src/companion/messages.ts` (data, no logic).
2. Add a small helper in `src/companion/triggers.ts` that builds the `SayInput`
   and calls `say()`.
3. Call it from the feature — keep it additive and never let the companion
   affect app logic or data.

Existing call sites: set logged (cheers at most once every 3 sets), workout
finished, new personal records (summary screen), and a session-ready greeting on
the Train tab.

## Skins

A skin receives `mood`, `size` and `reduceMotion` and nothing else, so the
circle, queue and settings do not know which art is drawn. Which skin is
rendered is a persisted setting (`companionStyle`), mirrored for the live UI by
`src/companion/style.ts`; the pure part (the union, the guard and the fallbacks)
lives in `src/companion/skin.ts` and is unit-tested in
`scripts/test-companion.mjs`.

### `ImageSkin` (mouse, default)

A still picture cannot be redrawn per frame, so every motion is a **transform**
(or an opacity) on the built-in `Animated` API with `useNativeDriver` — no new
dependency, and the animations run on the UI thread.

- **idle** — gentle float loop plus slow breathing: `scaleY` 1.00 → 1.03 with an
  opposite `scaleX` (0.985), anchored at the feet.
- **blink** every 3–6 s — a very quick squash (`scaleY` 0.94) with a tiny head
  tilt (−2.5°).
- **happy** — a small hop with a squash on landing.
- **excited** — a faster double bounce plus a ±6° wiggle.
- **sleepy** — slower, deeper breathing, a slight droop (−6°), opacity 0.9, and
  a small "z" glyph drifting up in the muted text colour.
- **focused** — steady, with a slight forward lean (+3°).
- **cheer / PR** — 3 (cheer) or 5 (PR) sparkle stars float up and fade, in the
  accent and highlight colours.
- **ground shadow** — a soft theme-aware pill under the feet.
- **tap** — the circle adds a jump + wiggle for every skin.

The skin draws in `size` (the frame box); the circle clips it to the visible
48 dp.

## Adding a skin

Implement `CompanionSkin` (see `src/companion/skin.ts`):

```tsx
import type { CompanionSkin } from '../companion/skin';

export const MySkin: CompanionSkin = ({ mood, size, reduceMotion }) => { … };
```

Then add it to `COMPANION_STYLES` / `COMPANION_STYLE_LABEL` and render it where
`Companion.tsx` picks between `ImageSkin` and `Creature` (adding a `SkinFrame`
if it needs to be zoomed/offset to fill the ring). A skin receives `mood`, `size`
and `reduceMotion` only, so the circle, queue and settings stay untouched. Any
future animation library must remain optional and must not add a runtime network
call.

## Accessibility

- The ring is `accessibilityRole="button"` with a label and hint.
- New messages are announced with `AccessibilityInfo.announceForAccessibility`.
- Reduce-motion (`AccessibilityInfo.isReduceMotionEnabled`) disables every
  looping animation; the bubble and tap reaction become simple fades/no-ops.
- Text uses the app-wide scale cap (1.15×) and theme tokens only.
- Nothing floats over the onboarding wizard or the PAR-Q+ questionnaire, so a
  screen reader (or the user) always meets the screen's own content first.

## Turning it off

Settings → Companion → Off hides the creature completely (nothing renders) and
makes every `say()` a no-op. The style choice (Mouse / Blob) is a normal
setting: it persists like the others and travels in backups. There is no screen
position to remember any more — the circle is always in the top bar centre.
