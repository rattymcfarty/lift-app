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
  workout → add "Goblet Squat" → log 1 set (10 reps @ 20 kg) → open the RPE
  explainer from the RPE column header (Pip's intro, levels, worked example) →
  more sets, a warm-up row, a swap, the picker filters and the exercise detail
  tabs → finish → verify the exercise appears on the summary screen.
- `wheel.yaml` — the scroll drum: open it from a pending set's number, flick the
  weight three rows and assert the row keeps the value the drum settled on (7.5),
  then the reps tab (3). Guards the commit path: the first device pass showed the
  band moving while the row kept its old value.
- `workout-discard.yaml` — discard path: log a set → header Finish → the
  finish/discard sheet → Discard workout → confirm → back on Train with an
  empty History (the workout left no trace).
- `panels.yaml` — side panels: the top-left button opens the left menu (sections,
  New workout, Search, More), tapping a section jumps to it, a More item
  navigates and dismisses, the close button and a scrim tap dismiss, and the
  sliders button opens the Settings panel.
- `sheets.yaml` — shared sheet chrome: the actions sheet opens glass with its
  header, a pull down on the header dismisses it, and so do a backdrop tap and
  the header close.

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
| `set-reps-<n>`, `set-weight-<n>` | Set row value cells (n = set number). A tap opens the wheel; use `wheel-sheet-type` then type into `set-<field>-<n>-input` |
| `log-set-<n>` | Set row → Log button |
| `rpe-help` | Set table → RPE column header (opens the RPE explainer) |
| `plan-rpe-help` | Plan target editor → RPE field label (same explainer) |
| `edit-set-<n>` | Pending set row → set number (opens the wheel sheet) |
| `wheel-sheet`, `wheel-tab-<field>`, `wheel-sheet-done` | Wheel sheet, its field tabs and Done |
| `workout-finish` | Active workout → footer Finish workout |
| `workout-finish-bar` | Active workout → header Finish |
| `finish-sheet` | Finish/discard bottom sheet surface |
| `finish-sheet-finish` | Sheet → Finish workout |
| `finish-sheet-discard` | Sheet → Discard workout |
| `finish-sheet-cancel` | Sheet → Cancel |
| `topbar-panel` / `topbar-settings` | Top bar → open the left menu / the settings panel |
| `panel-close` | Open panel → close button |
| `panel-scrim` | Open panel → dimmed backdrop (tap dismisses) |
| `panel-tab-<key>` | Left panel → section row (programs, train, analytics, exercises) |
| `panel-new-workout`, `panel-search` | Left panel → quick actions |
| `panel-more-<key>` | Left panel → More row (history, records, balance, calculators, body-weight) |
| `settings-*` | Settings controls (also inside the right panel) |
| `<sheet>`, `<sheet>-close` | Any bottom sheet surface and its header close (see below) |
| `<sheet>-<value>` | Option picker (programs) → the choice with that value |

Every bottom sheet is the same component — `src/components/ui/BottomSheet.tsx`,
glass with rounded top corners, a grabber, a title and a close button; the option
pickers (`OptionSheet`) are thin wrappers over it. A sheet is dismissed by its
header close (`<testID>-close`), a tap on the dimmed backdrop, a pull down on the
header, or Android back. Surfaces in use: `finish-sheet`, `action-sheet`,
`warmup-sheet`, `reorder-sheet`, `superset-sheet`, `plate-sheet`, `muscle-sheet`,
`rest-timer`, `rpe-sheet`, `schedule-sheet`, `weeks-sheet`, `deload-sheet`,
`copy-week-sheet`, `day-sheet`.

The side panels close on a scrim tap; because the panel covers most of the
width, tap the bare strip on the far side (`tapOn: { point: "95%,50%" }` for the
left panel) rather than the scrim's centre.

Maestro taps use `tapOn: { id: "<testID>" }`. For alerts and system UI,
fall back to `tapOn: "<visible text>"`.
