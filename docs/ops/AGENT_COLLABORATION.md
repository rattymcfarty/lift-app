# Working with several agents on LIFT

LIFT is built by AI agents under one human owner. Different harnesses (Claude
Code, OpenCode, Codex/ChatGPT, Hermes, Gemini CLI, Cursor, …) may work on it
in turn or at the same time. This file is the protocol that keeps them from
stepping on each other. `AGENTS.md` is the entry point; this is §2 of the
reading order.

## 1. Roles

| Role | Who | Does |
|---|---|---|
| **Owner** | the human | decides product direction, approves store/billing/legal steps, tests on the iPhone |
| **Lead agent** | whichever harness the owner is talking to | plans, writes and reviews code, keeps HANDOFF current, merges to `main` |
| **Helper agent** | OpenCode via `scripts/delegate.sh` (free models) | does self-contained tasks on its own branch; never merges, never pushes |
| **Reviewer** | any agent asked to review | reads a branch or diff, reports findings, doesn't rewrite it |

Only one lead agent at a time. When the owner switches harness, the outgoing
lead runs the `lift-handoff` skill first if it can. If it couldn't (crash,
quota), the incoming lead treats §0 of HANDOFF as possibly stale and checks
`git status`, `git log` and `scripts/delegate.sh list`.

## 2. Claiming work (avoid collisions)

- Before starting, write a line in `docs/ops/HANDOFF.md` §0:
  `- [<harness>] <task> — branch <name|main> — started <YYYY-MM-DD>`
  Commit and push that line on its own when more than one agent is active.
- Remove or close the line when done (move the summary to the session log).
- A claim older than 2 days with no commits is abandoned. Take it over and say so in §0.
- Small, self-contained work goes straight to `main`. Anything risky or
  multi-step goes on `agent/<harness>/<slug>` and is merged by the lead
  after `npm run verify`. Helper output is always on `delegate/<slug>`.

## 3. Rules every agent follows

1. `AGENTS.md` rules and the definition of done (§6 there) apply to everyone.
2. Never rewrite published history (`git push --force` on `main` is forbidden).
   Rebase only your own unpublished branch.
3. Pull before you start, and again before you push: `git pull --rebase origin main`.
4. Keep commits small and self-describing. Another agent with no memory has to
   understand *why* from the message alone.
5. Don't revert another agent's change without saying why in the commit body. If
   it looks wrong, flag it in HANDOFF §5 (open decisions) instead.
6. Secrets: none in the repo, ever (`docs/ops/SECRETS_POLICY.md`). Every agent's
   commits go through the same pre-commit scan.

## 4. Attribution

Use your harness's own trailer, so `git log` shows which agent wrote what:

```
Co-Authored-By: <Agent or model name> <noreply address of that vendor>
```

Use only noreply addresses (the pre-commit hook rejects others). Helper-agent
commits on `delegate/*` are authored `opencode-helper <opencode-helper@example.com>`.
The lead re-commits reviewed work under its own trailer when merging.

## 5. Delegation (lead → helper)

Delegation saves the lead's context and cost: the helper's tokens are free and
never enter the lead's context, and the lead only reads a short report and the
diff. How it works and the rules: `docs/ops/DELEGATION.md` (skill: `lift-delegate`).

Good to delegate: unit tests for pure functions, doc/changelog drafts, KB
content passes, mechanical refactors, lint/type cleanups, first-pass search.
Keep with the lead: DB migrations, backup/import format, workout lifecycle
policy, privacy-sensitive code, architecture, anything touching secrets or
release signing, and the final review of every diff.

## 6. When you join with no memory

1. `AGENTS.md` → `docs/ops/HANDOFF.md` §0 → this file.
2. `git status`, `git log --oneline -15`, `scripts/delegate.sh list`.
3. `npm run verify` (and `npm run test:agents`).
4. Continue the open claim, or take the top "Next up" item and claim it.
