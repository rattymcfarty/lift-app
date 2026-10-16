# CLAUDE.md — LIFT

The project guide shared by every agent is **`AGENTS.md`**. It is imported below,
so Claude Code loads it automatically. Edit rules there, not here; this file
only adds Claude Code specifics.

@AGENTS.md

## Claude Code specifics

- **Delegate first (owner rule, budget is limited):** you are the orchestrator.
  Assess every request and hand investigation and edits to the OpenCode helper
  (`lift-delegate` skill) before doing them yourself. Do yourself only what it
  can't: device/emulator runs, secrets, judgment calls, final review. Read its
  summary and diff, not whole files.

- Skills: `.claude/skills` is a symlink to `.agents/skills`, so the shared
  playbooks show up as Claude Code skills (`lift-resume`, `lift-verify`, …).
- Background processes die when a tool call ends, and background commands are
  capped at about 2 h. Use `scripts/e2e.sh` for device work, and restart the Expo
  server when the owner asks (`lift-expo-iphone` skill).
- Delegation: hand self-contained, low-risk tasks to the OpenCode helper with
  `scripts/delegate.sh` (`lift-delegate` skill). Review its branch and run
  `npm run verify` before merging. **Free Console models only** (owner rule).
- Commit attribution: end commit messages with the `Co-Authored-By` trailer the
  harness provides. Never put a model identifier anywhere else in the repo.
- Keep context light: summary-printing scripts, `grep -n` + `sed -n` instead of
  whole-file reads, and one screenshot per question.
