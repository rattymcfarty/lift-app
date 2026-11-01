# Privacy Policy — LIFT (Longevity Intelligent Fitness Trainer)

**Status:** DRAFT — pending Matt's review and a hosted URL before any store
submission. Effective date: to be set at first release.

**App:** LIFT ("Longevity Intelligent Fitness Trainer"), a free, open-source
(MIT) workout tracker by Matt (`rattymcfarty`).
**Repository:** https://github.com/rattymcfarty/lift-app

## The short version

LIFT is private by construction. There are no accounts, no sign-in, no
analytics, no crash reporting, no ads, and no servers of ours. Everything you
log — workouts, sets, body measurements, routines, personal records — is stored
in a database on your own device and nowhere else. The only network activity
is downloading public exercise/program content and published exercise-video
clips, which sends us nothing about you.

## Data that stays on your device

All training data lives in an on-device SQLite database:

- Workouts, sets, reps, weights, rest times
- Custom and built-in exercises, routines
- Body measurements you enter manually (weight, etc.)
- Personal records, program enrollments and progress, PAR-Q+ screening answers
- App settings and knowledge-base sync state

This data never leaves your device through LIFT. We have no servers that
receive it, and no third-party SDK in the app collects it.

## The public network calls: knowledge-base and exercise-video sync

LIFT downloads public exercise and program content ("knowledge base", KB) so
the built-in exercise library stays up to date, and it discovers published
exercise-video clips so a guide can show a movement demo. These are the only
network activities the app performs:

- **Knowledge base:** two public JSON files over HTTPS —
  `https://rattymcfarty.github.io/lift-kb/channel.json` and the versioned
  bundle it points to.
- **Published exercise videos:** one public GitHub contents listing of
  `https://api.github.com/repos/rattymcfarty/lift-app/contents/assets/exercises/demos`,
  cached on the device for one hour; the matching MP4s are streamed from
  `https://raw.githubusercontent.com/rattymcfarty/lift-app/`.
- Every request is anonymous: no account, no cookies, no auth headers, no
  query parameters, no device identifiers, and none of your training data is
  sent. The video listing carries only the app's public repository path.
- Each KB bundle is verified by SHA-256 hash and schema validation before use.
  Video files are public content; the app only plays the files that match the
  exercise you opened.
- Honest technical note: like any web request, the hosting providers
  (GitHub Pages, GitHub API and raw.githubusercontent.com) can see standard
  connection metadata such as your IP address at the network level. We do not
  receive, log, or process it — there is nothing on our end to receive it with.

If a download fails (e.g. you are offline), the app keeps working with the KB
snapshot and the bundled exercise clips it shipped with; a published-only clip
simply falls back to the placeholder.

## Notifications

Rest-timer alerts are local notifications scheduled on your device. Nothing
is sent to any server. Notification permission is requested only when you
start your first rest timer, never at install or launch.

## Export and import

You can export a full JSON copy of your data at any time from inside the app
(user-initiated, via your device's share sheet / file picker). Once you
export or share that file, it is under your control — LIFT cannot protect a
file you sent somewhere else, so share it only where you intend to.

## Device backups

LIFT opts its database out of automatic cloud backups: the database is
excluded from Android Auto Backup rules and flagged for exclusion from iCloud
backups on iOS. Other app files follow your own device backup settings, which
remain entirely under your control.

## Health integrations

The current version of LIFT does **not** integrate with Apple HealthKit,
Google Health Connect, or any wearable. Body metrics are values you type in
yourself. If a future version adds health-platform integration, this policy
will be updated before that version ships, and the integration will remain
opt-in.

## Deleting your data

- Uninstalling the app deletes the on-device database.
- The app also offers an "erase local data" option (in the data-recovery
  screen) that wipes the database without uninstalling.
- Export a copy first if you want to keep your history.

## Children

LIFT is a general fitness tracker not directed at children under 13, and it
collects no data from anyone.

## Changes to this policy

If this policy changes, the updated version will ship with the app and be
posted at the hosted URL below, with the effective date updated.

## Contact

Questions about this policy: open an issue at
https://github.com/rattymcfarty/lift-app
(or the contact method published at the hosted policy URL once set).

---

**Open items before release (owner: Matt):**
1. Host this policy at a public URL — required by Google Play and the App
   Store before submission.
2. Set the effective date at first release.
3. Legal review of this draft.
