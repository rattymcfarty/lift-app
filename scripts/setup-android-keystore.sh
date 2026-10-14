#!/bin/bash
# One-time: create the Play upload keystore OUTSIDE the repo and register it
# with Gradle via ~/.gradle/gradle.properties (chmod 600). Never prints or
# commits the password. BACK UP ~/lift/secrets/lift-upload.jks AND the
# password line in ~/.gradle/gradle.properties somewhere safe — losing them
# means a Play upload-key reset request.
set -euo pipefail
export JAVA_HOME="${JAVA_HOME:-$HOME/tools/jdk-17.0.20.1+1}"
KS="$HOME/lift/secrets/lift-upload.jks"
GP="$HOME/.gradle/gradle.properties"
if [ -f "$KS" ]; then echo "keystore already exists: $KS (not overwriting)"; exit 0; fi
mkdir -p "$(dirname "$KS")" "$HOME/.gradle"; chmod 700 "$(dirname "$KS")"
PW="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
"$JAVA_HOME/bin/keytool" -genkeypair -v -storetype PKCS12 -keystore "$KS" \
  -alias lift-upload -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PW" -keypass "$PW" -dname "CN=LIFT Upload, O=LIFT, C=US" >/dev/null
chmod 600 "$KS"
touch "$GP"; chmod 600 "$GP"
cat >> "$GP" <<EOF
LIFT_UPLOAD_STORE_FILE=$KS
LIFT_UPLOAD_STORE_PASSWORD=$PW
LIFT_UPLOAD_KEY_ALIAS=lift-upload
LIFT_UPLOAD_KEY_PASSWORD=$PW
EOF
echo "created $KS and registered it in $GP"
