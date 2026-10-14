# LIFT — store listing copy (DRAFT)

> DRAFT for Matt's review (gates H5 name clearance, H8 artwork). Claims below
> are limited to what ships in the app today. No expert/trainer names (plan §3);
> add the "not affiliated" line if any publication is cited.

## Google Play

**Title (≤30):** LIFT: Private Workout Log

**Short description (≤80):**
Free, open-source workout tracker. No account. Your data stays on your phone.

**Full description (≤4000):**

LIFT is a free, open-source workout tracker built around one idea: your
training data is yours.

No account. No sign-in. No ads. No analytics. Everything you log is stored in
a database on your own device — LIFT has no servers that receive it.

LOG WORKOUTS FAST
• Log sets, reps and weight with a numeric keypad built for the gym floor
• Warm-up sets that are kept out of your volume totals
• Supersets, swap an exercise mid-workout, recent exercises at your fingertips
• Timestamp-based rest timer with a local alert
• Built-in plate calculator

A LARGE EXERCISE CATALOGUE
• 433 exercises, bundled in the app and available fully offline
• Filter by muscle group, equipment and movement
• Content updates are downloaded as public data — nothing about you is sent

SEE YOUR PROGRESS
• History, personal records and progression charts
• Muscle balance and training "pillars" overview on your dashboard
• Body measurements and built-in calculators

BUILT FOR PRIVACY
• Export a full copy of your data any time; import it on a new phone
• The training database is excluded from Android cloud backup and
  device-transfer
• Light, dark or system theme; respects your font-size settings
• MIT-licensed — read the code at github.com/rattymcfarty/lift-app

LIFT is a training log, not medical advice. Check with a health professional
before starting an exercise program.

**Category:** Health & Fitness  **Tags:** workout log, strength training, gym
**Contact email / website / privacy policy URL:** Matt to supply (H4).

## Graphics needed (H8)
- App icon 512×512 — placeholder in `assets/brand/` (replace)
- Feature graphic 1024×500 — not created
- Phone screenshots — `docs/release/screenshots/` (7 captured; Matt selects)

## Test-track release notes (en-US, ≤500 chars)

First closed-test build of LIFT 0.1.0. Log workouts with sets, warm-ups,
supersets and a rest timer; browse 433 offline exercises; see history, PRs and
muscle balance; export/import your data. Please test: a full workout start to
finish, backup export + import, airplane-mode launch, dark mode. Report issues
at github.com/rattymcfarty/lift-app/issues.

## App Store (iOS) — mirror of the above
Subtitle (≤30): Private workout tracker
Privacy nutrition label: "Data Not Collected" — mirrors
`docs/release/PLAY_DATA_SAFETY.md`.
