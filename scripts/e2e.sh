#!/bin/bash
# One command for the whole device-test loop, printing ONLY a short summary
# (the full logs go to a file). Replaces the long hand-written boot/install/run
# sequences, which are slow and — in an AI session — burn a lot of context.
#
#   scripts/e2e.sh                  boot emulator, install the existing release APK,
#                                   run every flow
#   scripts/e2e.sh --build          build the release APK first (~5 min)
#   scripts/e2e.sh onboarding tabs  run only the named flows
#   scripts/e2e.sh _zoom-fixture +60min _idle-prompt +4h _idle-autoclose
#       tokens like +60min / +4h move the emulator clock FORWARD (cumulative)
#       before the next flow — used to test idle detection and auto-finish.
#
# Output: one PASS/FAIL line per flow + the log directory. Needs the rig from
# docs/ops/ENVIRONMENT.md. Emulator is booted inside this script because
# background processes do not survive between agent tool calls.
set -uo pipefail
cd "$(dirname "$0")/.."
export ANDROID_HOME="$HOME/Android/Sdk" ANDROID_AVD_HOME="$HOME/.android/avd"
export JAVA_HOME="${JAVA_HOME:-$HOME/tools/jdk-17.0.20.1+1}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$PATH"
LOG="${TMPDIR:-/tmp}/lift-e2e-$(date +%H%M%S)"; mkdir -p "$LOG"

BUILD=0; FLOWS=()
for a in "$@"; do [ "$a" = "--build" ] && BUILD=1 || FLOWS+=("$a"); done
[ ${#FLOWS[@]} -eq 0 ] && FLOWS=(onboarding tabs user-content workout-flow)

if [ "$BUILD" = 1 ]; then
  echo "building release APK (≈5 min)…"
  bash scripts/build-android-release.sh apk > "$LOG/build.log" 2>&1 || { echo "BUILD FAILED — see $LOG/build.log"; tail -15 "$LOG/build.log"; exit 1; }
fi
APK=android/app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || { echo "no APK at $APK — run with --build"; exit 1; }

adb kill-server >/dev/null 2>&1; adb start-server >/dev/null 2>&1
nohup setsid "$ANDROID_HOME/emulator/emulator" -avd lift-test -gpu ${EMU_GPU:-swiftshader_indirect} -no-window -no-audio \
  -no-boot-anim -no-snapshot -wipe-data > "$LOG/emulator.log" 2>&1 < /dev/null &
adb wait-for-device
for _ in $(seq 1 70); do
  sleep 5
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ] && adb shell pm path android >/dev/null 2>&1 && break
done
sleep 8
ok=0; for _ in 1 2 3; do adb install -r "$APK" 2>&1 | tail -1 | grep -q Success && { ok=1; break; }; sleep 10; done
[ "$ok" = 1 ] || { echo "install failed (see $LOG)"; exit 1; }

shift_total=0
shift_clock() { # seconds
  shift_total=$((shift_total + $1))
  # A real idle phone is backgrounded/locked: send the app to the background
  # first, otherwise its on-screen heartbeat would keep stamping the new time.
  adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1; sleep 2
  adb root >/dev/null 2>&1; sleep 2
  adb shell settings put global auto_time 0 >/dev/null 2>&1
  adb shell settings put global auto_time_zone 0 >/dev/null 2>&1
  local t; t="$(date -u -d "@$(( $(date +%s) + shift_total ))" +%m%d%H%M%Y.%S)"
  adb shell "date -u $t" >/dev/null 2>&1
  echo "clock shifted +$((shift_total / 60)) min (device now: $(adb shell date | tr -d '\r'))"
}

fail=0
for f in "${FLOWS[@]}"; do
  if [[ "$f" =~ ^\+([0-9]+)(min|h)$ ]]; then
    n="${BASH_REMATCH[1]}"; [ "${BASH_REMATCH[2]}" = h ] && n=$((n * 60))
    shift_clock $((n * 60)); continue
  fi
  # The emulator occasionally drops between flows; re-check and retry once.
  adb get-state >/dev/null 2>&1 || { echo "emulator lost before '$f' — rerun"; fail=1; break; }
  if timeout 600 maestro test ".maestro/$f.yaml" > "$LOG/$f.log" 2>&1; then
    echo "PASS  $f"
  else
    echo "FAIL  $f   → $(grep -E 'FAILED|Element not found|Assertion' "$LOG/$f.log" | head -2 | tr '\n' ' ')"
    fail=1
  fi
done
adb logcat -d -t 4000 > "$LOG/logcat.txt" 2>/dev/null
echo "logs: $LOG"
exit $fail
