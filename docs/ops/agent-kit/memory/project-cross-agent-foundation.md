---
name: project-cross-agent-foundation
description: LIFT is set up so any harness (Claude Code, OpenCode, Codex/ChatGPT, Hermes, Gemini, Cursor, Copilot) can resume from the repo alone.
metadata:
  type: project
---

Owner request 2026-10-16: the project must be "cross-agent ready". `AGENTS.md` is canonical (CLAUDE.md/GEMINI.md import it with `@AGENTS.md`; Copilot/Cursor pointer files), playbooks in `.agents/skills/` (symlinked as `.claude/skills`), protocol in `docs/ops/AGENT_COLLABORATION.md` (claims in HANDOFF §0, branches `agent/<harness>/<slug>`, noreply attribution), guard `npm run test:agents`.

**Why:** the owner may switch harness at any time and wants continuity and good code regardless.

**How to apply:** edit rules in AGENTS.md (never only in CLAUDE.md); add new playbooks as `.agents/skills/<name>/SKILL.md` and list them in AGENTS.md §9; keep HANDOFF §0 current; apply the same pattern to new projects (see `docs/ops/agent-kit/README.md`).

Related: [[project-agent-delegation]], [[user-owner-profile]].
