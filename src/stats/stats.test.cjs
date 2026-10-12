/**
 * Stats layer unit tests (P4a) — pure functions only, no DB.
 * Run via `npm run test:stats` (scripts/test-stats.mjs compiles the
 * pure modules with the project's tsc, then runs this file).
 */
const assert = require('node:assert/strict');
const {
  setVolume,
  workoutVolume,
  startOfWeekMonday,
  volumeByWeek,
  volumeByMuscle,
  volumeByExercise,
} = require('./volume');
const { workoutsPerWeek, currentStreak, totalWorkouts } = require('./frequency');
const { epley1RM, bestSetBy1RM, strengthTrend } = require('./strength');
const { consistencyScore, weeklyActivityRate } = require('./consistency');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    console.error(`FAIL: ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
}

// --- fixtures -------------------------------------------------------
function mkSet(over = {}) {
  return {
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    primaryMuscles: ['chest', 'triceps'],
    reps: 10,
    weightKg: 60,
    completed: true,
    ...over,
  };
}
function mkWorkout(id, startedAt, sets) {
  return { id, startedAt: new Date(startedAt), endedAt: new Date(startedAt), sets };
}
// 2026-10-12 is a Monday. All dates are local noon to dodge DST edges.
const MON = '2026-10-12T12:00:00';
const TUE = '2026-10-13T12:00:00';
const LAST_MON = '2026-10-05T12:00:00'; // previous Monday
const TWO_MON_AGO = '2026-09-28T12:00:00';

// --- setVolume ------------------------------------------------------
test('setVolume: 10 reps × 60kg = 600', () => {
  assert.equal(setVolume(mkSet()), 600);
});
test('setVolume: skipped set = 0', () => {
  assert.equal(setVolume(mkSet({ completed: false })), 0);
});
test('setVolume: null reps = 0 (timed hold)', () => {
  assert.equal(setVolume(mkSet({ reps: null })), 0);
});
test('setVolume: null weight = 0 (unweighted)', () => {
  assert.equal(setVolume(mkSet({ weightKg: null })), 0);
});
test('setVolume: zero reps = 0', () => {
  assert.equal(setVolume(mkSet({ reps: 0 })), 0);
});

// --- workoutVolume --------------------------------------------------
test('workoutVolume: sums sets', () => {
  const w = mkWorkout('w1', MON, [mkSet(), mkSet({ reps: 8, weightKg: 70 })]);
  // 600 + 560 = 1160
  assert.equal(workoutVolume(w), 1160);
});
test('workoutVolume: empty workout = 0', () => {
  assert.equal(workoutVolume(mkWorkout('w1', MON, [])), 0);
});

// --- startOfWeekMonday ----------------------------------------------
test('startOfWeekMonday: Monday stays', () => {
  const m = startOfWeekMonday(new Date(MON));
  assert.equal(m.getDay(), 1);
  assert.equal(m.getHours(), 0);
});
test('startOfWeekMonday: Sunday goes back 6 days', () => {
  const m = startOfWeekMonday(new Date('2026-10-18T12:00:00')); // Sunday
  assert.equal(m.getDay(), 1);
  assert.equal(m.getDate(), 12);
});

// --- volumeByWeek ---------------------------------------------------
test('volumeByWeek: buckets two weeks correctly', () => {
  const ws = [
    mkWorkout('w1', MON, [mkSet()]), // 600 this week
    mkWorkout('w2', TUE, [mkSet({ reps: 5, weightKg: 100 })]), // 500 this week
    mkWorkout('w3', LAST_MON, [mkSet({ reps: 10, weightKg: 50 })]), // 500 last week
  ];
  const buckets = volumeByWeek(ws, 2, new Date(MON));
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].volumeKg, 500); // last week
  assert.equal(buckets[0].workouts, 1);
  assert.equal(buckets[1].volumeKg, 1100); // this week
  assert.equal(buckets[1].workouts, 2);
});
test('volumeByWeek: empty input = zero buckets', () => {
  const buckets = volumeByWeek([], 3, new Date(MON));
  assert.equal(buckets.length, 3);
  assert.ok(buckets.every((b) => b.volumeKg === 0 && b.workouts === 0));
});
test('volumeByWeek: ignores workouts outside window', () => {
  const ws = [mkWorkout('w1', '2026-01-05T12:00:00', [mkSet()])];
  const buckets = volumeByWeek(ws, 2, new Date(MON));
  assert.ok(buckets.every((b) => b.volumeKg === 0));
});

// --- volumeByMuscle -------------------------------------------------
test('volumeByMuscle: credits each primary muscle', () => {
  const ws = [mkWorkout('w1', MON, [mkSet()])]; // 600, chest+triceps
  const m = volumeByMuscle(ws);
  assert.equal(m.get('chest'), 600);
  assert.equal(m.get('triceps'), 600);
});
test('volumeByMuscle: no muscles → "other"', () => {
  const ws = [mkWorkout('w1', MON, [mkSet({ primaryMuscles: [] })])];
  assert.equal(volumeByMuscle(ws).get('other'), 600);
});

// --- volumeByExercise -----------------------------------------------
test('volumeByExercise: aggregates and sorts', () => {
  const ws = [
    mkWorkout('w1', MON, [mkSet(), mkSet({ exerciseId: 'ex-squat', exerciseName: 'Squat', primaryMuscles: ['quads'] })]),
    mkWorkout('w2', TUE, [mkSet({ reps: 5, weightKg: 100 })]),
  ];
  const ev = volumeByExercise(ws);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].exerciseName, 'Bench Press'); // 600+500=1100 first
  assert.equal(ev[0].volumeKg, 1100);
  assert.equal(ev[0].workouts, 2);
  assert.equal(ev[1].exerciseName, 'Squat');
});

// --- frequency ------------------------------------------------------
test('workoutsPerWeek: counts per bucket', () => {
  const ws = [
    mkWorkout('w1', MON, []),
    mkWorkout('w2', TUE, []),
    mkWorkout('w3', LAST_MON, []),
  ];
  const counts = workoutsPerWeek(ws, 2, new Date(MON));
  assert.deepEqual(counts, [1, 2]);
});
test('currentStreak: three consecutive weeks', () => {
  const ws = [
    mkWorkout('w1', MON, []),
    mkWorkout('w2', LAST_MON, []),
    mkWorkout('w3', TWO_MON_AGO, []),
  ];
  assert.equal(currentStreak(ws, new Date(MON)), 3);
});
test('currentStreak: forgives empty in-progress week', () => {
  // "Now" is Wednesday 2026-10-14; this week empty but last two active.
  const ws = [mkWorkout('w1', LAST_MON, []), mkWorkout('w2', TWO_MON_AGO, [])];
  assert.equal(currentStreak(ws, new Date('2026-10-14T12:00:00')), 2);
});
test('currentStreak: gap breaks the streak', () => {
  const ws = [mkWorkout('w1', MON, []), mkWorkout('w2', TWO_MON_AGO, [])];
  assert.equal(currentStreak(ws, new Date(MON)), 1);
});
test('currentStreak: survives US DST end (2026-11-01)', () => {
  // DST ends Sunday 2026-11-01; weeks are 7 days ± 1h in ms across it.
  const ws = [
    mkWorkout('w1', '2026-10-26T12:00:00', []), // Monday before DST end
    mkWorkout('w2', '2026-11-02T12:00:00', []), // Monday after DST end
  ];
  assert.equal(currentStreak(ws, new Date('2026-11-04T12:00:00')), 2);
});
test('currentStreak: no workouts = 0', () => {
  assert.equal(currentStreak([], new Date(MON)), 0);
});
test('weeklyActivityRate: survives DST change', () => {
  const ws = [
    mkWorkout('w1', '2026-10-26T12:00:00', []),
    mkWorkout('w2', '2026-11-02T12:00:00', []),
  ];
  assert.equal(weeklyActivityRate(ws, 2, new Date('2026-11-04T12:00:00')), 100);
});
test('workoutsPerWeek: buckets across DST', () => {
  const ws = [
    mkWorkout('w1', '2026-10-26T12:00:00', []),
    mkWorkout('w2', '2026-11-02T12:00:00', []),
  ];
  assert.deepEqual(workoutsPerWeek(ws, 2, new Date('2026-11-04T12:00:00')), [1, 1]);
});
test('currentStreak: longer than 8 weeks is not capped', () => {
  const ws = [];
  // 12 consecutive Monday workouts ending 2026-10-12.
  for (let i = 0; i < 12; i++) {
    const d = new Date('2026-10-12T12:00:00');
    d.setDate(d.getDate() - i * 7);
    ws.push(mkWorkout(`w${i}`, d.toISOString(), []));
  }
  assert.equal(currentStreak(ws, new Date(MON)), 12);
});
test('totalWorkouts: counts unique', () => {
  const ws = [mkWorkout('w1', MON, []), mkWorkout('w2', TUE, [])];
  assert.equal(totalWorkouts(ws), 2);
});

// --- strength -------------------------------------------------------
test('epley1RM: 100kg × 10 = 133.33', () => {
  const v = epley1RM(100, 10);
  assert.ok(v !== null && Math.abs(v - 133.333) < 0.01);
});
test('epley1RM: 1 rep scales by (1 + 1/30)', () => {
  assert.equal(epley1RM(80, 1), 80 * (1 + 1 / 30));
});
test('epley1RM: null on bad input', () => {
  assert.equal(epley1RM(null, 10), null);
  assert.equal(epley1RM(100, null), null);
  assert.equal(epley1RM(0, 10), null);
  assert.equal(epley1RM(100, 0), null);
});
test('bestSetBy1RM: picks highest epley', () => {
  const sets = [mkSet({ reps: 10, weightKg: 60 }), mkSet({ reps: 3, weightKg: 100 })];
  // 60×1.333=80 vs 100×1.1=110 → second wins
  const best = bestSetBy1RM(sets);
  assert.ok(best !== null && best.set.weightKg === 100);
});
test('bestSetBy1RM: skips incomplete sets', () => {
  const sets = [mkSet({ completed: false, reps: 10, weightKg: 200 })];
  assert.equal(bestSetBy1RM(sets), null);
});
test('strengthTrend: one point per workout, chronological', () => {
  const ws = [
    mkWorkout('w2', TUE, [mkSet({ reps: 8, weightKg: 65 })]),
    mkWorkout('w1', MON, [mkSet({ reps: 10, weightKg: 60 })]),
  ];
  const trend = strengthTrend(ws, 'ex-bench');
  assert.equal(trend.length, 2);
  assert.ok(trend[0].date < trend[1].date);
  assert.ok(Math.abs(trend[0].oneRM - 80) < 0.01); // 60 × 1.333
});
test('strengthTrend: ignores other exercises', () => {
  const ws = [mkWorkout('w1', MON, [mkSet({ exerciseId: 'ex-squat' })])];
  assert.equal(strengthTrend(ws, 'ex-bench').length, 0);
});

// --- consistency ----------------------------------------------------
test('consistencyScore: 3/4 = 75', () => {
  assert.equal(consistencyScore(3, 4), 75);
});
test('consistencyScore: clamps over-completion', () => {
  assert.equal(consistencyScore(5, 4), 100);
});
test('consistencyScore: null when nothing planned', () => {
  assert.equal(consistencyScore(0, 0), null);
});
test('weeklyActivityRate: 2 of last 4 weeks = 50', () => {
  const ws = [mkWorkout('w1', MON, []), mkWorkout('w2', TWO_MON_AGO, [])];
  assert.equal(weeklyActivityRate(ws, 4, new Date(MON)), 50);
});
test('weeklyActivityRate: null for new user (no workouts)', () => {
  assert.equal(weeklyActivityRate([], 8, new Date(MON)), null);
});
test('weeklyActivityRate: forgives empty in-progress week', () => {
  // Wednesday 2026-10-14, this week empty, last 2 weeks active → 2/2.
  const ws = [mkWorkout('w1', LAST_MON, []), mkWorkout('w2', TWO_MON_AGO, [])];
  assert.equal(weeklyActivityRate(ws, 2, new Date('2026-10-14T12:00:00')), 100);
});
test('weeklyActivityRate: null for non-positive weeks', () => {
  assert.equal(weeklyActivityRate([], 0, new Date(MON)), null);
});

console.log(`stats: ${passed} tests passed`);
