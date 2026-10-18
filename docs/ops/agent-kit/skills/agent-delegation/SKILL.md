---
name: agent-delegation
description: Agent-to-agent delegation between a lead agent (e.g. Claude Code) and an OpenCode v2 helper on free models. Use to set it up on a new machine or project, to delegate a task, or to debug a stalled delegation.
---

# Agent-to-agent delegation (lead agent → OpenCode helper)

**Pattern:** the lead agent is the brain. It plans, splits work, writes tight
briefs, reviews and merges. OpenCode is the helper ("AI employee"): it runs its
own agent loop with tools on **free** Console models, in a sandbox, and returns
a short report. The helper's tokens cost $0 and never enter the lead's context.

Reference implementation (copy it): the LIFT repo
`github.com/rattymcfarty/lift-app`. See `scripts/delegate.sh`, `scripts/opencode/`
(locked config, `models.json`, Jev router, MCP server, config builder,
summarizer), `.mcp.json`, and `docs/ops/DELEGATION.md` (full design and troubleshooting).

## What's bundled (when installed as a packaged skill)

- `references/DELEGATION.md`: the full design, rules, troubleshooting and the measured model table.
- `references/AGENT_KIT.md`: how to rebuild the rig and save this kit to a Claude account.
- `scripts/`: a working copy of the tooling (`delegate.sh`, `opencode-key.sh`,
  `setup-agent-kit.sh`, `opencode/*`) to copy into a project's `scripts/` folder.
- `assets/mcp.json`: the MCP registration (`.mcp.json`) for the
  `delegate_to_opencode_free` tool.

In the LIFT repo the same files live at their normal paths. Prefer those when they exist.

## Which free model (measured 2026-10-16)

Coding bake-off (16-case spec, 150 s limit). **DeepSeek V4.1 Flash** won (20 s).
Then Space Bunny (24 s), Muse Spark 1.3 (34 s), Nemotron 3.5 Super VL (44 s, also
the vision model), GLM-5.3-Flash (95 s), Big Pickle (103 s), MiMo-V2.6 (148 s). LongCat,
LL Alpha, Nemotron 3 Ultra and Nemotron 3.5 Lightning failed or timed out; Cat Jam
was unavailable. Default to DeepSeek and fall back to Space Bunny. Re-measure when models change.

## Set up on a new machine

1. `git clone` the LIFT repo, then run `scripts/setup-agent-kit.sh`. It installs
   OpenCode v2, this skill, the Claude Code memories, and checks everything.
2. Owner steps, which an agent can't do:
   - Run `opencode`, then `/connect` → **OpenCode Console**, and sign in. Free models need this.
   - Console → Settings → Service accounts → add a key, then
     `scripts/opencode-key.sh set` (hidden prompt; used by the Jev router).
3. Check: `scripts/delegate.sh health` must print `OK`.

## Apply to another project

Copy `scripts/delegate.sh`, `scripts/opencode/`, `scripts/opencode-key.sh` and
`.mcp.json`. Then change, in `delegate.opencode.jsonc`: the `node_modules`
path, the shell allowlist (that project's test/typecheck commands) and the
protected files. Make `AGENTS.md` the canonical guide (OpenCode v2 reads only
`AGENTS.md`, plus `.agents/skills` and `.claude/skills`).

## Use it

```bash
scripts/delegate.sh route "<task>"              # category + ranked free models (Jev, else rules)
scripts/delegate.sh run <slug> "<task>"         # edits on branch delegate/<slug>; report + diffstat
scripts/delegate.sh ask "<question>"            # read-only answer
scripts/delegate.sh diff <slug>                 # review like a PR, re-run the acceptance check
git merge --squash delegate/<slug>              # then verify, commit under the lead's attribution
scripts/delegate.sh clean <slug>                # worktree + branch only; sessions are kept
```

MCP tool equivalent: `delegate_to_opencode_free` (`mode: ask|code`), plus
`opencode_route` and `opencode_delegations`.

**Delegate:** tests for pure code, boilerplate, docs and changelog drafts,
content passes, mechanical refactors, regex, log parsing, code search.
**Keep with the lead:** design, migrations, data formats, security and privacy
code, secrets, complex debugging, final review. Never trust helper output blindly.

## Model pool (automatic failover)

`delegate.sh run` rotates through the free models when one is throttled (429),
overloaded (503/504) or gone, keeps the cooldowns in `~/lift/delegations/.model-state.json`,
and hands any partial work to the next model to finish. `delegate.sh pool` = status,
`delegate.sh pool probe` = test all models now. Order for coding: DeepSeek V4.1 Flash,
Space Bunny, GLM-5.3-Flash, Big Pickle, LongCat, MiMo, Nemotron Super VL / Lightning / Ultra.
Do not wait for a quota reset: switch model. Keep jobs under ~20 minutes (upstream
drops long streams) and split big features into several small jobs.

## Hard-won facts (verified 2026-10-16, OpenCode v2.0.31)

- **Free models only answer OpenCode itself.** Raw `POST /inference/openai/v1/chat/completions`
  returns `FreeTierError` with or without a key. Route through the `opencode` CLI.
- **`ask` permission rules hang** `opencode run` forever. Use only allow and deny.
- **Parallel runs wedge the shared service**, and a killed client leaves its
  session stuck. Run one at a time (a lock); on a stall, `opencode service restart`.
- OpenCode writes session titles with cheap **paid** models unless the hidden
  `title`/`summary`/`compaction` agents are pinned to a free model.
- Restricting models: policies only cover providers, so allow just `opencode` and
  set `disabled: true` on every non-allowed model, read live from `opencode models`.
- Make sure only v2 is on PATH (`type -a opencode`). Agent shells can resolve a stale v1.
- Jev (`/inference/systemone/v1/systemone`, `jev-1.13-free`) works with the service-account key.
  It's a classifier: use it to route, not to code.

## Owner rules (LIFT rig)

Free models only. Never delete OpenCode sessions. Leave a task's worktree in
place if the owner wants to continue it in OpenCode (`opencode -c` in that folder).
