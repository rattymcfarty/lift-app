/**
 * Unit tests for the live-session store and clock (`src/workout/activeSession.ts`).
 *
 * The badge must appear exactly while a workout is open, tick without drifting into
 * negative or padded nonsense, and stop notifying when nothing changed — it is
 * read by the chrome on every screen, so a spurious notification is a re-render of
 * the whole top bar on every route change.
 *
 * Usage: node scripts/test-active-session.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'active-session-')), 'activeSession.mjs');
await build({
  entryPoints: [join(root, 'src/workout/activeSession.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const {
  setActiveSession,
  getActiveSessionSnapshot,
  subscribeActiveSession,
  formatElapsed,
} = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* ---- the store ------------------------------------------------------------ */

eq(getActiveSessionSnapshot(), null, 'nothing is running at start');

let notifications = 0;
const unsubscribe = subscribeActiveSession(() => { notifications += 1; });

const session = { id: 'w1', name: 'Workout · Oct 25', startedAt: 1_700_000_000_000 };
setActiveSession(session);
eq(getActiveSessionSnapshot(), session, 'the session is readable synchronously');
eq(notifications, 1, 'starting a session notifies the chrome once');

setActiveSession({ ...session });
eq(notifications, 1, 'the same session does not notify again');

setActiveSession({ ...session, name: 'Renamed' });
eq(notifications, 1, 'a rename alone is not a new session');

setActiveSession({ ...session, startedAt: session.startedAt + 1 });
eq(notifications, 2, 'a different start time is a new session');

setActiveSession(null);
eq(getActiveSessionSnapshot(), null, 'finishing clears it');
eq(notifications, 3, 'and notifies');

unsubscribe();
setActiveSession(session);
eq(notifications, 3, 'an unsubscribed listener stops hearing about it');

/* ---- the clock ------------------------------------------------------------ */

eq(formatElapsed(0, 0), '0:00', 'zero');
eq(formatElapsed(0, 1_000), '0:01', 'one second');
eq(formatElapsed(0, 59_000), '0:59', 'under a minute');
eq(formatElapsed(0, 60_000), '1:00', 'one minute');
eq(formatElapsed(0, 61_000), '1:01', 'minutes are not zero-padded below an hour');
eq(formatElapsed(0, 3_599_000), '59:59', 'just under an hour');
eq(formatElapsed(0, 3_600_000), '1:00:00', 'an hour');
eq(formatElapsed(0, 3_661_000), '1:01:01', 'past an hour, minutes pad');
eq(formatElapsed(0, 4_000), '0:04', 'seconds pad to two digits');
eq(formatElapsed(1_000, 0), '0:00', 'a clock skew never shows a negative time');

console.log(`test:active-session — ${n} assertions passed`);
