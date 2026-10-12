# Google Play Data Safety declaration — DRAFT

> **DRAFT — NOT SUBMITTED. Pending Matt's review.**
> This file is a working draft of the answers for the Play Console
> "Data safety" form and the Health apps declaration. It declares only what
> the app actually does today (v0.1.0, P5-complete). Re-verify against the
> shipped build before submitting; if anything below has changed, update this
> file first.

## 1. Data collection and sharing

**Declaration: No data collected. No data shared with third parties.**

Rationale (matches Play's definitions — "collection" means transmitting data
off the user's device):

- All user data (workouts, sets, measurements, routines, PRs, program
  progress, PAR-Q+ answers, settings) is stored in an on-device SQLite
  database and is never transmitted off the device by the app.
- The app's only network activity is downloading public knowledge-base
  content bundles (anonymous HTTPS GET of public JSON; no user data sent —
  see `docs/PRIVACY_POLICY.md`).
- No analytics, crash reporting, advertising, or third-party data-collecting
  SDKs are included.
- No accounts; no sign-in; no server component.

### Per-category answers (all "No")

| Data type | Collected? | Shared? |
|---|---|---|
| Personal info (name, email, address, …) | No | No |
| Financial info | No | No |
| Location | No | No |
| Photos, videos, audio, files | No* | No |
| App activity / app interactions | No | No |
| Health and fitness | No** | No |
| Contacts, calendar, messages | No | No |
| Device or other IDs | No | No |

\* The user-initiated export/import flow lets the user pick or share a JSON
file via the OS share sheet / file picker. The app does not transmit file
contents anywhere itself; the destination is the user's explicit choice.
\** Body measurements are typed in by the user and stored on-device only.
Per Play's definition this is not "collected" because it never leaves the
device.

### Security practices

With no data collected, the follow-up questions are answered accordingly:

- Data encrypted in transit: the only transmission is the anonymous KB
  content download, which is HTTPS-only. (Play marks this N/A when nothing
  is collected; the HTTPS fact is stated here for the record.)
- Data cannot be deleted by the user via an account (there are no accounts);
  all data is deleted by uninstalling the app or using the in-app "erase
  local data" option.
- Note for the record: the on-device SQLite database is protected by OS
  app-sandboxing only (no SQLCipher). No data leaves the device, so this
  does not affect the Data safety answers.

## 2. Health Connect / Health apps declaration

**NOT APPLICABLE — do not submit a Health apps declaration for this release.**

- LIFT v1 requests **zero** Health Connect permissions and integrates with
  neither Health Connect nor HealthKit. There is no health-data access,
  background or otherwise.
- The HealthKit/Health Connect permission-mapping table from the project plan
  (P4 exit item) was preparation work only; it is not in the repo and no
  health code ships in the app.
- ⚠️ When the post-v1 health integration lands, the following must happen
  **before** that release: complete the Play "Health apps" declaration,
  request only the permissions the feature actually uses, pass Play's health
  data review, update this file, and update the privacy policy. Do not copy
  this "not applicable" section forward.

## 3. Account deletion

Not applicable — the app has no accounts. (Play's account-deletion
requirement applies to apps with accounts.)

## 4. Before submitting (owner: Matt)

1. Re-verify every answer above against the actual release build.
2. Privacy policy must be hosted at a public URL (see
   `docs/PRIVACY_POLICY.md` open items).
3. If any network, analytics, or health code was added since this draft,
   rewrite this file first.
