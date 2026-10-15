#!/bin/bash
# Rebuild the LIFT development rig from nothing (Ubuntu/Debian x86_64).
#
#   scripts/bootstrap-rig.sh            install everything that is missing
#   scripts/bootstrap-rig.sh --check    only report what is present / missing
#
# Idempotent: every step is skipped when its result already exists, so it is
# safe to re-run after a partial failure. Installs into the SAME locations the
# rest of the docs and scripts assume (see docs/ops/ENVIRONMENT.md):
#   ~/.local/node        Node 22     ~/tools/jdk-17.*   Temurin JDK 17
#   ~/Android/Sdk        Android SDK + emulator + AVD "lift-test"
#   ~/.maestro           Maestro E2E ~/.local/bin/gh    GitHub CLI
# It does NOT restore secrets (upload keystore, gh login) — see
# docs/ops/RECOVERY.md section "Secrets".
set -euo pipefail

CHECK=0; [ "${1:-}" = "--check" ] && CHECK=1
NODE_VERSION="22.21.1"
JDK_URL="https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
SDK_PACKAGES=(
  "platform-tools"
  "emulator"
  "platforms;android-36"
  "build-tools;35.0.0"
  "build-tools;36.0.0"
  "cmake;3.22.1"
  "ndk;27.1.12297006"
  "system-images;android-36;google_apis;x86_64"
)
GH_VERSION="2.102.0"
ANDROID_HOME="$HOME/Android/Sdk"
missing=()

say() { printf '\n== %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
note_missing() { missing+=("$1"); echo "MISSING: $1"; }

say "base packages"
if have apt-get && [ "$CHECK" = 0 ]; then
  sudo apt-get update -y
  sudo apt-get install -y curl unzip git ca-certificates openssl libpulse0 libnss3 libgl1 xz-utils
fi

say "node ${NODE_VERSION}"
if [ -x "$HOME/.local/node/bin/node" ]; then
  echo "ok: $("$HOME/.local/node/bin/node" -v)"
elif [ "$CHECK" = 1 ]; then note_missing "node"
else
  mkdir -p "$HOME/.local"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" | tar -xJ -C "$HOME/.local"
  rm -rf "$HOME/.local/node"
  mv "$HOME/.local/node-v${NODE_VERSION}-linux-x64" "$HOME/.local/node"
fi
export PATH="$HOME/.local/node/bin:$PATH"

say "JDK 17"
JDK_DIR="$(ls -d "$HOME"/tools/jdk-17* 2>/dev/null | grep -v jre | head -1 || true)"
if [ -n "$JDK_DIR" ] && [ -x "$JDK_DIR/bin/java" ]; then
  echo "ok: $JDK_DIR"
elif [ "$CHECK" = 1 ]; then note_missing "jdk17"
else
  mkdir -p "$HOME/tools"
  curl -fsSL -o "$HOME/tools/jdk17.tar.gz" "$JDK_URL"
  tar -xzf "$HOME/tools/jdk17.tar.gz" -C "$HOME/tools"
  JDK_DIR="$(ls -d "$HOME"/tools/jdk-17* | head -1)"
fi
export JAVA_HOME="${JDK_DIR:-}"
[ -n "$JAVA_HOME" ] && export PATH="$JAVA_HOME/bin:$PATH"

say "Android SDK command-line tools"
if [ -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "ok"
elif [ "$CHECK" = 1 ]; then note_missing "android cmdline-tools"
else
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  curl -fsSL -o /tmp/cmdtools.zip "$CMDLINE_TOOLS_URL"
  unzip -q -o /tmp/cmdtools.zip -d "$ANDROID_HOME/cmdline-tools"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi

SDKM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
say "Android SDK packages"
if [ -x "$SDKM" ] && [ -n "${JAVA_HOME:-}" ]; then
  installed="$("$SDKM" --list_installed 2>/dev/null || true)"
  for pkg in "${SDK_PACKAGES[@]}"; do
    if echo "$installed" | grep -qF "$pkg"; then echo "ok: $pkg"
    elif [ "$CHECK" = 1 ]; then note_missing "sdk: $pkg"
    else yes | "$SDKM" --licenses >/dev/null 2>&1 || true; "$SDKM" "$pkg"; fi
  done
fi

say "emulator AVD lift-test (Pixel 9, API 36, google_apis x86_64)"
if [ -d "$HOME/.android/avd/lift-test.avd" ]; then echo "ok"
elif [ "$CHECK" = 1 ]; then note_missing "avd lift-test"
elif [ -x "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" ]; then
  echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n lift-test \
    -k "system-images;android-36;google_apis;x86_64" -d pixel_9 --force
fi

say "Maestro"
if [ -x "$HOME/.maestro/bin/maestro" ]; then echo "ok"
elif [ "$CHECK" = 1 ]; then note_missing "maestro"
else curl -fsSL "https://get.maestro.mobile.dev" | bash; fi

say "GitHub CLI ${GH_VERSION}"
if have gh || [ -x "$HOME/.local/bin/gh" ]; then echo "ok"
elif [ "$CHECK" = 1 ]; then note_missing "gh"
else
  mkdir -p "$HOME/.local/bin"
  curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
    | tar -xz -C /tmp
  cp "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" "$HOME/.local/bin/gh"
fi

say "KVM (emulator acceleration)"
if [ -e /dev/kvm ] && [ -r /dev/kvm ] && [ -w /dev/kvm ]; then echo "ok"
else echo "WARNING: /dev/kvm not usable — the emulator will be very slow or fail. Add your user to the 'kvm' group."; fi

say "repositories"
mkdir -p "$HOME/lift"
for r in lift-app lift-kb; do
  if [ -d "$HOME/lift/$r/.git" ]; then echo "ok: $r"
  elif [ "$CHECK" = 1 ]; then note_missing "repo $r"
  else git clone "https://github.com/rattymcfarty/$r.git" "$HOME/lift/$r"; fi
done
if [ "$CHECK" = 0 ] && [ -d "$HOME/lift/lift-app" ] && [ ! -d "$HOME/lift/lift-app/node_modules" ]; then
  (cd "$HOME/lift/lift-app" && npm ci)
fi

echo
if [ "${#missing[@]}" -gt 0 ]; then
  echo "RESULT: ${#missing[@]} item(s) missing -> run without --check to install."
  printf ' - %s\n' "${missing[@]}"
  exit 1
fi
echo "RESULT: rig is complete. Next: restore secrets (docs/ops/RECOVERY.md), then scripts/verify-recovery.sh"
