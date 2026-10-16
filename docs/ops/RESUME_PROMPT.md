# Resuming in a new session (copy-paste)

> Read `AGENTS.md` (the canonical guide for any harness), then `docs/ops/HANDOFF.md`
> (especially **§0 In-flight work**) and `docs/ops/AGENT_COLLABORATION.md`.
> Run `git status` and `git log --oneline -10` to see what is committed vs. pending,
> then `npm ci` (if needed) and `npm run verify`. Continue with the first unfinished
> item under "In-flight work"; if none, take the top item of "Next up". Keep
> `docs/ops/HANDOFF.md` updated as you go and commit/push after every verified step.

## Keeping a session light (so you can always cut over)

- **Checkpoint early, not at the end.** After each verified milestone: update
  HANDOFF §0, commit, push. A session can then be abandoned at any point with
  zero loss.
- **Prefer scripts that print summaries**: `scripts/e2e.sh` (device flows),
  `npm run verify`, `scripts/verify-recovery.sh`. Don't paste long logs.
- **Targeted reads**: `grep -n` + `sed -n a,bp` instead of whole files; the repo map
  is in AGENTS.md §4.
- **Delegate grunt work** to the OpenCode helper (free models, $0, outside your
  context): `scripts/delegate.sh` or the `delegate_to_opencode_free` MCP tool.
- **Compact or restart at natural seams** (feature done + pushed). Use
  `/compact` to keep going, or start a fresh session with the prompt above.
- Screenshots are the biggest token cost — take them only to verify a visual
  change, and read one per question.
