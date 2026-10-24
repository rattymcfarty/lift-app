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
| A guided interview that builds a **program** (plans + progression) for me | 🟡 → queued | Onboarding generates a plan today; a step-by-step quiz with a review step before saving is queue 2b |
| Starting weights sized to my body & level | ✅ P9 | Conservative estimates, clearly labelled |

## 2. Deciding what to do today
| Need | Status | Notes |
|---|---|---|
| "What's my workout today?" | ✅ P9 | Program pointer existed; now also suggests next plan in rotation |
| Week at a glance + weekly goal | ✅ P9 | Week strip + goal progress on Train |
| Readiness check-in (energy / sleep / soreness) | ✅ P9 | 3 taps; advice adjusts effort, stored locally |
| Reminders on my training days | ✅ P9 | Local notifications, no server |
| Move between sections with one thumb | ✅ A3 | Floating glass pill tab bar, icon only (Programs · Train · Analytics · Exercises), active item in an accent capsule; order persisted (`src/nav/tabOrder.ts`) and carried in backups; content pads around it (`useTabBarSpace`) |
| Reach anything from one menu | ✅ B | Glass **side panels** from the top bar: left = New workout, Search, the four sections (tap to jump, long-press-drag to reorder the bar) and More (History, Records, Balance, Calculators, Body weight); right = Settings. Tap-only dismissal (scrim, close button, item tap, Android back) |
| Sheets and dialogs that look like one app | ✅ C | Every bottom sheet is the same glass component (`BottomSheet` + shared `SheetHeader`: grabber, title, close); the option pickers, the plate calculator, the muscle sheet and the rest timer all render it, and the rename dialog is glass. Dismiss by the header close, a backdrop tap, a pull down on the header, or Android back |
| Find exercises by muscle or equipment at a glance | ✅ D | 2-column tile + label grid (`TaxonomyFilterGrid`) with original LIFT artwork: 21 muscle-group and 10 equipment icons, figure in the theme's muted colour with the worked muscle or the implement in the theme highlight (light and dark), so the set follows the app theme rather than a fixed accent (`docs/design/ICON_STYLE.md`) |
| Know how to do a movement, and why it matters | ✅ E | Exercise guide (KB bundle 0.6.0, 631 pages): numbered steps with the tempo written in, coaching cues, common mistakes, a safety note that says when to stop, and longevity notes under *why this matters for a long life · rhythm and tempo · keeping it for life*. All 50 curated foundational names now resolve to a live page (Bird Dog, Cable Woodchops, Rowing Machine and Outdoor Cycling were written for this pass) |
| Know how to do the movement I'm on, mid-set | ❌ → queued | Should be a sheet from the exercise title (key cues, the safety stop line, plan rest, last time) without leaving the workout; today only ⋯ → “View Demo & History” pushes the full guide — queue 2e |
| Understand what "Plan" and "Program" mean in this app | ❌ → queued | Owner-supplied copy — a Plan is the weekly schedule, a Program is how training progresses over weeks; needs one shared info page and a copy source that can be edited later (queue 2a) |

## 3. During the workout
| Need | Status | Notes |
|---|---|---|
| Fast set logging, carry-over of last numbers | ✅ | Grid + carry-over (this session) |
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
| Analytics: lifetime, week, balance, pillars | ✅ | |
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
| Review and update my profile ("persona") at any time, and see what each answer changes | 🟡 → queued | Editable in Settings today (and carried in backups); a reachable reviewer in the Programs section that shows the effect on volume/reps/rest/exclusions is queue 2b |

## 6. Longevity layer
| Need | Status | Notes |
|---|---|---|
| Weekly pillars (strength sessions, cardio minutes) | ✅ | |
| Program deloads + RPE caps | ✅ | |
| Generated plans always include squat/hinge/push/pull/carry/core/mobility | ✅ P9 | The "movement vocabulary" for ageing well |
| Effort guidance (stay 2–3 reps in reserve) | ✅ P9 | In generated plan notes + readiness advice; the RPE explainer spells out what each number leaves in the tank |

## Backlog (not in this pass)
Progress photos (permissions), Apple Health / Health Connect, Watch, cloud sync,
exercise videos/media (parked), save-workout-as-plan, wake-lock.
