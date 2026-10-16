---
name: lift-handoff
description: Checkpoint a LIFT session so any agent in any harness can continue with zero memory. Use after each milestone, before ending, and before switching agents.
---

# Checkpoint / hand off

1. `docs/ops/HANDOFF.md`:
   - §0 In-flight: what is half-done, on which branch, the exact next step, and
     behaviour that must be preserved. Close your claim if done.
   - Session log: date, harness, what changed, what was verified (commands + results).
   - "Next up" and open decisions: keep them current and ordered.
   - Update the "Last updated" line.
2. `CHANGELOG.md` (Unreleased) and `docs/product/FEATURE_MATRIX.md` if features changed.
3. `npm run verify`, which must say ALL GREEN, plus `npm run test:agents`.
4. Commit (imperative subject, why-body, your attribution trailer) and
   `git push origin main`. Retry with backoff on network errors.
5. Open helper branches: merge, keep (note them in §0), or `scripts/delegate.sh clean <slug>`.

The test: could a stranger with only this repo continue tomorrow? If not, write more in §0.
