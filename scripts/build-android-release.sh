#!/bin/bash
# Local Android release build (no EAS, no cloud). Produces:
#   android/app/build/outputs/bundle/release/app-release.aab  (Play upload)
#   android/app/build/outputs/apk/release/app-release.apk     (sideload test)
# Usage: scripts/build-android-release.sh [aab|apk|both]   (default: both)
# One-time keystore setup: scripts/setup-android-keystore.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-$HOME/tools/jdk-17.0.20.1+1}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
what="${1:-both}"

if ! grep -qs '^LIFT_UPLOAD_STORE_FILE=' "$HOME/.gradle/gradle.properties"; then
  echo "WARNING: no upload keystore configured; release will be debug-signed (NOT Play-uploadable)." >&2
  echo "         Run scripts/setup-android-keystore.sh first." >&2
fi

npx expo prebuild --platform android --no-install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
case "$what" in
  aab)  ./gradlew --no-daemon bundleRelease ;;
  apk)  ./gradlew --no-daemon assembleRelease ;;
  both) ./gradlew --no-daemon assembleRelease bundleRelease ;;
  *) echo "usage: $0 [aab|apk|both]" >&2; exit 2 ;;
esac
ls -lh app/build/outputs/apk/release/*.apk app/build/outputs/bundle/release/*.aab 2>/dev/null || true
