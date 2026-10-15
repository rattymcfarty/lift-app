# LIFT — Fallback runbook: Muse credits are out

**Verified 2026-10-13.** How to keep developing LIFT with zero Muse involvement.
Tools: everything below is already on ai-rig1. Nothing here costs money.
Do NOT paste secrets/credentials into any chat or file.

## Current state (verified via `git ls-remote` + GitHub tree API, 2026-10-13)

- **lift-app main:** `ae32523` — "P6: release-blocking keyboard fix + Maestro gate + screenshot 03".
  NOTE: the commit message mentions screenshot 03, but the file
  `docs/release/screenshots/03-dashboard.png` itself did NOT land — verified absent on main.
- **lift-kb main:** `45a4bdc` — "P8 catalogue (part 11/11)". **KB is FULLY pushed:**
  433 `exercises/*.json`, `channel.json`, `kb-version.json`,
  `schemas/exercise.schema.json`, `scripts/build-bundle.mjs` — all on main. Nothing pending.
- **Unpushed (rig tree `~/lift/lift-app`, based on `e99619d`, BEHIND origin/main `ae32523`):**
  - P7+P8 app batch: all P7 code + migrations m0009–m0012 + new snapshot
    `assets/kb/snapshot/bundle.json` (733 KB, 433 exercises) + `channel.json`
    + P8 app-side files + fixed test files.
  - `docs/release/screenshots/03-dashboard.png` (156 KB, in tree).
  - NEVER push: `package-lock.json` (rig-only), `.github/workflows/*` (Matt pastes via web UI).
- **Media:** PARKED by Matt 2026-10-13. App uses the standard placeholder image for all
  exercises. No media work.
- NOTE: `~/workspace/lift/PIPELINE.md` dispatch log lags reality (still says P6 remainder
  and P8 are unpushed). Trust this snapshot. `~/lift/lift-kb` on the rig has no `.git`
  (plain file copy) — for future KB work, clone fresh (see below).

## Finish the pushes (do this FIRST)

```bash
gh auth login            # interactive, once. Then plain git push works (see below).
cd ~/lift/lift-app
git fetch origin
git rebase origin/main   # tree is behind origin/main. EXPECT a possible conflict on the
                         # keyboardShouldPersistTaps lines in app/workout/[id].tsx
                         # (tree has P6 fix + P7 changes; main has P6 fix only).
                         # If it conflicts, keep the TREE version (it has both), then:
                         # git rebase --continue
~/lift/dev-loop.sh       # must print ALL GREEN before pushing
git status --porcelain   # review the list
# Stage the P7+P8 batch + the screenshot. Do NOT `git add -A` (would grab
# package-lock.json). Do NOT add .maestro/screenshots.yaml (already on main).
git add -u
git add docs/release/screenshots/03-dashboard.png
git add <any NEW P7/P8 files shown as ?? by git status, except package-lock.json>
git commit -m "P7 workout UX overhaul + P8 catalogue (433 exercises)"
git push origin main     # plain git push handles big files — NO 128 KB limit.
                         # (The old web-UI upload for bundle.json is NO LONGER needed;
                         #  that was only a workaround for the Muse connector limit.)
git ls-remote https://github.com/rattymcfarty/lift-app.git HEAD   # verify new HEAD
```

KB repo: nothing to push. If you later need to work on KB:
```bash
git clone https://github.com/rattymcfarty/lift-kb.git ~/lift/lift-kb
```

## The pipeline in 5 lines

1. Read `~/workspace/lift/PIPELINE.md` (queue) / `~/lift/IMPLEMENTATION_PLAN_v0.4.md` (spec) — pick next workstream.
2. Implement in `~/lift/lift-app` (or `~/lift/lift-kb`).
3. `npm run typecheck` (or `~/lift/dev-loop.sh` for typecheck + KB + P7 tests).
4. Review: `~/lift/review.sh ~/lift/lift-app` (Hermes, free) or `~/lift/review-claude.sh` (Claude, if sub alive).
5. Fix blockers → commit → `git push`. Never push `.github/workflows/*` or `package-lock.json`.

## Tier 1 — Claude Code (primary, if his Claude subscription is alive)

Interactive mode (recommended). In `-p` (headless) mode permission grants are broken,
so run interactive, or have it print code/diffs for you to apply.
Smoke test (verified 2026-10-13): `claude -p "Reply with the single word OK and nothing else."` → `OK`

Copy-paste prompt templates (run `claude` from `~/lift/lift-app` first):

1. Implement:
   `Implement workstream [N] from ~/workspace/lift/PIPELINE.md in this repo. Follow the spec, run npm run typecheck, and report files changed + tests run.`
2. Review:
   `Hostile-review the files I changed in this session: list BLOCKERS (real bugs), SHOULD-FIX, NITPICKS. Be specific with file:line.`
3. Fix:
   `Fix the BLOCKERS from your review, re-run typecheck, confirm green.`

## Tier 2 — Hermes (free, OpenRouter free tier)

- Smoke test (verified 2026-10-13): `hermes -z "Reply with the single word OK and nothing else."` → `OK`
  NOTE: `-z` REQUIRES a prompt argument. Bare `hermes -z` errors.
- Review gate (read-only, cannot touch files): `~/lift/review.sh ~/lift/lift-app`
- Implement (simple tasks only):
  `hermes -z "In ~/lift/lift-app, <task>. Write the code, run npm run typecheck, report files changed."`
- Hermes NEVER reviews its own output — review Hermes-written code with `review.sh` or Claude.
- Hermes may silently fall back to a different free model mid-run; output is still usable.

## Tier 3 — Ollama local (offline, zero credits, SIMPLE tasks only)

- `ollama run qwen2.5-coder:7b "<task>"` — model is local (4.7 GB), no network, no credits.
- Good for: small functions, small tests, simple fixes. NOT for: architecture, big refactors, reviews.
- First run after boot is SLOW (cold model load, can take minutes — if a first run times out, just retry; the model stays loaded after first use). Later runs are fast (~5 s for small code, verified in a prior session).
- HONEST CAVEAT (fresh smoke test 2026-10-13): a fresh `ollama run` produced NO output within ~5 min (cold load hung). Tier 3 is the least reliable tier — if a first run hangs, retry once; if it still hangs, use Tier 2 instead.
- API also available at `http://localhost:11434` (e.g. `ollama list`, `ollama ps`).

## Push instructions (recap)

- `gh auth login` once (interactive); then plain `git push` from `~/lift/lift-app` / `~/lift/lift-kb`.
- Never push `.github/workflows/*` (Matt pastes via web UI), never push `package-lock.json`.
- Big files are fine via `git push` (no 128 KB limit).

## Helpers on the rig

- `~/lift/dev-loop.sh` — typecheck + `test:kb` (29) + `test:p7` (87), prints PASS/FAIL. Verified ALL GREEN 2026-10-13.
- `~/lift/review.sh` — Hermes review gate. `~/lift/review-claude.sh` — Claude review gate.
- `~/lift/FALLBACK.md` — this file. `~/lift/IMPLEMENTATION_PLAN_v0.4.md` — full spec.
- `gh` CLI 2.102.0 installed at `~/.local/bin/gh` (checksum-verified, in PATH). No auth configured — Matt runs `gh auth login` himself.
