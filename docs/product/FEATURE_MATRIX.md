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
| Starting weights sized to my body & level | ✅ P9 | Conservative estimates, clearly labelled |

## 2. Deciding what to do today
| Need | Status | Notes |
|---|---|---|
| "What's my workout today?" | ✅ P9 | Program pointer existed; now also suggests next plan in rotation |
| Week at a glance + weekly goal | ✅ P9 | Week strip + goal progress on Train |
| Readiness check-in (energy / sleep / soreness) | ✅ P9 | 3 taps; advice adjusts effort, stored locally |
| Reminders on my training days | ✅ P9 | Local notifications, no server |

## 3. During the workout
| Need | Status | Notes |
|---|---|---|
| Fast set logging, carry-over of last numbers | ✅ | Grid + carry-over (this session) |
| Warm-up sets, supersets, swap, add exercise | ✅ | Heading from the actions sheet — the warmups ramp at 50/70/85% ahead of the working sets; supersets group linked exercises |
| Rest timer + alert | ✅ | |
| Plate calculator | ✅ | |
| Feedback that feels good (haptics, motion) | ✅ P9 | Haptics on log, pop animation, PR celebration |
| Previous performance visible | ✅ | "Prev" column |
| Progressive overload suggestions | ✅ | Progression engine |
| Keep screen on | ❌ backlog (needs expo-keep-awake) | |
| Forgot to finish? Idle detection, check-in prompt, auto-finish at last activity | ✅ P9 | `src/workouts/` |
| A companion that encourages without hype | 🟡 foundation | Floating avatar + message queue (`src/companion/`); two skins — the illustrated mouse by default, the SVG creature as an alternative; `docs/product/COMPANION.md` |

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
| Hide the companion completely | ✅ | Settings → Companion (default ON); position stays local, out of backups |
| Choose the companion's look | ✅ | Settings → Companion → Style: Mouse (default) / Blob; persisted, rides in backups |
| Works offline, no tracking | ✅ | |

## 6. Longevity layer
| Need | Status | Notes |
|---|---|---|
| Weekly pillars (strength sessions, cardio minutes) | ✅ | |
| Program deloads + RPE caps | ✅ | |
| Generated plans always include squat/hinge/push/pull/carry/core/mobility | ✅ P9 | The "movement vocabulary" for ageing well |
| Effort guidance (stay 2–3 reps in reserve) | ✅ P9 | In generated plan notes + readiness advice |

## Backlog (not in this pass)
Progress photos (permissions), Apple Health / Health Connect, Watch, cloud sync,
exercise videos/media (parked), save-workout-as-plan, wake-lock.
