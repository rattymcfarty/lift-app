# Companion (floating avatar)

A small, friendly creature — "Pip" — that floats above every screen, keeps the
user company and speaks short, warm messages: a cheer at the end of a workout,
the odd nudge mid-set, a personal-record note, a reminder that a program session
is waiting. It is local-only: no network, no analytics, nothing leaves the
device.

This is the **foundation**. The character is a temporary procedurally drawn
placeholder (SVG), designed to be swapped for a future Lottie/Rive/image-sequence
skin without touching anything else.

## Architecture

```
app/_layout.tsx            mounts <Companion/> ONCE, above the Stack + tabs
  src/companion/
    queue.ts               pure message store: priority, dedupe, eviction, expiry
    messages.ts            every copy string + SayInput builders
    triggers.ts            the few, safe call sites: setLogged / finished / records / sessionWaiting
    enabled.ts             reactive on/off bridge to the persisted setting + hook
    useCompanion.ts        useSyncExternalStore binding for the queue
    skin.ts                CompanionSkin interface (pluggable renderer)
    Creature.tsx           default SVG character (the placeholder)
    Bubble.tsx             themed speech bubble
    Companion.tsx          the floating overlay: drag, snap, tap, announce
    index.ts               public surface
app/settings.tsx           Companion On/Off toggle
src/data/settings.ts       companionEnabled persisted setting (default ON)
```

The queue is the single source of truth. The overlay is a thin renderer that
reads the current message and the mood; features only ever hand the queue
something to say.

### Touches & layout

- The root overlay is `StyleSheet.absoluteFill` with `pointerEvents="box-none"`,
  so it never blocks touches — except on the creature (drag/tap target) and the
  bubble, which is `pointerEvents="none"`.
- Position is safe-area aware. Default: top-centre, just below the status bar.
- Drag to move; on release it snaps to the nearest edge/corner. The corner is
  remembered in AsyncStorage under `lift:companion-pos` — a **plain local key**,
  deliberately *not* in the backup whitelist (`src/data/appData.ts`): a UI
  position is not user data.
- Tap = a small bounce + dismiss the visible message.

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

## Adding a skin

Implement `CompanionSkin` (see `src/companion/skin.ts`):

```tsx
import type { CompanionSkin } from '../companion/skin';

export const MySkin: CompanionSkin = ({ mood, size, reduceMotion }) => { … };
```

Then render `<MySkin …/>` where `Companion.tsx` uses `Creature`, or pass it in
as a prop. A skin receives `mood`, `size` and `reduceMotion` only, so the overlay,
queue and settings stay untouched. Any future animation library must remain
optional and must not add a runtime network call.

## Accessibility

- The creature is `accessibilityRole="button"` with a label and hint.
- New messages are announced with `AccessibilityInfo.announceForAccessibility`.
- Reduce-motion (`AccessibilityInfo.isReduceMotionEnabled`) disables every
  looping animation; the bubble and tap reaction become simple fades/no-ops.
- Text uses the app-wide scale cap (1.15×) and theme tokens only.

## Turning it off

Settings → Companion → Off hides the creature completely (nothing renders) and
makes every `say()` a no-op. The choice persists like other settings and travels
in backups; the remembered screen *position* does not.
