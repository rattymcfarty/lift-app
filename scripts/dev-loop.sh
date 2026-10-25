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
check "test:filters" "npm run test:filters"
check "test:adaptive" "npm run test:adaptive"
check "test:notifications" "npm run test:notifications"
check "test:plan" "npm run test:plan"
check "test:lifecycle" "npm run test:lifecycle"
# Invoked directly: same package.json-edit sandbox constraint as planned-sets.
check "test:companion" "node scripts/test-companion.mjs"
# Invoked directly: this sandbox's policy blocks edits to package.json, so the
# matching "test:workout-discard" npm script is pending.
check "test:workout-discard" "node scripts/test-workout-discard.mjs"
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
# Invoked directly: this sandbox's policy blocks edits to package.json, so the
# matching "test:exercise-menu" npm script is pending.
check "test:exercise-menu" "node scripts/test-exercise-menu.mjs"
# Invoked directly: this sandbox's policy blocks edits to package.json, so the
# matching "test:tab-order" npm script is pending (one line next to test:companion).
check "test:tab-order" "node scripts/test-tab-order.mjs"
check "test:panel" "npm run test:panel"
check "test:sheet" "npm run test:sheet"
check "test:programs:user" "npm run test:programs:user"
check "test:backup" "npm run test:backup"
check "test:backup:roundtrip" "npm run test:backup:roundtrip"
check "test:calculators" "npm run test:calculators"
check "test:programs" "npm run test:programs"
check "test:progression" "npm run test:progression"
check "test:stats" "npm run test:stats"
# Invoked directly: this sandbox's policy blocks edits to package.json, so the
# matching "test:icons" npm script is pending (one line next to test:lifecycle
# in package.json).
check "test:icons" "node scripts/test-icons.mjs"
check "test:rpe" "npm run test:rpe"
check "test:wheel" "npm run test:wheel"
check "test:content" "npm run test:content"
check "test:exercise-info" "npm run test:exercise-info"
check "test:filter-panel" "npm run test:filter-panel"
check "test:persona" "npm run test:persona"
check "test:agents" "npm run test:agents"
if [ "$OVERALL" -eq 0 ]; then echo "ALL GREEN"; else echo "SOME FAILURES (exit 1)"; exit 1; fi
