/**
 * Unit tests for the exercise-filter panel state (`src/components/workout/filterPanel.ts`).
 *
 * The owner reported that the chevron lied: with the muscle grid open, the
 * equipment chip still pointed "open". Two invariants fix it, and both are pure:
 *
 *   1. at most one grid is open, so a caret always describes the grid under it;
 *   2. ▲ means open (tap closes), ▼ means closed (tap opens) — the convention the
 *      composer picker next door already used.
 *
 * Usage: node scripts/test-filter-panel.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'filter-panel-')), 'filterPanel.mjs');
await build({
  entryPoints: [join(root, 'src/components/workout/filterPanel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const { toggleFilterPanel, panelCaret } = await import(pathToFileURL(out).href);

let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* ---- toggling ------------------------------------------------------------- */

eq(toggleFilterPanel(null, 'muscle'), 'muscle', 'tapping Muscles opens the muscle grid');
eq(toggleFilterPanel(null, 'equipment'), 'equipment', 'tapping Equipment opens the equipment grid');
eq(toggleFilterPanel('muscle', 'muscle'), null, 'tapping the open chip closes it');
eq(toggleFilterPanel('equipment', 'equipment'), null, 'same for equipment');
eq(toggleFilterPanel('muscle', 'equipment'), 'equipment', 'opening one closes the other');
eq(toggleFilterPanel('equipment', 'muscle'), 'muscle', 'and back again');

// The invariant: whatever you tap, never two at once and never a stale panel.
for (const start of [null, 'muscle', 'equipment']) {
  for (const tap of ['muscle', 'equipment']) {
    const next = toggleFilterPanel(start, tap);
    eq(next, start === tap ? null : tap, `${start} + ${tap} → ${next}`);
  }
}

/* ---- the caret ------------------------------------------------------------ */

eq(panelCaret(true), '▴', 'an open grid shows ▲ — the tap closes it');
eq(panelCaret(false), '▾', 'a closed grid shows ▼ — the tap opens it');
assert.notEqual(panelCaret(true), panelCaret(false), 'the two states are distinguishable');

console.log(`test:filter-panel — ${n} assertions passed`);
