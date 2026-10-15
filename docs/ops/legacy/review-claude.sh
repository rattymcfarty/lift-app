#!/bin/bash
# LIFT review gate — hostile read-only review via Claude Code (headless).
# Usage: review.sh <directory> [app|kb]
#   <directory>  path to the tree to review (e.g. ~/lift/lift-app)
#   [app|kb]     review profile; defaults to auto-detect from directory name
# Output: ranked findings (BLOCKERS / SHOULD-FIX / NITPICKS) on stdout.
# Claude is invoked read-only: it must not create, modify, or delete files.
set -u

TARGET="${1:?Usage: review.sh <directory> [app|kb]}"
PROFILE="${2:-auto}"
PLAN="$HOME/lift/IMPLEMENTATION_PLAN_v0.4.md"

if [ ! -d "$TARGET" ]; then
  echo "ERROR: directory not found: $TARGET" >&2
  exit 1
fi
if [ "$PROFILE" = "auto" ]; then
  case "$TARGET" in
    *lift-app*) PROFILE="app" ;;
    *lift-kb*)  PROFILE="kb" ;;
    *) echo "ERROR: cannot auto-detect profile; pass app or kb explicitly" >&2; exit 1 ;;
  esac
fi
if [ ! -f "$PLAN" ]; then
  echo "ERROR: plan not found: $PLAN" >&2
  exit 1
fi

read -r -d '' COMMON <<'EOF'
You are doing a HOSTILE code review. Read-only: do NOT create, modify, or delete any files. Do not run any build commands.
Report findings in EXACTLY this format:
## BLOCKERS (must fix before this ships; wrong behavior, crashes, data loss, privacy leaks, CI failures)
- `[path/to/file:LINE] Title — one-sentence explanation and impact.`
## SHOULD-FIX (real problems that will bite later if not addressed)
- `[path/to/file:LINE] Title — explanation.`
## NITPICKS (style, minor robustness, docs)
- `[path/to/file:LINE] Title — explanation.`
Be adversarial and specific. Cite exact file paths and line numbers. Do not suggest new features — only defects in what exists.
EOF

if [ "$PROFILE" = "app" ]; then
  read -r -d '' SPECIFIC <<'EOF'
Context: Phase 0 scaffold of LIFT, a privacy-first workout tracker. Spec: ~/lift/IMPLEMENTATION_PLAN_v0.4.md (READ IT FIRST). Review the scaffold at TARGET_DIR against it. Skip node_modules/ and android/ (generated). Stack: fresh Expo SDK 57 + TypeScript + expo-router + Drizzle ORM + expo-sqlite, built from scratch.
Privacy is a HARD requirement: user training data must NEVER leave the device. No accounts, no servers, no analytics, no network calls except anonymous fetch of public knowledge-base bundles.
Check: (1) bugs — logic errors, wrong imports, broken re-exports, bad Drizzle schema; (2) spec violations (sync-ready fields UUID/created_at/updated_at/deleted_at, bundle id, migration bundling); (3) Expo SDK 57 gotchas — deprecated APIs, wrong versions, config Expo Go or `npx expo run:android` will reject; (4) Drizzle/expo-sqlite migrations — will useMigrations actually apply the SQL at startup, is the bundled migrations.js complete, schema/SQL mismatches; (5) TypeScript strictness — real `tsc --noEmit` cleanliness vs `any` escapes; (6) privacy/security — ANY network call, telemetry, secret, or exfiltration path; (7) anything that fails CI or breaks run:android / Expo Go.
EOF
else
  read -r -d '' SPECIFIC <<'EOF'
Context: `lift-kb`, the PUBLIC content repo for LIFT (app fetches versioned JSON bundles; content only, never user data). Spec: ~/lift/IMPLEMENTATION_PLAN_v0.4.md, KB sections (READ FIRST). Review TARGET_DIR. Skip dist/ (build output).
Spec rules: schemas are JSON Schema draft-07 (ajv-cli only supports draft-07); exercise IDs permanent kebab-case ^[a-z0-9]+(-[a-z0-9]+)*$ (deprecated/replacedBy, never renamed); channel.json = {latest, minAppVersion, schemaVersion, sha256, revoked[]}; prose CC BY 4.0, media CC0, code MIT; no expert names in marketing content (cite publications).
Check: (1) schema bugs — leftover draft 2020-12-isms, type errors, bad regexes; (2) data-vs-schema mismatches; (3) ID permanence/kebab-case violations; (4) build-bundle.mjs bugs — hashing, bundle structure, ID-vs-filename guard; (5) CI workflow bugs — bad ajv-cli invocation, wrong globs, nonexistent action versions; (6) licensing violations; (7) anything resembling user data/PII (there should be none).
EOF
fi

PROMPT="$COMMON

$SPECIFIC"
PROMPT="${PROMPT//TARGET_DIR/$TARGET}"

echo "=== LIFT review gate: profile=$PROFILE target=$TARGET ===" >&2
claude -p "$PROMPT"
