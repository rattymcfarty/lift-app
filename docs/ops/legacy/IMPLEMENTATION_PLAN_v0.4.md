# LIFT — Implementation Plan (v0.4, FINAL validated)

**Project:** LIFT — a longevity-focused, privacy-first workout tracker.
**Basis:** Built FROM SCRATCH (Expo SDK 57 + TypeScript). Ischys = ideas only.
**Decisions by:** Matt · **Drafted by:** Dash · **Reviewed:** 2 hostile frontier-model
reviews (v0.2 full, v0.3 deltas) — all corrections folded in below.
**Date:** 2026-10-11 · **Status:** FINAL — approved to begin Phase 0

---

## 1. Product definition

**What it is:** free, MIT-licensed, local-first workout tracker with longevity-
focused programming. No accounts, no servers, no user data leaves the device
(truthfully stated: OS-level device backups may include app data per the user's
own settings — documented, plus in-app export).
**Content layer:** public `lift-kb` repo (CC BY 4.0 prose, CC0 AI media) delivered
as CI-built versioned JSON bundles; app ships a snapshot, syncs updates via
`channel.json`. **Differentiators:** longevity programming (R2), programs engine
(R13), muscle-balance analytics + pillars (R14), dashboard (R15), on-device AI
post-v1 (R6).

**Scope cuts available** (to compress 32–34 wks → ~24): web build → v1.1;
measurements/calculators → v1.1; iPad multi-column → "don't break at any width";
anatomical heatmap → per-muscle volume bars; one flagship program; pillars =
strength + manual cardio minutes; Android beta before iOS.

## 2. Repositories
- **`lift-app`** (public, MIT): fresh Expo SDK 57 + TypeScript + Drizzle +
  expo-sqlite + expo-router. Sync-ready schema from day one (UUID keys,
  created_at/updated_at, soft deletes).
- **`lift-kb`** (public): CC BY 4.0 prose / CC0 media; CI validates → emits
  `kb-bundle-<v>.json` (`schemaVersion`, hashes) as **GitHub Release assets**
  (+ GitHub Pages mirror for web CORS); `channel.json` = `{latest,
  minAppVersion, schemaVersion, sha256, revoked[]}`; rollback supported;
  atomic verified install (`expo-crypto` sha256 → schema validate → swap);
  exercise IDs permanent (`deprecated`/`replacedBy`, never renamed).

## 3. Key technical rules (from reviews)
- **Expo Go (iPhone):** viable while the app uses only modules shipping inside
  Expo Go at its exact versions (covers Reanimated, Skia, SVG, Lottie → charts,
  muscle map, animations). Start on whatever SDK the App Store Expo Go runs;
  upgrade within a week of each release. Limits: no HealthKit/Watch/widgets/
  Foundation Models/IAP; `app.json` native settings ignored; notifications come
  from "Expo Go"; KB sync runs on app open; dev-mode performance only; no real
  training history in Expo Go.
- **Android:** rig-built dev builds/APKs — full native, primary test platform.
- **Health (post-v1):** no Expo built-in; community libs —
  `@kingstinct/react-native-healthkit` (iOS, config plugin),
  `react-native-health-connect` + expo plugin (Android). 3–4 weeks + Play review.
  v1 pillars are manual entry (quick-log UI).
- **Watch:** v2 (8–12 wks), gated on account + health + Mac access.
- **Rest timer:** timestamp-based, local-notification alert (never tick-counting).
- **Theming/tokens + breakpoints in Phase 1**, before any feature screens.
- **Privacy defaults in Phase 0–1:** Auto Backup rules, export flow, privacy
  policy groundwork. No expert names in UI/store metadata (cite publications;
  "not affiliated" line).
- **Media:** Matt supplies (his cloud AI sub). Dash's media spec defines
  dimensions/formats/naming/style. Per-asset record: service + model + prompt +
  license terms check. **Coach review = merge gate** (AI anatomy errors are a
  safety liability). Stills first; clips later, spec'd conservatively.
- **Licensing hygiene:** no Ischys source in AI assistants' context (or add MIT
  credit as insurance); generated "Licenses & credits" screen in-app.

## 4. Phases
- **P0 (2 wks):** repos, scaffold, toolchain; spikes (KB pipeline e2e, Drizzle
  migrations, snapshot import, Expo Go SDK match, Health Connect proof on
  Android); media spec → Matt; privacy defaults; exit = runs on both devices.
- **P1 Foundation (4 wks):** tokens/theming/breakpoints; data model; workout
  logging; rest timer; export/import. Exit = log a full workout both devices.
- **P1b Parity (4–5 wks):** routines, PRs, history/charts, measurements,
  calculators — every R1 feature explicitly scheduled.
- **P2 KB (2 wks app-side + editorial parallel):** schemas; test bundle
  (10 exercises, 1 program) as exit; full curation continues in parallel.
- **P3 Programs engine (6 wks):** DSL, enrollment snapshots, progression +
  deloads, RPE/RIR caps, PAR-Q+ gate, missed sessions. v1 = linear + fixed deloads.
- **P4 Dashboard & analytics (4 wks):** stats layer, dashboard, muscle balance,
  pillars (manual entry), themed charts; HealthKit/Connect mapping table ready.
- **P5 Polish (3 wks):** responsive, font scaling, safe areas, Maestro E2E.
- **P6 Release prep (3–4 wks):** privacy policy, Health Connect declaration
  (start early), Play Console ($25) + 14-day/12-tester closed test, screenshots,
  Apple account (~week 12 per reviewer; Matt's trigger remains "working app"
  — monthly iOS builds from purchase), TestFlight + Play beta.
- **Post-v1:** health integrations, Watch (v2), on-device AI (summaries of
  KB-grounded facts only), donations via GitHub Sponsors links.

**Estimate:** ~32–34 weeks to public beta at full scope (~24 with the §1 cuts).

## 5. What Dash needs from Matt (final kickoff list)
1. ✅ Repos: **approved** ("create a fresh repo") — creating `lift-app` + `lift-kb` now.
2. "LIFT" trademark/store-name search — quick web check by Dash; full clearance
   is Matt's call before Phase 1 rebrand assets.
3. KB shaping instructions (Matt's parallel track) + first visuals per media spec.
4. Android device model (for Health Connect test planning).
5. Apple account timing: plan holds Matt's "working app" trigger; reviewer
   recommends ~week 12 with monthly iOS builds — revisit then.
