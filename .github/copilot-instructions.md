# Copilot instructions — LIFT

The canonical guide for every AI agent is [`AGENTS.md`](../AGENTS.md) at the
repo root. Read it, then `docs/ops/HANDOFF.md`. The short version:

- Expo SDK 57 / React Native / TypeScript strict / expo-router / Drizzle + expo-sqlite.
- Private by construction: no new network calls, SDKs, analytics or accounts.
- Every font size and weight comes from `src/theme/tokens.ts` (enforced by `npm run test:ui`).
- Swipe left = remove, swipe right = add, everywhere.
- The repo is public: no secrets, personal emails or private IPs in code or commits.
- Done means `npm run verify` prints ALL GREEN.
- Recurring jobs have playbooks in `.agents/skills/<name>/SKILL.md`.
