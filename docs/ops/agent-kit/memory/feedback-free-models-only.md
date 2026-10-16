---
name: feedback-free-models-only
description: Owner rule — delegated OpenCode work may use ONLY the listed free Console models, never paid ones.
metadata:
  type: feedback
---

Delegation uses only these free OpenCode Console models: LongCat 2.5 Preview Free, Cat Jam Free, Space Bunny Free, LL Alpha Free, MiMo-V2.6-Flash Free, Nemotron 3 Ultra Free, GLM-5.3-Flash Free, Nemotron 3.5 Lightning Free, Jev 1.13 Free (router only — it is a classifier, not a coding model), Nemotron 3.5 Super VL Free, DeepSeek V4.1 Flash Free, Big Pickle, Muse Spark 1.3 Free.

**Why:** cost; the owner wants $0 delegation. OpenCode silently uses cheap *paid* models for session titles unless title/summary/compaction agents are pinned to a free model.

**How to apply:** keep the allowlist in `scripts/opencode/models.json` (the wrapper refuses anything else; every other Console model is disabled per run). If a report shows non-zero cost, stop and investigate. Ask the owner before ever adding a paid model.

Related: [[project-agent-delegation]].
