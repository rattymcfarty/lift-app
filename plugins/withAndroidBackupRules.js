/**
 * Expo config plugin: excludes the training database from Android Auto Backup.
 *
 * Privacy is a hard requirement for LIFT — the SQLite database must NEVER
 * leave the device via Google Drive auto-backup or device-to-device transfer.
 *
 * IMPORTANT: expo-sqlite stores its databases under
 * <filesDir>/SQLite/ (see SQLiteModule.kt), NOT in the "database" domain
 * (context.getDatabasePath). Excluding domain="database" matches nothing —
 * the rules must use domain="file" with the SQLite/ prefix.
 *
 * Writes two rule files (API <=30 uses fullBackupContent, API 31+ uses
 * dataExtractionRules) and points the <application> tag at both. Covers the
 * database plus its journal/WAL/SHM sidecars in BOTH cloud-backup and
 * device-transfer sections — a rule in only one section leaks on new-phone
 * setup.
 *
 * Idempotent under repeated `expo prebuild` runs.
 */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// expo-sqlite database location: filesDir/SQLite/lift.db (+ sidecars).
// domain="file" addresses filesDir; the SQLite/ prefix is required.
// The whole SQLite/ directory is excluded (belt and braces: the directory
// rule plus explicit files, so a sidecar variation can never slip through).
// NOTE: only SQLite/ is excluded. Anything else the app writes to filesDir
// (e.g. a future in-app export file) WILL be included in OS backups —
// that is the user's own cloud copy, and the export flow tells them so.
const DB_DIR_EXCLUDE = `        <exclude domain="file" path="SQLite/"/>`;
const DB_FILES = [
  'SQLite/lift.db',
  'SQLite/lift.db-journal',
  'SQLite/lift.db-wal',
  'SQLite/lift.db-shm',
];

const excludes = [DB_DIR_EXCLUDE]
  .concat(DB_FILES.map((f) => `        <exclude domain="file" path="${f}"/>`))
  .join('\n');

const FULL_BACKUP_XML = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${excludes}
</full-backup-content>
`;

const DATA_EXTRACTION_XML = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
${excludes}
    </cloud-backup>
    <device-transfer>
${excludes}
    </device-transfer>
</data-extraction-rules>
`;

function withBackupRules(config) {
  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:fullBackupContent'] = '@xml/lift_backup_rules';
      app.$['android:dataExtractionRules'] = '@xml/lift_data_extraction_rules';
    }
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resXml = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      );
      fs.mkdirSync(resXml, { recursive: true });
      fs.writeFileSync(path.join(resXml, 'lift_backup_rules.xml'), FULL_BACKUP_XML);
      fs.writeFileSync(
        path.join(resXml, 'lift_data_extraction_rules.xml'),
        DATA_EXTRACTION_XML,
      );
      return config;
    },
  ]);

  return config;
}

module.exports = withBackupRules;
