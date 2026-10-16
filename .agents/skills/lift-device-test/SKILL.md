---
name: lift-device-test
description: Run or add Maestro E2E flows on the Android emulator, check layouts at the zoom widths, and test idle/auto-finish with emulator clock shifts.
---

# Device tests (Android emulator + Maestro)

```bash
scripts/e2e.sh                       # default flows on the existing release APK
scripts/e2e.sh --build program-builder plan-picker   # rebuild APK (~5 min), run named flows
scripts/e2e.sh _zoom-fixture +60min _idle-prompt +4h _idle-autoclose   # clock-shift test
```

Prints one PASS/FAIL line per flow plus a log dir. A JS change needs `--build`;
the flow runs the signed release APK.

**Writing flows (`.maestro/*.yaml`):**
- Start with `runFlow: _skip-onboarding.yaml` (fresh installs show onboarding).
- Select by `id:` (`testID`). Text selectors are full-match regexes.
- `scrollUntilVisible` for anything that may be below the fold (add `direction: UP`
  to go back); `hideKeyboard` before tapping controls under the keyboard.
- Native alerts: `assertVisible: "Title\\?"` then `tapOn: "Button"`.
- Debug: `- takeScreenshot: dbg` (relative path) → `~/.maestro/tests/<ts>/<flow>/takeScreenshot/`.

**Zoom/layout:** check 288/320/411/514 dp (`.maestro/_zoom-fixture.yaml`,
`adb shell wm size` / `wm density`).

**Flakes:** "0 devices connected" or an install failure is emulator flakiness.
Rerun the same command. Background processes die between agent tool calls,
which is why the script boots the emulator itself.
