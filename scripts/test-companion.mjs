// Unit tests for the companion message queue, the (pure) skin-selection logic
// (pure TS, bundled with esbuild) and the (pure) screen-placement helpers.
// Covers priority ordering, same-priority FIFO, de-dupe/cooldown, eviction,
// expiry against an injected clock, dismiss/clear, subscribe and the enabled
// gate — plus the companion style default, guard and fallbacks, and the
// default/snap position, bubble placement and hidden-route rules.
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'companion-')), 'queue.mjs');
await build({ entryPoints: [join(root, 'src/companion/queue.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const Q = await import(pathToFileURL(out).href);

// The skin module is pure (types only) so it bundles standalone.
const outSkin = join(mkdtempSync(join(tmpdir(), 'companion-skin-')), 'skin.mjs');
await build({ entryPoints: [join(root, 'src/companion/skin.ts')], bundle: true, format: 'esm', platform: 'node', outfile: outSkin, logLevel: 'error' });
const S = await import(pathToFileURL(outSkin).href);

// Placement geometry is pure as well: no React, no native imports.
const outPlace = join(mkdtempSync(join(tmpdir(), 'companion-placement-')), 'placement.mjs');
await build({ entryPoints: [join(root, 'src/companion/placement.ts')], bundle: true, format: 'esm', platform: 'node', outfile: outPlace, logLevel: 'error' });
const P = await import(pathToFileURL(outPlace).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// --- priority ordering + FIFO at equal priority ---------------------------
{
  let t = 1_000_000;
  const q = Q.createCompanionQueue({ now: () => t });
  q.say({ text: 'info', kind: 'info' });
  q.say({ text: 'tip', kind: 'tip' });
  q.say({ text: 'pr', kind: 'pr' });
  eq(q.current().text, 'pr', 'highest priority first');
  q.dismiss();
  eq(q.current().text, 'tip', 'next highest');
  q.dismiss();
  eq(q.current().text, 'info', 'lowest last');
  q.dismiss();
  eq(q.current(), null, 'empty after dismissing all');
}
{
  const q = Q.createCompanionQueue({ now: () => 5_000 });
  q.say({ text: 'first', kind: 'info' });
  q.say({ text: 'second', kind: 'info' });
  eq(q.current().text, 'first', 'equal priority is FIFO');
}

// --- defaults by kind -----------------------------------------------------
{
  const q = Q.createCompanionQueue({ now: () => 1 });
  const cheer = q.say({ text: 'x', kind: 'cheer' });
  eq(cheer.mood, 'happy', 'cheer mood default');
  eq(cheer.priority, Q.DEFAULT_PRIORITY.cheer, 'cheer priority default');
  eq(cheer.durationMs, Q.DEFAULT_DURATION_MS.cheer, 'cheer duration default');
  const pr = q.say({ text: 'y', kind: 'pr' });
  eq(pr.mood, 'excited', 'pr mood default');
}

// --- dedupe: replace while queued ----------------------------------------
{
  const q = Q.createCompanionQueue({ now: () => 1 });
  q.say({ text: 'one', kind: 'tip', dedupeKey: 'k' });
  const replaced = q.say({ text: 'two', kind: 'tip', dedupeKey: 'k' });
  eq(q.size(), 1, 'dedupe keeps a single slot');
  eq(replaced.text, 'two', 'replaces returns the new message');
  eq(q.current().text, 'two', 'queue shows the replacement');
}

// --- dedupe: cooldown after being shown ----------------------------------
{
  let t = 10_000;
  const q = Q.createCompanionQueue({ now: () => t, cooldownMs: 1000 });
  q.say({ text: 'a', kind: 'tip', dedupeKey: 'k' });
  q.dismiss();
  eq(q.say({ text: 'a2', kind: 'tip', dedupeKey: 'k' }), null, 'suppressed within cooldown');
  t += 1000;
  ok(q.say({ text: 'a3', kind: 'tip', dedupeKey: 'k' }) !== null, 'allowed after cooldown');
}

// --- eviction: oldest lowest-priority goes first --------------------------
{
  const q = Q.createCompanionQueue({ now: () => 1, maxSize: 2 });
  q.say({ text: 'low1', kind: 'info' });
  q.say({ text: 'low2', kind: 'info' });
  ok(q.say({ text: 'high', kind: 'pr' }) !== null, 'high priority is admitted');
  eq(q.size(), 2, 'size capped');
  eq(q.current().text, 'high', 'high priority shows first');
  q.dismiss();
  eq(q.current().text, 'low2', 'oldest low-priority evicted, newer kept');
}
{
  const q = Q.createCompanionQueue({ now: () => 1, maxSize: 1 });
  q.say({ text: 'pr', kind: 'pr' });
  eq(q.say({ text: 'info', kind: 'info' }), null, 'lower priority rejected when full');
  eq(q.size(), 1, 'queue unchanged');
  eq(q.current().text, 'pr', 'existing kept');
}

// --- expiry against an injected clock ------------------------------------
{
  let t = 0;
  const q = Q.createCompanionQueue({ now: () => t });
  q.say({ text: 'exp', kind: 'tip', durationMs: 1000 });
  eq(q.current().text, 'exp', 'visible immediately');
  t += 999;
  q.tick();
  eq(q.current().text, 'exp', 'still visible one ms before expiry');
  t += 2;
  q.tick();
  eq(q.current(), null, 'gone after durationMs');
}
{
  let t = 0;
  const q = Q.createCompanionQueue({ now: () => t });
  q.say({ text: 'tip', kind: 'tip' }); // default 7000
  t += 6999;
  q.tick();
  ok(q.current() !== null, 'kind default duration used');
  t += 1;
  q.tick();
  eq(q.current(), null, 'expires at kind default');
}

// --- dismiss / clear ------------------------------------------------------
{
  const q = Q.createCompanionQueue({ now: () => 1 });
  q.dismiss();
  ok(true, 'dismiss on empty is a no-op');
  q.say({ text: 'a', kind: 'tip' });
  q.say({ text: 'b', kind: 'info' });
  q.clear();
  eq(q.size(), 0, 'clear empties');
  eq(q.current(), null, 'nothing current after clear');
}

// --- subscribe ------------------------------------------------------------
{
  const q = Q.createCompanionQueue({ now: () => 1 });
  let calls = 0;
  const unsub = q.subscribe(() => { calls += 1; });
  q.say({ text: 'a', kind: 'tip' });
  eq(calls, 1, 'say notifies');
  q.say({ text: 'b', kind: 'tip' });
  eq(calls, 2, 'second say notifies');
  q.dismiss();
  eq(calls, 3, 'dismiss notifies');
  q.dismiss();
  eq(calls, 4, 'dismissing the last message notifies');
  q.dismiss();
  eq(calls, 4, 'dismiss on empty does not notify');
  q.clear();
  eq(calls, 4, 'clear on empty does not notify');
  q.say({ text: 'c', kind: 'tip' });
  q.clear();
  eq(calls, 6, 'clear with items notifies');
  unsub();
  q.say({ text: 'd', kind: 'tip' });
  eq(calls, 6, 'no notification after unsubscribe');
}

// --- snapshot stability (useSyncExternalStore contract) -------------------
{
  const q = Q.createCompanionQueue({ now: () => 1 });
  const msg = q.say({ text: 'a', kind: 'tip' });
  ok(q.current() === msg, 'current() is a stable reference');
  const snap = q.getSnapshot();
  eq(snap.current, msg, 'snapshot exposes current');
  eq(snap.queued, 1, 'snapshot counts queued');
  eq(q.getServerSnapshot().current, null, 'server snapshot is empty');
}

// --- enabled gate ---------------------------------------------------------
{
  const q = Q.createCompanionQueue({ now: () => 1 });
  q.say({ text: 'a', kind: 'tip' });
  q.setEnabled(false);
  eq(q.size(), 0, 'disabling empties the queue');
  eq(q.say({ text: 'b', kind: 'tip' }), null, 'say is a no-op while off');
  eq(q.isEnabled(), false, 'isEnabled reflects state');
  q.setEnabled(true);
  ok(q.say({ text: 'c', kind: 'tip' }) !== null, 'say works again when on');
}

// --- skin selection (pure) ------------------------------------------------
{
  eq(S.DEFAULT_COMPANION_STYLE, 'mouse', 'the illustrated mouse is the default skin');
  eq(S.normalizeCompanionStyle(undefined), 'mouse', 'missing value falls back to the default');
  eq(S.normalizeCompanionStyle('mouse'), 'mouse', 'a stored mouse is kept');
  eq(S.normalizeCompanionStyle('blob'), 'blob', 'a stored blob is kept');
  eq(S.normalizeCompanionStyle('dragon'), 'mouse', 'an unknown name falls back to the default');
  eq(S.normalizeCompanionStyle(42), 'mouse', 'a non-string falls back to the default');
  eq(S.normalizeCompanionStyle(null), 'mouse', 'null falls back to the default');
  ok(S.isCompanionStyle('blob') && S.isCompanionStyle('mouse'), 'both styles pass the guard');
  ok(!S.isCompanionStyle('Blob') && !S.isCompanionStyle('') && !S.isCompanionStyle(1), 'nothing else passes the guard');
  eq([...S.COMPANION_STYLES], ['mouse', 'blob'], 'the settings choice lists both styles, mouse first');
  eq(S.COMPANION_STYLE_LABEL.mouse, 'Mouse', 'mouse label');
  eq(S.COMPANION_STYLE_LABEL.blob, 'Blob', 'blob label');
  for (const style of S.COMPANION_STYLES) {
    ok(style in S.COMPANION_STYLE_LABEL, `${style} has a settings label`);
  }
}

// --- screen placement (pure) ------------------------------------------------
{
  // A 411×891 phone with insets: the bounds the overlay derives.
  const B = { left: 12, right: 319, top: 46, bottom: 743 };

  eq(P.clampPosition(5, 0, 10), 5, 'clamp keeps a value inside the range');
  eq(P.clampPosition(-5, 0, 10), 0, 'clamp lifts a value under the minimum');
  eq(P.clampPosition(50, 0, 10), 10, 'clamp drops a value over the maximum');

  eq([...P.COMPANION_CORNERS], ['tc', 'tl', 'tr', 'bl', 'br'], 'the five snap anchors');
  ok(P.COMPANION_CORNERS.includes(P.FALLBACK_CORNER), 'the fallback is a real anchor');

  eq(P.cornerPosition('tc', B), { x: 165.5, y: 46 }, 'tc is top-centre');
  eq(P.cornerPosition('tl', B), { x: 12, y: 46 }, 'tl is top-left');
  eq(P.cornerPosition('tr', B), { x: 319, y: 46 }, 'tr is top-right');
  eq(P.cornerPosition('bl', B), { x: 12, y: 743 }, 'bl is bottom-left');
  eq(P.cornerPosition('br', B), { x: 319, y: 743 }, 'br is bottom-right');

  eq(P.nearestCorner(317, 740, B), 'br', 'a release at the bottom-right snaps to br');
  eq(P.nearestCorner(14, 48, B), 'tl', 'a release at the top-left snaps to tl');
  eq(P.nearestCorner(160, 400, B), 'tc', 'centred up top is nearest to tc');
  eq(P.nearestCorner(20, 700, B), 'bl', 'a release low-left snaps to bl');

  // Default: RIGHT edge, ~38% down, inside the safe-area bounds.
  eq(P.DEFAULT_V_FRACTION, 0.72, 'the default sits 72% down the window');
  const def = P.defaultCompanionPosition(891, B);
  eq(def.x, 12, 'the default hugs the left bound');
  eq(def.y, 641.52, 'the default is 72% of the window height down');
  ok(def.y > B.top && def.y < B.bottom, 'the default is inside the bounds');
  ok(def.y > 420 && def.y < 700, 'the default is in the lower part of the screen, clear of the header and the tab bar');

  // Tiny window: the raw 72% point is outside the bounds and gets clamped.
  const tiny = { left: 12, right: 100, top: 30, bottom: 60 };
  eq(P.defaultCompanionY(240, tiny), 60, 'a short window clamps the default down to the bottom bound');
  const squat = { left: 12, right: 100, top: 60, bottom: 100 };
  eq(P.defaultCompanionY(70, squat), 60, 'a very short window clamps it up to the top bound');
  eq(P.defaultCompanionPosition(70, squat), { x: 12, y: 60 }, 'the tiny-window default is still the left edge');

  // Bubble: opens to the left of a right-edge creature, centred otherwise.
  const right = P.placeBubble(319, 80, 411, 260, 12, 8);
  ok(right.opensLeft, 'a right-edge creature pushes the bubble left');
  eq(right.left, 51, 'the bubble ends 8dp before the creature');
  ok(right.left + 260 <= 319, 'the bubble never overlaps the creature');
  const left = P.placeBubble(12, 80, 411, 260, 12, 8);
  ok(!left.opensLeft, 'a left-side creature keeps the centred bubble');
  eq(left.left, 12, 'the centred bubble is clamped inside the margin');
  const centre = P.placeBubble(165, 80, 411, 260, 12, 8);
  ok(!centre.opensLeft, 'a centred creature keeps the centred bubble');
  eq(centre.left, 75, 'the centred bubble is centred on the creature');
  const narrow = P.placeBubble(200, 80, 240, 220, 12, 8);
  ok(narrow.left >= 12 && narrow.left + 220 <= 240, 'a narrow window still keeps the bubble inside');

  // Routes the overlay must stay off.
  // Top-level (tab) routes show the panel/settings buttons; inner screens do not.
  ok(P.isTopLevelRoute('/', ['(tabs)']), 'the Train tab (group index) is top level');
  ok(P.isTopLevelRoute('/programs', ['(tabs)', 'programs']), 'Programs is top level');
  ok(P.isTopLevelRoute('/exercises', ['(tabs)', 'exercises']), 'Exercises is top level');
  ok(!P.isTopLevelRoute('/workout/abc', ['workout', '[id]']), 'a workout screen is not top level');
  ok(!P.isTopLevelRoute('/settings', ['settings']), 'settings is not top level');
  ok(P.isCompanionHiddenRoute('/onboarding', ['onboarding']), 'onboarding is hidden');
  ok(P.isCompanionHiddenRoute('/onboarding', []), 'onboarding is hidden by pathname alone');
  ok(P.isCompanionHiddenRoute('/programs/parq', ['programs', 'parq']), 'PAR-Q is hidden');
  ok(P.isCompanionHiddenRoute('/programs/parq', []), 'PAR-Q is hidden by pathname alone');
  ok(!P.isCompanionHiddenRoute('/', ['(tabs)']), 'the Train tab shows the companion');
  ok(!P.isCompanionHiddenRoute('/programs', ['programs']), 'program lists show the companion');
  ok(!P.isCompanionHiddenRoute('/workout/abc-123', ['workout', 'abc-123']), 'a workout shows the companion');
  ok(!P.isCompanionHiddenRoute('/settings', ['settings']), 'settings show the companion');
}

console.log(`companion queue + skins + placement: ${n} assertions passed`);
