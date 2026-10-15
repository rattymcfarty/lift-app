# Development environment (exact, reproducible)

Captured from the working rig on 2026-10-14. `scripts/bootstrap-rig.sh` installs
all of this; `--check` reports what is missing.

## Machine
- Linux x86_64 (Ubuntu-like), user `dash`, home `/home/dash`. KVM available
  (`/dev/kvm`) — the Android emulator is unusably slow without it.
- Disk: ~10 GB for SDK + emulator image + builds; ~2 GB for `node_modules`.
- Network needed for installs and for the KB fetch at runtime; builds are otherwise offline.

## Toolchain (locations are assumed by scripts and docs)
| Tool | Version | Location |
|---|---|---|
| Node | 22.21.1 (npm 10.9.4) | `~/.local/node/bin` |
| JDK | Temurin 17.0.20.1+1 | `~/tools/jdk-17.0.20.1+1` |
| Android cmdline-tools | 19.0 (`latest`) | `~/Android/Sdk/cmdline-tools/latest` |
| Android SDK | platform-tools 37.0.1, emulator 37.2.12, platforms;android-36, build-tools 35.0.0 + 36.0.0, cmake 3.22.1, NDK 27.1.12297006 | `~/Android/Sdk` |
| Emulator image | system-images;android-36;google_apis;x86_64 (rev 7) | `~/Android/Sdk/system-images` |
| AVD | `lift-test`: Pixel 9, 1080×2424, 420 dpi, 2 GB RAM, 6 GB data, x86_64, no Play Store | `~/.android/avd/lift-test.avd` |
| Maestro | CLI from get.maestro.mobile.dev | `~/.maestro/bin` |
| GitHub CLI | 2.102.0 | `~/.local/bin/gh` |
| Gradle | 9.3.1 via the project wrapper (downloads itself) | `android/gradlew` |

Environment variables used by the scripts:

```bash
export JAVA_HOME=$HOME/tools/jdk-17.0.20.1+1
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_AVD_HOME=$HOME/.android/avd
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$HOME/.local/node/bin:$PATH
```

## Project pins (see `package-lock.json` — committed, use `npm ci`)
Expo SDK 57 (`expo ~57.0.x`), React Native 0.86.3, React 19.2.3, TypeScript ~6.0.3,
expo-router ~57.0.x, expo-sqlite ~57.0.x, Drizzle ORM ^0.44, drizzle-kit ^0.31.
Expo Go on the iPhone must be the version that supports SDK 57.

## Ports and URLs
- Metro / Expo Go: `8081` (LAN). Use the rig's LAN IP: `exp://192.168.0.150:8081`
  (`hostname -I` to find it; set `REACT_NATIVE_PACKAGER_HOSTNAME` to pin it).
- KB channel (runtime): `https://rattymcfarty.github.io/lift-kb/channel.json`.

## Build outputs
- `android/app/build/outputs/apk/release/app-release.apk` (sideload) and
  `.../bundle/release/app-release.aab` (Play). Both signed with the upload key when
  `~/.gradle/gradle.properties` has the `LIFT_UPLOAD_*` entries; otherwise debug-signed
  (the script warns).
- `dist/` in `lift-kb` holds the built KB bundle (git-ignored).

## Emulator quirks (see CLAUDE.md §7 for the agent-sandbox ones)
- Boot flags that work headless with the host GPU:
  `-gpu host -no-window -no-audio -no-boot-anim -no-snapshot -wipe-data`.
- Simulate iOS "Display Zoom" / big text: `adb shell wm size 720x1280`,
  `adb shell wm density 360` (→ 320 dp wide) and
  `adb shell settings put system font_scale 1.3`. Reset with `wm size reset`,
  `wm density reset`, `font_scale 1.0`.
