#!/bin/bash
# LIFT review gate (Hermes variant) -- hostile read-only review via Hermes Agent (headless).
# Usage: review-hermes.sh <directory> [app|kb]
#   <directory>  path to the tree to review (e.g. ~/lift/lift-app)
#   [app|kb]     review profile; defaults to auto-detect from directory name
# Output: ranked findings (BLOCKERS / SHOULD-FIX / NITPICKS) on stdout.
# Hermes is invoked with -z (zero-shot, no tools): it cannot touch the filesystem.
# Model: Hermes default (nvidia/nemotron-3-ultra:free via OpenRouter, free-tier).
set -u

TARGET="${1:?Usage: review-hermes.sh <directory> [app|kb]}"
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

# Collect reviewable source files (skip generated/vendor dirs), cap total size.
# Hermes -z inlines file contents: keep the prompt under ~120KB.
MAX_BYTES=122880
TMPDIR_WORK="$(mktemp -d)"
FILELIST="$TMPDIR_WORK/files.txt"
(
  cd "$TARGET" || exit 1
  find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.sql" -o -name "*.json" \) \
    -not -path "./node_modules/*" -not -path "./android/*" -not -path "./dist/*" \
    -not -path "./.expo/*" -not -path "./ios/*" | sort > "$FILELIST"
)
PROMPT_FILE="$TMPDIR_WORK/prompt.txt"

{
  cat <<'COMMON_EOF'
You are doing a HOSTILE code review. Read-only analysis: you cannot create, modify, or delete files. Do not suggest new features -- only defects in what exists.
Report findings in EXACTLY this format:
## BLOCKERS (must fix before this ships; wrong behavior, crashes, data loss, privacy leaks, CI failures)
- `[path/to/file:LINE] Title -- one-sentence explanation and impact.`
## SHOULD-FIX (real problems that will bite later if not addressed)
- `[path/to/file:LINE] Title -- explanation.`
## NITPICKS (style, minor robustness, docs)
- `[path/to/file:LINE] Title -- explanation.`
Be adversarial and specific. Cite exact file paths and line numbers. Do NOT invent problems: a clean file gets "no findings". Rank honestly -- a BLOCKER must be something that actually breaks.
COMMON_EOF
  echo ""
  if [ "$PROFILE" = "app" ]; then
    cat <<'APP_EOF'
Context: LIFT, a privacy-first workout tracker. React Native + Expo SDK 57 + TypeScript + expo-router + Drizzle ORM + expo-sqlite, built from scratch.
Privacy is a HARD requirement: user training data must NEVER leave the device. No accounts, no servers, no analytics, no network calls except anonymous fetch of public knowledge-base bundles.
Check: (1) bugs -- logic errors, wrong imports, broken re-exports, bad Drizzle schema; (2) Expo SDK 57 gotchas -- deprecated APIs, wrong versions; (3) Drizzle/expo-sqlite migrations -- ordering, FK correctness, bundle completeness, schema/SQL mismatches; (4) TypeScript strictness; (5) privacy/security -- ANY network call, telemetry, secret, or exfiltration path; (6) async correctness -- missing awaits, fire-and-forget inside transactions, race conditions; (7) anything that fails CI or breaks Expo Go.
APP_EOF
  else
    cat <<'KB_EOF'
Context: lift-kb, the PUBLIC content repo for LIFT (app fetches versioned JSON bundles; content only, never user data).
Spec rules: schemas are JSON Schema draft-07 (ajv-cli only supports draft-07); exercise IDs permanent kebab-case ^[a-z0-9]+(-[a-z0-9]+)*$ (deprecated/replacedBy, never renamed); channel.json = {latest, minAppVersion, schemaVersion, sha256, revoked[]}; prose CC BY 4.0, media CC0, code MIT; no expert names in marketing content.
Check: (1) schema bugs -- draft 2020-12-isms, type errors, bad regexes; (2) data-vs-schema mismatches; (3) ID permanence/kebab-case violations; (4) build-bundle.mjs bugs -- hashing, bundle structure; (5) CI workflow bugs; (6) licensing violations; (7) anything resembling user data/PII (there should be none).
KB_EOF
  fi
  echo ""
  echo "Files under review (from $TARGET):"
  TOTAL=0
  while IFS= read -r f; do
    fp="$TARGET/$f"
    [ -f "$fp" ] || continue
    sz=$(wc -c < "$fp")
    if [ $((TOTAL + sz)) -gt $MAX_BYTES ]; then
      echo ""
      echo "(truncated: file list exceeded ${MAX_BYTES} bytes budget; ${f} and later files omitted)"
      break
    fi
    TOTAL=$((TOTAL + sz))
    echo ""
    echo "=== FILE: $f ==="
    cat "$fp"
  done < "$FILELIST"
} > "$PROMPT_FILE"

echo "=== LIFT review gate (hermes): profile=$PROFILE target=$TARGET ===" >&2
hermes -z "$(cat "$PROMPT_FILE")"
RC=$?
rm -rf "$TMPDIR_WORK"
exit $RC
