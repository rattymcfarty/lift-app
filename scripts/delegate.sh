#!/bin/bash
# Delegate work to the OpenCode helper agent ("AI employee"), sandboxed, free models only.
#
#   scripts/delegate.sh run   <slug> "<task>" [-m opencode/<model>] [-t minutes]
#                             code task on its own branch delegate/<slug> (worktree ~/lift/delegations/<slug>)
#   scripts/delegate.sh ask   "<question>" [-m opencode/<model>] [-t minutes]
#                             read-only question about the repo (no edits, no shell); prints the answer
#   scripts/delegate.sh route "<task>"     which category/models the router picks (Jev, else rules)
#   scripts/delegate.sh list | diff <slug> | log <slug> | clean <slug> | models | health
#
# Design (docs/ops/DELEGATION.md): the lead agent orchestrates and reviews;
# OpenCode does the work with tools (read/edit/limited shell) on free Console
# models through the owner's OpenCode sign-in, so runs cost $0 and never enter
# the lead's context. Each run gets a locked config (scripts/opencode/), one run
# at a time (lock), a hard time limit, and one retry on the next-ranked model
# if the first stalls. Nothing reaches main until the lead reviews the branch
# and `npm run verify` passes. Exit 0 = run finished, 1 = failed.
set -uo pipefail
TOOLKIT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${DELEGATE_REPO:-$TOOLKIT}"   # repo the helper works in (default: this one)
OC="${LIFT_OPENCODE_BIN:-$HOME/.local/node/bin/opencode}"   # v2 only; a stale v1 lived in ~/.opencode/bin
TREES="${LIFT_DELEGATIONS_DIR:-$HOME/lift/delegations}"
LOGS="$TREES/.logs"
TOOLS="$TOOLKIT/scripts/opencode"

die() { echo "delegate: $*" >&2; exit 1; }
allowed() { node -e 'console.log(require(process.argv[1]).allowed.join("\n"))' "$TOOLS/models.json"; }
valid_slug() { [[ "$1" =~ ^[a-z0-9][a-z0-9-]{1,40}$ ]] || die "slug must be lowercase letters/digits/dashes (2-41 chars)"; }
check_model() { allowed | grep -qxF "$1" || die "model '$1' is not allowed (owner rule: free models only). See: $0 models"; }

# opencode run with a hard limit; on a stall (no events at all) restart the
# shared service so the next attempt isn't blocked by a stuck server session.
oc_run() { # dir model minutes title prompt events errlog
  local dir="$1" model="$2" min="$3" title="$4" prompt="$5" ev="$6" err="$7" rc
  ( cd "$dir" && timeout --kill-after=15 "$((min * 60))" "$OC" run --model "$model" --title "$title" --format json "$prompt" > "$ev" 2> "$err" )
  rc=$?
  if [ "$rc" -ne 0 ] && [ ! -s "$ev" ]; then "$OC" service restart > /dev/null 2>&1; fi
  return $rc
}

pick_models() { # task [forced-model] → ranked model list, one per line
  if [ -n "${2:-}" ]; then check_model "$2"; echo "$2"; return; fi
  node "$TOOLS/route.mjs" "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.error(`route:   ${r.category} via ${r.source} (${r.note})`);console.log(r.models.join("\n"))})'
}

parse_opts() { MODEL=""; MINUTES="${1:-20}"; shift; while [ $# -gt 0 ]; do case "$1" in
  -m) MODEL="$2"; shift 2 ;; -t) MINUTES="$2"; shift 2 ;; *) die "unknown option $1" ;; esac; done
  [[ "$MINUTES" =~ ^[0-9]+$ ]] && [ "$MINUTES" -ge 1 ] && [ "$MINUTES" -le 60 ] || die "-t must be 1-60 minutes"; }

with_lock() { mkdir -p "$TREES" "$LOGS"; chmod 700 "$TREES"; exec 9> "$TREES/.lock"
  flock -w 1800 9 || die "another delegation has held the lock for 30 min"; }

BRIEF="You are the OpenCode helper agent working for the lead agent on LIFT (a public, MIT,
privacy-first workout app). Read AGENTS.md first and follow it. Rules for this run:
- Work ONLY inside this directory. Do not commit, push, install packages, or touch config/CI files.
- Keep the change small and focused on the task; match the surrounding code style.
- Check your work with the allowed commands (npm run typecheck, npm run test:*, node scripts/...).
- Many shell commands are blocked on purpose; do not try to work around a block.
- Finish with a short report: files changed, what you did, what you verified, open doubts."

cmd="${1:-}"; shift || true
case "$cmd" in
  models) allowed ;;
  route)  [ -n "${1:-}" ] || die 'usage: route "<task>"'; node "$TOOLS/route.mjs" "$*" ;;
  list)   git -C "$REPO" worktree list | grep "$TREES/" || echo "no open delegations" ;;

  health)
    d="$(mktemp -d)"; node "$TOOLS/build-config.mjs" /dev/null 2>&1 | tail -1
    mkdir -p "$d/.opencode"; node "$TOOLS/build-config.mjs" "$d/.opencode/opencode.jsonc" --readonly 2>/dev/null || die "config build failed"
    m="$(allowed | head -1)"; s=$(date +%s)
    if oc_run "$d" "$m" 2 "delegate health" "Reply with exactly: PONG" "$d/ev" "$d/err" && grep -q '"PONG' "$d/ev"; then
      echo "health:  OK ($m answered in $(( $(date +%s) - s ))s)"; rm -rf "${d:?}"
    else echo "health:  FAILED (service restarted; retry, or check: $OC service status)"; rm -rf "${d:?}"; exit 1; fi ;;

  diff)
    slug="${1:-}"; valid_slug "$slug"
    base="$(git -C "$REPO" config --get "branch.delegate/$slug.delegatebase")" || die "no delegation $slug"
    git -C "$REPO" diff --stat "$base" "delegate/$slug" && git -C "$REPO" diff "$base" "delegate/$slug" ;;

  log)
    slug="${1:-}"; valid_slug "$slug"; f="$LOGS/$slug.events.jsonl"
    [ -f "$f" ] || die "no log for $slug"; node "$TOOLS/summarize.mjs" "$f" ;;

  clean)
    slug="${1:-}"; valid_slug "$slug"
    git -C "$REPO" worktree remove --force "$TREES/$slug" 2>/dev/null || true
    git -C "$REPO" branch -D "delegate/$slug" 2>/dev/null || true
    git -C "$REPO" config --remove-section "branch.delegate/$slug" 2>/dev/null || true
    git -C "$REPO" worktree prune; echo "cleaned $slug" ;;

  ask)
    q="${1:-}"; shift || true; [ -n "$q" ] || die 'usage: ask "<question>" [-m model] [-t minutes]'
    parse_opts 10 "$@"; with_lock
    mapfile -t models < <(pick_models "$q" "$MODEL"); [ ${#models[@]} -gt 0 ] || die "router returned no model"
    id="ask-$(date +%Y%m%d-%H%M%S)"; wt="$TREES/.$id"
    git -C "$REPO" worktree add -q --detach "$wt" HEAD || die "could not create read-only worktree"
    mkdir -p "$wt/.opencode"; node "$TOOLS/build-config.mjs" "$wt/.opencode/opencode.jsonc" --readonly 2>/dev/null || die "config build failed"
    [ -d "$REPO/node_modules" ] && ln -s "$REPO/node_modules" "$wt/node_modules"
    rc=1
    for m in "${models[@]:0:2}"; do
      ev="$LOGS/$id.events.jsonl"; s=$(date +%s)
      oc_run "$wt" "$m" "$MINUTES" "delegate: $id" "You are a read-only helper for the lead agent on the LIFT repo (AGENTS.md has context). Answer concisely and precisely; cite file paths with line numbers. You cannot edit files or run shell commands.

QUESTION:
$q" "$ev" "$LOGS/$id.stderr.log"; rc=$?
      echo "ask:     $m  ${rc/#0/ok}  $(( $(date +%s) - s ))s"
      [ "$rc" -eq 0 ] && break
    done
    node "$TOOLS/summarize.mjs" "$ev"
    git -C "$REPO" worktree remove --force "$wt" >/dev/null 2>&1; git -C "$REPO" worktree prune
    [ "$rc" -eq 0 ] ;;

  run)
    slug="${1:-}"; task="${2:-}"; shift 2 || true
    valid_slug "$slug"; [ -n "$task" ] || die 'usage: run <slug> "<task>" [-m opencode/<model>] [-t minutes]'
    parse_opts 20 "$@"; [ -x "$OC" ] || die "opencode v2 not found at $OC"
    [ -e "$TREES/$slug" ] && die "delegation '$slug' already exists (diff/clean it first)"
    with_lock
    mapfile -t models < <(pick_models "$task" "$MODEL"); [ ${#models[@]} -gt 0 ] || die "router returned no model"

    base="$(git -C "$REPO" rev-parse HEAD)"; wt="$TREES/$slug"
    git -C "$REPO" worktree add -q -b "delegate/$slug" "$wt" "$base" || die "could not create worktree"
    git -C "$REPO" config "branch.delegate/$slug.delegatebase" "$base"
    excl="$(git -C "$REPO" rev-parse --git-common-dir)/info/exclude"
    for pat in '/.opencode/' '/node_modules'; do grep -qxF "$pat" "$excl" 2>/dev/null || echo "$pat" >> "$excl"; done
    mkdir -p "$wt/.opencode"; node "$TOOLS/build-config.mjs" "$wt/.opencode/opencode.jsonc" 2>/dev/null || die "config build failed"
    [ -d "$REPO/node_modules" ] && ln -s "$REPO/node_modules" "$wt/node_modules"

    events="$LOGS/$slug.events.jsonl"; start=$(date +%s); rc=1; used=""
    for m in "${models[@]:0:2}"; do    # first choice + one fallback
      git -C "$wt" checkout -q -- . 2>/dev/null; git -C "$wt" clean -qfd -e .opencode -e node_modules
      used="$m"; oc_run "$wt" "$m" "$MINUTES" "delegate: $slug" "$BRIEF

TASK:
$task" "$events" "$LOGS/$slug.stderr.log"; rc=$?
      [ "$rc" -eq 0 ] && break
      echo "attempt: $m failed (exit $rc) — trying next model" >&2
    done
    dur=$(( $(date +%s) - start ))

    git -C "$wt" add -A
    if git -C "$wt" diff --cached --quiet; then changed="no file changes"
    else
      git -C "$wt" -c user.name="opencode-helper" -c user.email="opencode-helper@example.com" \
        commit -q --no-verify -m "delegate($slug): helper output, unreviewed" -m "Model: $used"
      changed="$(git -C "$REPO" diff --stat "$base" "delegate/$slug" | tail -1)"
      ( cd "$wt" && bash scripts/secrets-scan.sh --tree > "$LOGS/$slug.scan.log" 2>&1 ) \
        || changed="$changed   ⚠ secrets-scan FAILED — see $LOGS/$slug.scan.log"
    fi
    echo "delegation: $slug   model: $used   time: ${dur}s   exit: $rc$([ $rc = 124 ] && echo ' (TIMED OUT)')"
    echo "branch:  delegate/$slug   ($changed)"
    node "$TOOLS/summarize.mjs" "$events"
    echo "next:    scripts/delegate.sh diff $slug   |   clean $slug"
    [ $rc -eq 0 ] ;;

  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
