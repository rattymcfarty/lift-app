#!/bin/bash
# Install the portable agent kit on this machine (idempotent). Safe to re-run.
#
#   scripts/setup-agent-kit.sh           install / refresh everything
#   scripts/setup-agent-kit.sh --check   only report status
#   scripts/setup-agent-kit.sh --export [dir]   build the files the OWNER uploads to the
#        Claude account (persists across every machine/VM): agent-delegation.zip
#        (claude.ai → Settings → Capabilities → Skills → Upload) and the memory text
#        (claude.ai → Settings → Memory). Default dir: ~/lift/agent-kit-export
#
# Installs (sources in docs/ops/agent-kit/, see its README.md):
#   - OpenCode v2 CLI (pinned), and retires a stale v1 binary that can shadow it
#   - the generic `agent-delegation` skill → ~/.claude/skills and ~/.agents/skills
#   - Claude Code memories → ~/.claude/projects/<slug>/memory (+ MEMORY.md index)
#     for the home dir and the lift-app dir (Claude Code keys memory by start dir)
# Then checks: Console sign-in, service-account key, delegation health.
# Never handles secrets itself: the key is entered by the owner via opencode-key.sh.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
KIT="$REPO/docs/ops/agent-kit"
OPENCODE_VERSION="2.0.31"
NODE_BIN="$HOME/.local/node/bin"
OC="$NODE_BIN/opencode"
CHECK=0; [ "${1:-}" = "--check" ] && CHECK=1
if [ "${1:-}" = "--export" ]; then
  out="${2:-$HOME/lift/agent-kit-export}"; work="$(mktemp -d)"; mkdir -p "$out" "$work/agent-delegation"
  cp "$KIT/skills/agent-delegation/SKILL.md" "$work/agent-delegation/"
  cp "$KIT/README.md" "$work/agent-delegation/REFERENCE-agent-kit.md"
  rm -f "$out/agent-delegation.zip"
  (cd "$work" && python3 -I -c "import zipfile,os;z=zipfile.ZipFile(os.sys.argv[1],'w',zipfile.ZIP_DEFLATED);[z.write(os.path.join('agent-delegation',f)) for f in sorted(os.listdir('agent-delegation'))];z.close()" "$out/agent-delegation.zip")
  cp "$out/agent-delegation.zip" "$out/agent-delegation.skill"   # same archive; .skill shows a "Save skill" button when sent in a Claude chat
  cp "$KIT/claude-account-memory.txt" "$out/"
  rm -rf "${work:?}"
  echo "exported to $out:"; ls -1 "$out"
  echo "Owner: upload agent-delegation.skill (or .zip) in claude.ai → Settings → Capabilities → Skills,"
  echo "       or attach it in any claude.ai chat and click \"Save skill\"; paste claude-account-memory.txt into Settings → Memory."
  exit 0
fi
todo=()
say() { printf '\n== %s\n' "$*"; }
need() { todo+=("$1"); echo "TODO: $1"; }
export PATH="$NODE_BIN:$PATH"

say "OpenCode v2"
if [ -x "$OC" ] && "$OC" --version 2>/dev/null | grep -q 'v2\.'; then echo "ok: $("$OC" --version)"
elif [ "$CHECK" = 1 ]; then need "install OpenCode v2 (npm i -g @opencode/cli@$OPENCODE_VERSION)"
else npm install -g "@opencode/cli@$OPENCODE_VERSION" && echo "installed: $("$OC" --version)"; fi
# A v1 install (~/.opencode/bin/opencode) once shadowed v2 in agent shells.
V1="$HOME/.opencode/bin/opencode"
if [ -x "$V1" ] && ! "$V1" --version 2>/dev/null | grep -q 'v2\.'; then
  if [ "$CHECK" = 1 ]; then need "retire stale v1 at $V1"
  else mv "$V1" "$V1.v1-disabled" && echo "retired stale v1 → $V1.v1-disabled"; fi
fi

say "skills (generic agent-delegation)"
for dest in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  tgt="$dest/agent-delegation/SKILL.md"
  if cmp -s "$KIT/skills/agent-delegation/SKILL.md" "$tgt"; then echo "ok: $tgt"
  elif [ "$CHECK" = 1 ]; then need "install skill → $tgt"
  else mkdir -p "$(dirname "$tgt")" && cp "$KIT/skills/agent-delegation/SKILL.md" "$tgt" && echo "installed: $tgt"; fi
done

say "Claude Code memories"
for start in "$HOME" "$REPO"; do
  mem="$HOME/.claude/projects/$(printf '%s' "$start" | sed 's#[^A-Za-z0-9]#-#g')/memory"
  for f in "$KIT"/memory/*.md; do
    b="$(basename "$f")"
    if cmp -s "$f" "$mem/$b"; then continue
    elif [ "$CHECK" = 1 ]; then need "memory $b → $mem"
    else mkdir -p "$mem" && cp "$f" "$mem/$b"; fi
  done
  [ "$CHECK" = 1 ] && continue
  # Rebuild the index lines for kit memories; keep any other lines untouched.
  idx="$mem/MEMORY.md"; touch "$idx"
  kit_names=$(cd "$KIT/memory" && ls *.md)
  grep -vF -f <(printf '(%s)\n' $kit_names) "$idx" > "$idx.tmp" || true
  for f in "$KIT"/memory/*.md; do
    b="$(basename "$f")"
    name=$(sed -n 's/^name: *//p' "$f" | head -1)
    desc=$(sed -n 's/^description: *//p' "$f" | head -1)
    echo "- [$name]($b) — $desc" >> "$idx.tmp"
  done
  mv "$idx.tmp" "$idx"; echo "ok: $mem ($(ls "$KIT"/memory/*.md | wc -l) kit memories indexed)"
done

say "OpenCode Console sign-in (owner step)"
if "$OC" auth list 2>/dev/null | grep -q 'OpenCode Console'; then echo "ok: Console connected"
else need "owner: run 'opencode', then /connect → OpenCode Console, and sign in"; fi

say "service-account key (owner step; used by the Jev router)"
if bash "$REPO/scripts/opencode-key.sh" check; then :
else need "owner: create a key in Console → Settings → Service accounts, then scripts/opencode-key.sh set"; fi

say "delegation health"
if [ "${#todo[@]}" -eq 0 ] && [ "$CHECK" = 0 ]; then
  bash "$REPO/scripts/delegate.sh" health || need "delegation health failed (see docs/ops/DELEGATION.md §5)"
else echo "skipped (finish the items above first)"; fi

echo
if [ "${#todo[@]}" -gt 0 ]; then echo "RESULT: ${#todo[@]} item(s) to do:"; printf ' - %s\n' "${todo[@]}"; exit 1; fi
echo "RESULT: agent kit ready — Claude Code + OpenCode delegation are set up on this machine."
