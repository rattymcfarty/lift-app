/**
 * Exercise demo clips — the contract, the registry and the guide wiring.
 *
 * The clips are bundled assets, so nothing checks them at runtime until a user
 * opens a guide. This test catches the silent failures early:
 *
 *   1. the generated registry matches the MP4s on disk and every id is a real
 *      KB exercise id (a typo would leave a clip unreachable);
 *   2. every clip is the authored 720² / 24 fps / 3 s / H.264 / yuv420p /
 *      silent / ≤ 500 KB file (the size cap keeps the app bundle sane);
 *   3. the guide mounts the component and the component keeps the platform
 *      behaviour (muted autoplay, no controls, cover crop, rounded tile,
 *      pause on blur/background, Reduce Motion fallback).
 *
 * Usage: node scripts/test-exercise-demo.mjs   (npm run test:exercise-demo)
 */
import { build } from 'esbuild';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const demosDir = join(root, 'assets', 'exercises', 'demos');
const out = join(mkdtempSync(join(tmpdir(), 'exercise-demo-')), 'exerciseDemo.mjs');

await build({
  entryPoints: [join(root, 'src/kb/exerciseDemo.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
  loader: { '.mp4': 'dataurl' },
});
const demo = await import(pathToFileURL(out).href);

let n = 0;
const ok = (c, m) => {
  assert.ok(c, m);
  n++;
};
const eq = (a, b, m) => {
  assert.deepEqual(a, b, m);
  n++;
};

/* ---- 1. the registry ---- */
eq(demo.DEMO_SPEC, { size: 720, fps: 24, seconds: 3, maxBytes: 500_000 }, 'the clip contract is the authored one');

const files = readdirSync(demosDir)
  .filter((f) => f.toLowerCase().endsWith('.mp4'))
  .sort();
const ids = files.map((f) => f.slice(0, -4));
eq(demo.bundledDemoIds(), ids, 'the generated registry matches the MP4s on disk');
ok(ids.includes('bench-press-powerlifting'), 'the bench press clip is bundled');
ok(demo.resolveExerciseDemo('bench-press-powerlifting'), 'the bench press resolves to an asset');
eq(demo.resolveExerciseDemo('barbell-squat'), null, 'an exercise without a clip resolves to null');
eq(demo.resolveExerciseDemo(null), null, 'a missing id resolves to null');
ok(!demo.hasExerciseDemo('barbell-squat'), 'hasExerciseDemo is false for a missing clip');
ok(demo.hasExerciseDemo('bench-press-powerlifting'), 'hasExerciseDemo is true for the bench press');

const bundle = JSON.parse(readFileSync(join(root, 'assets/kb/snapshot/bundle.json'), 'utf8'));
const kbIds = new Set(bundle.exercises.map((e) => e.id));
for (const id of ids) {
  ok(kbIds.has(id), `"${id}" is a real KB exercise id`);
}

/* ---- 2. the clip contract ---- */
for (const f of files) {
  const file = join(demosDir, f);
  const bytes = statSync(file).size;
  ok(bytes > 0, `${f} is not empty`);
  ok(bytes <= demo.DEMO_SPEC.maxBytes, `${f} is ${bytes} bytes, under the ${demo.DEMO_SPEC.maxBytes} cap`);

  const probe = spawnSync(
    'ffprobe',
    [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,nb_frames:format=duration',
      '-of', 'json',
      file,
    ],
    { encoding: 'utf8' },
  );
  if (probe.error?.code === 'ENOENT') {
    console.log('ffprobe not installed — video spec checks skipped');
    continue;
  }
  ok(probe.status === 0, `${f} probes cleanly`);
  const info = JSON.parse(probe.stdout);
  const video = (info.streams ?? []).find((s) => s.codec_type === 'video');
  const audio = (info.streams ?? []).filter((s) => s.codec_type === 'audio');
  ok(video, `${f} has a video stream`);
  eq(audio, [], `${f} is silent (no audio stream)`);
  eq(video.codec_name, 'h264', `${f} is H.264`);
  eq(video.width, demo.DEMO_SPEC.size, `${f} is ${demo.DEMO_SPEC.size} px wide`);
  eq(video.height, demo.DEMO_SPEC.size, `${f} is ${demo.DEMO_SPEC.size} px tall`);
  eq(video.pix_fmt, 'yuv420p', `${f} is yuv420p`);
  eq(video.r_frame_rate, `${demo.DEMO_SPEC.fps}/1`, `${f} is ${demo.DEMO_SPEC.fps} fps`);
  eq(Number(video.nb_frames), demo.DEMO_SPEC.fps * demo.DEMO_SPEC.seconds, `${f} has ${demo.DEMO_SPEC.fps * demo.DEMO_SPEC.seconds} frames`);
  ok(
    Math.abs(Number(info.format?.duration) - demo.DEMO_SPEC.seconds) < 0.01,
    `${f} runs ${demo.DEMO_SPEC.seconds} s`,
  );
}

/* ---- 3. the guide + component wiring ---- */
const guide = readFileSync(join(root, 'app', 'exercises', '[id].tsx'), 'utf8');
ok(/<ExerciseDemo/.test(guide), 'the exercise guide mounts ExerciseDemo');
ok(/exerciseId=\{exercise\.kbId \?\? exercise\.id\}/.test(guide), 'the guide passes the permanent KB id');

const component = readFileSync(join(root, 'src', 'components', 'exercise', 'ExerciseDemo.tsx'), 'utf8');
ok(/p\.loop = true/.test(component), 'the loop repeats');
ok(/p\.muted = true/.test(component), 'the loop is muted (iOS autoplay requires it)');
ok(/nativeControls=\{false\}/.test(component), 'the loop shows no native controls');
ok(/contentFit="cover"/.test(component), 'the clip cover-crops the square tile');
ok(/surfaceType="textureView"/.test(component), 'Android clips the video to the rounded tile');
ok(/fullscreenOptions=\{\{ enable: false \}\}/.test(component), 'the tile cannot open fullscreen');
ok(/useFocusEffect/.test(component), 'the loop pauses when the screen loses focus');
ok(/AppState\.addEventListener/.test(component), 'the loop pauses when the app backgrounds');
ok(/reduceMotionChanged/.test(component), 'Reduce Motion is observed');
ok(/exercise-demo-placeholder/.test(component), 'a placeholder exists for exercises without a clip');
ok(/Movement demo coming soon/.test(component), 'the placeholder says a demo is coming');

const flow = readFileSync(join(root, '.maestro', 'exercise-demo.yaml'), 'utf8');
ok(/id: "exercise-demo"/.test(flow), 'the Maestro flow checks the clip tile');
ok(/id: "exercise-demo-placeholder"/.test(flow), 'the Maestro flow checks the placeholder');

console.log(`test:exercise-demo — ${n} assertions passed`);
