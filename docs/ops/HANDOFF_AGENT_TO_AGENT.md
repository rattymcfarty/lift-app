# LIFT — agent-to-agent handoff (written 2026-10-18)

Claude Code (the usual lead) is **away until Monday 2026-10-19 or later** because of
weekly usage limits. Any other agent (OpenCode, Codex, Hermes, Gemini, Cursor…) can carry
on from here. Read this file, then `AGENTS.md`, then `docs/ops/HANDOFF.md` and
`docs/ops/DELEGATION.md`. The owner is not a programmer: keep explanations short and simple.

## 0. Non-negotiable rules (from the owner)

1. Repos are **public**. No secrets, tokens, keys, `.env`, or personal data in commits.
   Secrets live only in `~/lift/secrets`, `~/.gradle/gradle.properties`, tool auth files.
2. **Free OpenCode models only** (list: `scripts/opencode/models.json` → `allowed`). Never paid.
3. Never delete OpenCode sessions. Only clean a task worktree/branch after you merged it.
4. Never push `.github/workflows/*`. No PRs, releases, or tags unless the owner asks.
5. Review `package.json` / `app.json` diffs by eye before committing (helpers cannot edit `package.json`).
6. Run `npm run verify` (must print **ALL GREEN**) before every commit. Commit small, one topic each.
7. Do **not push** until the "push gate" in §3 is met. Local `main` is **9 commits ahead** of `origin/main` (last pushed `f95684e`).
8. Reference images in `~/lift/ref-icons/` are local-only: never commit them, never copy them into the repo.

## 1. How to work (delegate-first)

- The lead orchestrates; a helper writes code. Send helper jobs with
  `scripts/delegate.sh run <slug> "<task>" [-m opencode/<model>] [-t minutes] [-f image]...`
  (own branch `delegate/<slug>`, worktree `~/lift/delegations/<slug>`). One job at a time.
- The pool rotates free models automatically on quota/stall (`scripts/delegate.sh pool`
  shows who is available). Keep jobs under ~20 minutes: split big features. If a job
  stops half-way, partial work is kept and handed to the next model.
- Review with `scripts/delegate.sh diff <slug>` / `log <slug>`, then
  `git merge --squash delegate/<slug>`, `npm run verify`, commit, `scripts/delegate.sh clean <slug>`.
  If `src/components/icons/iconArt.generated.ts` conflicts, just rerun `node scripts/build-icon-art.mjs`.
- Past briefs (good templates) are in `docs/ops/briefs/` (layout A1–A3, icon batches).
- If you ARE the helper model with no delegation tool: work directly, same rules, same verify gate.
- Device tests: `scripts/e2e.sh <flows>` (boots the emulator itself; do not run it while a
  helper job is running; first run is slow, `_warmup` flow comes first).
  Expo server for the owner's phone: systemd user service `lift-expo` (`systemctl --user status lift-expo`);
  the owner opens it in Expo Go over LAN or Tailscale.

## 2. State right now

Committed locally (not pushed): glass top bar with panel/settings buttons, companion in a
fixed glass circle at top centre, floating glass tab bar with reorderable tab order, the
free-model pool, the icon pipeline, and **all 21 muscle-group icons + Barbell and Dumbbell**.
Nothing is running. Working tree clean after commit `8135f1a`.

Already pushed and working: warmup sets sheet, supersets, finish/discard workout sheet,
planned-set prefill, Markdown exercise guides, "top 50" foundational list, mouse companion,
purple/blue theme, leave-program fix, Markdown as the only KB source (lift-kb).

## 3. The queue (do in this order)

### A. Side panels (Stage B) — unlocks the push
The top-bar buttons currently open nothing. Panel state exists in `src/chrome/panels.tsx`;
glass primitive in `src/components/ui/Glass.tsx`; bar in `src/components/chrome/TopBar.tsx`.
- **Left panel** (button at top-left): slide-in glass panel with TABS (reorder the bottom bar by
  **long-press and drag**, persisted via `src/nav/tabOrder.ts`), MORE links (History, Records,
  Balance, Calculators, Body weight), Search, and a new-workout button.
- **Right panel** (sliders button): all Settings content, embedded.
- **Tap only**: open by the button; close by scrim tap, close button, item tap, or Android back.
  **No swipe gestures, no drag-to-close.**
- Liquid-glass look for chrome/buttons/panels/sheets; cards stay solid.
- Split into two helper jobs (left, right). Add pure-logic tests (`scripts/test-*.mjs`, wire a
  `test:*` script into `package.json` yourself) and a Maestro flow `.maestro/panels.yaml`.

### B. Verify layout on the emulator, then PUSH
`scripts/e2e.sh --build` then the `_shots` flow and `workout-flow`, `exercise-menu`, `tabs`.
Look at screenshots (one per question). Check: top bar not overlapping content, companion
circle not covering controls, floating tab bar not hiding the last list row. Push gate: panels
work + `npm run verify` green + e2e flows pass → `git push -u origin main`.

### C. Glass sheets (Stage C)
Restyle `BottomSheet`/menus in glass; consistent headers. Small jobs.

### D. Icons — refinement then equipment
Batches A and B are merged (contact sheet: `node scripts/render-icons.mjs /tmp/x.png`, then view it).
- Refine: **Biceps, Forearms, Front/Middle Delts** highlights are too small (zoom the crop on the
  target muscle); **Neck** and **Olympic** look odd (simplify Olympic); Calves highlight sits low.
- Equipment (with a person using it, same style as muscle icons): Kettlebell, Machine, Bodyweight,
  Cardio, Smith Machine, Cable, Safety Bar, Other, All (+ redraw Barbell/Dumbbell with a figure).
- Style rules: `docs/design/ICON_STYLE.md`; sources `assets/icons-src/{muscle,equipment}/*.svg`;
  build `node scripts/build-icon-art.mjs`; tests `npm run test:icons`.
  Vision-capable models: DeepSeek, Nemotron VL, GLM (attach reference images with `-f`).
- After icons: wire the equipment icons where equipment names are shown (`equipmentIcons.tsx`).

### E. Rich exercise pages + missing exercises (repo `~/lift/lift-kb`)
- Pilot ~6 rich pages (why it matters for longevity, rhythm/tempo, motivation, safety) for the
  owner to approve before rewriting all exercises/programs.
- Write missing: Bird Dog, Cable Woodchops, Rowing Machine, Outdoor Cycling; add to the foundational list.
- Markdown pages are the only source of truth; after edits run `node scripts/validate-content.mjs`
  in lift-kb, rebuild the bundle, and confirm the app snapshot (`assets/kb/snapshot`) is regenerated.

### F. Beam bake-off
`opencode/beam-free` is new: run a small coding test (e.g. the 16-case `parseDuration` task), then
set its place in `pool_order` in `scripts/opencode/models.json` and note the result in
`docs/ops/DELEGATION.md` §6. Do it when no other job is running.

### G. Housekeeping
Update `docs/ops/HANDOFF.md` §0 and `CHANGELOG.md` at the end of each session.

## 4. Owner-only items (don't try to do these)
- Verify recent features on the iPhone (Expo Go).
- Consider rotating the OpenRouter key found in the OpenCode session database.
- Optional: delete `~/lift/nas-staging/` once happy with the NAS backups (`backups/ai-rig1/`).
- Anything needing a password, store account, or credentials.

## 5. Gotchas that cost time before
- Never `pkill -f <pattern>` that matches your own command; use `[x]yz` bracket patterns or PIDs.
- Stuck emulator: kill by PID (`pgrep -f "[q]emu-system-x86_64"`), remove AVD `*.lock` files.
- Free-model streams can drop (503/504) on long jobs → keep jobs short.
- Maestro `eraseText` only deletes left of the caret.
- Shell for helpers is allowlist-only; helpers cannot change `package.json`.
- The NAS (address in the lan-nas-backup skill config) is often off; follow the `lan-nas-backup` skill; never put secrets on it
  without the owner saying so.
