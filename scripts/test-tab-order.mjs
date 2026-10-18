// Unit tests for the bottom-tab order store (src/nav/tabOrder.ts): the pure
// normalizeOrder / moveTab logic, plus the snapshot/subscribe contract the tab
// bar reads through useSyncExternalStore. AsyncStorage is stubbed with a
// throwaway in-memory module — the store's persistence never reaches a device.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const stubAsyncStorage = {
  name: 'async-storage-stub',
  setup(b) {
    b.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({
      path: 'async-storage',
      namespace: 'stub',
    }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: [
        'const store = new Map();',
        'export default {',
        '  getItem: async (k) => (store.has(k) ? store.get(k) : null),',
        '  setItem: async (k, v) => { store.set(k, v); },',
        '};',
      ].join('\n'),
      loader: 'js',
    }));
  },
};

const out = join(mkdtempSync(join(tmpdir(), 'tab-order-')), 'tabOrder.mjs');
await build({
  entryPoints: [join(root, 'src/nav/tabOrder.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
  plugins: [stubAsyncStorage],
});
const T = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const DEFAULT = ['programs', 'train', 'analytics', 'exercises'];

// --- defaults -------------------------------------------------------------
{
  eq([...T.DEFAULT_TAB_ORDER], DEFAULT, 'shipped order is Programs, Train, Analytics, Exercises');
  eq(T.normalizeOrder(undefined), DEFAULT, 'nothing stored → the default order');
  ok(T.isTabKey('train') && T.isTabKey('programs'), 'known ids pass the guard');
  ok(!T.isTabKey('Train') && !T.isTabKey('settings') && !T.isTabKey(3), 'unknown ids, wrong case and non-strings do not');
}

// --- normalizeOrder: repair, never lose a tab -----------------------------
{
  eq(T.normalizeOrder(['train', 'programs', 'analytics', 'exercises']), ['train', 'programs', 'analytics', 'exercises'], 'a complete order is kept as given');
  eq(T.normalizeOrder(['exercises', 'programs', 'train', 'analytics']), ['exercises', 'programs', 'train', 'analytics'], 'a fully reversed order is valid');
  eq(T.normalizeOrder(['train']), ['train', 'programs', 'analytics', 'exercises'], 'missing tabs are appended, never dropped');
  eq(T.normalizeOrder(['train', 'train', 'analytics']), ['train', 'analytics', 'programs', 'exercises'], 'duplicates collapse, missing tabs appended');
  eq(T.normalizeOrder(['settings', 'train', 'nope']), ['train', 'programs', 'analytics', 'exercises'], 'unknown ids are dropped');
  eq(T.normalizeOrder('train'), DEFAULT, 'a bare string is not an order');
  eq(T.normalizeOrder(42), DEFAULT, 'a number is not an order');
  eq(T.normalizeOrder(null), DEFAULT, 'null is not an order');
  eq(T.normalizeOrder({ 0: 'train' }), DEFAULT, 'an object is not an order');
  eq(T.normalizeOrder(['train', 'analytics']).length, 4, 'the result always has all four tabs');
}

// --- moveTab --------------------------------------------------------------
{
  eq(T.moveTab(DEFAULT, 'exercises', 0), ['exercises', 'programs', 'train', 'analytics'], 'last tab to the front');
  eq(T.moveTab(DEFAULT, 'programs', 3), ['train', 'analytics', 'exercises', 'programs'], 'first tab to the back');
  eq(T.moveTab(DEFAULT, 'train', 2), ['programs', 'analytics', 'train', 'exercises'], 'one step down');
  eq(T.moveTab(DEFAULT, 'analytics', 1), ['programs', 'analytics', 'train', 'exercises'], 'one step up');
  eq(T.moveTab(DEFAULT, 'train', -5), ['train', 'programs', 'analytics', 'exercises'], 'a negative index clamps to the front');
  eq(T.moveTab(DEFAULT, 'train', 99), ['programs', 'analytics', 'exercises', 'train'], 'an oversized index clamps to the back');
  eq(T.moveTab(DEFAULT, 'train', 1), DEFAULT, 'moving onto its own index is a no-op');
  eq(T.moveTab(['train', 'train', 'programs'], 'analytics', 1), ['train', 'analytics', 'programs', 'exercises'], 'a sloppy order is normalized on the way in');
}
{
  const order = ['programs', 'train', 'analytics', 'exercises'];
  const moved = T.moveTab(order, 'train', 3);
  eq(order, ['programs', 'train', 'analytics', 'exercises'], 'the input order is never mutated');
  ok(moved !== order, 'a new array comes back');
}

// --- stored order: snapshot, subscribe, persistence ------------------------
{
  eq(T.getTabOrderSnapshot(), DEFAULT, 'the snapshot starts at the default order');
  let calls = 0;
  const unsubscribe = T.subscribeTabOrder(() => { calls += 1; });

  await T.setTabOrder(['train', 'programs', 'analytics', 'exercises']);
  eq(T.getTabOrderSnapshot(), ['train', 'programs', 'analytics', 'exercises'], 'a saved order becomes the snapshot');
  eq(calls, 1, 'subscribers hear about it');

  await T.setTabOrder(['train', 'train', 'settings']);
  eq(T.getTabOrderSnapshot(), ['train', 'programs', 'analytics', 'exercises'], 'saved values are normalized');

  eq(await T.loadTabOrder(), ['train', 'programs', 'analytics', 'exercises'], 'the saved order survives a reload');

  unsubscribe();
  const before = calls;
  await T.setTabOrder(DEFAULT);
  eq(calls, before, 'no notification after unsubscribing');
  eq(T.getTabOrderSnapshot(), DEFAULT, 'the order is back to the default');
}

// --- the layout's tab table still matches the store and the Maestro ids ----
{
  const layout = readFileSync(join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
  const keys = [...layout.matchAll(/key: '([a-z]+)'/g)].map((m) => m[1]);
  eq(keys, DEFAULT, 'the layout declares the four tabs in the default order');
  for (const testID of ['tab-programs', 'tab-train', 'tab-analytics', 'tab-exercises']) {
    ok(layout.includes(`testID: '${testID}'`), `the ${testID} test id Maestro taps is still on the bar`);
  }
}

console.log(`tab order: ${n} assertions passed`);
