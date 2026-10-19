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
7. Do **not push** unless the current work is done and `npm run verify` is green
   and the device flows pass. `main` is pushed through `41b3953` (2026-10-19); push
   each verified checkpoint from now on.
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

Everything through queue item F is **pushed** (`main` = `41b3953`, 2026-10-19): side panels
(B), glass sheets (C), the full muscle + equipment icon set (D), the exercise-guide pass
(E — lift-kb 0.6.0, four new movements, the six-page rich pilot, the detail-screen Overview
change) and the exercise-detail flow. Nothing is running; working tree clean.

**Fixed 2026-10-19:** the KB importer never wrote `longevityNotes`, so the exercise page's
**Why** card (the longevity notes) was missing on every imported exercise. It is stored now,
and `.maestro/exercise-detail.yaml` asserts a line from every guide card, so this cannot
vanish silently again.

**Added 2026-10-18 (opencode session, stage B):** the two top-bar buttons now open the
**side panels** — left menu (New workout, Search, the four sections with long-press drag to
reorder the bar, More links) and right Settings panel; both glass over a dim, tap-only
dismissal. `npm run verify` green, device flows pass, owner confirmed the drag on iOS.
Committed `b8a1685` (+ a flow fix and handoff docs). See `docs/ops/HANDOFF.md` §0.

Already pushed and working: warmup sets sheet, supersets, finish/discard workout sheet,
planned-set prefill, Markdown exercise guides, "top 50" foundational list, mouse companion,
purple/blue theme, leave-program fix, Markdown as the only KB source (lift-kb).

## 3. The queue (do in this order)

### A. Side panels (Stage B) — unlocks the push ✅ DONE 2026-10-18
The top-bar buttons now open the left menu (New workout, Search, the four
sections with long-press drag to reorder the bar, More links) and the right
Settings panel. Both are glass over a dim scrim and close on scrim tap, the
close button, an item tap or Android back. Pure logic in
`src/chrome/panelsModel.ts` (`npm run test:panel`), Maestro flow
`.maestro/panels.yaml`. See `docs/ops/HANDOFF.md` §0 for the file list.

### B. Verify layout on the emulator, then PUSH ✅ DONE 2026-10-18
`_warmup`, `panels`, `tabs`, `workout-flow`, `exercise-menu`, `_shots` all pass
on the emulator; `npm run verify` ALL GREEN; the owner confirmed the long-press
drag on iOS (Expo Go). `main` pushed to `origin/main` (gate met).

### C. Glass sheets (Stage C) ✅ DONE 2026-10-18
Every bottom sheet is now one glass component with a shared header
(`src/components/ui/BottomSheet.tsx` + `SheetHeader.tsx`, maths in
`sheetModel.ts` / `npm run test:sheet`). Committed `043a39d`; the follow-up fixes
the emulator found (Android pull-down claiming at touch-down, the `maxHeight`
cap, the flow's swipe coordinates) are in `01c8f5f` — see `docs/ops/HANDOFF.md` §0.

### D. Icons — refinement then equipment ✅ DONE 2026-10-18, crop fixes 2026-10-19
Muscle art redrawn where the highlight was thin or the crop wrong (Biceps,
Front/Middle Delts, Neck, Olympic, Other). **Calves now draws both lower legs** —
the reference crop shows both — and **Forearms** is the single documented
one-limb exception (one arm on a diagonal with a hand); see
`docs/design/ICON_STYLE.md`. All ten
equipment ids render from `assets/icons-src/equipment/*.svg` (barbell, dumbbell,
kettlebell, machine, bodyweight, cardio, smith machine, cable, safety bar, other)
and the exercise detail page shows the equipment icon next to the name. The build
now fails when a taxonomy id has no art file, the contact sheet renders in the
real theme colours (`--only=muscle|equipment`), and `test:icons` is 63 assertions.
Pushed `a782d31`, `5736bfd`; contact sheet at `.opencode/renders/sheet.png`
(`node scripts/render-icons.mjs`).

### E. Rich exercise pages + missing exercises (repo `~/lift/lift-kb`) ✅ DONE 2026-10-18 (pilot awaiting owner approval)
- Pilot ~6 rich pages (why it matters for longevity, rhythm/tempo, motivation, safety) for the
  owner to approve before rewriting all exercises/programs.
- Write missing: Bird Dog, Cable Woodchops, Rowing Machine, Outdoor Cycling; add to the foundational list.
- Markdown pages are the only source of truth; after edits run `node scripts/validate-content.mjs`
  in lift-kb, rebuild the bundle, and confirm the app snapshot (`assets/kb/snapshot`) is regenerated.

### F. Beam bake-off ✅ DONE 2026-10-19
`opencode/beam-free` measured on the 16-case `parseDuration` fixture: **pass in 17 s** (fastest
in the pool), spec and test untouched, a regex parser rather than a lookup table. Promoted to
2nd in `pool_order` (behind DeepSeek for its real-delegation history) and in the `code` rank;
row + notes in `docs/ops/DELEGATION.md` §6. Worktree cleaned.

### G. Housekeeping ✅ DONE 2026-10-19
`docs/ops/HANDOFF.md` §0, `CHANGELOG.md`, this file and `DELEGATION.md` are current after the
2026-10-19 session. Keep doing this at the end of every session.

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
