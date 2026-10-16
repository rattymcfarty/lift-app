---
name: feedback-delegate-first
description: Owner rule — act as orchestrator only; delegate coding and other work to helper agents (OpenCode) first to save the owner's limited token budget.
metadata:
  type: feedback
---

For every request (coding or otherwise), Claude is the orchestrator/brain: assess the work, split it, and delegate to helper agents FIRST (today: OpenCode via `scripts/delegate.sh` / `delegate_to_opencode_free`, free models only — [[feedback-free-models-only]], [[project-agent-delegation]]). Do it yourself only for what the helper cannot do (device/emulator runs, secrets, final review, judgment calls) and keep that part small.

**Why:** the owner's token budget is limited; on 2026-10-16 they hit the session limit while Claude debugged a bug alone, reading many files.

**How to apply:** before reading code, ask "can a helper find/fix this?" — delegate investigation as well as edits (`delegate.sh ask` for read-only digging). Read only the helper's summary and `delegate.sh diff`, not whole files. Use cheap, summary-only commands. Say up front what is being delegated.
