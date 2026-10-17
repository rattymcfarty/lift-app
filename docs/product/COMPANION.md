# Companion (floating avatar)

A small, friendly creature — "Pip" — that floats above every screen, keeps the
user company and speaks short, warm messages: a cheer at the end of a workout,
the odd nudge mid-set, a personal-record note, a reminder that a program session
is waiting. It is local-only: no network, no analytics, nothing leaves the
device.

Pip ships with **two skins** (Settings → Companion → Style):

- **Mouse** (default) — the owner-supplied illustrated mouse, a single flat
  512×492 PNG (`assets/companion/mouse.png`) animated with transforms only.
- **Blob** — the procedural SVG creature, the original placeholder.

The character's name is still a placeholder. A future Lottie/Rive/image-sequence
skin can drop in without touching the queue, the overlay or the settings.

## Architecture

```
app/_layout.tsx            mounts <Companion/> ONCE, above the Stack + tabs
  src/companion/
    queue.ts               pure message store: priority, dedupe, eviction, expiry
    messages.ts            every copy string + SayInput builders
    triggers.ts            the few, safe call sites: setLogged / finished / records / sessionWaiting
    enabled.ts             reactive on/off bridge to the persisted setting + hook
    style.ts               reactive skin-selection bridge + hook
    useCompanion.ts        useSyncExternalStore binding for the queue
    skin.ts                CompanionSkin interface + the style union/labels/guard (pure)
    placement.ts           screen geometry: snap anchors, default spot, bubble, hidden routes (pure)
    ImageSkin.tsx          default skin: the mouse picture (transforms only)
    Creature.tsx           alternative skin: the SVG blob
    Bubble.tsx             themed speech bubble
    Companion.tsx          the floating overlay: drag, snap, tap, announce
    index.ts               public surface
app/settings.tsx           Companion On/Off + Style (Mouse / Blob)
src/data/settings.ts       companionEnabled (default ON) + companionStyle (default 'mouse')
```

The queue is the single source of truth. The overlay is a thin renderer that
reads the current message and the mood; features only ever hand the queue
something to say.

### Touches & layout

- The root overlay is `StyleSheet.absoluteFill` with `pointerEvents="box-none"`,
  so it never blocks touches. The creature box is the only interactive target
  (tap/drag); the bubble, its tail, the ground shadow, the sparkles and the "z"
  are all `pointerEvents="none"`, so taps pass straight through to the screen
  underneath. The overlay also renders **nothing** until the saved position has
  been read, so the box is never an invisible touch target on first paint.
- **Default position: the LEFT edge, about 72 % down the window** — clear of
  screen headers, the tab bar and the bottom action rows. (It used to be
  top-centre, which sat on top of titles like "Workout · 17 Oct".) The spot is
  clamped into the safe-area bounds, so a short window can never push the
  creature under the status bar or over the tabs.
- Drag to move; on release it snaps to the nearest of five anchors
  (`tc`/`tl`/`tr`/`bl`/`br`) exactly as before. The anchor is remembered in
  AsyncStorage under `lift:companion-pos` — a **plain local key**, deliberately
  *not* in the backup whitelist (`src/data/appData.ts`): a UI position is not
  user data. Saved positions stay valid, including a saved `tc` from the old
  default; only an install with nothing stored gets the new spot.
- The speech bubble is centred on the creature when there is room, and pushed
  to the creature's **left** when the creature is on the right half of the
  screen, so it never lies on top of the art; the tail moves to the bubble's
  far edge and points back at the character.
- The overlay is **not rendered at all** on the onboarding / profile wizard
  (`app/onboarding.tsx` — the route that owns the whole first launch, with its
  "Skip for now" button and bottom action row) or on the PAR-Q+ screening
  questionnaire (`app/programs/parq.tsx` — nothing floats over a safety
  question). The route comes from expo-router's `usePathname`/`useSegments` and
  is matched by the pure `isCompanionHiddenRoute` helper.
- Tap = a quick jump + a wiggle, and dismiss the visible message.

The geometry behind all of the above lives in the pure `placement.ts`
(`cornerPosition`, `nearestCorner`, `defaultCompanionPosition`,
`placeBubble`, `isCompanionHiddenRoute`) and is unit-tested in
`scripts/test-companion.mjs`.

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
overlay, queue and settings do not know which art is drawn. Which skin is
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
- **ground shadow** — a soft theme-aware pill under the feet; it shrinks and
  fades while the character is airborne (driven by the same hop value).
- **tap** — the overlay adds a jump + wiggle for every skin.

#### One transformed view, one picture, no SVG

An Android release build showed a lighter "plate" the size of the creature's box
behind the mouse, with the screen faintly visible through it — an artefact of
compositing, not of the artwork (the PNG is fully transparent outside the mouse).
Every possible cause was removed rather than guessed at:

- **One `Animated.View` with one `transform` list.** The old skin nested ~11
  transform wrappers via a `nest()` helper. They are now the entries of a single
  `style.transform` array, in the same order, so the motion is identical with
  one view instead of eleven.
- **No opacity above the picture.** The sleepy 0.9 dim moved from the wrapper
  `View` onto the `Image` style itself.
- **The `Image` is explicit**: fixed `width`/`height`, `resizeMode="contain"`,
  `backgroundColor: 'transparent'`, `fadeDuration={0}`, and deliberately no
  `renderToHardwareTextureAndroid`.
- **No SVG while idle.** The ground shadow is a plain `View` (`borderRadius` =
  height / 2, `backgroundColor: withAlpha(theme.colors.text, 0.18)`), and the
  sparkles are plain `Text` star glyphs in the accent/highlight colours. Both —
  and the sleepy "z" — are mounted only while their mood is active, so an idle
  creature renders the picture and nothing else. (`Creature.tsx`, the SVG blob,
  is unchanged.)
- **No plate from the overlay.** The overlay root, the bubble wrapper and the
  tail carry no `backgroundColor`, `elevation` or `shadow*` style that could
  paint behind the character; only the bubble body itself is filled.

Transform origin: scaling stays anchored at the feet by translating by
`height × (1 − scale) / 2` in an entry *before* the scale, and rotation is
anchored at the feet with `translateY(+h/2) → rotate → translateY(−h/2)` — both
as neighbouring entries of the same list. The mouse box is 80 dp wide (drawing
~80×77 dp) — the same box the bubble is placed around, and the mouse draws
*above* it while it hops (`MOUSE_HOP_OVERSHOOT`), which is why the overlay adds
that headroom to the top drag bound.

Reduce-motion: no loops and no hops. What remains is the mood's static pose (the
droop, the lean, the 0.9 dim), fade-only sparkles and the static "z"; a tap only
dismisses the bubble.

Cost: one `Animated.Value` per motion plus five for the sparkles, all on the
native driver; nothing runs while reduce-motion is on, and every loop is stopped
when the mood changes or the skin unmounts (switching style remounts it). Idle
costs one transformed view, one `Image` and one small shadow view.

## Adding a skin

Implement `CompanionSkin` (see `src/companion/skin.ts`):

```tsx
import type { CompanionSkin } from '../companion/skin';

export const MySkin: CompanionSkin = ({ mood, size, reduceMotion }) => { … };
```

Then add it to `COMPANION_STYLES` / `COMPANION_STYLE_LABEL` and render it where
`Companion.tsx` picks between `ImageSkin` and `Creature`. A skin receives
`mood`, `size` and `reduceMotion` only, so the overlay, queue and settings stay
untouched. Any future animation library must remain optional and must not add a
runtime network call.

## Accessibility

- The creature is `accessibilityRole="button"` with a label and hint (the
  overlay box is the accessible element; a skin's picture is not a second focus
  stop).
- New messages are announced with `AccessibilityInfo.announceForAccessibility`.
- Reduce-motion (`AccessibilityInfo.isReduceMotionEnabled`) disables every
  looping animation; the bubble and tap reaction become simple fades/no-ops.
- Text uses the app-wide scale cap (1.15×) and theme tokens only.
- Nothing floats over the onboarding wizard or the PAR-Q+ questionnaire, so a
  screen reader (or the user) always meets the screen's own content first.

## Turning it off

Settings → Companion → Off hides the creature completely (nothing renders) and
makes every `say()` a no-op. The style choice (Mouse / Blob) is a normal
setting: it persists like the others and travels in backups, while the
remembered screen *position* does not.
