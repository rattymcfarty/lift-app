---
name: lift-delegate
description: Hand a self-contained, low-risk task to the OpenCode helper agent (free models only), then review and merge its branch. Use it to save lead-agent context and cost.
---

# Delegate to the OpenCode helper

Full design and rules: `docs/ops/DELEGATION.md`. The lead agent is the
orchestrator; OpenCode is the helper ("AI employee").

1. **Is it delegable?** Yes: unit tests for pure functions, doc/changelog
   drafts, content passes, mechanical refactors, lint/type cleanups, searches.
   No: migrations, backup format, lifecycle policy, privacy code, secrets,
   release signing, architecture.
2. **Write a tight brief.** Give the goal, the exact files, the acceptance
   check (a command that must pass) and what *not* to touch. Small beats big:
   split anything over ~30 minutes.
3. **Run it:**
   ```bash
   scripts/delegate.sh route "<task>"              # which free model (Jev router, rules fallback)
   scripts/delegate.sh run <slug> "<task>"         # auto-picks the model; -m opencode/<id> to force one
   ```
   It returns a short report: tools used, blocked attempts, tokens, cost (must be $0) and diffstat.
4. **Review like a PR:** `scripts/delegate.sh diff <slug>`. Check scope, style,
   tests and anything weird. Re-run the acceptance check yourself.
5. **Land it:** in the main checkout,
   `git merge --squash delegate/<slug>` (or `git cherry-pick`), run `npm run verify`,
   then commit under your own attribution with a body noting "drafted by the OpenCode helper".
6. **Clean up:** `scripts/delegate.sh clean <slug>`. Record useful outcomes
   (model quality, failures) in `docs/ops/DELEGATION.md` §6.

Never loosen the sandbox config (`scripts/opencode/`) to make a task pass. Change the task instead.
