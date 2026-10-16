#!/bin/bash
# Store / check the OpenCode Console service-account key (srv_ai-rig1).
#
# What it is used for: the Jev router (scripts/opencode/route.mjs) and any
# future budget-capped paid models. Delegated FREE-model runs do NOT use it:
# OpenCode's free tier refuses service-account/API traffic ("FreeTierError:
# free tier can only be used from within OpenCode"), so they run through the
# owner's OpenCode Console sign-in instead.
#
#   scripts/opencode-key.sh set      prompt for the key (hidden), save it, test it
#   scripts/opencode-key.sh check    check the saved key is valid (reads workspace config, no cost)
#   scripts/opencode-key.sh path     print where the key lives
#
# The key is kept OUTSIDE the repo at ~/lift/secrets/opencode-sa.key (mode 600).
# It is never printed, logged, or passed on a command line (the test call
# reads the header from a pipe). Create/revoke keys in the Console:
#   https://opencode.ai/console → Settings → Service accounts → srv_ai-rig1
set -euo pipefail

KEY_FILE="${LIFT_OC_KEY_FILE:-$HOME/lift/secrets/opencode-sa.key}"
URL="https://opencode.ai/console/api/v2/config"   # readable by every key permission; costs nothing

check() {
  [ -s "$KEY_FILE" ] || { echo "no key saved yet — run: $0 set" >&2; return 1; }
  local code
  code=$(printf 'Authorization: Bearer %s\n' "$(tr -d '[:space:]' < "$KEY_FILE")" \
    | curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$URL" -H @-)
  case "$code" in
    200) echo "key OK (workspace config readable)";;
    401) echo "key REJECTED (401): wrong, revoked or expired — run: $0 set" >&2; return 1;;
    403) echo "key refused for this workspace (403)" >&2; return 1;;
    429) echo "rate limited or budget reached (429) — key itself is valid" >&2; return 1;;
    *)   echo "unexpected HTTP $code (network?)" >&2; return 1;;
  esac
}

case "${1:-}" in
  set)
    mkdir -p "$(dirname "$KEY_FILE")"; chmod 700 "$(dirname "$KEY_FILE")"
    printf 'Paste the service-account key (starts with oc_sk_; input is hidden): '
    IFS= read -rs key; echo
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    [[ "$key" == oc_sk_* ]] || { echo "that does not look like an oc_sk_ key — nothing saved" >&2; exit 1; }
    ( umask 077; printf '%s\n' "$key" > "$KEY_FILE" )
    chmod 600 "$KEY_FILE"; unset key
    echo "saved to $KEY_FILE (mode 600)"
    check
    ;;
  check) check ;;
  path)  echo "$KEY_FILE" ;;
  *) echo "usage: $0 set | check | path" >&2; exit 2 ;;
esac
