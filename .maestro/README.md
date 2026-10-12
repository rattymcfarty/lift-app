# Maestro E2E Tests

End-to-end tests for LIFT using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

- Maestro CLI installed: `curl -Ls "https://get.maestro.mobile.dev" | bash`
  (requires Java 17+)
- Android emulator booted, or a physical device connected via ADB
- Debug APK built and installed:
  ```bash
  npx expo run:android --variant debug
  ```

## Running

```bash
npm run test:e2e
# or directly:
maestro test .maestro/workout-flow.yaml
```

## Flows

- `workout-flow.yaml` — happy path: launch (fresh state) → start blank
  workout → add "Goblet Squat" → log 1 set (10 reps @ 20 kg) → finish →
  verify the exercise appears on the summary screen.

## Writing new flows

Use `testID`s (not text) for taps — they're stable across theme/copy
changes. Key testIDs:

| testID | Element |
|---|---|
| `home-start-workout` | Home → Start workout button |
| `new-workout-start-blank` | New workout → Start blank workout |
| `workout-add-exercise` | Active workout → + Add exercise |
| `add-exercise-search` | Add exercise → search field |
| `add-exercise-row-<id>` | Add exercise → row per exercise id |
| `set-reps-<n>`, `set-weight-<n>` | Set row inputs (n = set number) |
| `log-set-<n>` | Set row → Log button |
| `workout-finish` | Active workout → Finish workout |

Maestro taps use `tapOn: { id: "<testID>" }`. For alerts and system UI,
fall back to `tapOn: "<visible text>"`.
