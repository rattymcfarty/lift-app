/**
 * In-binary KB snapshot: the app ships with a validated bundle so it works
 * fully offline out of the box. On first launch the snapshot is imported;
 * afterwards, channel checks fetch updates.
 *
 * The snapshot files live in assets/kb/snapshot/ (bundle.json + channel.json)
 * and are refreshed by scripts/sync-kb-snapshot.mjs — see src/kb/README.md.
 * Metro bundles required JSON at build time; keep the snapshot small enough
 * that it doesn't bloat the JS bundle (10 exercises ≈ 30KB — fine).
 */
import { KbBundleJson, KbChannelJson, KbError } from './types';
import { formatIssues, validateSchema } from './validate';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const snapshotBundle = require('../../assets/kb/snapshot/bundle.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const snapshotChannel = require('../../assets/kb/snapshot/channel.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const exerciseSchema = require('./schemas/exercise.schema.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const programSchema = require('./schemas/program.schema.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const channelSchema = require('./schemas/channel.schema.json');

/** The bundle version baked into this build. */
export function snapshotBundleVersion(): string {
  return (snapshotBundle as KbBundleJson).bundleVersion;
}

/**
 * Load and validate the in-binary snapshot. The snapshot is validated at
 * runtime (not just at build time) so a corrupt asset can never poison
 * the database — defense in depth on top of the build-time checks.
 * Throws KbError when the snapshot is invalid.
 */
export function loadSnapshot(): { bundle: KbBundleJson; channel: KbChannelJson } {
  const bundle = snapshotBundle as KbBundleJson;
  const channel = snapshotChannel as KbChannelJson;

  const channelResult = validateSchema(channelSchema, channel);
  if (!channelResult.valid) {
    throw new KbError('invalid-channel', `snapshot channel.json invalid: ${formatIssues(channelResult.issues)}`);
  }
  if (!Array.isArray(bundle.exercises) || !Array.isArray(bundle.programs)) {
    throw new KbError('invalid-bundle', 'snapshot bundle is missing exercises[] or programs[]');
  }
  const issues: string[] = [];
  bundle.exercises.forEach((ex, i) => {
    const r = validateSchema(exerciseSchema, ex);
    if (!r.valid) issues.push(`exercises[${i}]: ${formatIssues(r.issues, 2)}`);
  });
  bundle.programs.forEach((p, i) => {
    const r = validateSchema(programSchema, p);
    if (!r.valid) issues.push(`programs[${i}]: ${formatIssues(r.issues, 2)}`);
  });
  if (issues.length > 0) {
    throw new KbError('invalid-bundle', `snapshot bundle invalid: ${issues.slice(0, 3).join(' | ')}`);
  }
  return { bundle, channel };
}
