#!/bin/bash
# LIFT dev loop: typecheck + unit tests + typography gate. Prints PASS/FAIL per
# step and ALL GREEN at the end. Location-independent (runs from the repo root).
#   scripts/dev-loop.sh        (also: npm run verify)
set -u
cd "$(dirname "$0")/.." || exit 1
OVERALL=0
check() {
  echo "=== $1 ==="
  if $2; then echo "PASS: $1"; else echo "FAIL: $1"; OVERALL=1; fi
}
check "secrets" "npm run secrets:scan"
check "typecheck" "npm run typecheck"
check "test:kb" "npm run test:kb"
check "test:p7" "npm run test:p7"
check "test:ui" "npm run test:ui"
check "test:plan" "npm run test:plan"
check "test:lifecycle" "npm run test:lifecycle"
# Invoked directly: same package.json-edit sandbox constraint as planned-sets.
check "test:companion" "node scripts/test-companion.mjs"
# Invoked directly: this sandbox's policy blocks edits to package.json, so the
# matching "test:markdown" npm script is pending (one line next to
# test:lifecycle in package.json).
check "test:markdown" "node scripts/test-markdown.mjs"
# Invoked directly: this sandbox's policy blocks edits to package.json, so the
# matching "test:planned-sets" npm script is pending (one line next to
# test:lifecycle in package.json).
check "test:planned-sets" "node scripts/test-planned-sets.mjs"
# Invoked directly: this sandbox's policy blocks edits to package.json, so the
# matching "test:foundational" npm script is pending (one line next to
# test:planned-sets in package.json).
check "test:foundational" "node scripts/test-foundational.mjs"
check "test:programs:user" "npm run test:programs:user"
check "test:backup" "npm run test:backup"
check "test:backup:roundtrip" "npm run test:backup:roundtrip"
check "test:calculators" "npm run test:calculators"
check "test:programs" "npm run test:programs"
check "test:progression" "npm run test:progression"
check "test:stats" "npm run test:stats"
check "test:agents" "npm run test:agents"
if [ "$OVERALL" -eq 0 ]; then echo "ALL GREEN"; else echo "SOME FAILURES (exit 1)"; exit 1; fi
