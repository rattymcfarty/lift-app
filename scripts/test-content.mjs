/**
 * Unit tests for the explainer pages (`src/content/infoPages.ts`).
 *
 * These pages are the app's answers to its own vocabulary, so the things worth
 * pinning are structural, not typographic:
 *
 *   1. every page is reachable (slug → route → an entry point in the UI);
 *   2. the blocks are well-formed (no empty text, no unknown kind);
 *   3. the Plan/Program page actually does its job — defines both sides, shows
 *      both examples, carries the one-line rule and the interchangeability note,
 *      and uses LIFT's own vocabulary.
 *
 * Usage: node scripts/test-content.mjs
 */
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'content-')), 'infoPages.mjs');
await build({
  entryPoints: [join(root, 'src/content/infoPages.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const content = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const KINDS = ['heading', 'paragraph', 'bullets', 'pair', 'example', 'callout', 'note'];

/* ---- 1. shape ------------------------------------------------------------- */

ok(content.INFO_PAGES.length >= 1, 'there is at least one explainer page');
for (const page of content.INFO_PAGES) {
  ok(/^[a-z0-9-]+$/.test(page.slug), `${page.slug}: the slug is URL-safe`);
  ok(page.title.length > 2, `${page.slug}: has a title`);
  ok(page.subtitle.length > 2, `${page.slug}: has a subtitle`);
  ok(page.blocks.length >= 4, `${page.slug}: has real content`);
  for (const b of page.blocks) {
    ok(KINDS.includes(b.kind), `${page.slug}: ${b.kind} is a known block`);
    if (b.kind === 'bullets' || b.kind === 'example') {
      ok(b.items.length >= 2, `${page.slug}: ${b.kind} has at least two items`);
      b.items.forEach((i) => ok(i.trim().length > 0, `${page.slug}: no empty ${b.kind} item`));
    } else if (b.kind === 'pair') {
      ok(b.left.label.length > 0 && b.left.text.length > 0, `${page.slug}: pair.left is filled`);
      ok(b.right.label.length > 0 && b.right.text.length > 0, `${page.slug}: pair.right is filled`);
    } else {
      ok(b.text.trim().length > 0, `${page.slug}: no empty ${b.kind} text`);
    }
  }
}
eq(new Set(content.INFO_PAGES.map((p) => p.slug)).size, content.INFO_PAGES.length, 'slugs are unique');

const page = content.infoPage('plan-vs-program');
ok(page, 'the Plan/Program page is registered by slug');
eq(content.infoPage('nope'), undefined, 'an unknown slug resolves to nothing');
eq(page.slug, 'plan-vs-program', 'the slug matches the route the UI links to');

/* ---- 2. it does its job --------------------------------------------------- */

const kinds = page.blocks.map((b) => b.kind);
ok(kinds.includes('pair'), 'it defines the two words side by side');
const pair = page.blocks.find((b) => b.kind === 'pair');
eq([pair.left.label, pair.right.label], ['Plan', 'Program'], 'the pair is Plan vs Program');
ok(page.blocks.filter((b) => b.kind === 'example').length >= 2, 'it shows BOTH examples (the week and the program)');
ok(kinds.includes('callout'), 'it carries the one-line rule');
ok(kinds.includes('note'), 'it notes that the industry uses the words interchangeably');

const flat = page.blocks
  .map((b) => [b.text, b.title, ...(b.items ?? []), b.left?.text, b.right?.text].filter(Boolean).join(' '))
  .join(' ');
ok(/plan/i.test(flat) && /program/i.test(flat), 'both words appear');
ok(/progressive overload/i.test(flat), 'the program example covers progression');
ok(/12-week|12 week/i.test(flat), 'the program example is a 12-week structure');
// LIFT's own vocabulary (HANDOFF §4): Program = structure, Plan = schedule, Workout = a session.
ok(/Workout is one session/i.test(flat), 'it defines a Workout as one session of a plan');

/* ---- 3. reachability ------------------------------------------------------ */

// One explicit route file per page (test:panel checks the same invariant for
// every menu link, so a rename cannot leave a dead link).
for (const p of content.INFO_PAGES) {
  const file = `app/learn/${p.slug}.tsx`;
  ok(existsSync(join(root, file)), `${p.slug} has a route file (${file})`);
  const route = readFileSync(join(root, file), 'utf8');
  ok(route.includes(`slug="${p.slug}"`), `${file} renders that page by slug`);
}
const shell = readFileSync(join(root, 'src/components/content/InfoScreen.tsx'), 'utf8');
ok(/infoPage\(/.test(shell), 'the shell resolves the slug through the registry');
ok(/EmptyState/.test(shell), 'an unknown slug degrades to a friendly empty state');

// Every panel destination maps to a real route file.
const links = readFileSync(join(root, 'src/chrome/panelLinks.ts'), 'utf8');
const hrefs = [...links.matchAll(/href: '(\/[a-z0-9/-]+)'/g)].map((m) => m[1]);
ok(hrefs.length >= 5, 'the panel still has its More links');
for (const href of hrefs) {
  // A destination is a file (`app/history.tsx`) or a folder's index (`app/programs/index.tsx`).
  const base = `app${href}`;
  const file = existsSync(join(root, `${base}.tsx`)) ? `${base}.tsx` : `${base}/index.tsx`;
  ok(existsSync(join(root, file)), `${href} has a route file (${file})`);
}

// The Programs header is the visible entry point…
const programs = readFileSync(join(root, 'app/programs/index.tsx'), 'utf8');
ok(/testID="programs-learn"/.test(programs), 'the Programs header links to the page');
ok(/learn\/plan-vs-program/.test(programs), 'and points at this page');
// …and a flow opens it on a device.
const flow = readFileSync(join(root, '.maestro/learn.yaml'), 'utf8');
ok(/programs-learn/.test(flow), 'a Maestro flow opens the page from the Programs header');

console.log(`test:content — ${n} assertions passed`);
