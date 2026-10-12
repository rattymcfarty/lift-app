# LIFT Release Checklist — QA / production validation

**Scope:** everything needed to take LIFT from the current dev state
(P5-complete, `main` @ e99619d) to a submittable release candidate, without
spending Matt's money or authority.
**Status legend:** [x] done · [ ] open · [H] human gate (Matt decides)

## 1. Version and identity

- [ ] Decide the release version number (currently `0.1.0` in app.json). [H]
- [H] **UNRESOLVED — android.package `app.lift.mobile`:** Matt's call before
  Play upload. The package name is permanent once the first artifact is
  uploaded — it cannot be changed afterwards. iOS bundle ID currently mirrors
  it (`app.lift.mobile`); the two are independent, so iOS can diverge if
  Matt prefers, but decide before first upload on each store.
- [ ] App name / trademark: "LIFT" clearance is Matt's call before store
  metadata is finalized. [H]

## 2. QA validation (release candidate)

Run all of these against the release build, in order:

- [x] `npm run typecheck` — must be clean (re-run on the release tree).
- [ ] All unit test scripts green: `test:backup`, `test:backup:roundtrip`,
  `test:calculators`, `test:programs`, `test:progression`, `test:stats`.
- [ ] Maestro E2E `npm run test:e2e` — 15/15 green on emulator, fresh app
  state (last green: P5, 2026-10-12; re-run for the release build).
- [ ] Fresh install: migration chain m0000–m0008 applies on real SQLite, zero
  FK violations, 12 tables.
- [ ] First-launch KB snapshot seeding (P5 fix) — fresh install shows the
  built-in exercises with no network.
- [ ] Offline launch — KB channel unreachable: app works, no user-facing
  error (sync retries next launch; verified in code `src/kb/index.ts`).
- [ ] Backup round-trip: export → erase local data → import → data intact.
- [ ] Rest timer: schedule, background the app, alert fires.
- [ ] Themes: light / dark / system; font scaling capped at 1.3x; safe areas
  (notch, gesture bar) on small → large screens.
- [ ] Expo Go on iPhone — smoke test (Matt). [H]
- [ ] Physical Android device — launch + log a full workout (Matt). [H]

## 3. Build and signing

- [ ] Decide production build route: EAS Build (needs an Expo account —
  Matt's call) vs local release builds on ai-rig1. [H]
- [ ] Android: release AAB signed with the upload keystore. Generate once,
  back up securely, **never commit** (`.gitignore` already covers keystores,
  p12/pem, mobileprovision).
- [ ] iOS: distribution certificate + provisioning profile (needs the Apple
  Developer account — see §6).
- [ ] Verify `app.json`: version, package/bundle ID (after §1 decision),
  add `icon` + `adaptiveIcon` (currently **missing** — no icon configured),
  confirm plugins (`withAndroidBackupRules`, `withIosBackupExclusion`,
  `expo-notifications`).

## 4. Google Play — closed test track

- [H] **UNRESOLVED — Play Console $25 registration fee:** needs Matt's
  explicit go-ahead. Nothing enrolled, paid, or submitted by Dash.
- [ ] Create app in Play Console (after the package-name decision, §1).
- [ ] Data safety form — draft ready: `docs/release/PLAY_DATA_SAFETY.md`
  ("No data collected", no Health declaration). Re-verify against the release
  build; Matt reviews before submit. [H]
- [ ] Privacy policy hosted at a public URL (required). Draft:
  `docs/PRIVACY_POLICY.md`; hosting + effective date are open items. [H]
- [ ] Content rating questionnaire (IARC) — fitness app, no objectionable
  content; complete truthfully at submission time.
- [ ] Target audience / "Designed for Families": not a children's app.
- [ ] Store listing: short + full description (privacy-forward positioning),
  screenshots (see §5), feature graphic 1024×500, app icon 512×512. [H]
- [ ] Closed test: 12 testers, 14-day minimum before production. Tester list
  is Matt's call. [H]
- [ ] Release notes for the test track.

## 5. Screenshots and store media

- [x] Emulator screenshot flow (1080×2424, Play-minimum width): captured in
  this workstream → `docs/release/screenshots/` (dashboard, workout logging,
  history/progress, measure, calculators).
- [ ] Matt selects final screenshots; feature graphic + icon still needed
  (no icon exists in the repo yet — see §3). [H]
- [ ] iPhone screenshots for App Store (6.7" + 6.5" sets) — capture from
  Matt's device or simulator at submission time. [H]

## 6. Apple — TestFlight

- [H] **UNRESOLVED — Apple Developer Program enrollment:** needs Matt's
  explicit go-ahead (his standing trigger is "working app"). Nothing
  enrolled, paid, or submitted by Dash.
- [ ] Bundle ID decision (see §1).
- [ ] App Store privacy nutrition labels — mirror the Data safety draft
  (`docs/release/PLAY_DATA_SAFETY.md`).
- [ ] Export compliance: answer at submission (app uses SHA-256 hashing for
  KB bundle verification and `expo-crypto` for ID generation — no
  user-data encryption; answer carefully, do not guess).
- [ ] TestFlight internal → external testers; App Store review notes.

## 7. Pre-push / pre-tag hygiene

- [ ] `git status` clean on the release tree; CHANGELOG or release-notes
  entry for the version.
- [ ] Tag the release commit (`v1.0.0` or chosen version) after Matt's
  approval of the final push batch. [H]

## 8. Human gates — summary (nothing proceeds without Matt)

| # | Gate | Why it blocks |
|---|---|---|
| H1 | android.package `app.lift.mobile` — Matt's call | Permanent after first Play upload |
| H2 | Play Console $25 fee — Matt's explicit go-ahead | Money + his account |
| H3 | Apple Developer Program — Matt's explicit go-ahead | Money + his account; his trigger is "working app" |
| H4 | Privacy policy hosted URL + effective date | Required by both stores |
| H5 | "LIFT" name/trademark clearance | Store metadata |
| H6 | Release version number | Tags, store listings |
| H7 | 12 closed-test testers list | Play 14-day closed test |
| H8 | App icon / feature graphic / final screenshots | Store listings |
| H9 | Production build route (EAS vs local) | Account + signing |
| H10 | Expo Go iPhone + physical Android validation | Real-device QA |

**Standing rule:** Dash does not enroll in, pay for, or submit anything to
either store. All H-gates are Matt's.
