/**
 * Safety rails unit tests (P3 #14) — zero dependencies beyond the app's own
 * tsc. Exercises the pure rules in safetyRules.ts (PAR-Q+ constants, RPE/RIR
 * cap checker, session calendar math) plus DSL safety-cap validation.
 * DB-backed operations (gate status, screenings, session states) are
 * typechecked but not unit-tested here (they need expo-sqlite).
 */
const assert = require('node:assert');
const {
  PARQ_QUESTIONS,
  PARQ_QUESTION_COUNT,
  PARQ_FRESHNESS_MS,
  checkRpeCaps,
  startOfDay,
  scheduledDateFor,
  programSessions,
  DAY_MS,
  EARLY_LINK_MS,
  WORKOUT_LINK_WINDOW_MS,
} = require('./programs/safetyRules.js');
const { validateProgramDefinition } = require('./programs/validate.js');

let passed = 0;
function check(name, cond) {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`ok - ${name}`);
}

// --- PAR-Q+ constants ---
check('7 standard questions', PARQ_QUESTIONS.length === 7);
check('question count constant matches', PARQ_QUESTION_COUNT === 7);
check('freshness is 12 months in ms', PARQ_FRESHNESS_MS === 365 * 24 * 60 * 60 * 1000);
check('questions are non-empty strings', PARQ_QUESTIONS.every((q) => typeof q === 'string' && q.length > 20));

// --- checkRpeCaps ---
check('null caps → no violations', checkRpeCaps(null, 10, 0).length === 0);
check('undefined caps → no violations', checkRpeCaps(undefined, 10, 0).length === 0);
check('empty caps → no violations', checkRpeCaps({}, 10, 0).length === 0);
check('missing rpe/rir → no violations', checkRpeCaps({ maxRpe: 8, minRir: 2 }, null, null).length === 0);
check('NaN rpe ignored', checkRpeCaps({ maxRpe: 8 }, NaN, null).length === 0);

let v = checkRpeCaps({ maxRpe: 8 }, 9.5, null);
check('rpe above cap → violation', v.length === 1 && v[0].type === 'rpe-exceeded');
check('rpe violation carries cap+actual', v[0].cap === 8 && v[0].actual === 9.5);
check('rpe violation has message', typeof v[0].message === 'string' && v[0].message.length > 0);

check('rpe at cap → no violation', checkRpeCaps({ maxRpe: 8 }, 8, null).length === 0);
check('rpe below cap → no violation', checkRpeCaps({ maxRpe: 8 }, 7, null).length === 0);

v = checkRpeCaps({ minRir: 2 }, null, 1);
check('rir below floor → violation', v.length === 1 && v[0].type === 'rir-below-min');
check('rir violation carries cap+actual', v[0].cap === 2 && v[0].actual === 1);
check('rir at floor → no violation', checkRpeCaps({ minRir: 2 }, null, 2).length === 0);
check('rir above floor → no violation', checkRpeCaps({ minRir: 2 }, null, 3).length === 0);

v = checkRpeCaps({ maxRpe: 8, minRir: 2 }, 10, 0);
check('both violated → two violations', v.length === 2);

// --- startOfDay / scheduledDateFor ---
const enrolledAt = new Date(2026, 9, 11, 15, 30, 0).getTime(); // Oct 11 2026 15:30 local
const dayStart = new Date(2026, 9, 11, 0, 0, 0, 0).getTime();
check('startOfDay strips time', startOfDay(enrolledAt) === dayStart);
check('week 1 day 1 = enrollment date', scheduledDateFor(enrolledAt, 1, 1) === dayStart);
check('week 1 day 3 = +2 days', scheduledDateFor(enrolledAt, 1, 3) === dayStart + 2 * DAY_MS);
check('week 2 day 1 = +7 days', scheduledDateFor(enrolledAt, 2, 1) === dayStart + 7 * DAY_MS);
check('week 3 day 5 = +18 days', scheduledDateFor(enrolledAt, 3, 5) === dayStart + 18 * DAY_MS);

let threw = false;
try {
  scheduledDateFor(enrolledAt, 0, 1);
} catch {
  threw = true;
}
check('week 0 throws', threw);
threw = false;
try {
  scheduledDateFor(enrolledAt, 1, 8);
} catch {
  threw = true;
}
check('day 8 throws', threw);

// --- programSessions ---
const def = {
  schemaVersion: 1,
  id: 'p',
  name: 'P',
  goal: 'G',
  weeks: 2,
  daysPerWeek: 3,
  phases: [
    {
      name: 'Base',
      startWeek: 1,
      endWeek: 2,
      sessions: [
        { day: 1, routineKbId: 'p--session-1' },
        { day: 3, routineKbId: 'p--session-3' },
        { day: 5, routineKbId: 'p--session-5' },
      ],
    },
  ],
  deload: { week: 2, volumeFactor: 0.6 },
  progression: { kind: 'linear' },
  pillars: [],
  source: { kind: 'local' },
};
const sessions = programSessions(def);
check('2 weeks × 3 sessions = 6', sessions.length === 6);
check('first is week 1 day 1', sessions[0].week === 1 && sessions[0].day === 1);
check('last is week 2 day 5', sessions[5].week === 2 && sessions[5].day === 5);
check('routineKbId carried', sessions[2].routineKbId === 'p--session-5');

// --- DSL safety validation ---
function validWithSafety(safety) {
  return { ...def, safety };
}
check('absent safety passes', validateProgramDefinition(def).length === 0);
check('valid caps pass', validateProgramDefinition(validWithSafety({ maxRpe: 8, minRir: 2 })).length === 0);
check('partial caps pass', validateProgramDefinition(validWithSafety({ maxRpe: 9 })).length === 0);
check('empty safety object passes', validateProgramDefinition(validWithSafety({})).length === 0);
check(
  'maxRpe 11 rejected',
  validateProgramDefinition(validWithSafety({ maxRpe: 11 })).some((e) => e.includes('maxRpe')),
);
check(
  'maxRpe 0 rejected',
  validateProgramDefinition(validWithSafety({ maxRpe: 0 })).some((e) => e.includes('maxRpe')),
);
check(
  'minRir -1 rejected',
  validateProgramDefinition(validWithSafety({ minRir: -1 })).some((e) => e.includes('minRir')),
);
check(
  'minRir 11 rejected',
  validateProgramDefinition(validWithSafety({ minRir: 11 })).some((e) => e.includes('minRir')),
);
check(
  'non-object safety rejected',
  validateProgramDefinition(validWithSafety('caps')).some((e) => e.includes('safety')),
);

// --- PAR-Q+ question content (official 7, © PAR-Q+ Collaboration) ---
check('7 questions', PARQ_QUESTIONS.length === 7);
check(
  'Q1 mentions heart condition or high blood pressure',
  PARQ_QUESTIONS[0].toLowerCase().includes('heart condition') &&
    PARQ_QUESTIONS[0].toLowerCase().includes('high blood pressure'),
);
check(
  'Q3 covers 12-month dizziness/consciousness with over-breathing qualifier',
  PARQ_QUESTIONS[2].toLowerCase().includes('12 months') &&
    PARQ_QUESTIONS[2].toLowerCase().includes('over-breathing'),
);
check(
  'Q6 covers 12-month soft-tissue problems with past-problem qualifier',
  PARQ_QUESTIONS[5].toLowerCase().includes('soft tissue') &&
    PARQ_QUESTIONS[5].toLowerCase().includes('12 months') &&
    PARQ_QUESTIONS[5].toLowerCase().includes('does not limit your current ability'),
);
check(
  'Q7 covers medically supervised activity',
  PARQ_QUESTIONS[6].toLowerCase().includes('medically supervised'),
);

// --- DST-safe date math ---
// US Eastern DST 2026: springs forward Mar 8. A fixed 24h-block schedule
// starting Mar 6 would put Mar 9 at 01:00; calendar math stays at midnight.
{
  const mar6 = new Date(2026, 2, 6, 12, 0, 0).getTime(); // Mar 6 noon local
  const mar9 = scheduledDateFor(mar6, 1, 4); // +3 days → Mar 9
  const d = new Date(mar9);
  check('DST-safe: +3 days across spring forward is local midnight', d.getHours() === 0 && d.getMinutes() === 0);
  check('DST-safe: lands on Mar 9', d.getMonth() === 2 && d.getDate() === 9);
}
check('EARLY_LINK_MS is 24h', EARLY_LINK_MS === 24 * 60 * 60 * 1000);
check('WORKOUT_LINK_WINDOW_MS is 48h', WORKOUT_LINK_WINDOW_MS === 48 * 60 * 60 * 1000);

console.log(`\n${passed} safety tests passed`);
