/**
 * KB release channel: fetch + validate channel.json, version comparison.
 *
 * Privacy: the ONLY network calls the app ever makes are the explicit KB
 * fetches in this module and bundle.ts — public, unauthenticated JSON over
 * HTTPS. No cookies, no auth headers, no query params, no PII. The channel
 * URL is the single trust root; everything else is hash-pinned to it.
 */
import { KbChannelJson, KbError } from './types';
import { formatIssues, validateSchema } from './validate';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const channelSchema = require('./schemas/channel.schema.json');

/** Default channel URL (GitHub Pages mirror of lift-kb). Overridable. */
export const DEFAULT_CHANNEL_URL = 'https://rattymcfarty.github.io/lift-kb/channel.json';

/** Fetch and validate channel.json. Throws KbError on any failure. */
export async function fetchChannel(url: string = DEFAULT_CHANNEL_URL): Promise<KbChannelJson> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new KbError('fetch-failed', `channel fetch failed: ${(e as Error).message}`);
  }
  if (!res.ok) {
    throw new KbError('fetch-failed', `channel fetch returned HTTP ${res.status}`);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new KbError('invalid-channel', 'channel.json is not valid JSON');
  }
  const result = validateSchema(channelSchema, json);
  if (!result.valid) {
    throw new KbError('invalid-channel', `channel.json failed schema validation: ${formatIssues(result.issues)}`);
  }
  return json as KbChannelJson;
}

/** Parse "1.2.3" into [1,2,3]. Throws on malformed input. */
export function parseSemver(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) throw new KbError('invalid-channel', `malformed semver: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** -1 if a<b, 0 if equal, 1 if a>b. */
export function compareSemver(a: string, b: string): number {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

/** True when the channel advertises a newer bundle than the imported one. */
export function isUpdateAvailable(channel: KbChannelJson, currentBundleVersion: string | null): boolean {
  if (!currentBundleVersion) return true;
  return compareSemver(channel.latest, currentBundleVersion) > 0;
}

/** True when the installed bundle version was pulled (must not be used). */
export function isVersionRevoked(channel: KbChannelJson, bundleVersion: string): boolean {
  return channel.revoked.includes(bundleVersion);
}

/** True when this app build meets the channel's minimum app version. */
export function isAppSupported(channel: KbChannelJson, appVersion: string): boolean {
  return compareSemver(appVersion, channel.minAppVersion) >= 0;
}

/**
 * Derive the bundle download URL from the channel URL.
 * Convention (lift-kb publishing): the bundle sits next to channel.json as
 * kb-bundle-<version>.json on the Pages mirror.
 */
export function bundleUrlFor(channelUrl: string, bundleVersion: string): string {
  const base = channelUrl.replace(/\/channel\.json$/, '');
  return `${base}/kb-bundle-${bundleVersion}.json`;
}
