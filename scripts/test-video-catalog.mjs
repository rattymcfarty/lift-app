/**
 * Published-video catalogue — filename parsing, exercise-name matching, versions.
 *
 * The app lists the public GitHub demo folder at runtime and matches published
 * MP4s to the guide's exercise by display name. This test pins the naming
 * conventions the video agent uses and the match rules (equipment suffixes,
 * aliases, plurals, versions) so a badly named file fails here, not on a phone.
 *
 * Usage: node scripts/test-video-catalog.mjs   (npm run test:video-catalog)
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'video-catalog-')), 'videoCatalog.mjs');

await build({
  entryPoints: [join(root, 'src/kb/videoCatalog.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const catalog = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => {
  assert.ok(c, m);
  n++;
};
const eq = (a, b, m) => {
  assert.deepEqual(a, b, m);
  n++;
};

/* ---- normalization ---- */
eq(catalog.normalizeDemoName('Dumbbell Bench Press (Dumbbell)'), 'dumbbellbenchpress', 'display equipment is stripped');
eq(catalog.normalizeDemoName('Dumbbell Bench Press - Dumbbell'), 'dumbbellbenchpress', 'file equipment is stripped');
eq(catalog.normalizeDemoName('Bench Press - Powerlifting (Barbell)'), 'benchpresspowerlifting', 'Powerlifting is part of the name');
eq(catalog.normalizeDemoName('Pull-Up (Bodyweight)'), 'pullup', 'bodyweight is stripped');
eq(catalog.normalizeDemoName('  '), '', 'empty names normalize to empty');

/* ---- version parsing ---- */
const url = 'https://raw.githubusercontent.com/rattymcfarty/lift-app/main/assets/exercises/demos/';
const parse = (file) => catalog.parsePublishedVideo(file, url + encodeURIComponent(file), 500);
eq(parse('Dumbbell Bench Press - Dumbbell.mp4').version, 1, 'no suffix is version 1');
eq(parse('Dumbbell Bench Press - Dumbbell-2.mp4').version, 2, 'trailing -2 is version 2');
eq(parse('Dumbbell Bench Press - Dumbbell__2.mp4').version, 2, '__2 is version 2');
eq(parse('Dumbbell Bench Press - Dumbbell v2.mp4').version, 2, 'v2 is version 2');
eq(parse('Dumbbell Bench Press - Dumbbell (2).mp4').version, 2, '(2) is version 2');
eq(parse('Dumbbell Bench Press - Dumbbell-2.mp4').key, 'dumbbellbenchpress', 'version is removed from the key');
eq(parse('Dumbbell Bench Press - Dumbbell-2.mp4').url, url + encodeURIComponent('Dumbbell Bench Press - Dumbbell-2.mp4'), 'URL survives parsing');
eq(parse('notes.txt'), null, 'non-MP4 is ignored');
eq(parse('.mp4'), null, 'empty MP4 name is ignored');

/* ---- exercise matching ---- */
const display = 'Dumbbell Bench Press (Dumbbell)';
const videos = [
  parse('Dumbbell Bench Press - Dumbbell.mp4'),
  parse('Dumbbell Bench Press - Dumbbell-2.mp4'),
  parse('Dumbbell Chest Press - Dumbbell.mp4'),
  parse('Bench Press - Powerlifting.mp4'),
  parse('Barbell Back Squat.mp4'),
  parse('Pull-Ups.mp4'),
  parse('Leg Extension.mp4'),
  parse('RDL.mp4'),
  parse('Barbell Squat - Barbell.mp4'),
];
eq(catalog.matchPublishedVideos(videos, display, 'dumbbell-bench-press').map((v) => v.file), [
  'Dumbbell Bench Press - Dumbbell.mp4',
  'Dumbbell Chest Press - Dumbbell.mp4',
  'Dumbbell Bench Press - Dumbbell-2.mp4',
], 'matches the display name and the Dumbbell Chest Press alias, versions sorted');
eq(catalog.matchPublishedVideos(videos, display, 'dumbbell-bench-press').map((v) => v.version), [1, 1, 2], 'versions are parsed');
eq(catalog.matchPublishedVideos(videos, 'Bench Press - Powerlifting (Barbell)', 'bench-press-powerlifting').map((v) => v.file), ['Bench Press - Powerlifting.mp4'], 'bench press matches');
eq(catalog.matchPublishedVideos(videos, 'Barbell Squat (Barbell)', 'barbell-squat').map((v) => v.file), ['Barbell Back Squat.mp4', 'Barbell Squat - Barbell.mp4'], 'Barbell Back Squat and Barbell Squat alias');
eq(catalog.matchPublishedVideos(videos, 'Pull-Up (Bodyweight)', 'pull-up-bodyweight').map((v) => v.file), ['Pull-Ups.mp4'], 'plural Pull-Ups matches');
eq(catalog.matchPublishedVideos(videos, 'Leg Extensions (Machine)', 'leg-extensions').map((v) => v.file), ['Leg Extension.mp4'], 'singular/plural matches');
eq(catalog.matchPublishedVideos(videos, 'Romanian Deadlift (Barbell)', 'romanian-deadlift').map((v) => v.file), ['RDL.mp4'], 'RDL alias matches');
eq(catalog.matchPublishedVideos(videos, 'Bicep Curl (Barbell)', 'barbell-curl'), [], 'unrelated exercise does not match');
eq(catalog.matchPublishedVideos([], display, 'dumbbell-bench-press'), [], 'empty catalogue is empty');
eq(catalog.matchPublishedVideos([parse('Dumbbell Bench Press - Dumbbell-2.mp4'), parse('Dumbbell Bench Press - Dumbbell-2.mp4')], display).length, 1, 'duplicate files are deduped');

/* ---- exercise keys ---- */
ok(catalog.demoMatchKeys(display, 'dumbbell-bench-press').has('dumbbellbenchpress'), 'display key');
ok(catalog.demoMatchKeys(display, 'dumbbell-bench-press').has('dumbbellbenchpresss') === false, 'no bogus plural');
ok(catalog.demoMatchKeys('Pull-Up (Bodyweight)', 'pull-up-bodyweight').has('pullup'), 'pull-up key');
ok(catalog.demoMatchKeys('Pull-Up (Bodyweight)', 'pull-up-bodyweight').has('pullups'), 'pull-up plural');
ok(catalog.demoMatchKeys('Barbell Squat (Barbell)', 'barbell-squat').has('barbellbacksquat'), 'back squat alias');
ok(catalog.demoMatchKeys('Overhead Press (Dumbbell)', 'overhead-press').has('shoulderpress'), 'shoulder press alias');

console.log(`test:video-catalog — ${n} assertions passed`);
