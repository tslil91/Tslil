# Personnel & Billets Management — Mobile MVP
## Architecture & Planning Document (ניהול כוח אדם ותקנים)

> Status: Planning only. No code yet.
> Target: a mobile-first, RTL (Hebrew) demo, with a path to desktop.

---

## 0. Key decisions at a glance

| Topic | Decision |
|---|---|
| Primary assignment UX | **Tap-to-select → Tap-to-assign** (drag & drop is an optional later add-on) |
| Tree on mobile | **Drill-down navigation** (one level per screen) + collapsible teams. No deep indented tree. |
| Time travel | **Bottom "Time Dock"**: date chip + scrubber slider with event ticks + quick-jump buttons |
| Bench (על-תקני) | **Bottom sheet**, scoped to the unit/team on screen, with a count badge visible at all times |
| Snapshot calculation | **Pure function** `getSnapshot(data, date)`, memoized per *timeline segment* (between change points) |
| Date model | Date-only ISO strings (`YYYY-MM-DD`), **half-open intervals `[start, end)`** |
| Stack | Vite + React + TypeScript, Tailwind CSS (logical properties), Radix/shadcn primitives, `vaul` sheets, Zustand, date-fns (`he`), Vitest |
| Backend | None for the MVP. Seeded synthetic data + localStorage behind a repository interface. Postgres later. |

---

## 1. Domain model clarifications

The schema in the brief is sound. A few clarifications and small additions make the simulator correct.

### 1.1 Entities

```
Unit            id, name, parentId (null = root), type (UNIT | TEAM), order
Personnel       id, name, population (KEVA | HOVA), releaseDate, degreeStatus, joinDate*
Billet          id, title, unitId (team), requiredPopulation (KEVA | HOVA | ANY*), validFrom*, validTo*
Assignment      id, personnelId, unitId, billetId (nullable), startDate, endDate (nullable), type
Benefit         id, personnelId, benefitType, grantedDate
```
`*` = recommended additions:
- **`Personnel.joinDate`**: without it, people "exist" before they enlisted. If we skip it, we can infer it from the earliest assignment. For a time-travel demo the explicit field is better.
- **`Billet.validFrom / validTo`**: billets get created and cancelled over time (תקן נפתח/נסגר). Without this the simulator can show a past org with a billet that did not exist yet. These fields can be nullable, meaning "always existed".
- **`Unit` table with `parentId`**: one self-referencing table covers both Unit and Team (an adjacency list). That leaves room for deeper hierarchies when we move to desktop.

### 1.2 Assignment types, and how they define the bench

| Type | `billetId` | Meaning | Where it renders |
|---|---|---|---|
| `STANDARD` | required | Person occupies a billet (משובץ בתקן) | Inside the billet card |
| `TEMP_OVER_BILLET` | `null` | Career (קבע) person belongs to the team but has no billet yet, e.g. waiting for one to clear (על-תקני זמני) | Bench |
| `MANDATORY_NO_BILLET` | `null` | Mandatory (חובה) person attached to the team with no standard billet | Bench |

**Rule: the bench is every assignment active on date D where `billetId IS NULL`, grouped by `unitId`.**
We don't need a separate "bench" table. The bench is just a view over Assignments.

> ⚠️ To confirm with the business owner: if "Temporary-Over-Billet" really means a *second person sitting on an already occupied billet* (חפיפה / overlap), the model still works. `billetId` is set, and that billet then renders with 2 occupants and an "over-strength" badge. The snapshot engine below supports both meanings.

### 1.3 Date semantics (the most important correctness rule)

- All dates are **date-only strings** `YYYY-MM-DD`. No `Date` objects in the store and no time zones. This avoids off-by-one bugs around Israeli DST changes. Lexicographic string comparison is then also correct chronological comparison.
- Intervals are **half-open `[startDate, endDate)`**. `endDate` is the first day the person is *no longer* in the role. When someone moves on date D, the old assignment gets `endDate = D` and the new one gets `startDate = D`. There are no gaps or overlaps, and there's no "+1 day" arithmetic.
- `endDate = null` means "open-ended / until further notice".

### 1.4 Integrity invariants (checked by a validator, shown as warnings in the demo)

1. A person has **at most one active assignment** on any date.
2. A billet has **at most one `STANDARD` occupant** on any date (unless the over-strength meaning above applies).
3. `assignment.unitId` must equal `billet.unitId` when a billet is set.
4. Population match: `person.population` must match `billet.requiredPopulation` (or the billet must be `ANY`).
5. No assignment may extend past `person.releaseDate` (a release-date conflict).
6. A person with no active assignment on D, who has joined and is not yet released, is **"unplaced"**. This is a data gap and gets flagged.

In production, Postgres enforces invariants 1 and 2 with `EXCLUDE USING gist (... daterange(start, end) WITH &&)`. In the MVP they are checked in TypeScript.

---

## 2. Mobile UX/UI strategy

### 2.1 Screen anatomy (portrait, from 360px wide)

```
┌──────────────────────────────────┐
│  ☰   גדוד 51 › צוות אלפא      🔍 │  ← Sticky header: breadcrumb (tap to go up)
├──────────────────────────────────┤
│ ┌ KPI strip (horizontal scroll) ┐│
│ │ תקנים 24 │ מאוישים 19 │ פנויים 5 │ על-תקני 3 ││
│ └──────────────────────────────┘│
│                                  │
│  ▾ צוות אלפא          8/10  ⚠1   │  ← Team accordion header (occupancy + warnings)
│   ┌────────────────────────────┐ │
│   │ מפקד צוות   [קבע]          │ │  ← Billet card (filled)
│   │ ● ישראל ישראלי · שחרור 03/27│ │
│   └────────────────────────────┘ │
│   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   │ מש"ק   [חובה]    + פנוי    │ │  ← Billet card (vacant, dashed border)
│   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│  ▸ צוות בראבו         10/10      │
│                                  │
├──────────────────────────────────┤
│ ▔▔▔  על-תקני (3)  ⌃              │  ← Bench sheet, "peek" state (always visible)
├──────────────────────────────────┤
│  ◀ חודש   📅 05/11/2026 (היום)  חודש ▶│  ← Time Dock (fixed bottom)
│  |··|····|·|······●·····|··|···· │  ← Scrubber with event ticks
└──────────────────────────────────┘
```

Thumb-zone principle: everything you *act* with (time and bench) sits at the bottom, in reach of the thumb. Everything you *read* (the tree) scrolls in the middle. Navigation sits at the top.

### 2.2 Time-Travel Simulator: the "Time Dock"

A fixed bottom bar, about 88px, with three layers of control from coarse to fine:

1. **Date chip** (center): shows the simulated date in Hebrew format (`ה׳, 05 בנוב׳ 2026`). Tapping it opens a native-feel date picker (a bottom sheet with a calendar). This is for jumping precisely.
2. **Quick jumps**: `−חודש`, `היום`, `+חודש` buttons (44px minimum targets). Long-pressing ± switches the step to a week or a year.
3. **Scrubber slider**: a continuous slider over a configurable window (by default −2 to +2 years around today).
   - **Event ticks**: small marks at every *change point* (any assignment start or end, release date, or billet open/close). These are the only dates where the org actually changes. Haptic feedback (`navigator.vibrate(5)` where supported) snaps when the thumb crosses a tick.
   - **"Next change / previous change" buttons** (⏮ ⏭) jump straight to the next change point. This is the fastest way to "replay" history.
   - While dragging, a floating bubble shows the date above the thumb so the finger doesn't hide it.

**Mode visual cue.** When the simulated date ≠ today, the whole app gets a mode tint:
- Past: a sepia/amber header and a badge `מצב היסטורי`
- Future: a blue/violet header and a badge `תחזית`
- A persistent `חזרה להיום` pill appears.

This is critical. Users must never mistake a simulated state for reality.

**RTL direction of time.** In RTL the slider runs **right = past, left = future**. Radix Slider supports `dir="rtl"`, so this works out of the box. This should be validated with 2–3 real users in the first demo, because some Hebrew users are used to LTR timelines (as in Excel and Gantt charts). Keep it as a single config flag.

**Animated transitions.** When the date changes, cards that change state animate:
- A person leaving fades out.
- A person arriving slides in.
- A billet that becomes vacant flashes the dashed outline.

This is what makes the time travel *feel* like time travel. Use CSS transitions with keyed elements; no heavy animation library is needed (Framer Motion's `layout` is optional).

### 2.3 Organizational tree on a narrow screen

Deeply indented trees break below 400px. Use **drill-down plus accordion** instead:

- **Level 1 — Units list**: cards per unit with an occupancy bar (מאוישים/תקנים), vacancy count, bench count, and a warning count.
- **Level 2 — Unit screen**: teams as **accordions** (header shows `8/10` and warnings), billets listed inside. Only one or two levels are ever indented.
- **Breadcrumb header**: tap any segment to go up. Swiping from the screen edge goes back (the RTL back gesture comes from the *right* edge).
- **Search (🔍)**: a global search for a person or billet that jumps to its location and highlights it. Essential once there are more than about 50 billets.
- **Filters chips**: `פנויים בלבד` (vacant only), `קבע/חובה`, `התראות` (warnings).

**Billet card states** (by colour *and* icon/shape, never colour alone, for accessibility):

| State | Visual |
|---|---|
| Filled | Solid card, person name, population chip, release date |
| Vacant | Dashed border, `+ פנוי` |
| Ending soon (occupant leaves within 60 days of D) | Amber clock icon, "מתפנה ב־12/26" |
| Conflict (population mismatch, past release) | Red ⚠ with reason on tap |
| Over-strength (2 occupants) | Stacked avatars + badge |
| Not yet existing / closed at D | Hidden (optional toggle: show greyed) |

Tapping a person opens a **Person Sheet** with their details, benefits granted up to D, rights/degree status, and a **mini personal timeline** of their assignment history. Tapping a point on that timeline moves the Time Dock to that date.

### 2.4 Unassigned Bench (על-תקני): bottom sheet

Built with `vaul` (a mobile-native drawer) and three snap points:
- **Peek (~48px)**: `על-תקני (3)` with small avatars. Always visible above the Time Dock.
- **Half (~45%)**: a list of bench people *for the unit or team currently on screen*, grouped by population type (`קבע` / `חובה`), each with the reason (`ממתין לתקן`, `חובה ללא תקן`) and days on bench.
- **Full**: the whole unit, with a search box.

The bench is **context-scoped**. On a team screen it shows that team's bench first, then "other teams in the unit".

### 2.5 Assignment interaction: Tap-to-select → Tap-to-assign (primary)

Why tap is primary:
- On mobile, drag conflicts with scroll.
- Long lists need auto-scroll while dragging, which feels clumsy.
- Drag is hard to do one-handed.
- Drag is hard for accessibility (screen readers).

Tap works one-handed, across screens and with screen readers.

**Flow:**
1. In the bench, the user taps a person → enters **Assign Mode**.
   - The sheet collapses to the peek state, which now shows a "selected" chip: `משבץ את: דנה כהן ✕`.
   - The tree **highlights valid targets**: vacant billets in the same unit whose population matches get a pulsing green outline. Billets that are invalid (population mismatch, occupied) are dimmed. Billets that are vacant but *ending* get amber.
   - The tree auto-scrolls to the first valid target.
2. The user taps a target billet → a **Confirm Sheet** opens:
   - From → To (`על-תקני → מש"ק, צוות אלפא`)
   - **Effective date**: defaults to the *simulated date* D. That makes future planning ("on 01/03/27 Dana moves into this billet") a natural part of the time-travel feature.
   - Optional end date.
   - Validation warnings inline, e.g. "the person's release date is before the end date", "this billet already has a planned occupant starting 01/05/27".
   - `אישור שיבוץ`
3. After confirming:
   - The card animates in.
   - A toast `שובץ בהצלחה · ביטול` gives a 5-second undo.
   - Assign Mode exits.

Reverse flows from the same pattern:
- Tap a vacant billet → "who can fill this?", which opens the bench filtered to eligible people.
- Tap an occupied billet → actions: `העבר לעל-תקני` (unassign to bench), `החלף` (swap), `סיים שיבוץ` (end assignment).

**Drag & drop (phase 2, optional):** `@dnd-kit/core` with a `TouchSensor` (`delay: 250ms, tolerance: 8px` → long-press to drag, so it doesn't fight scrolling), `KeyboardSensor` for accessibility, and `DragOverlay`. It is a power-user shortcut on top of the same `assign()` command. It never replaces tap.

### 2.6 RTL & Hebrew specifics

- `<html dir="rtl" lang="he">`.
- Use Tailwind **logical properties only**:
  - spacing: `ms-*`, `me-*`, `ps-*`, `pe-*`
  - positioning: `start-*`, `end-*`
  - text alignment: `text-start`

  No `ml`/`mr`/`left`/`right`. This makes a future LTR/English mode free.
- Directional icons (chevrons, arrows) flip via `rtl:rotate-180`.
- Fonts: **Heebo** or **Assistant** (Google Fonts), which have good Hebrew and Latin numerals.
- Dates use `date-fns` with the `he` locale, display format `dd/MM/yyyy`.
- Numbers and IDs inside Hebrew text are wrapped in `<bdi>` to avoid bidi glitches, e.g. personal numbers and `8/10`.
- All UI copy goes in a single `he.ts` dictionary from day one, ready for i18n later.

### 2.7 Path to desktop

The same components re-arrange at the `lg:` breakpoint:
- The tree becomes a left/right **side panel** with a real expandable tree.
- Billets become a **grid**.
- The bench becomes a **permanent side column**.
- The Time Dock becomes a **wide timeline** at the top or bottom, possibly with a Gantt view per team.
- Drag & drop becomes primary on desktop.

Because all logic lives in the snapshot engine and the command layer, desktop is a layout exercise, not a rewrite.

---

## 3. State management strategy

### 3.1 Layers

```
┌─────────────────────────────────────────────────────────┐
│ UI components (dumb, read the snapshot via hooks)         │
├─────────────────────────────────────────────────────────┤
│ Selectors / hooks: useSnapshot(), useUnitView(unitId),    │
│                    useBench(unitId), useEligibleBillets()  │
├─────────────────────────────────────────────────────────┤
│ Snapshot engine (pure TS, no React)  ← unit-tested core    │
│   buildIndexes(data) · getSnapshot(idx, date) · validate() │
├─────────────────────────────────────────────────────────┤
│ Commands (pure TS): assign(), unassign(), move(), endAt()  │
│   (data, cmd) => { data', warnings }                       │
├─────────────────────────────────────────────────────────┤
│ Zustand store: { data (normalized), selectedDate, ui }     │
│   persist → localStorage · zundo → undo/redo               │
├─────────────────────────────────────────────────────────┤
│ Repository interface (Seed/localStorage now, REST later)   │
└─────────────────────────────────────────────────────────┘
```

**Rules:**
- The store holds **only source-of-truth data plus `selectedDate` plus UI state**.
- The snapshot is **always derived** and never stored. That way it can never go stale.

### 3.2 Store shape

```ts
// illustrative types only
type ISODate = string; // 'YYYY-MM-DD'

interface DataState {
  units:       Record<UnitId, Unit>;
  personnel:   Record<PersonId, Person>;
  billets:     Record<BilletId, Billet>;
  assignments: Record<AssignmentId, Assignment>;
  benefits:    Record<BenefitId, Benefit>;
  version:     number;   // bumped on every mutation → cache key
}

interface UiState {
  selectedDate: ISODate;          // defaults to today
  assignMode:   { personId: PersonId } | null;
  currentUnitId: UnitId | null;
  filters:      { vacantOnly: boolean; population?: 'KEVA' | 'HOVA' };
}
```

### 3.3 The snapshot algorithm

**Step A — Build indexes once per data `version`** (O(N log N)):
- `assignmentsByPerson: Map<PersonId, Assignment[]>`, sorted by start
- `assignmentsByBillet: Map<BilletId, Assignment[]>`, sorted by start
- `assignmentsByUnit: Map<UnitId, Assignment[]>`
- `changePoints: ISODate[]`: a sorted, unique list of every date where state can change:
  - every `startDate` and `endDate`
  - every `releaseDate` and `joinDate`
  - every billet `validFrom` and `validTo`
  - every benefit `grantedDate`

  This also feeds the slider's **event ticks** and the ⏮ ⏭ buttons.

**Step B — Active predicate** (half-open):

```
isActive(a, D)  :=  a.startDate <= D  &&  (a.endDate == null || D < a.endDate)
billetExists(b, D) := (b.validFrom == null || b.validFrom <= D) && (b.validTo == null || D < b.validTo)
personPresent(p, D) := (p.joinDate == null || p.joinDate <= D) && D < p.releaseDate
```

**Step C — `getSnapshot(idx, D)`** produces a render-ready structure:

```
activeAssignments = all a where isActive(a, D)

for each a in activeAssignments:
    person = personnel[a.personnelId]
    if a.billetId:
        occupantsByBillet[a.billetId].push({ person, assignment: a })
    else:
        benchByUnit[a.unitId].push({ person, assignment: a, daysOnBench: D - a.startDate })

for each billet b where billetExists(b, D):
    occ = occupantsByBillet[b.id] ?? []
    status = occ.length == 0 ? VACANT : occ.length > 1 ? OVER_STRENGTH : FILLED
    upcoming = next assignment on b with startDate > D   // "planned occupant"
    endingSoon = occ.some(o => o.assignment.endDate && o.assignment.endDate - D <= 60d)
    billetView[b.id] = { billet: b, occupants: occ, status, upcoming, endingSoon }

benefitsByPerson = benefits where grantedDate <= D

unitStats = roll up the tree bottom-up:
  { billets, filled, vacant, bench, warnings } per unit

warnings = validate(activeAssignments, D)
  (invariants 1–6 from §1.4)

return { date: D, billetView, benchByUnit, unitStats, benefitsByPerson, warnings }
```

**Complexity.** This is O(A + B) per snapshot, where A is the number of assignments and B the number of billets. A demo with about 500 people and 2,000 assignments takes well under 5ms.

**Step D — Segment memoization** (keeps the slider smooth):
- The org state is **identical for every date between two consecutive change points**.
- Map `D` to its segment index using a binary search over `changePoints`.
- Memoize the snapshot by `(data.version, segmentIndex)` in a small LRU cache (about 50 entries).

Effects:
- Scrubbing across 300 days that contain only 12 changes computes **12 snapshots, not 300**.
- Re-renders happen only when the segment actually changes.
- Combined with Zustand's selector equality, components re-render only when *their* billet's view changed.

Optimization if lists grow: during an active drag of the slider, update the bubble label every frame. Commit `selectedDate` to the store via `requestAnimationFrame` or `useDeferredValue` so the tree re-renders at most once per frame.

### 3.4 Mutations (commands) under time travel

All writes go through pure command functions that **respect the timeline**. They return the new data plus warnings, and the store commits the result.

`assign(personId, billetId, effectiveDate = D, endDate?)`:
1. Find the person's assignment active at D (e.g. on the bench). Set its `endDate = D`, so it is truncated, not deleted. History is preserved.
   - If that assignment *starts* at D, replace it instead, so no zero-length assignment is left behind.
2. Create the new `STANDARD` assignment `[D, endDate ?? originalEnd)`.
3. If the billet has a **future** planned occupant starting at F > D, cap the new assignment at `endDate = F` and warn the user ("will hold until 01/05/27").
4. If the person has **future** assignments after D, ask whether to keep them (default) or replace them. The demo can simply keep them and warn.
5. Run `validate()` on the affected window and return any warnings to show in the Confirm Sheet *before* commit (a dry run).

`unassign(personId, D)` ends the current `STANDARD` assignment at D and opens a bench assignment (`TEMP_OVER_BILLET` or `MANDATORY_NO_BILLET`, chosen by population) from D.

Every command:
- Is a pure function `(data, args) => { data, warnings }`, so it is trivially unit-testable.
- Bumps `version`.
- Is undoable through `zundo` (temporal middleware). Undo is just the previous `data`.

### 3.5 Why not a backend query per date?

For the MVP, all data lives client-side and the computation is instant, so scrubbing works offline and with no latency. At scale (thousands of people), use a hybrid:
- The server returns assignments **overlapping a date window**: `WHERE daterange(start, end) && daterange(:from, :to)`, using a GiST index.
- The *same* snapshot engine runs on the client over that window.
- The engine stays a pure TS module, so it can also run on a Node backend or in a Web Worker unchanged.

---

## 4. Tech stack recommendations

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite** | Instant dev server, simple static deploy; a demo needs no SSR |
| UI | **React 19 + TypeScript (strict)** | Ecosystem, team familiarity, typed domain model |
| Styling | **Tailwind CSS v4** | Logical properties (`ms-`, `pe-`, `start-`) and the `rtl:` variant make RTL clean; mobile-first by default |
| Primitives | **Radix UI / shadcn/ui** | Accessible, with `dir="rtl"` support (Slider, Accordion, Dialog, Toast); we own the code |
| Bottom sheets | **vaul** | Native-feeling drawer with snap points and good touch physics |
| State | **Zustand** + `immer` + `persist` + **`zundo`** | Tiny, selector-based re-renders, easy persistence and undo; no Redux boilerplate |
| Dates | **date-fns** + `he` locale | Tree-shakable, works on plain strings and dates; no heavy Moment |
| Drag & drop (phase 2) | **@dnd-kit/core** | Best touch support (long-press activation), accessible keyboard sensor, works with RTL |
| Virtualization (if needed) | **@tanstack/react-virtual** | For bench or search lists larger than about 200 rows |
| Validation of seed/import | **zod** | Validates mock JSON and future API payloads against the domain types |
| Fake data | **@faker-js/faker** (`he` locale) | Realistic Hebrew names; **synthetic data only** |
| Unit tests | **Vitest** | Snapshot engine and commands: the core of correctness |
| E2E | **Playwright** with mobile emulation (iPhone 13, Pixel 7) | Validates the tap-to-assign flow and RTL layout |
| PWA (nice to have) | **vite-plugin-pwa** | "Add to home screen" makes the demo feel like an app |
| Hosting | Static (internal server / Vercel / Netlify) | No backend needed for the MVP |

**Future backend:** PostgreSQL. Its `daterange` columns plus GiST exclusion constraints enforce "no overlapping assignments" at the database level. The API layer can be Supabase, or NestJS/Fastify. Add TanStack Query on the client when the data moves to the server.

> 🔒 **Data note:** personnel data is sensitive. The demo must use **synthetic data only** and must not be connected to real personnel systems. Hosting has to follow the organization's information-security policy (e.g. an internal network only). Plan authentication and role-based access before any real data is involved.

---

## 5. Project structure (proposed)

```
src/
  domain/           types.ts, dates.ts (ISO helpers, half-open math)
  engine/           indexes.ts, snapshot.ts, validate.ts, changePoints.ts   ← pure, 100% tested
  commands/         assign.ts, unassign.ts, move.ts                         ← pure, tested
  data/             seed.ts (faker), repository.ts (interface + local impl)
  store/            dataStore.ts, uiStore.ts, selectors.ts
  features/
    time-dock/      TimeDock, DateChip, Scrubber, EventTicks
    org-tree/       UnitList, UnitScreen, TeamAccordion, BilletCard
    bench/          BenchSheet, BenchPersonRow
    assign/         AssignModeBanner, ConfirmAssignSheet
    person/         PersonSheet, PersonTimeline
  ui/               shadcn primitives, Badge, KpiStrip
  i18n/he.ts
```

---

## 6. Step-by-step MVP roadmap

Rough estimates assume one full-stack developer. Each phase ends in a demoable state.

### Phase 0 — Foundations (0.5–1 day)
- Vite + React + TS + Tailwind v4 + shadcn. Set `dir="rtl"`, load the Heebo font, add the `he.ts` dictionary.
- ESLint/Prettier and Vitest set up.
- An ESLint rule (or a check in review) that bans physical Tailwind classes (`ml-`, `mr-`, `left-`, `right-`).
- Deploy pipeline to a static host, so there's a demo URL from day one.

### Phase 1 — Domain & snapshot engine (2–3 days) ⭐ core
- Domain types and date helpers (half-open interval math on ISO strings).
- `buildIndexes`, `getSnapshot`, `changePoints`, `validate`.
- **Thorough Vitest suite** covering:
  - boundary days (start day, end day)
  - open-ended assignments
  - release date on the selected date
  - billet closed in the past
  - double booking
  - population mismatch
  - the segment-memo cache key
- *Exit criteria:* given the seed data and a date, the engine returns a correct snapshot. No UI yet.

### Phase 2 — Seed data (1 day)
- Synthetic org: 1 unit (or 2), 4–6 teams, about 60 billets, about 70 people, mixed קבע/חובה.
- Assignment history from −2 to +1 years, built from scripted "stories" that make good demo moments:
  - a career officer waits 3 months on the bench, then takes a billet
  - a mandatory soldier is released, leaving a vacancy
  - a planned future move
  - one deliberate conflict
- Validate the seed with zod and the engine's `validate()`.

### Phase 3 — App shell & org tree, read-only at "today" (2 days)
- Sticky header with breadcrumb, KPI strip.
- Unit list → Unit screen → Team accordions → Billet cards, with all visual states.
- Person Sheet (details, benefits).
- *Exit criteria:* someone can browse the current org on a phone.

### Phase 4 — Time Dock (2 days)
- Date chip with picker sheet, quick jumps, scrubber with event ticks, ⏮ ⏭ change-point navigation.
- Past/future mode tint, the `חזרה להיום` pill.
- Wire up `selectedDate` → segment-memoized snapshot. Add the arrival/departure transitions.
- *Exit criteria:* scrubbing history is smooth (60fps on a mid-range Android) and the org visibly changes.

### Phase 5 — Bench (1–2 days)
- vaul bottom sheet with peek/half/full snap points, scoped to the current unit/team.
- Grouped by population, with reason and days-on-bench.
- Bench counts in the KPIs and the team headers.

### Phase 6 — Tap-to-assign (2–3 days) ⭐ core
- Commands `assign` / `unassign` / `endAt`, with unit tests including future-occupant capping.
- Assign Mode:
  - highlight valid targets, dim invalid ones, auto-scroll to the first valid target
  - Confirm Sheet with effective date (defaults to the simulated date) and a dry-run validation preview
- Toast with undo (zundo), persistence to localStorage, and a "reset demo data" button.
- Reverse flows: vacant billet → eligible bench people; occupied billet → unassign/end.

### Phase 7 — Insights & polish (1–2 days)
- Warnings center (a list of all conflicts at D; tap one to jump to it).
- Person mini-timeline (tap a point → time-travel to it).
- Search.
- Accessibility pass: 44px targets, focus order, ARIA labels in Hebrew, colour-plus-icon for states.
- PWA manifest and icons.
- Playwright E2E for the golden path on iPhone and Pixel emulation.

### Phase 8 — Demo readiness (0.5–1 day)
- A scripted demo walkthrough (5 minutes) using the seeded stories.
- Performance check with a 5× seed (about 350 people) to show it scales.
- Collect feedback on two open UX questions: the RTL slider direction, and the meaning of "Temporary-Over-Billet".

### Phase 9 — Post-MVP (only if the demo succeeds)
- `@dnd-kit` drag & drop as a power-user shortcut; desktop layout (`lg:` breakpoint).
- Backend: Postgres with `daterange` and exclusion constraints, REST API, authentication and roles, audit log (who changed what assignment, when).
- Planning scenarios ("what-if" branches of the future that don't affect the official plan). Because the data is immutable and command-based, this fits naturally.
- Import/export (Excel), reports (occupancy over time, expected vacancies by release dates).

**Total MVP estimate: ~2.5–3.5 weeks for one developer.**

---

## 7. Open questions for the business owner

1. Does `Temporary-Over-Billet` mean "career person with no billet" (bench) or "second person overlapping an occupied billet"? The engine supports both, but the UI copy differs.
2. Should a person be able to be on the bench of a team *different* from the team of their eventual billet (cross-team moves)?
3. Which "Degrees/Rights status" values exist, and do they depend on the date (i.e., should they be derived from Benefits on D)?
4. Can billets be "frozen" (exist, but not to be filled)? That would add a status to `Billet`.
5. Timeline direction preference in RTL: past on the right (RTL-natural) or on the left (Gantt/Excel convention)?
6. Who edits? Is the demo single-user, or do we need to show roles (viewer vs. planner)?
