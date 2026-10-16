# Agent kit: portable agent setup for a new machine or harness

Everything an AI agent learned about **working on this rig** lives here or in
the repo, so a rebuilt machine (or a different harness) gets the same logic,
principles and knowledge. No secrets are stored here.

| Piece | In the repo | Installed to (by `scripts/setup-agent-kit.sh`) |
|---|---|---|
| Project rules for every harness | `AGENTS.md`, `.agents/skills/` (+ `.claude/skills` link) | read straight from the repo |
| Generic delegation playbook | `docs/ops/agent-kit/skills/agent-delegation/` | `~/.claude/skills/` (Claude Code) and `~/.agents/skills/` (OpenCode, Codex, others) |
| Claude Code memories | `docs/ops/agent-kit/memory/*.md` | `~/.claude/projects/<home-slug>/memory/` + `MEMORY.md` index |
| Delegation tooling | `scripts/delegate.sh`, `scripts/opencode/`, `.mcp.json` | used in place |
| OpenCode v2 CLI | pinned in the setup script | `~/.local/node/bin/opencode` |

## Save it to the Claude account (persists everywhere)

Files on a machine or VM can be lost; the owner's Claude account can't. Run
`scripts/setup-agent-kit.sh --export`, then the owner:
1. claude.ai → Settings → Capabilities → **Skills** → Upload `agent-delegation.zip`.
   Account skills sync to every Claude session (they appear under `~/.claude/skills/synced/`).
2. claude.ai → Settings → **Memory** → add the text from `claude-account-memory.txt`.

Agents can't write to the account themselves. The `synced` folder is download-only.

## Rebuild on a new machine

```bash
# 1. toolchain + repos (see docs/ops/RECOVERY.md). This also runs step 2.
bash lift-app/scripts/bootstrap-rig.sh
# 2. or on its own: OpenCode v2, skills, memories, health checks (idempotent)
~/lift/lift-app/scripts/setup-agent-kit.sh            # --check only reports
```

Then the owner, once:
1. `opencode` → `/connect` → **OpenCode Console** → sign in. Free models need this.
2. Console → Settings → Service accounts → `srv_ai-rig1` (or a new one) → **Add API Key**,
   then `scripts/opencode-key.sh set`. The key is only for the Jev router; lose it and you just make a new one.
3. `scripts/delegate.sh health` → `OK`.

## Use with another harness

- **Codex/ChatGPT, OpenCode, Hermes, Cursor, Copilot, Gemini CLI:** they read
  `AGENTS.md` (or a pointer file that imports it) and the skills in `.agents/skills/`.
- **Delegation from any MCP-capable harness:** register
  `node scripts/opencode/mcp-server.mjs` (stdio) as an MCP server. `.mcp.json`
  already does it for Claude Code. Tools: `delegate_to_opencode_free`,
  `opencode_route`, `opencode_delegations`.
- **No MCP:** call `scripts/delegate.sh` from the shell.

## Keeping it current

When an agent learns something durable about this setup, it updates the
matching file here (and `docs/ops/DELEGATION.md`) in the same commit, then
re-runs `scripts/setup-agent-kit.sh` to refresh the installed copies. The repo
is the source of truth; installed copies are overwritten.
