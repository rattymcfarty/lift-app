---
name: lift-verify
description: Run LIFT's definition of done before committing (secrets scan, typecheck, unit tests, typography gate, agent-foundation check, diff review).
---

# Verify before commit

```bash
npm run verify            # secrets + typecheck + all unit tests + typography gate → must say ALL GREEN
npm run test:agents       # AGENTS.md / skills / pointer files still consistent
git diff package.json app.json   # revert anything Expo tooling changed by itself
git status --short        # no stray files (logs, screenshots, .opencode/, secrets)
```

- UI change: also run the relevant flow, `scripts/e2e.sh <flow>` (see `lift-device-test`).
- A failure is information. Fix it; never skip or delete a test to get green.
- The pre-commit hook re-runs the secrets scan and refuses non-noreply author
  emails. If it blocks you, fix the content (use a placeholder like
  `<tailscale-ip>`); don't use `--no-verify`.
