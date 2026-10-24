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
| OpenCode | **v2** 2.0.31 (npm `@opencode/cli`), shared background service, signed in to the owner's Console | `~/.local/node/bin/opencode` (v1 in `~/.opencode/bin` is retired as `opencode.v1-disabled`) |

Environment variables used by the scripts:

```bash
export JAVA_HOME=$HOME/tools/jdk-17.0.20.1+1
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_AVD_HOME=$HOME/.android/avd
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$HOME/.local/node/bin:$PATH
```

## Project pins (see `package-lock.json` — committed, use `npm ci`)
Expo SDK 58 (`expo ~58.0.19`), React Native 0.88.0, React 19.3.0, TypeScript ~6.0.3,
expo-router ~58.0.25, expo-sqlite ~58.0.13, Drizzle ORM ^0.44, drizzle-kit ^0.31.

**Expo Go must be the SDK 58 build on both phones.** iOS updates automatically and
cannot be rolled back, which is why the project moved to 58. On Android the Play
Store build can still be an older SDK (it was 57 when this was written): Play cannot
update it to a version that does not exist there yet, and the client refuses an SDK
mismatch with a generic "something went wrong" screen. The server is not at fault —
the SDK 58 manifest and bundle serve fine (`curl -H 'expo-platform: android'
http://<lan-ip>:8081`). Install the SDK 58 Expo Go APK from
<https://expo.dev/go?sdkVersion=58&platform=android&device=true>
(`Expo-Go-58.0.5.apk` at the time of writing). If Android refuses the install
because the Play build is signed by a different key, uninstall the Play version
first. Verify with `adb shell dumpsys package host.exp.exponent | grep versionName`
— it must be a 58.x build.

Expo Go's native modules are frozen when each Expo Go build is published, and the
JavaScript packages keep moving: `expo-notifications` 58.1.6 needs
`ExpoTopicSubscriptionModule`, which Expo Go 58.0.5 for Android does not have. It is
loaded through `src/notifications/native.ts` for exactly this reason — the app starts
and everything except local notifications works there. To exercise notifications,
install a development build (`npx expo run:android`) or the release APK, which bundle
the module.

## Ports and URLs
- Metro / Expo Go: `8081` (LAN). Use the rig's LAN IP: `exp://<lan-ip>:8081`
  (`hostname -I` to find it; set `REACT_NATIVE_PACKAGER_HOSTNAME` to pin it).
- KB channel (runtime): `https://rattymcfarty.github.io/lift-kb/channel.json`.

## Build outputs
- `android/app/build/outputs/apk/release/app-release.apk` (sideload) and
  `.../bundle/release/app-release.aab` (Play). Both signed with the upload key when
  `~/.gradle/gradle.properties` has the `LIFT_UPLOAD_*` entries; otherwise debug-signed
  (the script warns).
- `dist/` in `lift-kb` holds the built KB bundle (git-ignored).

## Emulator quirks (see AGENTS.md §8 for the agent-sandbox ones)
- Boot flags that work headless with the host GPU:
  `-gpu host -no-window -no-audio -no-boot-anim -no-snapshot -wipe-data`.
- Simulate iOS "Display Zoom" / big text: `adb shell wm size 720x1280`,
  `adb shell wm density 360` (→ 320 dp wide) and
  `adb shell settings put system font_scale 1.3`. Reset with `wm size reset`,
  `wm density reset`, `font_scale 1.0`.
