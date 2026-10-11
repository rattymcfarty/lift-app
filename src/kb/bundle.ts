/**
 * KB bundle: fetch, sha256-verify (hash-pinned to channel.json), validate.
 *
 * Hash contract (must match scripts/build-bundle.mjs in lift-kb):
 *   sha256( JSON.stringify({bundleVersion, schemaVersion, exercises, programs}) )
 * `generatedAt` is stripped before hashing so builds are reproducible.
 * Key order is fixed as above; JSON.parse preserves file key order and
 * JSON.stringify emits insertion order, so the canonical form is stable.
 */
import { KbBundleJson, KbError } from './types';
import { formatIssues, validateSchema } from './validate';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const exerciseSchema = require('./schemas/exercise.schema.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const programSchema = require('./schemas/program.schema.json');

export interface VerifiedBundle {
  bundle: KbBundleJson;
  /** The canonical JSON string that was hashed. */
  canonicalJson: string;
}

/** Build the canonical JSON string covered by the channel sha256. */
export function canonicalBundleJson(bundle: KbBundleJson): string {
  return JSON.stringify({
    bundleVersion: bundle.bundleVersion,
    schemaVersion: bundle.schemaVersion,
    exercises: bundle.exercises,
    programs: bundle.programs,
  });
}

/** sha256 hex digest of a string. expo-crypto is imported lazily so this
 * module stays importable in node (unit tests) — only sha256Hex needs it. */
export async function sha256Hex(data: string): Promise<string> {
  const Crypto = await import('expo-crypto');
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
  return digest.toLowerCase();
}

/**
 * Fetch a bundle, verify its sha256 against the channel, and validate every
 * exercise and program against the vendored draft-07 schemas.
 * Returns the typed bundle. Throws KbError — never returns partial content.
 */
export async function fetchAndVerifyBundle(bundleUrl: string, expectedSha256: string): Promise<VerifiedBundle> {
  let res: Response;
  try {
    res = await fetch(bundleUrl);
  } catch (e) {
    throw new KbError('fetch-failed', `bundle fetch failed: ${(e as Error).message}`);
  }
  if (!res.ok) {
    throw new KbError('fetch-failed', `bundle fetch returned HTTP ${res.status}`);
  }

  // Hash the canonical form, not the raw bytes: the build stamps
  // `generatedAt` after hashing, so raw bytes can never match.
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new KbError('invalid-bundle', 'bundle is not valid JSON');
  }
  const bundle = raw as KbBundleJson;
  if (typeof bundle !== 'object' || bundle === null || !Array.isArray(bundle.exercises) || !Array.isArray(bundle.programs)) {
    throw new KbError('invalid-bundle', 'bundle is missing exercises[] or programs[]');
  }

  const canonical = canonicalBundleJson(bundle);
  const actual = await sha256Hex(canonical);
  if (actual !== expectedSha256.toLowerCase()) {
    throw new KbError(
      'hash-mismatch',
      `bundle sha256 mismatch: expected ${expectedSha256.slice(0, 12)}…, got ${actual.slice(0, 12)}… — refusing to import`,
    );
  }

  // Validate every item. One bad exercise fails the whole bundle —
  // partial imports would leave the KB in an inconsistent state.
  const issues: string[] = [];
  bundle.exercises.forEach((ex, i) => {
    const r = validateSchema(exerciseSchema, ex);
    if (!r.valid) issues.push(`exercises[${i}] (${(ex as { id?: string }).id ?? '?'}): ${formatIssues(r.issues, 3)}`);
  });
  bundle.programs.forEach((p, i) => {
    const r = validateSchema(programSchema, p);
    if (!r.valid) issues.push(`programs[${i}] (${(p as { id?: string }).id ?? '?'}): ${formatIssues(r.issues, 3)}`);
  });
  if (issues.length > 0) {
    throw new KbError('invalid-bundle', `bundle failed schema validation: ${issues.slice(0, 3).join(' | ')}`);
  }

  return { bundle, canonicalJson: canonical };
}
