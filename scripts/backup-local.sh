#!/bin/bash
# One-command backup of everything recoverable from this machine, to a
# directory you choose (external drive, synced folder, ...):
#
#   scripts/backup-local.sh <dest-dir>
#
# Produces, inside <dest-dir>/lift-backup-YYYYMMDD-HHMM/:
#   lift-app.bundle, lift-kb.bundle     full git history (restorable with `git clone`)
#   environment.txt                      exact toolchain versions seen on this rig
#   lift-secrets-*.tar.enc               (only if you pass --with-secrets; prompts for a passphrase)
#
# GitHub is the primary backup; this is the belt-and-braces copy that also
# captures any commits not yet pushed.
set -euo pipefail
DEST="${1:?usage: $0 <dest-dir> [--with-secrets]}"
WITH_SECRETS=0; [ "${2:-}" = "--with-secrets" ] && WITH_SECRETS=1
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$DEST/lift-backup-$STAMP"
mkdir -p "$OUT"

for r in lift-app lift-kb; do
  d="$HOME/lift/$r"
  if [ -d "$d/.git" ]; then
    git -C "$d" bundle create "$OUT/$r.bundle" --all
    echo "unpushed commits in $r: $(git -C "$d" log --oneline @{u}..HEAD 2>/dev/null | wc -l)"
  else
    echo "skip $r (not a git checkout at $d)"
  fi
done

{
  echo "date: $(date -u +%FT%TZ)"
  echo "node: $(node -v 2>/dev/null || echo n/a)  npm: $(npm -v 2>/dev/null || echo n/a)"
  echo "java: $(java -version 2>&1 | head -1)"
  echo "maestro: $("$HOME/.maestro/bin/maestro" --version 2>/dev/null | tail -1)"
  echo "gh: $(gh --version 2>/dev/null | head -1)"
  uname -a
  git -C "$HOME/lift/lift-app" rev-parse HEAD 2>/dev/null | sed 's/^/lift-app HEAD: /'
  git -C "$HOME/lift/lift-kb" rev-parse HEAD 2>/dev/null | sed 's/^/lift-kb  HEAD: /'
} > "$OUT/environment.txt"

if [ "$WITH_SECRETS" = 1 ]; then
  "$(dirname "$0")/backup-secrets.sh" backup "$OUT"
else
  echo "secrets NOT included (re-run with --with-secrets to add the encrypted keystore backup)"
fi
echo "backup written to $OUT"
