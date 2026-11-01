/**
 * Published exercise videos — GitHub catalogue, filename matching.
 *
 * The video agent drops MP4s into `assets/exercises/demos/` using the
 * exercise's display name (`Dumbbell Bench Press - Dumbbell-2.mp4`). The app
 * lists that folder on GitHub at runtime, matches each file to the exercise
 * on the guide, and shows every matching version. The bundled, KB-id-named
 * clips remain the offline fallback.
 *
 * This module is pure (no React, no network) so the matcher can be unit-tested.
 *
 * Naming convention for published files:
 *   <Exercise Name>.mp4                    demo 1
 *   <Exercise Name> - 2.mp4                demo 2
 *   <Exercise Name> - <Equipment>-2.mp4    demo 2, with the equipment word
 * The version can be `-2`, `_2`, `__2`, ` v2`, ` (2)`; the equipment word is
 * stripped so the display name and the file name meet in the middle.
 */

export interface PublishedVideo {
  /** File name in the GitHub folder. */
  file: string;
  /** Raw HTTPS URL for expo-video. */
  url: string;
  /** Bytes, when GitHub reports them. */
  size: number;
  /** Normalized exercise key (name, equipment and version removed). */
  key: string;
  /** Demo version; 1 when the file name has no version suffix. */
  version: number;
}

/** Equipment words that can trail the exercise in a file name or display name. */
const EQUIPMENT_WORDS = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'smith machine',
  'safety bar',
  'cardio',
  'other',
].join('|');

const EQUIPMENT_SUFFIX = new RegExp(`\\s*[-–—]\\s*(?:${EQUIPMENT_WORDS})\\s*$`, 'i');
const PARENTHETICAL_SUFFIX = /\s*\([^)]*\)\s*$/;
const VERSION_SUFFIX = /(?:__|[-_ ](?:v(?:ersion)?\s*)?)(\d+)$/i;

/**
 * Normalized exercise key: lower case, punctuation removed, a trailing
 * parenthetical or equipment word stripped. `Dumbbell Bench Press (Dumbbell)`
 * and `Dumbbell Bench Press - Dumbbell` both become `dumbbellbenchpress`.
 */
export function normalizeDemoName(name: string): string {
  let s = name.normalize('NFKD').toLowerCase();
  s = s.replace(/\.mp4$/i, '');
  s = s.replace(PARENTHETICAL_SUFFIX, '');
  s = s.replace(EQUIPMENT_SUFFIX, '');
  return s.replace(/[^a-z0-9]+/g, '');
}

/**
 * Parse a published filename. Returns null for non-MP4/empty names. The
 * version is 1 unless the name ends in a separated number (`-2`, `__2`, `v2`,
 * ` (2)`); the version suffix never swallows part of the exercise name.
 */
export function parsePublishedVideo(
  file: string,
  url: string,
  size = 0,
): PublishedVideo | null {
  if (!/\.mp4$/i.test(file)) return null;
  let base = file.replace(/\.mp4$/i, '').trim();
  let version = 1;
  const paren = /\((\d+)\)\s*$/.exec(base);
  if (paren) {
    version = Number(paren[1]);
    base = base.slice(0, paren.index).trim();
  } else {
    const m = VERSION_SUFFIX.exec(base);
    if (m) {
      version = Number(m[1]);
      base = base.slice(0, m.index).trim();
    }
  }
  const key = normalizeDemoName(base);
  if (!key) return null;
  return { file, url, size, key, version };
}

/**
 * Canonical exercise key -> alternative names the video agent may use. Keys and
 * values are normalized. Keep these specific: a generic `squat` would steal
 * every squat variant.
 */
const ALIASES: Record<string, readonly string[]> = {
  barbellsquat: ['barbellbacksquat', 'backsquat', 'backbarbellsquat', 'squat'],
  frontbarbellsquat: ['frontsquat'],
  barbelldeadlift: ['deadlift', 'conventionaldeadlift'],
  romaniandeadlift: ['rdl', 'stifflegdeadlift', 'straightlegdeadlift'],
  benchpresspowerlifting: ['benchpress', 'barbellbenchpress', 'competitionbenchpress'],
  dumbbellbenchpress: ['dumbbellchestpress', 'dumbbellpress', 'dbbenchpress'],
  overheadpress: ['overheadshoulderpress', 'shoulderpress', 'militarypress', 'standingpress'],
  pullupbodyweight: ['pullup', 'pullups'],
  chinup: ['chinups'],
  bentoverbarbellrow: ['barbellrow', 'bentoverrow'],
  barbellhipthrust: ['hipthrust'],
  glutebridgebw: ['glutebridge'],
  bulgariansplitsquatbw: ['bulgariansplitsquat', 'splitsquat'],
  widegriplatpulldown: ['latpulldown', 'pulldown'],
  seatedcablerows: ['seatedcablerow', 'cablerow'],
  sidelateralraise: ['lateralraise', 'sidelateral'],
  barbellcurl: ['bicepcurl', 'bicepscurl', 'bicepcurls', 'bicepscurls'],
  tricepspushdown: ['triceppushdown', 'pushdown'],
  dipstricepsversion: ['dips', 'tricepsdips'],
  reverseflyes: ['reversefly', 'reardeltfly'],
  hangingkneeraise: ['hangingkneeraises', 'kneeraise'],
  cablewoodchops: ['cablewoodchop', 'woodchop'],
  standingcalfraises: ['standingcalfraise', 'calfraise', 'calfraises'],
  weightedstepup: ['stepup', 'stepups'],
  farmercarry: ['farmerscarry', 'farmerswalk', 'farmercarries'],
  deadbug: ['deadbugs'],
  birddog: ['birddogs'],
  sideplank: ['sideplanks'],
  plank: ['planks'],
  kettlebellsving: ['kettlebellsvings'],
};

/** Keys an exercise can match: the display name, the raw name, the KB id, plurals and aliases. */
export function demoMatchKeys(name: string, id?: string | null): Set<string> {
  const keys = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const key = normalizeDemoName(value);
    if (key) keys.add(key);
  };
  add(name);
  add(id?.replace(/[-_]+/g, ' '));
  // Singular/plural variants (Pull-Up / Pull-Ups, Curl / Curls, Leg Extension(s)).
  for (const key of [...keys]) {
    if (key.length > 3 && key.endsWith('s') && !key.endsWith('ss')) keys.add(key.slice(0, -1));
    else if (key.length > 2 && !key.endsWith('s')) keys.add(`${key}s`);
  }
  // Aliases in both directions, so a published file that uses either name matches.
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (keys.has(canonical) || aliases.some((a) => keys.has(a))) {
      keys.add(canonical);
      for (const a of aliases) keys.add(a);
    }
  }
  return keys;
}

/** All published versions for an exercise, oldest first. */
export function matchPublishedVideos(
  videos: readonly PublishedVideo[],
  name: string,
  id?: string | null,
): PublishedVideo[] {
  const keys = demoMatchKeys(name, id);
  const seen = new Set<string>();
  return videos
    .filter((video) => keys.has(video.key) && !seen.has(video.file) && seen.add(video.file) !== undefined)
    .sort((a, b) => a.version - b.version || a.file.localeCompare(b.file));
}
