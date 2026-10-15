# Disaster recovery — rebuild LIFT from scratch

**Principle:** GitHub is the source of truth for *everything except secrets*.
Two public repos hold all code, content, docs, scripts, tests and this runbook.
The only things GitHub cannot hold are listed in §2.

## 0. What lives where

| Asset | Where it lives | If lost |
|---|---|---|
| App source, docs, scripts, tests, lockfile | GitHub `lift-app` | `git clone` |
| Exercise/program content, KB build, CI | GitHub `lift-kb` | `git clone` |
| Agent instructions + state | `CLAUDE.md`, `docs/ops/HANDOFF.md` (in `lift-app`) | `git clone` |
| Toolchain (Node, JDK, SDK, emulator, Maestro) | reinstallable | `scripts/bootstrap-rig.sh` |
| **Android upload keystore + passwords** | **only on the rig** (+ your encrypted backup) | restore from backup, else §2 |
| `gh` login token | rig (`~/.config/gh`) | `gh auth login` |
| Build artifacts (APK/AAB) | not stored | rebuild (`npm run build:android`) |
| User data on phones | each phone (+ user exports) | user's own backup file |

## 1. New machine, nothing but a shell

```bash
# 1. get the bootstrap script (no repo yet)
curl -fsSLO https://raw.githubusercontent.com/rattymcfarty/lift-app/main/scripts/bootstrap-rig.sh
bash bootstrap-rig.sh          # installs toolchain, clones both repos, npm ci  (~30 min, ~10 GB)

# 2. log in to GitHub (needed to push), interactive
gh auth login
git -C ~/lift/lift-app config user.name rattymcfarty
git -C ~/lift/lift-app config user.email rattymcfarty@users.noreply.github.com
git -C ~/lift/lift-kb  config user.name rattymcfarty
git -C ~/lift/lift-kb  config user.email rattymcfarty@users.noreply.github.com

# 3. prove the rebuild works (no secrets needed)
~/lift/lift-app/scripts/verify-recovery.sh
```

If `bootstrap-rig.sh` reports a download URL has moved, fix the URL at the top of the
script (Temurin JDK, Android cmdline-tools, Node, Maestro, gh) and re-run — it is
idempotent. Everything else (versions, paths) is in `docs/ops/ENVIRONMENT.md`.

## 2. Secrets (the only non-GitHub assets)

### 2a. Android upload keystore
Needed only to produce **Play-uploadable** builds. Without it everything still
builds (debug-signed) and works on a device; you just can't upload to Play.

*Restore from your encrypted backup:*
```bash
scripts/backup-secrets.sh restore /path/to/lift-secrets-YYYYMMDD.tar.enc   # prompts for passphrase
keytool -list -keystore ~/lift/secrets/lift-upload.jks | grep SHA-256       # compare with HANDOFF.md §5
```
The fingerprint must equal the one recorded in `docs/ops/HANDOFF.md`.

*Make the backup (do this now, and after any keystore change):*
```bash
scripts/backup-secrets.sh backup /somewhere/off-this-machine   # prompts for a passphrase
```
Store the `.enc` file and its passphrase **separately** (e.g. password manager +
cloud drive). Never commit it. Never paste the passphrase into a chat.

*If the keystore is truly lost:*
- App **never uploaded** to Play → generate a new one: `npm run setup:keystore`.
  Nothing else depends on it. Update the fingerprint in HANDOFF.md.
- App **already on Play** → use Play Console → *App integrity → App signing →
  Request upload key reset*. Google supports this because Play App Signing holds
  the real signing key. Then `npm run setup:keystore`, register the new certificate.

### 2b. GitHub access
`gh auth login` (browser/device flow). Repo write access is the owner's GitHub
account `rattymcfarty`. If the account itself is lost, any clone is a complete
copy (full history) — see §4.

## 3. Resuming development with a fresh AI agent

1. Start Claude Code (or any agent) in `~/lift/lift-app`. `CLAUDE.md` loads
   automatically; `AGENTS.md` points other agents to it.
2. Tell the agent: *"Read CLAUDE.md and docs/ops/HANDOFF.md, run `npm ci && npm run
   verify`, then continue with the top item under Next up."*
3. For device work the agent needs: an emulator (`~/lift/lift-app/CLAUDE.md` §7 explains
   how), or the owner's iPhone on the same Wi-Fi with Expo Go.

No chat history, memory or local files are required.

## 4. Redundancy beyond GitHub (recommended)

- **Second remote** (mirror): `git remote add backup <url>` in each repo, then
  `git push backup --all` (e.g. Codeberg/GitLab). One command pushes both:
  `scripts/push-all-remotes.sh`.
- **Offline copy:** `scripts/backup-local.sh /mnt/usb --with-secrets` writes git
  bundles of both repos (restore with `git clone lift-app.bundle lift-app`), the
  environment manifest, and the encrypted secrets.
- Run `scripts/verify-recovery.sh` after big changes and monthly: it clones fresh,
  `npm ci`, runs the whole suite and rebuilds the KB bundle.

## 5. Failure drills

| Symptom | Fix |
|---|---|
| `npm ci` fails on a missing lockfile entry | `package-lock.json` is committed; if it drifted, `npm install` then commit the result |
| Gradle can't find SDK | `echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties` (the build script does this) |
| `adb` offline / emulator gone mid-run | reboot it inside the same command as the test run (CLAUDE.md §7) |
| App shows old exercises after a KB bump | refresh the snapshot: `node scripts/sync-kb-snapshot.mjs ~/lift/lift-kb`; existing installs keep their imported rows |
| Push rejected (non-fast-forward) | `git pull --rebase origin main`, re-run `npm run verify`, push |
