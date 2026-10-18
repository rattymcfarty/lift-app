// Unit tests for the shared bottom-sheet contract (src/components/ui/sheetModel.ts):
// the corner radii, the test ids the Maestro flows tap, and the pull-down
// thresholds. The glass look itself is verified on the emulator
// (.maestro/exercise-menu.yaml, workout-flow.yaml, program-builder.yaml).
//
// The model module is bundled with esbuild (same approach as test-panel.mjs) so
// a plain Node run exercises the exact source.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Bundle a repo module to a temp ESM file and import it. */
async function loadModule(relPath, name) {
  const out = join(mkdtempSync(join(tmpdir(), 'sheet-')), `${name}.mjs`);
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

const model = await loadModule('src/components/ui/sheetModel.ts', 'sheetModel');

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

// --- corners --------------------------------------------------------------

check('a sheet rounds its top corners and squares its bottom', () => {
  assert.deepEqual(model.sheetCorners(24), {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  });
});

check('corners follow the radius token', () => {
  assert.equal(model.sheetCorners(8).borderTopLeftRadius, 8);
  assert.equal(model.sheetCorners(0).borderTopRightRadius, 0);
});

// --- test ids -------------------------------------------------------------

check('the close id is the surface id plus -close', () => {
  assert.deepEqual(model.sheetIds('action-sheet'), { surface: 'action-sheet', close: 'action-sheet-close' });
});

check('a sheet with no test id still has a close id', () => {
  const ids = model.sheetIds();
  assert.equal(ids.surface, undefined);
  assert.equal(ids.close, 'sheet-close');
});

// --- the pull-down gesture ------------------------------------------------

check('a small pull is not a drag', () => {
  assert.equal(model.shouldStartDrag(0, model.SHEET_DRAG_START), false);
  assert.equal(model.shouldStartDrag(0, model.SHEET_DRAG_START + 1), true);
});

check('sideways and upward moves are left to the list', () => {
  assert.equal(model.shouldStartDrag(40, 20), false, 'a sideways swipe stays with the list');
  assert.equal(model.shouldStartDrag(0, -40), false, 'dragging up does not pull the sheet down');
});

check('the sheet dismisses only past the threshold', () => {
  assert.equal(model.dragDismisses(model.SHEET_DRAG_DISMISS), false);
  assert.equal(model.dragDismisses(model.SHEET_DRAG_DISMISS + 1), true);
  assert.equal(model.dragDismisses(-50), false);
});

check('the dismiss threshold is overridable', () => {
  assert.equal(model.dragDismisses(30, 20), true);
  assert.equal(model.dragDismisses(30, 60), false);
});

// --- the Maestro flows depend on these ids --------------------------------

check('every sheet close id in .maestro is the id sheetIds would build', () => {
  const flows = readdirSync(join(root, '.maestro')).filter((f) => f.endsWith('.yaml'));
  let checked = 0;
  for (const file of flows) {
    const text = readFileSync(join(root, '.maestro', file), 'utf8');
    for (const m of text.matchAll(/id:\s*"([^"]+)-close"/g)) {
      const surface = m[1];
      if (surface.startsWith('panel-')) continue; // the side panels, not sheets
      if (surface.startsWith('topbar-')) continue;
      assert.equal(model.sheetIds(surface).close, `${surface}-close`, `${file}: ${surface}-close`);
      checked += 1;
    }
  }
  assert.ok(checked > 0, 'at least one sheet close id is exercised');
});

// --- one header for every sheet -------------------------------------------

check('the shared sheet primitive renders the shared header, over glass', () => {
  const src = readFileSync(join(root, 'src/components/ui', 'BottomSheet.tsx'), 'utf8');
  assert.ok(src.includes('SheetHeader'), 'BottomSheet uses the shared SheetHeader');
  assert.ok(src.includes('Glass'), 'BottomSheet is glass');
});

check('the option picker is the same sheet, not a copy of it', () => {
  const src = readFileSync(join(root, 'src/components/ui', 'OptionSheet.tsx'), 'utf8');
  assert.ok(src.includes('BottomSheet'), 'OptionSheet renders the shared BottomSheet');
  assert.ok(!src.includes('Modal'), 'OptionSheet no longer hand-rolls a Modal');
});

if (process.exitCode) {
  console.error(`\n${passed} passed, some failures`);
} else {
  console.log(`PASS: bottom sheets (${passed} checks)`);
}
