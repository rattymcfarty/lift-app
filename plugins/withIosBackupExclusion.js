/**
 * Expo config plugin: excludes the training database from iCloud backups.
 *
 * iOS parity with plugins/withAndroidBackupRules.js — privacy is a hard
 * requirement for LIFT (R8), and the SQLite database must NEVER leave the
 * device via iCloud backup or device-to-device transfer.
 *
 * iOS backs up the whole app sandbox except tmp/ and Library/Caches/.
 * expo-sqlite stores its databases in Documents/SQLite/
 * (defaultDatabaseDirectory in expo-sqlite/ios/SQLiteModule.swift), so
 * lift.db WOULD be included in iCloud backups without this plugin.
 *
 * At app launch the plugin injects code into AppDelegate that:
 *   1. ensures Documents/SQLite/ exists,
 *   2. sets NSURLIsExcludedFromBackupKey on the directory — this covers the
 *      database, its journal/WAL/SHM sidecars, and files created later,
 *   3. stamps the flag on any lift.db files already present (belt and
 *      braces for users updating from a build without this exclusion).
 *
 * DB NAME COUPLING: "lift.db" here must match the name passed to
 * openDatabaseSync() in src/db/client.ts.
 *
 * LIMITATIONS:
 * - Config plugins only affect prebuild/dev builds, NOT Expo Go: in Expo Go
 *   the database remains backup-eligible (dev/test data on the dev's own
 *   device — acceptable; the shipped app is what R8 governs).
 * - Failures are swallowed (try?) so a backup-flag problem can never break
 *   launch; worst case matches stock Expo behavior.
 *
 * Idempotent under repeated `expo prebuild` runs (marker comment guard).
 * Fails LOUD at prebuild time if the AppDelegate template anchor changes,
 * instead of shipping without the R8 exclusion.
 */
const { withAppDelegate } = require('expo/config-plugins');

const MARKER = '// LIFT-R8: exclude SQLite from iCloud backup';
const ANCHOR =
  'return super.application(application, didFinishLaunchingWithOptions: launchOptions)';

const SNIPPET = `    ${MARKER} (R8 privacy: lift.db must never leave the device via iCloud)
    if let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
      // expo-sqlite defaultDatabaseDirectory == Documents/SQLite/
      let sqliteDir = documents.appendingPathComponent("SQLite", isDirectory: true)
      try? FileManager.default.createDirectory(at: sqliteDir, withIntermediateDirectories: true)
      // Directory-level exclusion covers the DB, its sidecars, and files created later.
      var dirValues = URLResourceValues()
      dirValues.isExcludedFromBackup = true
      var mutableDir = sqliteDir
      try? mutableDir.setResourceValues(dirValues)
      // Stamp files already on disk (e.g. updating from a build without this exclusion).
      for sidecar in ["", "-journal", "-wal", "-shm"] {
        let fileURL = sqliteDir.appendingPathComponent("lift.db" + sidecar)
        if FileManager.default.fileExists(atPath: fileURL.path) {
          var fileValues = URLResourceValues()
          fileValues.isExcludedFromBackup = true
          var mutableFile = fileURL
          try? mutableFile.setResourceValues(fileValues)
        }
      }
    }
`;

function withIosBackupExclusion(config) {
  return withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) {
      return config;
    }
    const idx = contents.indexOf(ANCHOR);
    if (idx === -1) {
      throw new Error(
        '[withIosBackupExclusion] anchor not found in AppDelegate.swift — ' +
          'the Expo template changed; update the plugin instead of shipping without the R8 exclusion.',
      );
    }
    contents = contents.slice(0, idx) + SNIPPET + contents.slice(idx);
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withIosBackupExclusion;
