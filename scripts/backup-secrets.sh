#!/bin/bash
# Encrypted backup/restore of the ONLY things that cannot live on GitHub:
#   - the Android upload keystore  (~/lift/secrets/lift-upload.jks)
#   - its Gradle credentials       (the LIFT_UPLOAD_* lines of ~/.gradle/gradle.properties)
#
#   scripts/backup-secrets.sh backup  <dest-dir>        -> <dest>/lift-secrets-YYYYMMDD.tar.enc
#   scripts/backup-secrets.sh restore <file.tar.enc>    -> puts them back in place (never overwrites)
#
# Encryption: AES-256-CBC + PBKDF2 via openssl; you are prompted for the
# passphrase (it is never stored, logged or passed on a command line).
# Store the .enc file somewhere OFF this machine (password manager, a cloud
# drive, a USB stick). Anyone with the file AND passphrase can sign builds as
# you, so keep the passphrase separate from the file.
set -euo pipefail

KEYSTORE="${LIFT_KEYSTORE:-$HOME/lift/secrets/lift-upload.jks}"
GRADLE_PROPS="${LIFT_GRADLE_PROPS:-$HOME/.gradle/gradle.properties}"
cmd="${1:-}"; arg="${2:-}"

pass_args() {
  # LIFT_BACKUP_PASSPHRASE exists ONLY for the automated self-test.
  if [ -n "${LIFT_BACKUP_PASSPHRASE:-}" ]; then echo "-pass env:LIFT_BACKUP_PASSPHRASE"; else echo ""; fi
}

case "$cmd" in
  backup)
    [ -n "$arg" ] || { echo "usage: $0 backup <dest-dir>" >&2; exit 2; }
    [ -f "$KEYSTORE" ] || { echo "keystore not found: $KEYSTORE" >&2; exit 1; }
    mkdir -p "$arg"
    work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
    cp "$KEYSTORE" "$work/lift-upload.jks"
    grep '^LIFT_UPLOAD_' "$GRADLE_PROPS" > "$work/lift-gradle-credentials.properties" || true
    tar -C "$work" -cf "$work/payload.tar" lift-upload.jks lift-gradle-credentials.properties
    out="$arg/lift-secrets-$(date +%Y%m%d).tar.enc"
    # shellcheck disable=SC2046
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt $(pass_args) -in "$work/payload.tar" -out "$out"
    chmod 600 "$out"
    echo "wrote $out"
    ;;
  restore)
    [ -f "$arg" ] || { echo "usage: $0 restore <file.tar.enc>" >&2; exit 2; }
    work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
    # shellcheck disable=SC2046
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 $(pass_args) -in "$arg" -out "$work/payload.tar"
    tar -C "$work" -xf "$work/payload.tar"
    mkdir -p "$(dirname "$KEYSTORE")" "$(dirname "$GRADLE_PROPS")"
    chmod 700 "$(dirname "$KEYSTORE")"
    if [ -e "$KEYSTORE" ]; then echo "keystore already exists, not overwriting: $KEYSTORE" >&2
    else cp "$work/lift-upload.jks" "$KEYSTORE"; chmod 600 "$KEYSTORE"; echo "restored $KEYSTORE"; fi
    if grep -q '^LIFT_UPLOAD_STORE_FILE=' "$GRADLE_PROPS" 2>/dev/null; then
      echo "gradle credentials already present, not overwriting: $GRADLE_PROPS" >&2
    else
      touch "$GRADLE_PROPS"; chmod 600 "$GRADLE_PROPS"
      cat "$work/lift-gradle-credentials.properties" >> "$GRADLE_PROPS"
      echo "restored LIFT_UPLOAD_* into $GRADLE_PROPS"
      echo "NOTE: LIFT_UPLOAD_STORE_FILE points at the ORIGINAL path; edit it if the keystore now lives elsewhere."
    fi
    ;;
  *)
    echo "usage: $0 backup <dest-dir> | restore <file.tar.enc>" >&2; exit 2 ;;
esac
