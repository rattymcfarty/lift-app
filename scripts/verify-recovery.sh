#!/bin/bash
# Proves the project can be rebuilt from GitHub alone: fresh clones in a
# temp directory, clean dependency install, then the whole test suite.
#
#   scripts/verify-recovery.sh [--skip-install]
#
# Needs only Node 22 + network. Does not touch ~/lift or any secret.
set -euo pipefail
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
echo "== cloning into $W"
git clone --quiet https://github.com/rattymcfarty/lift-app.git "$W/lift-app"
git clone --quiet https://github.com/rattymcfarty/lift-kb.git  "$W/lift-kb"
cd "$W/lift-app"
echo "lift-app @ $(git rev-parse --short HEAD)   lift-kb @ $(git -C ../lift-kb rev-parse --short HEAD)"
[ -f package-lock.json ] || { echo "FAIL: package-lock.json missing from the repo"; exit 1; }
[ "${1:-}" = "--skip-install" ] || { echo "== npm ci"; npm ci --no-audit --no-fund --silent; }
# test:kb reads the sibling lift-kb/dist bundle, so build it first (it is git-ignored).
echo "== knowledge base bundle"
( cd "$W/lift-kb" && node scripts/build-bundle.mjs >/dev/null )
git -C "$W/lift-kb" diff --quiet -- channel.json || { echo "FAIL: channel.json sha does not match a fresh build"; exit 1; }
echo "kb: bundle builds, channel.json hash matches"
for t in typecheck test:kb test:p7 test:ui test:plan test:backup test:backup:roundtrip test:calculators test:programs test:progression test:stats; do
  printf '== npm run %s ... ' "$t"
  if npm run -s "$t" >/tmp/verify-$$.log 2>&1; then echo ok; else echo FAIL; tail -15 /tmp/verify-$$.log; exit 1; fi
done
echo
echo "RECOVERY VERIFIED: both repositories rebuild and pass from GitHub alone."
