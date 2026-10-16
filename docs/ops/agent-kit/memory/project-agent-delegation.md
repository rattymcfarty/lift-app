---
name: project-agent-delegation
description: Agent-to-agent delegation on the rig — Claude Code is the lead/orchestrator, OpenCode v2 is the helper ("AI employee") on free models; how it is wired and where it lives.
metadata:
  type: project
---

Owner set this up on 2026-10-16: Claude (lead) plans, reviews and merges; OpenCode does self-contained sub-tasks on free Console models via `scripts/delegate.sh` (or the MCP tool `delegate_to_opencode_free`, server in the repo's `.mcp.json`). Each task gets its own git worktree + `delegate/<slug>` branch and a locked config; the lead reviews the diff, runs `npm run verify`, squash-merges under its own attribution.

**Why:** save lead-agent tokens/context and cost; free models cost $0.

**How to apply:**
- Design + facts: `~/lift/lift-app/docs/ops/DELEGATION.md`; portable kit + generic skill: `docs/ops/agent-kit/` (installed by `scripts/setup-agent-kit.sh`).
- Free models only answer OpenCode itself: raw Inference API calls return FreeTierError → always go through the `opencode` CLI on the owner's Console sign-in.
- Never use `ask` permission rules (hang non-interactive runs); run one delegation at a time (parallel runs wedge the shared service → `opencode service restart`).
- Only OpenCode **v2** (`~/.local/node/bin/opencode`); a stale v1 in `~/.opencode/bin` shadowed it once.
- Router: Jev 1.13 Free (Console systemone endpoint, service-account key) classifies tasks; keyword fallback.

Related: [[feedback-free-models-only]], [[feedback-keep-opencode-sessions]], [[reference-opencode-console]], [[project-cross-agent-foundation]].
