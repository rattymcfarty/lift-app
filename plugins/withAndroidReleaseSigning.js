/**
 * Expo config plugin: signs the Android release build with a local upload
 * keystore instead of the debug key that `expo prebuild` wires in by default.
 *
 * Credentials are never stored in the repo. They are read at build time from
 * Gradle properties (~/.gradle/gradle.properties or -P flags):
 *   LIFT_UPLOAD_STORE_FILE, LIFT_UPLOAD_STORE_PASSWORD,
 *   LIFT_UPLOAD_KEY_ALIAS,  LIFT_UPLOAD_KEY_PASSWORD
 * If they are absent the release build falls back to the debug key, so a
 * plain `prebuild` / CI typecheck keeps working (such an APK is NOT
 * Play-uploadable).
 *
 * Idempotent under repeated `expo prebuild` runs.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// LIFT release signing';

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;

    const signing = `
        ${MARK}
        release {
            if (project.hasProperty('LIFT_UPLOAD_STORE_FILE')) {
                storeFile file(LIFT_UPLOAD_STORE_FILE)
                storePassword LIFT_UPLOAD_STORE_PASSWORD
                keyAlias LIFT_UPLOAD_KEY_ALIAS
                keyPassword LIFT_UPLOAD_KEY_PASSWORD
            }
        }`;
    // Add a release signingConfig after the debug one.
    src = src.replace(
      /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\})/,
      `$1${signing}`
    );
    // Point the release buildType at it (when configured).
    src = src.replace(
      /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('LIFT_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
    );
    cfg.modResults.contents = src;
    return cfg;
  });
};
