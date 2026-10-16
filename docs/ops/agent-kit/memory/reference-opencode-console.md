---
name: reference-opencode-console
description: Where the OpenCode Console, service account, key file and V2 docs are.
metadata:
  type: reference
---

- Console: https://opencode.ai/console (owner's "Personal" workspace). Service account **srv_ai-rig1** (Settings → Service accounts); its key lives ONLY at `~/lift/secrets/opencode-sa.key` (mode 600) — manage with `scripts/opencode-key.sh set|check`, never print it.
- The key powers the Jev router; free-model runs use the owner's OpenCode Console sign-in instead (`opencode auth list` → "OpenCode Console · Personal").
- V2 docs index (machine-readable): https://opencode.ai/v2/llms.txt — key pages: /v2/docs/permissions, /policies, /cli/commands, /console/api, /console/api/inference, /console/models (model IDs + endpoints).

Related: [[project-agent-delegation]].
