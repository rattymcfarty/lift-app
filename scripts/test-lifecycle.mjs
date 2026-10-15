// Unit tests for the workout lifecycle policy (pure TS, bundled with esbuild).
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'lifecycle-')), 'policy.mjs');
await build({ entryPoints: [join(root, 'src/workouts/policy.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const P = await import(pathToFileURL(out).href);
const MIN = 60_000;
const now = Date.UTC(2026, 9, 15, 18, 0, 0);
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const pol = P.DEFAULT_IDLE_POLICY;
eq(pol, { promptAfterMin: 45, autoFinishAfterMin: 180 }, 'defaults');

// classification boundaries
eq(P.classifyIdle(now, now - 44 * MIN, pol), 'active', '44 min active');
eq(P.classifyIdle(now, now - 45 * MIN, pol), 'idle', '45 min idle (boundary)');
eq(P.classifyIdle(now, now - 179 * MIN, pol), 'idle', '179 min idle');
eq(P.classifyIdle(now, now - 180 * MIN, pol), 'stale', '180 min stale (boundary)');
eq(P.classifyIdle(now, now + 5 * MIN, pol), 'active', 'clock skew (future activity) is active');
eq(P.classifyIdle(now, now - 999 * MIN, { promptAfterMin: 45, autoFinishAfterMin: 0 }), 'idle', 'auto-finish off never goes stale');

// normalisation
eq(P.normalizePolicy({ promptAfterMin: 1, autoFinishAfterMin: 5 }), { promptAfterMin: 10, autoFinishAfterMin: 25 }, 'clamps');
eq(P.normalizePolicy({ promptAfterMin: 60, autoFinishAfterMin: 0 }), { promptAfterMin: 60, autoFinishAfterMin: 0 }, '0 = off preserved');
eq(P.normalizePolicy(undefined), pol, 'undefined -> defaults');

// last activity & end time
eq(P.latestActivity(1000, [null, 5000, undefined, 3000, NaN]), 5000, 'latest of several');
eq(P.latestActivity(9000, [1000]), 9000, 'never earlier than start');
eq(P.autoFinishEndTime(10 * MIN, 30 * MIN), 30 * MIN, 'ends at last activity');
eq(P.autoFinishEndTime(10 * MIN, 10 * MIN), 11 * MIN, 'never zero duration');

// reconcile plans
const w = (id, started, last, sets) => ({ id, startedAtMs: now - started * MIN, lastActivityMs: now - last * MIN, loggedSets: sets });
let plan = P.planReconcile(now, [], pol);
eq([plan.current, plan.closes.length], [null, 0], 'nothing open');

plan = P.planReconcile(now, [w('a', 60, 10, 4)], pol);
eq([plan.current.id, plan.currentState, plan.closes.length], ['a', 'active', 0], 'fresh workout untouched');

plan = P.planReconcile(now, [w('a', 120, 60, 4)], pol);
eq([plan.current.id, plan.currentState, plan.closes.length], ['a', 'idle', 0], 'idle -> prompt, not closed');

plan = P.planReconcile(now, [w('a', 400, 300, 5)], pol);
eq([plan.current, plan.closes.length, plan.closes[0].action, plan.closes[0].reason], [null, 1, 'finish', 'stale'], 'stale with sets finishes');
eq(plan.closes[0].endedAtMs, now - 300 * MIN, 'ended at last activity, not now');

plan = P.planReconcile(now, [w('a', 400, 400, 0)], pol);
eq([plan.closes[0].action, plan.closes[0].reason], ['discard', 'stale'], 'stale empty workout is discarded');

plan = P.planReconcile(now, [w('old', 1000, 900, 3), w('new', 30, 5, 1)], pol);
eq([plan.current.id, plan.closes.length, plan.closes[0].workout.id, plan.closes[0].reason, plan.closes[0].action], ['new', 1, 'old', 'duplicate', 'finish'], 'older duplicate closed, newest kept');

plan = P.planReconcile(now, [w('old', 300, 5, 0), w('new', 30, 5, 1)], pol);
eq([plan.closes[0].action, plan.closes[0].reason], ['discard', 'duplicate'], 'empty duplicate discarded even if recent');

plan = P.planReconcile(now, [w('x', 500, 400, 2), w('y', 600, 590, 0)], pol);
eq(plan.current, null, 'all stale -> nothing current');
eq(plan.closes.map((c) => c.workout.id).sort(), ['x', 'y'], 'all closed');

// formatting & alerts
eq(P.formatIdle(30_000), 'less than a minute', 'fmt <1m');
eq(P.formatIdle(47 * MIN), '47 min', 'fmt min');
eq(P.formatIdle(125 * MIN), '2 h 5 min', 'fmt h+m');
eq(P.formatIdle(120 * MIN), '2 h', 'fmt exact hours');
eq(P.alertTimes(now, pol), { checkInAt: now + 45 * MIN, finishWarnAt: now + 165 * MIN }, 'alert times');
eq(P.alertTimes(now, { promptAfterMin: 45, autoFinishAfterMin: 0 }).finishWarnAt, null, 'no warn when off');

console.log(`workout lifecycle policy: ${n} assertions passed`);
