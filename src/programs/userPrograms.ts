/**
 * User-built programs — persistence and operations (device only).
 *
 * The program record (name, weeks, schedule, which routines make up each
 * week) lives in AsyncStorage under `lift:user-programs` and rides in the
 * exported backup via appData. Each DAY is a real routine row in SQLite, so
 * exercises/targets/history use the normal tables. Day routines carry a
 * stable `kbId` ("uprog:<programId>:w<week>:d<day>") — that is how the
 * enrollment engine resolves a session to its plan; it also lets the UI hide
 * them from the flat "My plans" list.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq } from 'drizzle-orm';
import { Directory, File, Paths } from 'expo-file-system';
import { db } from '../db/client';
import { newId } from '../db/id';
import { routines } from '../db/schema';
import { createRoutine, getRoutine, softDeleteRoutine, withWriteLock } from '../data/repositories';
import { duplicateRoutine } from '../data/routines';
import { enrollProgram, listEnrollments, type EnrolledProgram } from './enrollments';
import {
  buildDefinition,
  DEFAULT_DETAILS,
  defaultDayName,
  normalizeDetails,
  type ProgramDetails,
  MAX_DAYS_PER_WEEK,
  MAX_WEEKS,
  MIN_WEEKS,
  programIssues,
  templateWeekCount,
  userRoutineKbId,
  type ProgramSchedule,
  type UserProgram,
} from './userProgramDef';

const KEY = 'lift:user-programs';

/* ---------------- storage ---------------- */

export async function listUserPrograms(): Promise<UserProgram[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return (parsed as UserProgram[]).filter(
      (p) => p && typeof p.id === 'string' && Array.isArray(p.weekDays),
    );
  } catch {
    return [];
  }
}

async function writeAll(list: UserProgram[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function getUserProgram(id: string): Promise<UserProgram | null> {
  return (await listUserPrograms()).find((p) => p.id === id) ?? null;
}

async function save(p: UserProgram): Promise<UserProgram> {
  const next = { ...p, updatedAt: Date.now() };
  const all = await listUserPrograms();
  const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = next;
  else all.push(next);
  await writeAll(all);
  return next;
}

/* ---------------- routines (days) ---------------- */

/** Sets many routines' kbIds safely (kbId is UNIQUE, so swaps need a temp step). */
async function applyKbIds(p: UserProgram): Promise<void> {
  const wanted: Array<{ rid: string; kbId: string }> = [];
  p.weekDays.forEach((ids, w) => ids.forEach((rid, d) => wanted.push({ rid, kbId: userRoutineKbId(p.id, w, d) })));
  await withWriteLock(async () => {
    for (const { rid } of wanted) {
      await db.update(routines).set({ kbId: `tmp:${rid}` }).where(eq(routines.id, rid));
    }
    for (const { rid, kbId } of wanted) {
      await db.update(routines).set({ kbId }).where(eq(routines.id, rid));
    }
  });
}

async function newDayRoutine(name: string, minutes?: number): Promise<string> {
  return createRoutine({ name, estimatedMinutes: minutes, longevityPillars: ['strength'] });
}

async function copyDay(sourceRoutineId: string, name?: string): Promise<string> {
  return duplicateRoutine(sourceRoutineId, name);
}

async function dropRoutines(ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    // Release the kb_id (UNIQUE) so renumbered/replaced days can reuse it.
    await withWriteLock(async () => {
      await db.update(routines).set({ kbId: `dropped:${id}` }).where(eq(routines.id, id));
    }).catch(() => undefined);
    await softDeleteRoutine(id).catch(() => undefined);
  }
}

/* ---------------- operations ---------------- */

export async function createUserProgram(name = 'New Program'): Promise<UserProgram> {
  const id = newId();
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) ids.push(await newDayRoutine(defaultDayName(i)));
  const now = Date.now();
  const p: UserProgram = {
    id,
    name,
    weeks: 8,
    schedule: 'repeating',
    weekDays: [ids],
    deloadWeek: null,
    details: { ...DEFAULT_DETAILS },
    createdAt: now,
    updatedAt: now,
  };
  await applyKbIds(p);
  return save(p);
}

export async function renameUserProgram(p: UserProgram, name: string): Promise<UserProgram> {
  return save({ ...p, name: name.trim() || p.name });
}

export async function setDeloadWeek(p: UserProgram, week: number | null): Promise<UserProgram> {
  return save({ ...p, deloadWeek: week });
}

/**
 * Copies every day of week `from` over each week in `targets` (custom
 * schedules only). Target weeks' old days are removed; copies get fresh
 * routines so later edits stay independent.
 */
export async function copyWeek(p: UserProgram, from: number, targets: readonly number[]): Promise<UserProgram> {
  if (p.schedule !== 'custom') throw new RangeError('Copy week needs different weeks.');
  const src = p.weekDays[from];
  if (!src) throw new RangeError('That week does not exist.');
  const weekDays = p.weekDays.map((d) => [...d]);
  for (const to of new Set(targets)) {
    if (to === from || to < 0 || to >= weekDays.length) continue;
    await dropRoutines(weekDays[to]);
    const copies: string[] = [];
    for (const rid of src) copies.push(await copyDay(rid, (await getRoutine(rid))?.routine.name));
    weekDays[to] = copies;
  }
  const next = { ...p, weekDays };
  await applyKbIds(next);
  return save(next);
}

/** Adds a day (new blank routine) to week `weekIdx` (0 for repeating). */
export async function addDay(p: UserProgram, weekIdx: number): Promise<UserProgram> {
  const days = p.weekDays[weekIdx];
  if (!days || days.length >= MAX_DAYS_PER_WEEK) throw new RangeError(`A week can have at most ${MAX_DAYS_PER_WEEK} days.`);
  const rid = await newDayRoutine(defaultDayName(days.length));
  const next = { ...p, weekDays: p.weekDays.map((d, i) => (i === weekIdx ? [...d, rid] : d)) };
  await applyKbIds(next);
  return save(next);
}

export async function duplicateDay(p: UserProgram, weekIdx: number, dayIdx: number): Promise<UserProgram> {
  const days = p.weekDays[weekIdx];
  if (!days || days.length >= MAX_DAYS_PER_WEEK) throw new RangeError(`A week can have at most ${MAX_DAYS_PER_WEEK} days.`);
  const src = await getRoutine(days[dayIdx]);
  const rid = await copyDay(days[dayIdx], `${src?.routine.name ?? 'Workout'} (copy)`);
  const nextDays = [...days];
  nextDays.splice(dayIdx + 1, 0, rid);
  const next = { ...p, weekDays: p.weekDays.map((d, i) => (i === weekIdx ? nextDays : d)) };
  await applyKbIds(next);
  return save(next);
}

export async function removeDay(p: UserProgram, weekIdx: number, dayIdx: number): Promise<UserProgram> {
  const days = p.weekDays[weekIdx];
  if (!days) return p;
  if (days.length <= 1) throw new RangeError('A week needs at least one day.');
  const [gone] = days.splice(dayIdx, 1);
  const next = { ...p, weekDays: p.weekDays.map((d, i) => (i === weekIdx ? [...days] : d)) };
  await dropRoutines([gone]);
  await applyKbIds(next);
  return save(next);
}

export async function moveDay(p: UserProgram, weekIdx: number, dayIdx: number, by: -1 | 1): Promise<UserProgram> {
  const days = [...(p.weekDays[weekIdx] ?? [])];
  const to = dayIdx + by;
  if (to < 0 || to >= days.length) return p;
  [days[dayIdx], days[to]] = [days[to], days[dayIdx]];
  const next = { ...p, weekDays: p.weekDays.map((d, i) => (i === weekIdx ? days : d)) };
  await applyKbIds(next);
  return save(next);
}

/** Changes the duration. Custom schedules gain/lose whole weeks. */
export async function setWeeks(p: UserProgram, weeks: number): Promise<UserProgram> {
  const w = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.round(weeks)));
  let weekDays = p.weekDays;
  if (p.schedule === 'custom') {
    if (w > weekDays.length) {
      const last = weekDays[weekDays.length - 1] ?? [];
      const grown = [...weekDays];
      while (grown.length < w) {
        const copies: string[] = [];
        for (const rid of last) copies.push(await copyDay(rid, (await getRoutine(rid))?.routine.name));
        grown.push(copies);
      }
      weekDays = grown;
    } else if (w < weekDays.length) {
      for (const dropped of weekDays.slice(w)) await dropRoutines(dropped);
      weekDays = weekDays.slice(0, w);
    }
  }
  const next: UserProgram = {
    ...p,
    weeks: w,
    weekDays,
    deloadWeek: p.deloadWeek != null && p.deloadWeek > w ? null : p.deloadWeek,
  };
  await applyKbIds(next);
  return save(next);
}

/**
 * Switches between "same week repeated" and "every week different".
 * repeating → custom copies week 1 into every week; custom → repeating keeps
 * week 1 and discards the others (callers confirm first).
 */
export async function setSchedule(p: UserProgram, schedule: ProgramSchedule): Promise<UserProgram> {
  if (p.schedule === schedule) return p;
  let weekDays: string[][];
  if (schedule === 'custom') {
    weekDays = [p.weekDays[0] ?? []];
    for (let w = 1; w < p.weeks; w++) {
      const copies: string[] = [];
      for (const rid of p.weekDays[0] ?? []) copies.push(await copyDay(rid, (await getRoutine(rid))?.routine.name));
      weekDays.push(copies);
    }
  } else {
    for (const dropped of p.weekDays.slice(1)) await dropRoutines(dropped);
    weekDays = [p.weekDays[0] ?? []];
  }
  const next: UserProgram = { ...p, schedule, weekDays };
  await applyKbIds(next);
  return save(next);
}

export async function activeEnrollmentFor(programId: string): Promise<EnrolledProgram | null> {
  const list = await listEnrollments('active');
  return list.find((e) => e.program.id === programId) ?? null;
}

/** Deletes the program and its day plans. Refused while it is being followed. */
export async function deleteUserProgram(id: string): Promise<void> {
  const p = await getUserProgram(id);
  if (!p) return;
  if (await activeEnrollmentFor(id)) {
    throw new RangeError('You are currently following this program. Leave it first, then delete it.');
  }
  await dropRoutines(p.weekDays.flat());
  const thumb = detailsOf(p).thumbnailUri;
  if (thumb) {
    try {
      new File(thumb).delete();
    } catch {
      // already gone
    }
  }
  await writeAll((await listUserPrograms()).filter((x) => x.id !== id));
}

/** Compiles and starts the program (PAR-Q+ gate enforced by enrollProgram). */
export async function startUserProgram(p: UserProgram): Promise<EnrolledProgram> {
  const issues = programIssues(p);
  if (issues.length > 0) throw new RangeError(issues[0]);
  const names = new Map<string, string>();
  for (const rid of p.weekDays.flat()) {
    const r = await getRoutine(rid);
    if (r) names.set(rid, r.routine.name);
    if (r && r.items.length === 0) throw new RangeError(`"${r.routine.name}" has no exercises yet.`);
  }
  await applyKbIds(p);
  return enrollProgram(buildDefinition(p, names));
}

export { templateWeekCount };


/* ---------------- program details (name, tagline, thumbnail, focus, …) ---------------- */

export function detailsOf(p: UserProgram): ProgramDetails {
  return normalizeDetails(p.details);
}

/**
 * Saves any subset of the details (and optionally the name). Changing the
 * time-per-workout also updates every day plan's estimated duration so the
 * rest of the app shows consistent numbers.
 */
export async function updateProgramDetails(
  p: UserProgram,
  patch: Partial<ProgramDetails> & { name?: string },
): Promise<UserProgram> {
  const { name, ...rest } = patch;
  const before = detailsOf(p);
  const details = normalizeDetails({ ...before, ...rest });
  const next: UserProgram = { ...p, name: name !== undefined ? name.slice(0, 50) : p.name, details };
  if (details.minutesPerWorkout !== before.minutesPerWorkout) {
    await withWriteLock(async () => {
      for (const rid of p.weekDays.flat()) {
        await db.update(routines).set({ estimatedMinutes: details.minutesPerWorkout }).where(eq(routines.id, rid));
      }
    });
  }
  return save(next);
}

const THUMB_DIR = 'program-thumbs';

/**
 * Copies a picked image into the app's private document directory (so it
 * survives the picker's cache being cleared) and records it. Pass null to
 * remove. The image never leaves the device.
 */
export async function setProgramThumbnail(p: UserProgram, sourceUri: string | null): Promise<UserProgram> {
  const old = detailsOf(p).thumbnailUri;
  let uri: string | null = null;
  if (sourceUri) {
    const dir = new Directory(Paths.document, THUMB_DIR);
    dir.create({ idempotent: true });
    const ext = (sourceUri.split('?')[0].match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? 'jpg').toLowerCase();
    const dest = new File(dir, `${p.id}-${Date.now()}.${ext}`);
    new File(sourceUri).copy(dest);
    uri = dest.uri;
  }
  const next = await updateProgramDetails(p, { thumbnailUri: uri });
  if (old && old !== uri) {
    try {
      new File(old).delete();
    } catch {
      // already gone
    }
  }
  return next;
}
