# LIFT — feature matrix (gym-goer journey × app)

_Updated after the P9 pass: every ✅ P9 row shipped and is covered by an E2E flow
(`.maestro/onboarding.yaml`, `user-content.yaml`, `tabs.yaml`, `workout-flow.yaml`)
or a unit test (`npm run test:plan`)._

Status key: ✅ shipped · 🟡 partial · ❌ missing → **planned in this pass (P9)**.
Principles: longevity first · everything on device · no accounts · MIT.

## 1. Before the first workout
| Need | Status | Notes |
|---|---|---|
| Understand privacy up front | ✅ P9 | Welcome step states "nothing leaves your phone" |
| Tell the app who I am (height, weight, age, experience) | ✅ P9 | Local profile, editable in Settings |
| Say what I want (longevity / strength / muscle / fitness) | ✅ P9 | Drives volume, reps, rest |
| Say what I have (full gym / dumbbells / bodyweight) and how often/long | ✅ P9 | Filters exercises, sizes sessions |
| Flag limitations (knees, lower back, shoulders) | ✅ P9 | Excludes risky movements |
| Safety screening (PAR-Q+) | ✅ | Gate before programs |
| A plan built for me, adjustable afterwards | ✅ P9 | Rule-based generator → ordinary editable plans |
| A guided interview that builds **plans** for me, with a review before anything is saved | ✅ | "Set up my plans" (`app/quiz.tsx`): six questions, each with its reason and live consequence, then a review of the real generated plan set (days, exercises, sets × reps, rest, estimated loads) before "Build my N plans". Same generator and writer as onboarding and the profile editor; replaces only `My Plan · …` |
| Starting weights sized to my body & level | ✅ P9 | Conservative estimates, clearly labelled |

## 2. Deciding what to do today
| Need | Status | Notes |
|---|---|---|
| "What's my workout today?" | ✅ | The Train page leads with UP NEXT and one Start button; while a session is open the Train door goes straight back into it, and a live badge follows you elsewhere |
| Week at a glance + weekly goal | ✅ P9 | Week strip + goal progress on Train |
| Readiness check-in (energy / sleep / soreness) | ✅ P9 | 3 taps; advice adjusts effort, stored locally |
| Reminders on my training days | ✅ P9 | Local notifications, no server |
| Move between sections with one thumb | ✅ | Three main doors — Train · Analytics · Exercises — on a floating glass pill mounted in the root layout, so it is visible on EVERY screen (owner decision 2026-10-26: it never disappears), sized like a modern system bar (64 dp, 30 dp icons, 62 × 44 capsules). Programs is a menu page, not a tab. With a workout open, Train goes to that workout (owner decision 2026-10-26) |
| Reach anything from one menu | ✅ | Glass **side panels**, split by purpose (owner decision 2026-10-26): left = features (New workout, Search, Programs, History, Records, Balance, Calculators, Body weight, Plans vs programs, Your profile); right = settings only (check-ins, reminders, companion, appearance, units, data). Tap-only dismissal (scrim, close button, item tap, Android back) |
| Sheets and dialogs that look like one app | ✅ C | Every bottom sheet is the same glass component (`BottomSheet` + shared `SheetHeader`: grabber, title, close); the option pickers, the plate calculator, the muscle sheet and the rest timer all render it, and the rename dialog is glass. Dismiss by the header close, a backdrop tap, a pull down on the header, or Android back |
| Find exercises by muscle or equipment at a glance | ✅ D | 2-column tile + label grid (`TaxonomyFilterGrid`) with original LIFT artwork: 21 muscle-group and 10 equipment icons, figure in the theme's muted colour with the worked muscle or the implement in the theme highlight (light and dark), so the set follows the app theme rather than a fixed accent (`docs/design/ICON_STYLE.md`) |
| Know how to do a movement, and why it matters | ✅ E | Exercise guide (KB bundle 0.6.0, 631 pages): numbered steps with the tempo written in, coaching cues, common mistakes, a safety note that says when to stop, and longevity notes under *why this matters for a long life · rhythm and tempo · keeping it for life*. All 50 curated foundational names now resolve to a live page (Bird Dog, Cable Woodchops, Rowing Machine and Outdoor Cycling were written for this pass) |
| See the movement demonstrated, not just read it | 🟡 | **Bench Press - Powerlifting** opens its guide with a bundled 3 s silent loop (720², H.264, 458 KB) in a full-width tile (capped at 420 pt). It autoplays muted, pauses off-screen/backgrounded, respects Reduce Motion, and opens a black full-screen viewer on tap. Every other exercise shows the same tile with its primary-muscle icon and "Movement demo coming soon". Clips live in `assets/exercises/demos/<kb-id>.mp4` — offline, no network call — and `npm run test:exercise-demo` enforces the contract |
| Know how to do the movement I'm on, mid-set | ✅ | The exercise title opens a sheet: muscles/equipment, key cues, common mistakes, the KB safety line, plan target, last time and one longevity line, with the full guide one button away (`ExerciseInfoSheet`). Never leaves the workout |
| Understand what "Plan" and "Program" mean in this app | ✅ | `/learn/plan-vs-program` — owner-supplied copy rendered from `src/content/infoPages.ts` by one shared `InfoPageView`; opened from the Programs header ⓘ and the left panel More list. Moving the copy to the KB (editable on GitHub) is the remaining half of queue 2a |

## 3. During the workout
| Need | Status | Notes |
|---|---|---|
| Fast set logging, carry-over of last numbers | ✅ | Grid + carry-over (this session); tapping a value opens the scroll wheel, with "Type instead" for the keypad — and the same wheel is used for every numeric field in the app (plate calculator, calculators, plan targets, measurements, warm-ups, onboarding, cardio minutes) |
| The running session outranks everything | ✅ | The workout is the main window while it runs — no back arrow, Train goes to it (from any door or a relaunch), accent title, live "● 12:34" badge elsewhere; one tap returns. Nothing pauses it; it clears on finish/discard or the idle reminders (`src/workout/activeSession.ts`, `WorkoutBadge`) |
| Exercise and workout names are never shrunk or cut | ✅ | Names wrap to as many lines as they need and rows grow; the shared `ScreenHeader` sizes its title once from the screen width and never shrinks per title |
| Warm-up sets, supersets, swap, add exercise | ✅ | Heading from the actions sheet — the warmups ramp at 50/70/85% ahead of the working sets; supersets group linked exercises |
| Rest timer + alert | ✅ | |
| Plate calculator | ✅ | |
| Feedback that feels good (haptics, motion) | ✅ P9 | Haptics on log, pop animation, PR celebration |
| Previous performance visible | ✅ | "Prev" column |
| Understand the RPE I'm asked to enter | ✅ | The set table's RPE header opens an explainer — the 6–10 scale with the reps left at each level, a worked program line, effort ≠ load, and the 7–9 range most programs target (`src/components/workout/RpeSheet.tsx`). Companion on → Pip says the one-liner; off → neutral copy. The plan target editor's RPE label opens the same sheet |
| Progressive overload suggestions | ✅ | Progression engine |
| Keep screen on | ❌ backlog (needs expo-keep-awake) | |
| Forgot to finish? Idle detection, check-in prompt, auto-finish at last activity | ✅ P9 | `src/workouts/` |
| Finish or discard a workout | ✅ | Header/footer **Finish** opens a themed sheet — **Finish workout** (→ summary), **Discard workout** (confirm → soft-delete, back to Train), **Cancel**; a discarded workout leaves no history, PRs, stats or program progress behind |
| A companion that encourages without hype | 🟡 foundation | Fixed avatar in the TopBar centre (circular glass ring) + message queue (`src/companion/`); two skins — the illustrated mouse by default, the SVG creature as an alternative; hidden on onboarding and PAR-Q; `docs/product/COMPANION.md` |

## 4. After the workout
| Need | Status | Notes |
|---|---|---|
| Summary: volume, duration, sets | ✅ | |
| PRs celebrated | ✅ P9 | Detected; celebration animation added |
| History & per-exercise progress | ✅ | |
| Analytics: lifetime, week, balance, pillars | ✅ | Volume chart with a 4 / 12 / 26-week window, per-exercise strength chart, muscle balance, body-weight and waist trends, and the insight rows into Balance / Pillars / PRs / Measurements |
| Save as plan from a freeform workout | ❌ → backlog | |

## 5. Ownership & trust
| Need | Status | Notes |
|---|---|---|
| Create/edit plans, exercises | ✅ | |
| Duplicate a plan to customise | ✅ | |
| Export / import everything | ✅ P9 | Profile & settings now included in the file |
| Units kg/lb, dark/light | ✅ | |
| Hide the companion completely | ✅ | Settings → Companion (default ON); the circle is fixed in the top bar centre |
| Choose the companion's look | ✅ | Settings → Companion → Style: Mouse (default) / Blob; persisted, rides in backups |
| Works offline, no tracking | ✅ | |
| Review and update my profile ("persona") at any time, and see what each answer changes | ✅ | `Your profile` (`app/persona.tsx`), opened from the Programs header (person button), the left panel's More list and Settings. Every answer shows its consequence read from the generator's own tables (`src/lib/personaImpact.ts`): sets/reps/rest, load factor, split names, exercise cap, equipment and limitation exclusions. Save, or save & rebuild only the generated plans |

## 6. Longevity layer
| Need | Status | Notes |
|---|---|---|
| Weekly pillars (strength sessions, cardio minutes) | ✅ | |
| Program deloads + RPE caps | ✅ | |
| Generated plans always include squat/hinge/push/pull/carry/core/mobility | ✅ P9 | The "movement vocabulary" for ageing well |
| Effort guidance (stay 2–3 reps in reserve) | ✅ P9 | In generated plan notes + readiness advice; the RPE explainer spells out what each number leaves in the tank |

## Backlog (not in this pass)
Progress photos (permissions), Apple Health / Health Connect, Watch, cloud sync,
per-exercise demo clips beyond the first (movement-pattern loops next; hosted
overrides need an owner decision because they add a network call), save-workout-as-plan, wake-lock.
