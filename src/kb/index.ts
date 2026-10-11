/**
 * KB sync orchestration: channel check → fetch → verify → import.
 *
 * Privacy: the only network calls the app makes are the two explicit HTTPS
 * GETs here (channel.json, then the bundle). No auth, no cookies, no query
 * params, no PII. Everything else the app does is on-device.
 */
import { KbError, KbSyncResult } from './types';
import { bundleUrlFor, DEFAULT_CHANNEL_URL, fetchChannel, isAppSupported, isUpdateAvailable, isVersionRevoked } from './channel';
import { fetchAndVerifyBundle } from './bundle';
import { getKbSyncState, importBundle, setKbSyncState } from './import';
import { loadSnapshot } from './snapshot';

export interface KbSyncConfig {
  /** Channel URL. Defaults to the lift-kb Pages mirror. */
  channelUrl?: string;
  /** This build's version, for the channel's minAppVersion gate. */
  appVersion: string;
  /** Override the bundle URL (tests / mirrors). */
  bundleUrlOverride?: string;
}

/**
 * Import the in-binary snapshot. Called on first launch (no sync state yet).
 * The snapshot is pre-validated; this just writes it to the database.
 */
export async function importSnapshotOnFirstLaunch(): Promise<KbSyncResult> {
  const existing = await getKbSyncState();
  if (existing?.bundleVersion) {
    return { status: 'up-to-date', bundleVersion: existing.bundleVersion };
  }
  const { bundle, channel } = loadSnapshot();
  const stats = await importBundle(bundle);
  await setKbSyncState({
    bundleVersion: bundle.bundleVersion,
    bundleSha256: channel.sha256,
    importedAt: Date.now(),
    checkedAt: Date.now(),
  });
  return { status: 'updated', bundleVersion: stats.bundleVersion, exercises: stats.exercisesUpserted, programs: stats.routinesUpserted };
}

/**
 * Check the channel for updates and import when available.
 * Safe to call on every app open — no-ops when up to date.
 */
export async function syncKb(config: KbSyncConfig): Promise<KbSyncResult> {
  const { appVersion } = config;
  const channelUrl = config.channelUrl ?? DEFAULT_CHANNEL_URL;
  let channel: Awaited<ReturnType<typeof fetchChannel>>;
  try {
    channel = await fetchChannel(channelUrl);
  } catch (e) {
    // Offline or channel unreachable: not an error the user needs to see.
    // The local KB keeps working; sync retries next launch.
    const reason = e instanceof KbError ? `${e.code}: ${e.message}` : String(e);
    return { status: 'failed', reason };
  }

  await setKbSyncState({ channelUrl: channelUrl, checkedAt: Date.now() });

  if (!isAppSupported(channel, appVersion)) {
    return { status: 'failed', reason: `app version ${appVersion} below channel minimum ${channel.minAppVersion}` };
  }
  if (isVersionRevoked(channel, channel.latest)) {
    return { status: 'failed', reason: `bundle ${channel.latest} was revoked by the channel` };
  }

  const state = await getKbSyncState();
  if (!isUpdateAvailable(channel, state?.bundleVersion ?? null)) {
    return { status: 'up-to-date', bundleVersion: channel.latest };
  }

  const bundleUrl = config.bundleUrlOverride ?? bundleUrlFor(channelUrl, channel.latest);
  const { bundle } = await fetchAndVerifyBundle(bundleUrl, channel.sha256);
  const stats = await importBundle(bundle);
  await setKbSyncState({
    bundleVersion: bundle.bundleVersion,
    bundleSha256: channel.sha256,
    importedAt: Date.now(),
    checkedAt: Date.now(),
  });
  return { status: 'updated', bundleVersion: stats.bundleVersion, exercises: stats.exercisesUpserted, programs: stats.routinesUpserted };
}
