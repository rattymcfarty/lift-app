# Legacy operating notes (historical)

These files predate the move to Claude Code and describe an earlier toolchain
(Muse connector limits, Hermes/Ollama fallback tiers, `~/workspace/lift/PIPELINE.md`
which no longer exists). They are kept for history and for the original
product spec — **do not treat them as current instructions.**

- `IMPLEMENTATION_PLAN_v0.4.md` — the original product plan and phase list. Still the
  best statement of *intent* (longevity-first, privacy-first, MIT, KB architecture).
- `FALLBACK.md` — the old fallback runbook. Its push rules (never push
  `.github/workflows/*`) are still correct; the Muse-specific parts are obsolete.
- `review.sh`, `review-claude.sh` — hostile-review gate scripts that call external agents.
  Current practice: run `/code-review` inside Claude Code instead.
