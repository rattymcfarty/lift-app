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
  so it never blocks touches — except on the creature (drag/tap target) and the
  bubble, which is `pointerEvents="none"`.
- Position is safe-area aware. Default: top-centre, just below the status bar.
- The creature occupies one square box (`SIZE`, 80 dp). Every skin draws inside
  that box and the bubble is placed around it: the tail sits at the box's
  horizontal centre, which is the character's centre in both skins, so the
  bubble points at whoever is drawn. The mouse skin draws *above* its box while
  it hops (`MOUSE_HOP_OVERSHOOT`), so the overlay adds that headroom to the top
  drag bound — the bottom bound and the tab-bar clearance are unchanged.
- Drag to move; on release it snaps to the nearest edge/corner. The corner is
  remembered in AsyncStorage under `lift:companion-pos` — a **plain local key**,
  deliberately *not* in the backup whitelist (`src/data/appData.ts`): a UI
  position is not user data.
- Tap = a quick jump + a wiggle, and dismiss the visible message.

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
- **ground shadow** — a soft theme-aware ellipse under the feet; it shrinks and
  fades while the character is airborne (driven by the same hop value).
- **tap** — the overlay adds a jump + wiggle for every skin.

Transform origin: scaling stays anchored at the feet by translating by
`height × (1 − scale) / 2` in a layer *outside* the scale, and rotation is
anchored at the feet by nesting `translateY(+h/2) → rotate → translateY(−h/2)`.
The mouse box is 80 dp wide (drawing ~80×77 dp) — the same box the bubble is
placed around.

Reduce-motion: no loops and no hops. What remains is the mood's static pose (the
droop, the lean, the 0.9 dim), fade-only sparkles and the static "z"; a tap only
dismisses the bubble.

Cost: one `Animated.Value` per motion plus five for the sparkles, all on the
native driver; nothing runs while reduce-motion is on, and every loop is stopped
when the mood changes or the skin unmounts (switching style remounts it).

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

## Turning it off

Settings → Companion → Off hides the creature completely (nothing renders) and
makes every `say()` a no-op. The style choice (Mouse / Blob) is a normal
setting: it persists like the others and travels in backups, while the
remembered screen *position* does not.
