---
name: lift-resume
description: Start or resume a LIFT work session with no prior memory. Orients you (handoff, claims, branches) and checks the repo is healthy before any change.
---

# Resume a LIFT session

1. Read `AGENTS.md` (if your harness didn't load it), then `docs/ops/HANDOFF.md`.
   §0 "In-flight work" is the most important part.
2. Read `docs/ops/AGENT_COLLABORATION.md` §2 (claims) if more than one agent may be active.
3. Inspect the tree:
   ```bash
   git status --short && git log --oneline -15
   git fetch origin main && git status -sb | head -1     # behind/ahead?
   scripts/delegate.sh list                              # open helper branches
   ```
4. Health check: `[ -d node_modules ] || npm ci`, then `npm run verify`.
   It must end with **ALL GREEN**. If not, fixing that is the task.
5. Pick the work: an open claim in §0, else the top of "Next up". Add your claim line to §0.
6. Load the skill for the job (`lift-feature`, `lift-kb-update`, …) and start
   in small, verified steps. Checkpoint with `lift-handoff` after each milestone.

If the machine itself is new or broken, follow `docs/ops/RECOVERY.md` first
(`scripts/bootstrap-rig.sh`, then `scripts/verify-recovery.sh`).
