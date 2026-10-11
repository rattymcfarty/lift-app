/**
 * Expo config plugin: excludes the training database from Android Auto Backup.
 *
 * Privacy is a hard requirement for LIFT — the SQLite database must NEVER
 * leave the device via Google Drive auto-backup or device-to-device transfer.
 *
 * expo-sqlite stores databases in <filesDir>/SQLite/ (domain="file"), NOT in
 * the databases/ directory (domain="database") — see SQLiteModule.kt
 * defaultDatabaseDirectory. The whole SQLite/ directory is excluded, which
 * covers lift.db and every journal/WAL sidecar (-journal, -wal, -shm).
 *
 * Writes two rule files (API <=30 uses fullBackupContent, API 31+ uses
 * dataExtractionRules) and points the <application> tag at both. Covers the
 * database in BOTH cloud-backup and device-transfer sections — a rule in
 * only one section leaks on new-phone setup.
 *
 * Idempotent under repeated `expo prebuild` runs.
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// domain="file" is rooted at <filesDir>; expo-sqlite keeps lift.db in SQLite/.
const excludes = [
  '        <exclude domain="file" path="SQLite/"/>',
  '        <exclude domain="file" path="SQLite/lift.db"/>',
  '        <exclude domain="file" path="SQLite/lift.db-journal"/>',
  '        <exclude domain="file" path="SQLite/lift.db-wal"/>',
  '        <exclude domain="file" path="SQLite/lift.db-shm"/>',
].join('\n');

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
