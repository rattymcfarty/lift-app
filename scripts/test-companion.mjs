// Unit tests for the companion message queue (pure TS, bundled with esbuild).
// Covers priority ordering, same-priority FIFO, de-dupe/cooldown, eviction,
// expiry against an injected clock, dismiss/clear, subscribe and the enabled
// gate.
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

console.log(`companion queue: ${n} assertions passed`);
