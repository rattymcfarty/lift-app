/**
 * Unit tests for src/notifications/native.ts — the defensive loader.
 *
 * Expo Go freezes its native modules at publish time. The Android 58.0.5 build
 * predates `ExpoTopicSubscriptionModule`, which `expo-notifications` 58.1.6
 * requires at import time, so the bare import killed the app while the router
 * was evaluating `app/_layout.tsx`. The loader must turn that into `null` (no
 * notifications) and never throw.
 *
 * The test bundles the loader twice against a fake `expo-notifications`:
 *   - present → the API object comes back;
 *   - absent  → `notifications()` returns null and `notificationsAvailable()` is false.
 *
 * Usage: node scripts/test-notifications.mjs
 */
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

/** Build the loader with `expo-notifications` left external. */
async function load({ provideModule }) {
  const dir = mkdtempSync(join(tmpdir(), 'notifications-'));
  if (provideModule) {
    const pkg = join(dir, 'node_modules', 'expo-notifications');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, 'index.js'), 'module.exports = { marker: 42, SchedulableTriggerInputTypes: { DATE: "date" } };');
  }
  const out = join(dir, 'native.cjs');
  await build({
    entryPoints: [join(root, 'src/notifications/native.ts')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    external: ['expo-notifications'],
    define: { __DEV__: 'false' },
    outfile: out,
    logLevel: 'error',
  });
  return import(pathToFileURL(out).href);
}

// ---- module missing (the Expo Go 58.0.5 Android case) ------------------------
const missing = await load({ provideModule: false });
let threw = null;
let api;
try {
  api = missing.notifications();
} catch (e) {
  threw = e;
}
ok(threw === null, 'a missing native module does not throw — the app can start');
ok(api === null, 'notifications() returns null when the runtime lacks the module');
ok(missing.notificationsAvailable() === false, 'notificationsAvailable() is false');
ok(missing.notifications() === null, 'the failure is cached (no repeated require)');

// ---- module present (release APK, development build, iOS) --------------------
const present = await load({ provideModule: true });
const live = present.notifications();
ok(live !== null, 'notifications() returns the API when the module exists');
ok(live.marker === 42, 'it is the real module object');
ok(present.notificationsAvailable() === true, 'notificationsAvailable() is true');
ok(live.SchedulableTriggerInputTypes.DATE === 'date', 'enum values come from the same object');

console.log(`notifications: ${n} assertions passed`);
