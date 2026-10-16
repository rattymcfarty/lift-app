---
name: feedback-keep-opencode-sessions
description: Owner rule — never delete OpenCode sessions created by delegation; only clean the task worktree/branch after merge, and not at all if the owner wants to take over.
metadata:
  type: feedback
---

Delegated runs are normal sessions in the owner's OpenCode (titled `delegate: <slug>`); the owner wants to open them to watch live or continue a task directly in OpenCode.

**Why:** visibility and the ability to take over work from OpenCode.

**How to apply:** `scripts/delegate.sh clean` removes only the worktree + branch after merge/reject — never call session delete. If the owner says they will continue a task, leave its worktree (`cd ~/lift/delegations/<slug> && opencode -c`).

Related: [[project-agent-delegation]].
