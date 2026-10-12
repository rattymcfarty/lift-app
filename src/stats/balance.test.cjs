/**
 * Balance analytics unit tests (P4b) — run via scripts/test-stats.mjs.
 * Plain node asserts; no framework. TZ=America/New_York (see test-stats.mjs).
 */
const {
  canonicalMuscle,
  volumeByGroup,
  volumeByMuscleByWeek,
  analyzeBalance,
} = require('./balance.js');
const { cardioPillar, cardioWorkoutMinutes, strengthPillar, strengthSessions } = require('./pillars.js');

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) { passed++; }
  else { failed++; console.error(`FAIL: ${name}`); }
}
function eq(a, b, name) {
  ok(a === b, `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

// ---- helpers to build StatWorkout-shaped fixtures ----
function set(exerciseId, primaryMuscles, reps, weightKg, category = 'strength', durationSeconds = null) {
  return { exerciseId, exerciseName: exerciseId, primaryMuscles, reps, weightKg, completed: true, exerciseCategory: category, durationSeconds };
}
function workout(id, sets, dayOffset = 0) {
  const d = new Date(2026, 9, 5 + dayOffset, 18, 0, 0); // Oct 2026, local
  return { id, startedAt: d, endedAt: new Date(d.getTime() + 3600e3), sets };
}

// ---- canonicalMuscle ----
eq(canonicalMuscle('Chest'), 'chest', 'case-insensitive');
eq(canonicalMuscle('quads'), 'quadriceps', 'alias quads');
eq(canonicalMuscle('Latissimus Dorsi'), 'back', 'multi-word alias');
eq(canonicalMuscle('  BICEPS  '), 'biceps', 'trims whitespace');
eq(canonicalMuscle('mystery muscle'), 'other', 'unknown -> other');
eq(canonicalMuscle('neck'), 'other', 'neck not mapped (anatomically loose)');

// ---- volumeByGroup ----
{
  const w = workout('w1', [
    set('bench', ['chest', 'triceps'], 8, 60),   // 480 → chest + triceps
    set('squat', ['quadriceps'], 5, 100),        // 500 → quadriceps
    set('row', ['lats'], 10, 40),               // 400 → back (alias)
  ]);
  const m = volumeByGroup([w]);
  eq(m.get('chest'), 480, 'chest volume');
  eq(m.get('triceps'), 480, 'full volume credited per muscle');
  eq(m.get('quadriceps'), 500, 'quadriceps volume');
  eq(m.get('back'), 400, 'lats normalized to back');
  ok(!m.has('other'), 'no other bucket when muscles known');
}
{
  // unknown muscle + empty list
  const w = workout('w1', [
    set('weird', ['quantum core'], 10, 20),
    set('body', [], 10, null),
  ]);
  const m = volumeByGroup([w]);
  ok((m.get('other') ?? 0) > 0, 'unknown/empty -> other');
}

// ---- analyzeBalance: push/pull + upper/lower ----
{
  // 4+ workouts, push-heavy: chest/shoulders/triceps only
  const ws = [0, 1, 2, 3].map(i =>
    workout(`w${i}`, [
      set('bench', ['chest'], 8, 60),
      set('ohp', ['shoulders'], 8, 40),
    ], i),
  );
  const r = analyzeBalance(ws);
  eq(r.pushPull.ratio, null, 'all-push ratio is null (zero pull side)');
  ok(r.flags.some(f => f.kind === 'push_pull' && f.severity === 'watch'), 'push/pull flag raised');
  eq(r.upperLower.ratio, null, 'all-upper ratio is null (zero lower side)');
  ok(r.flags.some(f => f.kind === 'upper_lower'), 'upper/lower flag raised');
  ok(r.totalKg > 0, 'total classified volume');
  const sum = r.byGroup.filter(g => g.group !== 'other').reduce((a, g) => a + g.share, 0);
  ok(Math.abs(sum - 1) < 0.001, 'shares sum to 1');
}
{
  // balanced-ish: push + pull + legs across 4 workouts → no watch flags
  const ws = [0, 1, 2, 3].map(i =>
    workout(`w${i}`, [
      set('bench', ['chest'], 8, 60),
      set('row', ['back'], 8, 60),
      set('squat', ['quadriceps'], 5, 100),
    ], i),
  );
  const r = analyzeBalance(ws);
  ok(!r.flags.some(f => f.severity === 'watch'), 'balanced training raises no watch flags');
}
{
  // legs-only: watch flag (not "nice"), upper groups not hidden behind phantom flag
  const ws = [0, 1, 2, 3].map(i =>
    workout(`w${i}`, [set('squat', ['quadriceps'], 5, 100)], i),
  );
  const r = analyzeBalance(ws);
  ok(r.flags.some(f => f.kind === 'upper_lower' && f.severity === 'watch' && f.title.includes('No upper-body')), 'legs-only gets no-upper-body watch');
  ok(!r.flags.some(f => f.title.includes('Lower body leads')), 'legs-only NOT praised as nice');
  // chest-only: "No pulling at all" watch fires. Triceps (sibling chest
  // trained, zero triceps volume) DOES get its own neglected info flag —
  // the no-pull watch is about back/biceps, a different gap. This verifies
  // the flags don't incorrectly hide distinct gaps behind the watch.
  const ws2 = [0, 1, 2, 3].map(i =>
    workout(`c${i}`, [set('bench', ['chest'], 8, 60)], i),
  );
  const r2 = analyzeBalance(ws2);
  ok(r2.flags.some(f => f.title.includes('No pulling')), 'chest-only gets no-pull watch');
  ok(r2.flags.some(f => f.title.includes('Triceps') && f.title.includes("isn't trained")), 'triceps flagged as distinct gap (not hidden by no-pull watch)');
}
{
  // too little data → flags stay quiet
  const ws = [workout('w1', [set('bench', ['chest'], 8, 60)])];
  const r = analyzeBalance(ws);
  eq(r.flags.length, 0, 'flags quiet under 4 workouts');
  eq(r.workoutCount, 1, 'workoutCount tracked');
  eq(r.grandTotalKg, 480, 'grandTotalKg tracked');
}
{
  // pull-heavy (push completely untrained): ratio is null (no push sets at
  // all), and the "No pressing at all" watch carries the signal.
  const ws = [0, 1, 2, 3].map(i =>
    workout(`w${i}`, [set('row', ['back'], 10, 50), set('curl', ['biceps'], 10, 20)], i),
  );
  const r = analyzeBalance(ws);
  eq(r.pushPull.ratio, null, 'pull-only ratio is null (push has no sets)');
  eq(r.pushPull.basis, 'none', 'pull-only basis is none');
  ok(r.flags.some(f => f.kind === 'push_pull' && f.title.includes('No pressing')), 'no-pressing watch raised');
}
{
  // neglected group: tiny calves share (<3%)
  const ws = [0, 1, 2, 3].map(i =>
    workout(`w${i}`, [
      set('bench', ['chest'], 10, 100),   // 1000
      set('calfraise', ['calves'], 10, 2), // 20 → 1.9% share
    ], i),
  );
  const r = analyzeBalance(ws);
  ok(r.flags.some(f => f.kind === 'neglected' && f.title.includes('Calves')), 'neglected calves flagged');
}
{
  // zero-volume hamstrings with quad work → flagged (sibling logic);
  // zero-volume traps with no pull work → NOT flagged (noPullWatch covers it,
  // and traps has no SIBLINGS entry so it can never be sibling-flagged)
  const ws = [0, 1, 2, 3].map(i =>
    workout(`w${i}`, [
      set('squat', ['quadriceps'], 5, 100),
      set('bench', ['chest'], 8, 60),
    ], i),
  );
  const r = analyzeBalance(ws);
  ok(r.flags.some(f => f.kind === 'neglected' && f.title.includes('Hamstrings')), 'zero hamstrings with quad work flagged');
  ok(r.flags.some(f => f.title.includes('No pulling at all')), 'no-pull watch fires');
  ok(!r.flags.some(f => f.title.includes('Traps')), 'traps never flagged (no siblings, covered by no-pull watch)');
}
{
  // empty input → zeros, no crash
  const r = analyzeBalance([]);
  eq(r.totalKg, 0, 'empty total is 0');
  eq(r.flags.length, 0, 'empty flags');
  eq(r.pushPull.ratio, null, 'empty push/pull ratio null');
}

// ---- volumeByMuscleByWeek ----
{
  const pts = volumeByMuscleByWeek([], 4);
  eq(pts.length, 4, 'always returns requested weeks');
  ok(pts.every(p => p.byGroup.size === 0), 'empty workouts → empty groups');
  ok(pts[0].weekStart <= pts[3].weekStart, 'oldest first');
}
{
  // workout logged on the reference date lands in the current week bucket
  const now = new Date(2026, 9, 12, 12, 0, 0); // Mon Oct 12 2026, noon local
  const w = {
    id: 'w-today',
    startedAt: now,
    endedAt: new Date(now.getTime() + 3600e3),
    sets: [set('bench', ['chest'], 10, 100)],
  };
  const pts = volumeByMuscleByWeek([w], 4, now);
  const last = pts[3];
  eq(last.byGroup.get('chest'), 1000, 'this week chest volume');
  ok(pts[0].byGroup.size === 0 && pts[1].byGroup.size === 0, 'older weeks empty');
}

// ---- pillars ----
{
  const s = strengthPillar(0);
  eq(s.state, 'idle', 'strength 0 → idle');
  eq(strengthPillar(1).state, 'progress', 'strength 1 → progress');
  eq(strengthPillar(2).state, 'met', 'strength 2 → met');
  eq(strengthPillar(5).state, 'met', 'strength 5 → met');
  eq(strengthPillar(1).progress, 0.5, 'strength progress 0.5');
}
{
  const c = cardioPillar(0);
  eq(c.state, 'idle', 'cardio 0 → idle');
  eq(cardioPillar(75).state, 'progress', 'cardio 75 → progress');
  eq(cardioPillar(150).state, 'met', 'cardio 150 → met');
  eq(cardioPillar(200).state, 'met', 'cardio 200 → met (capped)');
  eq(cardioPillar(200).progress, 1, 'cardio progress capped at 1');
}
// ---- strengthSessions / cardioWorkoutMinutes (blocker fix) ----
{
  // Blank sets (no reps, no weight) don't count as strength sessions.
  const blank = { ...set('bench', ['chest'], null, null), completed: true };
  eq(strengthSessions([workout('b1', [blank])]), 0, 'blank set is not a strength session');
  // Zero reps don't count either.
  const zeroReps = set('bench', ['chest'], 0, 60);
  eq(strengthSessions([workout('b2', [zeroReps])]), 0, 'zero-rep set is not a strength session');
}
{
  // Bodyweight-only training (no kg volume at all) still gets flags.
  const w = [
    workout('w1', [set('pushup', ['chest'], 20, null), set('pushup', ['chest'], 20, null)]),
    workout('w2', [set('pushup', ['chest'], 20, null), set('pushup', ['chest'], 20, null)]),
    workout('w3', [set('pushup', ['chest'], 20, null), set('pushup', ['chest'], 20, null)]),
    workout('w4', [set('pushup', ['chest'], 20, null), set('pushup', ['chest'], 20, null)]),
  ];
  const r = analyzeBalance(w);
  eq(r.flagsEvaluated, true, 'bodyweight-only flags are evaluated (no kg volume needed)');
  ok(r.flags.some((f) => f.title.includes('No pulling')), 'bodyweight push-only gets no-pull watch');
}
{
  // Mobility/balance sessions don't count either — strength means strength.
  const cardioOnly = workout('c1', [set('treadmill', ['other'], 1, null, 'cardio', 1800)]);
  const yoga = workout('m1', [set('yoga', ['other'], 1, null, 'mobility')]);
  eq(strengthSessions([yoga]), 0, 'mobility-only workout is not a strength session');
  // Strength workout counts.
  const lifting = workout('s1', [set('bench', ['chest'], 8, 60)]);
  eq(strengthSessions([cardioOnly, yoga, lifting]), 1, 'mixed week counts only the lifting day');
  // Incomplete sets don't count.
  const skipped = { ...set('bench', ['chest'], 8, 60), completed: false };
  eq(strengthSessions([workout('s2', [skipped])]), 0, 'incomplete sets do not count');
}
{
  // Cardio workout durations reach the cardio pillar.
  const cardioOnly = workout('c1', [
    set('treadmill', ['other'], 1, null, 'cardio', 1800),
    set('bike', ['other'], 1, null, 'cardio', 600),
  ]);
  eq(cardioWorkoutMinutes([cardioOnly]), 40, 'cardio set durations summed to minutes (rounded)');
  const lifting = workout('s1', [set('bench', ['chest'], 8, 60)]);
  eq(cardioWorkoutMinutes([lifting]), 0, 'strength sets contribute no cardio minutes');
}
// ---- bodyweight sets count in balance (blocker fix) ----
{
  // Weighted bench + bodyweight pull-ups: pull-ups count as pulling.
  const w = [
    workout('w1', [set('bench', ['chest', 'triceps'], 8, 60)]),
    workout('w2', [set('bench', ['chest', 'triceps'], 8, 60)]),
    workout('w3', [set('pullup', ['back', 'biceps'], 8, null)]),
    workout('w4', [set('pullup', ['back', 'biceps'], 8, null)]),
  ];
  const r = analyzeBalance(w);
  const kinds = r.flags.map((f) => f.title);
  ok(!kinds.includes('No pulling at all'), 'bodyweight pull-ups suppress "No pulling at all"');
  // Push/pull ratio falls back to set counts when pull side has no volume.
  ok(r.pushPull.ratio !== null, 'push/pull ratio falls back to set counts for bodyweight side');
  eq(r.pushPull.basis, 'sets', 'push/pull basis is sets when a side is bodyweight-only');
}
{
  // Bodyweight push-ups vs weighted rows: the fallback works on the A side
  // too — no false "Pull volume outweighs push" watch.
  const w = [
    workout('w1', [set('pushup', ['chest', 'triceps'], 20, null)]),
    workout('w2', [set('pushup', ['chest', 'triceps'], 20, null)]),
    workout('w3', [set('row', ['back', 'biceps'], 10, 50)]),
    workout('w4', [set('row', ['back', 'biceps'], 10, 50)]),
  ];
  const r = analyzeBalance(w);
  ok(r.pushPull.ratio !== null, 'push/pull ratio defined for bodyweight-push vs weighted-pull');
  eq(r.pushPull.basis, 'sets', 'basis is sets');
  ok(!r.flags.some((f) => f.title.includes('Pull volume outweighs push')), 'no false pull-dominance watch for push-ups');
}
{
  // 3 bench sets at 5x100kg (1500kg) vs 2 pull-up sets + 1 row at 10x20kg
  // (200kg): volume ratio 7.5, set ratio 1.0. They differ by 7.5x, so the
  // set ratio wins — no false "Push volume outweighs pull".
  const w = [
    workout('w1', [set('bench', ['chest'], 5, 100), set('bench', ['chest'], 5, 100), set('bench', ['chest'], 5, 100)]),
    workout('w2', [set('pullup', ['back'], 10, null), set('pullup', ['back'], 10, null), set('row', ['back'], 10, 20)]),
    workout('w3', [set('bench', ['chest'], 5, 100)]),
    workout('w4', [set('pullup', ['back'], 10, null)]),
  ];
  const r = analyzeBalance(w);
  // Volume ratio would be 1500/200=7.5, set ratio is 4/4=1.0 → differ by 7.5x.
  eq(r.pushPull.basis, 'sets', 'lopsided volume with balanced sets uses set ratio');
  ok(!r.flags.some((f) => f.title.includes('Push volume outweighs pull')), 'no false push-dominance for balanced sets');
}
{
  // flagsEvaluated: 2 lifting + 2 cardio-only sessions → analysis never ran,
  // so no "all clear".
  const w = [
    workout('w1', [set('bench', ['chest'], 8, 60)]),
    workout('w2', [set('bench', ['chest'], 8, 60)]),
    workout('w3', [set('treadmill', ['other'], 1, null, 'cardio', 1800)]),
    workout('w4', [set('treadmill', ['other'], 1, null, 'cardio', 1800)]),
  ];
  const r = analyzeBalance(w);
  eq(r.workoutCount, 4, 'workoutCount counts all workouts');
  eq(r.trainingWorkoutCount, 2, 'trainingWorkoutCount excludes cardio-only');
  eq(r.flagsEvaluated, false, 'flags not evaluated under 4 training workouts');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
