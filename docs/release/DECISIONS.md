# LIFT — release decisions: drafted answers for Matt (DRAFT)

> Each item is a **proposed answer**, not a decision. Nothing below enrolls,
> pays, or publishes anything. Matt marks each Accept / Change.
> Context: MIT license, open source, no accounts, no servers, no revenue.

## H1 — Android package name  → proposed: `io.github.rattymcfarty.lift`
- Permanent after first Play upload (and the Play listing URL embeds it).
- Current `app.lift.mobile` implies owning the `lift.app` domain — we don't.
  Reverse-DNS from a GitHub namespace you do own is the standard open-source
  choice and can't collide with anyone.
- iOS bundle ID may differ; proposed the same value for consistency.
- Change = edit `app.json` (`android.package`, `ios.bundleIdentifier`) and
  rebuild; free while nothing has been uploaded.

## H6 — Version number  → proposed: `0.1.0` (versionCode 1) for closed test
- Closed-test builds are not "1.0". Keep `0.x` until the 14-day test ends,
  then `1.0.0`. Play needs `versionCode` to increase every upload; bump it in
  `app.json` (`android.versionCode`) each build.

## H2 / H3 — Fees  → proposed: Play only now; Apple later or never
Honest accounting — "zero fees" holds for everything except the store gates:

| Item | Cost | Needed? |
|---|---|---|
| Google Play developer account | **US$25, one-time** | Only to publish on Play. No free route. |
| Apple Developer Program | **US$99/year** | Only for TestFlight / App Store. No free route for distribution. |
| Expo Go (iPhone testing) | $0 | What we use now; not distributable to the public. |
| Local Android builds (this rig) | $0 | Yes — EAS is not required. |
| GitHub, GitHub Pages, Actions | $0 | Public repo. |
| Android sideload APK (GitHub Releases) | $0 | Alternative to Play with no fee. |

Proposed: the zero-cost path is **GitHub Releases APK + Expo Go** for testers.
Pay the $25 only when you want Play distribution; defer Apple until iOS
demand justifies $99/yr. Your call; Dash will not enroll or pay.

## H4 — Privacy policy URL  → proposed: GitHub Pages from this repo
- URL: `https://rattymcfarty.github.io/lift-app/PRIVACY_POLICY` after enabling
  Pages (Settings → Pages → Source: `main` / `/docs`). Free; no new account.
- Effective date: set at first release (placeholder in the draft).
- Needs a one-line contact (GitHub Issues URL is acceptable to Play).

## H5 — Name "LIFT"  → proposed: keep, with a distinguishing store title
- Short generic name = likely crowded in stores. Proposed store title
  "LIFT: Private Workout Log" (already in `STORE_LISTING.md`).
- Not legal advice: do a USPTO/EUIPO search for fitness-app classes before
  paying any fee. Fallback names: "LIFT Log", "Liftable".

## H7 — Closed-test testers (12 for 14 days)  → template, not a list
Dash cannot invent testers. Proposed recruiting message (paste anywhere):

> I'm testing LIFT, a free open-source workout tracker with no accounts and no
> tracking. I need 12 Android testers for 14 days to unlock Play release. It
> takes ~5 min to install and a workout or two a week. Reply with the Gmail
> address you use on Play and I'll add you.

Tracking table (fill in; needs Google-account emails, kept off the repo):

| # | Name/handle | Play email | Invited | Installed |
|---|---|---|---|---|
| 1–12 | | | | |

Zero-cost alternative that needs no tester minimum: public APK on GitHub
Releases.

## H8 — Final artwork  → status
| Asset | State | Spec |
|---|---|---|
| App icon | placeholder (`assets/brand/icon.png`) | 1024², no transparency |
| Adaptive icon | placeholder | 1024² foreground in the 66% safe zone, bg `#111827` |
| Play icon | derive from icon | 512² PNG |
| Feature graphic | placeholder (`assets/brand/feature-graphic.png`) | 1024×500 |
| Screenshots | 7 captured (`docs/release/screenshots/`) | ≥1080 px wide; re-shoot after icon polish |
Brief for an artist or generator: dark navy `#111827`, white + emerald
`#10B981`, barbell motif, no text on the icon, legible at 48 px.

## H9 — Build route  → proposed: local builds on ai-rig1 (already working)
- Works today: `npm run build:android` → signed AAB + APK in ~6 min, $0.
- EAS Build adds an Expo account and queue time; its only gain is iOS builds
  without a Mac. Revisit when/if Apple is enrolled.
- iOS: needs macOS + Xcode or EAS; cannot be built on this Linux rig.
- Back up `~/lift/secrets/lift-upload.jks` and its password off-rig.
