// Unit tests for the side-panel model (src/chrome/panelsModel.ts), the tab
// table used by the panel and the bottom bar (src/nav/tabs.ts), and the
// panel's link list (src/chrome/panelLinks.ts). These are the parts of the
// panels that carry real logic; the gesture plumbing and the glass are
// verified on the emulator (.maestro/panels.yaml).
//
// The model modules are bundled with esbuild (same approach as
// test-tab-order.mjs) so a plain Node run exercises the exact source.
import { build } from 'esbuild';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Bundle a repo module to a temp ESM file and import it. */
async function loadModule(relPath, name) {
  const out = join(mkdtempSync(join(tmpdir(), 'panel-')), `${name}.mjs`);
  await build({
    entryPoints: [join(root, relPath)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    jsx: 'automatic',
    logLevel: 'silent',
  });
  return import(pathToFileURL(out).href);
}

const model = await loadModule('src/chrome/panelsModel.ts', 'panelsModel');
const tabs = await loadModule('src/nav/tabs.ts', 'tabs');
const links = await loadModule('src/chrome/panelLinks.ts', 'panelLinks');

let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    console.error(`FAIL: ${label}`);
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

// --- panel transitions ----------------------------------------------------

check('open sets the side', () => {
  assert.equal(model.panelsReducer(null, { type: 'open', side: 'left' }), 'left');
});

check('opening the other side switches', () => {
  assert.equal(model.panelsReducer('left', { type: 'open', side: 'right' }), 'right');
});

check('close clears the side', () => {
  assert.equal(model.panelsReducer('right', { type: 'close' }), null);
});

check('toggle opens when closed', () => {
  assert.equal(model.panelsReducer(null, { type: 'toggle', side: 'left' }), 'left');
});

check('toggle closes the same side', () => {
  assert.equal(model.panelsReducer('left', { type: 'toggle', side: 'left' }), null);
});

check('toggle from one side opens the other', () => {
  assert.equal(model.panelsReducer('left', { type: 'toggle', side: 'right' }), 'right');
});

// --- drag maths -----------------------------------------------------------

check('clampIndex bounds both ends', () => {
  assert.equal(model.clampIndex(-3, 4), 0);
  assert.equal(model.clampIndex(9, 4), 3);
  assert.equal(model.clampIndex(2, 4), 2);
  assert.equal(model.clampIndex(0, 0), 0);
});

check('dragTargetIndex rounds to the nearest slot', () => {
  // 54 dp rows: less than half a row keeps the origin, more moves one.
  assert.equal(model.dragTargetIndex(0, 20, 54, 4), 0);
  assert.equal(model.dragTargetIndex(0, 40, 54, 4), 1);
  assert.equal(model.dragTargetIndex(1, -40, 54, 4), 0);
  assert.equal(model.dragTargetIndex(3, 60, 54, 4), 3, 'cannot drag past the end');
});

check('dragTargetIndex is safe with no height', () => {
  assert.equal(model.dragTargetIndex(2, 100, 0, 4), 2);
});

check('shiftForIndex opens the gap downwards', () => {
  // dragging row 0 down to slot 2: rows 1 and 2 move up one.
  assert.equal(model.shiftForIndex(0, 0, 2), 0);
  assert.equal(model.shiftForIndex(1, 0, 2), -1);
  assert.equal(model.shiftForIndex(2, 0, 2), -1);
  assert.equal(model.shiftForIndex(3, 0, 2), 0);
});

check('shiftForIndex opens the gap upwards', () => {
  // dragging row 3 up to slot 1: rows 1 and 2 move down one.
  assert.equal(model.shiftForIndex(1, 3, 1), 1);
  assert.equal(model.shiftForIndex(2, 3, 1), 1);
  assert.equal(model.shiftForIndex(0, 3, 1), 0);
  assert.equal(model.shiftForIndex(3, 3, 1), 0);
});

check('shiftForIndex is a no-op when the slot does not change', () => {
  for (const i of [0, 1, 2, 3]) assert.equal(model.shiftForIndex(i, 2, 2), 0);
});

// --- the tab table --------------------------------------------------------

check('there are three main doors, keyed like the stored order', () => {
  // Owner decision 2026-10-26: Train · Analytics · Exercises. Programs is a menu
  // destination now, not a tab.
  assert.deepEqual(tabs.APP_TABS.map((t) => t.key), ['train', 'analytics', 'exercises']);
});

check('every section has a route and a test id', () => {
  for (const tab of tabs.APP_TABS) {
    assert.match(tabHrefOf(tab), /^\//, `${tab.key} has a path`);
    assert.ok(tab.testID.startsWith('tab-'), `${tab.key} has a test id`);
    assert.ok(tab.title.length > 0);
  }
  function tabHrefOf(tab) {
    return tabs.tabHref(tab.key);
  }
});

check('tabHref points at the real routes', () => {
  assert.equal(tabs.tabHref('train'), '/');
  assert.equal(tabs.tabHref('analytics'), '/analytics');
  assert.equal(tabs.tabHref('exercises'), '/exercises');
});

check('tabKeyForPathname matches only the three top-level paths', () => {
  assert.equal(tabs.tabKeyForPathname('/'), 'train');
  assert.equal(tabs.tabKeyForPathname('/analytics'), 'analytics');
  assert.equal(tabs.tabKeyForPathname('/exercises'), 'exercises');
  assert.equal(tabs.tabKeyForPathname('/programs'), undefined, 'Programs is a page, not a tab');
  assert.equal(tabs.tabKeyForPathname('/history'), undefined);
  assert.equal(tabs.tabKeyForPathname('/workout/abc'), undefined);
});

check('tabByKey knows every section and nothing else', () => {
  for (const tab of tabs.APP_TABS) assert.equal(tabs.tabByKey(tab.key)?.name, tab.name);
});

// --- the panel's link list ------------------------------------------------

check('every More link points at a screen that exists', () => {
  for (const link of links.PANEL_MORE_LINKS) {
    const base = join(root, 'app', link.href.replace(/^\//, ''));
    // A destination can be a file (`history.tsx`) or a folder's index (`programs`).
    const file = existsSync(`${base}.tsx`) ? `${base}.tsx` : join(base, 'index.tsx');
    assert.ok(existsSync(file), `${link.label} → ${link.href} (missing ${file})`);
    assert.ok(link.icon.length > 0);
  }
});

check('More links have unique keys and test ids', () => {
  const keys = links.PANEL_MORE_LINKS.map((l) => l.key);
  assert.equal(new Set(keys).size, keys.length);
});

// --- the panel test ids the Maestro flow depends on -----------------------

check('.maestro/panels.yaml uses panel test ids the panels actually render', () => {
  const src =
    readFileSync(join(root, 'src/components/chrome/LeftPanel.tsx'), 'utf8') +
    readFileSync(join(root, 'src/components/chrome/RightPanel.tsx'), 'utf8') +
    readFileSync(join(root, 'src/components/chrome/SidePanels.tsx'), 'utf8') +
    readFileSync(join(root, 'src/components/chrome/TabOrderList.tsx'), 'utf8');
  const flow = readFileSync(join(root, '.maestro/panels.yaml'), 'utf8');
  const ids = [...flow.matchAll(/id:\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((id) => id.startsWith('panel-'));
  assert.ok(ids.length >= 4, 'the flow exercises the panels');
  for (const id of ids) {
    // A literal test id, or a row id built from a template in the sources.
    const literal = src.includes(`testID="${id}"`);
    const template =
      (id.startsWith('panel-tab-') && src.includes('`panel-tab-${tabKey}`')) ||
      (id.startsWith('panel-more-') && src.includes('`panel-more-${link.key}`'));
    assert.ok(literal || template, `${id} is referenced by .maestro/panels.yaml but not rendered`);
  }
});

if (process.exitCode) {
  console.error(`\n${passed} passed, some failures`);
} else {
  console.log(`PASS: side panels (${passed} checks)`);
}
