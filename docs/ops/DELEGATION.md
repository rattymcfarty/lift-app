# Delegation: lead agent → OpenCode helper

**Goal:** the lead agent (Claude Code, or whichever harness the owner is using)
is the *brain*: it plans, decides, reviews and merges. **OpenCode is the
helper, the "AI employee"**: it does self-contained sub-tasks on **free** models,
so they cost $0 and never fill the lead's context. The lead only reads a short
report and the diff.

```
 owner ──► lead agent (orchestrator)
              │  scripts/delegate.sh  or  MCP tool delegate_to_opencode_free
              ▼
           router ── Jev (OpenCode Console, structured decision) ──► category
              │      └─ keyword rules if Jev is down/unsure
              ▼
           OpenCode v2 (shared service on the rig, owner's Console sign-in)
              │  locked config: free models only, default-deny shell, no push/net/secrets
              ▼
           git worktree ~/lift/delegations/<slug> on branch delegate/<slug>
              │
              ▼
           report (tools, blocked attempts, tokens, cost=$0, diffstat) ──► lead reviews,
           runs npm run verify, squash-merges or rejects
```

## 1. Owner rules

- **Free Console models only** (list in `scripts/opencode/models.json`). Paid
  models are disabled in every delegated run, and the wrapper refuses them.
- The helper never commits to `main`, never pushes, never touches secrets,
  CI, `package.json`/`app.json` or the delegation config.
- The lead never merges helper output without reading it and running `npm run verify`.

## 2. How to call it

| From | Use |
|---|---|
| Any shell / any harness | `scripts/delegate.sh run <slug> "<task>"` (edits) · `scripts/delegate.sh ask "<question>"` (read-only) |
| MCP-capable harness (Claude Code, Cursor, Codex, Hermes, Gemini CLI) | tools `delegate_to_opencode_free` (`mode: ask|code`), `opencode_route`, `opencode_delegations`, from `.mcp.json` → `scripts/opencode/mcp-server.mjs` |
| Check the plumbing | `scripts/delegate.sh health` (one free PONG) · `scripts/delegate.sh models` · `scripts/delegate.sh route "<task>"` |

Claude Code asks once to approve the project MCP server `opencode-helper` the
first time it starts in this repo. Other harnesses: point their MCP config at
`node scripts/opencode/mcp-server.mjs` (stdio).

**Writing a good brief:** goal, exact files, an acceptance command that must
pass (e.g. `npm run test:programs:user`), and what not to touch. Keep tasks
under ~30 minutes; split bigger ones.

**Delegate:** unit tests for pure functions, boilerplate, doc/changelog drafts,
KB content passes, mechanical refactors, lint/type cleanups, regex, log
parsing, code search and explanation.
**Keep with the lead:** system design, DB migrations, backup/import format,
workout lifecycle policy, privacy or security code, secrets, release signing,
complex debugging, and the final review of everything.

## 3. Model choice (router)

`scripts/opencode/route.mjs` asks **Jev 1.13 Free**, a structured-decision
model on the Console (`/inference/systemone/v1/systemone`, using the service-account
key), to classify the task into a category: `code`, `docs`, `content`,
`analysis` or `vision`. If Jev is unavailable or unsure (p < 0.5), keyword rules
decide. Each category has a **ranked** model list in `models.json`; the run
uses #1 and falls back to #2 if #1 stalls or fails. Rankings come from measured
results (§6), never guesses. Force a model with `-m opencode/<id>`.

## 4. How it is wired (and why)

- **Free models only answer OpenCode itself.** Calling the Inference API
  directly (`/inference/openai/v1/chat/completions`) with a free model returns
  `FreeTierError: "OpenCode's free tier can only be used from within OpenCode"`,
  both with the service-account key and without a key (tested 2026-10-16). So
  delegated runs go through the `opencode` CLI on the rig, on the owner's Console
  sign-in (`opencode auth list` → "OpenCode Console · Personal"). That also means
  the helper gets real tools (read/edit/shell) instead of returning text only.
- **The service-account key** (`srv_ai-rig1`, file `~/lift/secrets/opencode-sa.key`,
  managed by `scripts/opencode-key.sh`) is used by the Jev router. It is also
  ready for budget-capped paid models if the owner ever allows them; set the
  service-account budget in the Console first.
- **Locked config per run** (`scripts/opencode/delegate.opencode.jsonc` +
  `build-config.mjs`): only the `opencode` provider is allowed; every Console
  model not on the allowlist is `disabled`, read live; hidden
  title/summary/compaction agents are pinned to a free model (OpenCode otherwise
  writes session titles with cheap *paid* models); shell is default-deny with a
  small allowlist; push, network and secret paths are hard-denied by policy.
  Every rule is allow or deny, because **an `ask` rule hangs a non-interactive run forever**.
- **One run at a time** (a `flock` on `~/lift/delegations/.lock`). Many parallel
  `opencode run`s wedge the shared service, and a timed-out client leaves its
  server session stuck. On a stall the wrapper runs `opencode service restart`
  and retries on the next model.
- **Pin the binary:** only v2 (`~/.local/node/bin/opencode`) is valid. A stale v1
  in `~/.opencode/bin` was renamed to `opencode.v1-disabled`, and the wrapper pins
  the v2 path because agent shells may have a different PATH.
- OpenCode V2 reads `AGENTS.md` (not `CLAUDE.md`) and `.agents/skills` /
  `.claude/skills`, so the helper sees the same project rules and playbooks as the lead.

## 4b. History and visibility (owner rule)

- **Never delete OpenCode sessions.** Every delegated run is a normal session in
  the owner's OpenCode service, titled `delegate: <slug>`, listed under the LIFT
  project (`cd ~/lift/lift-app && opencode session list`). The owner can open it
  in OpenCode to watch it live or read it later. Run logs stay in
  `~/lift/delegations/.logs/`.
- `scripts/delegate.sh clean <slug>` removes only the task's git worktree and
  `delegate/<slug>` branch, after the work is merged or rejected. It never
  touches sessions.
- To take over a task in OpenCode: `cd ~/lift/delegations/<slug> && opencode -c`
  (same sandbox config, same branch). Do this **before** cleanup; if the owner
  says they want to continue a task, don't clean it.
- Read-only `ask` runs use a throwaway worktree, so their sessions are readable but can't be continued.

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| Run prints `events: none`, exit 124 | Service stalled. The wrapper already restarted it, so retry. `scripts/delegate.sh health` must say OK. |
| `FreeTierError` | Something called the raw API with a free model. Use the CLI path. |
| `model … is not allowed` | Pick from `scripts/delegate.sh models`. Only the owner may change the list. |
| `build-config: only N Console models listed` | Console signed out. The owner runs `opencode`, then `/connect` → OpenCode Console. |
| `cost: ⚠ NON-ZERO` | A paid model was reached. Stop delegating, inspect the log in `~/lift/delegations/.logs/`, fix the config. |
| Jev `Endpoint is unavailable` / unsure | Expected sometimes; the rules fallback handles it. |

## 6. Measured model results (update after real delegations)

Bake-off 2026-10-16. Task: implement `parseDuration` from a 16-case spec; pass =
`node test.js` prints ALL PASS with the test file untouched; one run each,
150 s limit, serial.

| Model | Result | Time | Notes |
|---|---|---|---|
| DeepSeek V4.1 Flash Free | ✅ pass | 20 s | fastest, minimal tool use; also did the first real LIFT delegation (14 tests, 67 s) |
| Space Bunny Free | ✅ pass | 24 s | fast; zero-retention provider |
| Muse Spark 1.3 Free | ✅ pass | 34 s | responses API, works through OpenCode |
| Nemotron 3.5 Super VL Free | ✅ pass | 44 s | the vision model, and it codes fine too |
| GLM-5.3-Flash Free | ✅ pass | 95 s | slower but solid; zero-retention provider |
| Big Pickle | ✅ pass | 103 s | |
| MiMo-V2.6-Flash Free | ✅ pass | 148 s | right at the limit, many shell retries |
| LongCat 2.5 Preview Free | ❌ fail | 91 s | finished without implementing the function |
| LL Alpha Free | ❌ timeout | 150 s | |
| Nemotron 3 Ultra Free | ❌ timeout | 150 s | never started a tool call |
| Nemotron 3.5 Lightning Free | ❌ timeout | 150 s | |
| Cat Jam Free | ❌ unavailable | 1 s | "Model unavailable" at the time of testing |

Resulting ranks in `models.json`: code/analysis → DeepSeek, Space Bunny, Muse Spark
(+GLM for code); docs/content → DeepSeek, GLM, Space Bunny (provisional; prose
wasn't benchmarked); vision → Nemotron Super VL. Re-run a bake-off when models
change; failing models stay allowed but unranked.

The fixture is committed and reproducible: `docs/ops/bakeoff/parseDuration/`
(`spec.md` + `test.mjs`) with the protocol in `docs/ops/bakeoff/README.md`. Pass =
`node docs/ops/bakeoff/parseDuration/test.mjs` prints `ALL PASS` **with the spec
and the test untouched** (`git diff` in the worktree) and a real implementation,
not a lookup table of the visible cases. One run per model, serially, 3-minute cap.

> **Other repos:** set `DELEGATE_REPO=~/path/to/repo` (for `run`, `diff`, `clean`) to let the helper work in a different repository; the locked config still comes from this repo. Used for lift-kb.


## Model pool and automatic failover (2026-10-17)

The free tier throttles per model and the upstream providers drop long streams
(HTTP 429 `FreeUsageLimitError`, 503 "overloaded", 504 "idle timeout"). One model
being out used to stall a whole job. `scripts/delegate.sh run` now keeps a **pool**:

- Order: the routed or `-m` model first, then the rest of `pool_order` in
  `scripts/opencode/models.json` (coding preference from the bake-off: DeepSeek,
  Space Bunny, GLM, Big Pickle, LongCat, MiMo, Nemotron Super VL / Lightning / Ultra,
  Muse Spark). Up to 6 attempts (`DELEGATE_MAX_ATTEMPTS`).
- After a failed attempt `scripts/opencode/pool.mjs classify` reads the events:
  `quota` (429) cools the model for 30 min, `transient` (503/504/overloaded) 10 min,
  `gone` ("Model unavailable") 24 h, `stall` (timeout, no events) 15 min. Cooled
  models are skipped, also by the next job (state: `~/lift/delegations/.model-state.json`).
- **Partial work is kept.** If the cut-off attempt left edits in the worktree, the
  next model is told to run `git status` / `git diff`, repair and finish; it does
  not start over.
- A real task failure (no provider error) stops the rotation.
- `scripts/delegate.sh pool` shows availability; `pool probe` tests every free model
  now (tiny prompt, one at a time) and refreshes the cooldowns.

Observed 2026-10-17: the quota refreshes within hours; when one model hits its limit
others usually answer, so rotate instead of waiting. Nemotron 3 Ultra is capable but
its upstream (Nvidia) drops streams on jobs longer than ~20 min.
