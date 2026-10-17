/**
 * Foundational-list candidate matcher (one-off research tool, kept for the
 * next time the owner edits the foundational list).
 *
 * Reads the shipped KB snapshot (assets/kb/snapshot/bundle.json) and, for each
 * name in the owner's ordered list, prints the best-scoring exercise
 * candidates — id, live/deprecated, equipment, movement pattern. It only
 * suggests: the ids that actually ship live in src/lib/foundational.ts.
 *
 * Usage: node scripts/foundational-candidates.mjs [--all]
 *   --all  print 8 candidates per name instead of 4
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = JSON.parse(readFileSync(join(root, 'assets/kb/snapshot/bundle.json'), 'utf8'));
const exercises = bundle.exercises;

/** The owner's ordered list, verbatim. */
const DESIRED = [
  'Barbell Back Squat', 'Front Squat', 'Deadlift', 'Romanian Deadlift', 'Bench Press',
  'Incline Dumbbell Press', 'Overhead Shoulder Press', 'Pull-Ups', 'Chin-Ups',
  'Barbell Bent-Over Row', 'Goblet Squat', 'Walking Lunges', 'Bulgarian Split Squat',
  'Leg Press', 'Leg Curl', 'Leg Extension', 'Hip Thrust', 'Glute Bridge',
  'Standing Calf Raises', 'Step-Ups', 'Push-Ups', 'Lat Pulldown', 'Seated Cable Row',
  'Dumbbell Chest Press', 'Dumbbell Lateral Raises', 'Face Pulls', 'Biceps Curls',
  'Triceps Pushdowns', 'Dips', 'Reverse Flyes', 'Plank', 'Side Plank', 'Dead Bug',
  'Bird Dog', 'Hanging Knee Raises', 'Cable Woodchops', 'Pallof Press',
  'Back Extensions', "Farmer's Carry", 'Kettlebell Swings', 'Treadmill Walking',
  'Running or Jogging', 'Stationary Cycling', 'Outdoor Cycling', 'Rowing Machine',
  'Elliptical Trainer', 'Stair Climber', 'Jump Rope', 'Burpees', 'Mountain Climbers',
];

const STOP = new Set(['the', 'a', 'and', 'or', 'with', 'to']);
/** Word forms the crude rules miss: short plurals and verb → KB noun. */
const WORD_ALIAS = { ups: 'up', running: 'run', jogging: 'jog' };

/** lowercase, punctuation → spaces, crude singularisation, stopword removal. */
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map((w) => WORD_ALIAS[w] ?? (w.length > 3 ? w.replace(/s$/, '') : w))
    .join(' ');
}

const norm = (s) => normalize(s);
const tokens = (s) => (norm(s) ? norm(s).split(' ') : []);

const prepared = exercises.map((ex) => ({
  ex,
  name: norm(ex.name),
  alias: (ex.aliases ?? []).map(norm),
  toks: new Set(tokens(ex.name)),
  aliasToks: (ex.aliases ?? []).map((a) => new Set(tokens(a))),
}));

function score(want, cand) {
  const w = norm(want);
  const wToks = new Set(tokens(want));
  let s = 0;
  if (cand.name === w) s = 100;
  else if (cand.alias.includes(w)) s = 95;
  else {
    let best = 0;
    for (const a of cand.aliasToks) {
      const inter = [...wToks].filter((t) => a.has(t)).length;
      if (inter === wToks.size && inter === a.size) best = Math.max(best, 90);
    }
    if (s === 0) s = best;
  }
  if (s === 0) {
    const inter = [...wToks].filter((t) => cand.toks.has(t)).length;
    const union = new Set([...wToks, ...cand.toks]).size;
    s = (inter / union) * 60;
    // exact substring of the full phrase either way
    if (cand.name.includes(w) || w.includes(cand.name)) s += 25;
  }
  // Prefer live entries and the plain/barbell standard variant.
  if (cand.ex.deprecated) s -= 40;
  if (/\b(barbell|standard)\b/.test(cand.name)) s += 3;
  if (/\b(smith|machine|single|one|alternating|deficit|pause|tempo|band|seated|standing|kneeling)\b/.test(cand.name)) s -= 2;
  return Math.round(s * 10) / 10;
}

/* --pattern <p> / --equipment <e>: list exercises by movement pattern or equipment. */
const patternIdx = process.argv.indexOf('--pattern');
const equipIdx = process.argv.indexOf('--equipment');
if (patternIdx !== -1 || equipIdx !== -1) {
  const field = patternIdx !== -1 ? 'movementPattern' : 'equipment';
  const want = (process.argv[(patternIdx !== -1 ? patternIdx : equipIdx) + 1] ?? '').toLowerCase();
  for (const ex of exercises) {
    const v = field === 'equipment' ? (ex.equipment ?? []).map((e) => e.toLowerCase()) : [String(ex[field]).toLowerCase()];
    if (v.includes(want)) {
      console.log(`${ex.id.padEnd(38)} ${ex.deprecated ? 'DEPRECATED ' : ''}${ex.name}  [${(ex.equipment ?? []).join('/')}]`);
    }
  }
  process.exit(0);
}

/* --grep <term>: print every exercise whose name/aliases/id contain the term. */
const grepIdx = process.argv.indexOf('--grep');
if (grepIdx !== -1) {
  const term = (process.argv[grepIdx + 1] ?? '').toLowerCase();
  for (const ex of exercises) {
    const hay = [ex.id, ex.name, ...(ex.aliases ?? [])].join(' | ').toLowerCase();
    if (hay.includes(term)) {
      console.log(
        `${ex.id.padEnd(38)} ${ex.deprecated ? 'DEPRECATED ' : ''}${ex.name}  [${(ex.equipment ?? []).join('/')}; ${(ex.muscles?.primary ?? []).join('/')}; ${ex.movementPattern}]  aliases: ${(ex.aliases ?? []).join(', ')}`,
      );
    }
  }
  process.exit(0);
}

const LIMIT = process.argv.includes('--all') ? 8 : 4;
const live = exercises.filter((e) => !e.deprecated).length;
console.log(`bundle ${bundle.bundleVersion}: ${exercises.length} exercises (${live} live)\n`);

const unmatched = [];
for (const want of DESIRED) {
  const ranked = prepared
    .map((c) => ({ c, s: score(want, c) }))
    .filter((r) => r.s >= 30)
    .sort((a, b) => b.s - a.s)
    .slice(0, LIMIT);
  console.log(`${want}`);
  if (ranked.length === 0) {
    console.log('  (no candidate above threshold)');
    unmatched.push(want);
  }
  for (const { c, s } of ranked) {
    const ex = c.ex;
    const eq = (ex.equipment ?? []).join('/');
    const prim = (ex.muscles?.primary ?? []).join('/');
    console.log(
      `  ${String(s).padStart(5)}  ${ex.id.padEnd(38)} ${ex.deprecated ? 'DEPRECATED ' : ''}${ex.name}  [${eq}; ${prim}; ${ex.movementPattern}]`,
    );
  }
}
console.log(`\nnames with no candidate: ${unmatched.length ? unmatched.join(', ') : 'none'}`);
