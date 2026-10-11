/**
 * TypeScript types mirroring the lift-kb JSON schemas (draft-07).
 * These are structural mirrors — the schemas themselves live in
 * src/kb/schemas/*.json (vendored from the lift-kb repo) and are the
 * source of truth for validation. Keep in sync when schemaVersion bumps.
 */

/** A single exercise from the KB bundle. */
export interface KbExerciseJson {
  id: string;
  schemaVersion: 1;
  name: string;
  aliases?: string[];
  muscles: { primary: string[]; secondary?: string[] };
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  movementPattern:
    | 'squat'
    | 'hinge'
    | 'push'
    | 'pull'
    | 'carry'
    | 'lunge'
    | 'core'
    | 'cardio'
    | 'mobility';
  instructions: string[];
  cues?: string[];
  commonMistakes?: string[];
  longevityNotes: string;
  safetyNotes?: string;
  progression?: {
    regressTo?: string;
    progressTo?: string;
    loadingGuidance?: string;
  };
  demoMedia?: { images?: string[]; video?: string | null };
  sources: { title: string; publisher?: string; url?: string }[];
  attribution?: string;
  updatedAt?: string;
  deprecated?: boolean;
  replacedBy?: string | null;
}

/** One programmed block inside a KB program session. */
export interface KbProgramBlock {
  exerciseId: string;
  sets: number;
  reps?: string;
  restSeconds?: number;
  rpeCap?: number;
  notes?: string;
}

/** One training day inside a KB program. */
export interface KbProgramSession {
  day: number;
  name?: string;
  blocks: KbProgramBlock[];
}

/** A multi-week training block from the KB bundle. */
export interface KbProgramJson {
  id: string;
  schemaVersion: 1;
  name: string;
  goal: string;
  weeks: number;
  daysPerWeek: number;
  sessions: KbProgramSession[];
  deload: { week: number; volumeFactor: number };
  sources?: { title: string; publisher?: string; url?: string }[];
  attribution?: string;
  updatedAt?: string;
  deprecated?: boolean;
  replacedBy?: string | null;
}

/** The release channel descriptor (channel.json). */
export interface KbChannelJson {
  latest: string;
  minAppVersion: string;
  schemaVersion: number;
  sha256: string;
  revoked: string[];
}

/** The versioned content bundle built by lift-kb CI. */
export interface KbBundleJson {
  bundleVersion: string;
  schemaVersion: number;
  exercises: KbExerciseJson[];
  programs: KbProgramJson[];
  /** Build timestamp — excluded from the sha256 hash contract. */
  generatedAt?: string;
}

/** Result of a KB sync attempt. */
export type KbSyncResult =
  | { status: 'up-to-date'; bundleVersion: string }
  | { status: 'updated'; bundleVersion: string; exercises: number; programs: number }
  | { status: 'failed'; reason: string };

/** Errors thrown by the KB pipeline. Never include user data. */
export class KbError extends Error {
  readonly code:
    | 'fetch-failed'
    | 'invalid-channel'
    | 'invalid-bundle'
    | 'hash-mismatch'
    | 'version-revoked'
    | 'app-too-old'
    | 'import-failed';
  constructor(code: KbError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'KbError';
  }
}
