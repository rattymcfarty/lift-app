# Secrets & privacy policy for a PUBLIC repository

Both repositories (`lift-app`, `lift-kb`) are **public and MIT/CC-licensed**.
Anything committed is readable by everyone, forever, including by scrapers that
copy it within minutes — deleting a file later does **not** un-publish it.
Rule zero: **if it is not meant for the whole internet, it never touches a commit.**

## 1. Classification

| Class | Examples | Where it lives |
|---|---|---|
| **Secret** — never in git | Android upload keystore (`*.jks`) and its passwords, GitHub tokens/`gh` login, OpenCode service-account key (`oc_sk_…`, `~/lift/secrets/opencode-sa.key`), any API key, signing certs, Play/Apple credentials | rig only (`~/lift/secrets/`, `~/.gradle/gradle.properties`, `~/.config/gh`) + **encrypted** offline backup (`scripts/backup-secrets.sh`) |
| **Personal data** — never in git | real email addresses, phone, home LAN IPs, physical location, other people's data | commit identity uses the GitHub **noreply** address; docs use `<lan-ip>` placeholders |
| **Public by design** — fine in git | upload-key *SHA-256 fingerprint*, app package name, GitHub username, store listing text, privacy policy, the KB content | repo |
| **Never public** | the user's own training data — it only ever exists on their phone/backup file | user device |

The keystore fingerprint recorded in `HANDOFF.md` is a *public certificate hash*;
it lets a restored keystore be verified and reveals nothing exploitable.

## 2. Defences already in place

1. **GitHub secret scanning + push protection** — enabled on both repos (verified via the API).
2. **`.gitignore`** blocks keystores, `.env*`, credentials, `*.enc`, `secrets/`,
   `gradle.properties`, `local.properties`, google-services files.
3. **Pre-commit hook** (`scripts/hooks/pre-commit`, installed automatically by
   `npm ci` via the `prepare` script, or `scripts/install-hooks.sh`):
   - runs `scripts/secrets-scan.sh --staged` (secret-looking values, key
     material, forbidden filenames, personal emails, private IPs);
   - **refuses to commit if `git config user.email` is not a noreply address.**
4. **`npm run secrets:scan`** (working tree) and **`npm run secrets:history`**
   (every commit) — also part of `npm run verify`.
5. **Keystore is outside the repo**; `backup-secrets.sh` encrypts it with AES-256 + PBKDF2
   before it goes anywhere.
6. The app itself holds **no secrets**: no API keys, no accounts, no analytics SDKs.

## 3. Day-to-day rules (for humans and agents)

- Never paste a password, token or passphrase into chat, a commit message, an issue
  or a file. Interactive prompts only.
- Never `git add -A` blindly; read `git status`/`git diff --cached`. `package-lock.json`
  is committed on purpose; nothing else outside source/docs/tests/scripts should be.
- Use `<lan-ip>`, `<user>`, `<keystore-path>` placeholders in docs.
- If the scanner flags a reviewed, deliberate match, put `secrets-scan:allow` on that line.
- Don't disable the hook (`--no-verify`) except to fix the hook itself.

## 4. Known exposure (history) — status and options

**Finding (2026-10-14):** 42 commits in `lift-app` and 39 in `lift-kb` made before the
noreply identity was configured carry the owner's personal Gmail address as the
commit author email. It is visible to anyone via `git log`/the GitHub API. No
credentials are involved, but it is personal data in a public history.

Options, least to most disruptive:

| Option | Effect | Cost |
|---|---|---|
| **A. Stop the bleeding (do this regardless)** | GitHub → Settings → Emails → tick **"Keep my email addresses private"** and **"Block command line pushes that expose my email"**. Combined with the hook, no new commits can expose it. | none |
| **B. Accept the existing exposure** | History stays as is. The address is already indexable; treat it as public, expect spam, enable 2FA, don't use it as a recovery address for anything critical. | none |
| **C. Rewrite history** | `git filter-repo --mailmap` replaces the address with the noreply one in every commit, then force-push both repos. | All commit SHAs change; every clone/fork must re-clone; open references to old SHAs break. **Does not guarantee removal**: GitHub can keep old commits reachable by SHA (ask GitHub Support to run garbage collection / purge cached views) and third parties may already have copies. |

Recommendation: **A now; B unless the owner wants C.** If C is chosen:
```bash
pip install git-filter-repo
git clone --mirror https://github.com/rattymcfarty/lift-app.git && cd lift-app.git
printf '%s\n' 'rattymcfarty <rattymcfarty@users.noreply.github.com> <OLD-EMAIL>' > ../mailmap
git filter-repo --mailmap ../mailmap
git push --force --mirror          # then repeat for lift-kb; re-clone everywhere
```
(then update `HANDOFF.md` §5 with the new HEAD and re-run `scripts/verify-recovery.sh`).

## 5. If a real secret is ever committed

1. **Assume compromised.** Rotate it first (new keystore / revoke token / change password).
   Play upload key: Play Console → App integrity → request upload-key reset.
2. Remove it from the tree and from history (`git filter-repo --path <file> --invert-paths`
   or `--replace-text`), force-push, and ask GitHub Support to purge cached commits.
3. Check GitHub's secret-scanning alerts; close them once rotated.
4. Add a regression pattern to `scripts/secrets-scan.sh`.

## 6. Owner checklist (needs your GitHub account — not done by the agent)

- [ ] Settings → Emails: **Keep my email addresses private** + **Block command line pushes that expose my email**.
- [ ] Settings → Password and authentication: two-factor authentication on.
- [ ] Each repo → Settings → Code security: **Dependabot alerts** and **security updates** on
      (currently disabled), secret scanning + push protection stay on.
- [ ] Each repo → Settings → Branches: consider a ruleset blocking force-pushes to `main`
      (do this *after* any history rewrite).
- [ ] Run `scripts/backup-secrets.sh backup <dir>` and store the file + passphrase off-rig.
