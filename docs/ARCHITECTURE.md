# ניהול כוח אדם ותקנים — Architecture & Plan v2

> Supersedes v1. Planning only, no production code yet.
> Mobile-first, Hebrew RTL, desktop later. Mock-up: see the Artifact "Personnel & Billets Mockup" (3 screens).

## 0. What changed from v1

| v1 | v2 |
|---|---|
| Time-travel simulator was the main screen | The simulator is a **third, secondary view** (a tool, not the home screen) |
| Org tree = Unit → Team → Billets | Home = **people grouped by מדור**, with every personnel attribute |
| Billets were only containers in the tree | Billets are a **first-class management view** (add / remove / query / history) |
| Little personnel data | Rich personnel record (rank type, degree, education, גמו"ש, דמ"ח ג׳/ב׳/א׳) |

Navigation: bottom tab bar → **כוח אדם | תקנים | סימולטור**. The simulator is reachable but visually marked "simulation — does not change real data".

## 1. Domain model

```
Section(מדור)   id, name, commanderPersonId?
Org             id, name, commanderPersonId?            (single root: גדוד/ארגון)
Person          id, name, mid (מ.א), population (KEVA|HOVA), rankType (SOLDIER|OFFICER|NCO|CIVILIAN),
                degree (from closed list by rankType), sectionId? (null = directly under the head),
                entryToKevaDate?, releaseDate,
                // NCO + OFFICER:
                hasBachelor, hasMasters, gamoshA,
                // OFFICER only:
                gamoshB,
                dmahC { firstSubmitDate, done, eligibilityDate },
                dmahB { ... }, dmahA { ... }
Billet          id (number), scope (INTERNAL|EXTERNAL), kind (FIXED|TEMPORARY), dmah (bool)
Assignment      personId, billetId?, sectionId?, startDate, endDate?, type (STANDARD | OVER_BILLET | MANDATORY_NO_BILLET)
```

Key modelling decisions
- **Section membership** = `Person.sectionId` (nullable → "under the head of the organization"). Moving a person is one field change (plus a history row in production).
- **Commander** is a pointer on `Section` / `Org` (one per unit), not a flag on Person. Moving a commander out of a section clears that section's pointer. A person can be commander of the org while sitting in any section.
- **Billet ↔ person** is derived from `Assignment`: the billet's "current person" = the assignment active today; "history" = all its assignments ordered by date. `על תקני` = KEVA person with no active billet assignment (the Bench from v1).
- **Conditional fields** are driven by one table, so the UI and validation stay consistent:

| Field | Soldier | NCO | Officer | Civilian |
|---|---|---|---|---|
| Billet, entry-to-keva | KEVA only | KEVA only | KEVA only | KEVA only |
| Bachelor / Masters / גמו"ש א׳ | – | ✔ | ✔ | – |
| גמו"ש ב׳, דמ"ח ג׳/ב׳/א׳ | – | – | ✔ | – |

- **Closed degree lists** live in a config table (`rankType → [degrees]`). *Assumption in the mock:* soldier = טוראי/רב"ט; NCO = סמל…רנ"ג; officer = סג"מ…אל"ם; civilian = דרגה א׳–ג׳. To be confirmed.
- Dates: ISO `YYYY-MM-DD` strings, half-open intervals `[start, end)` for assignments (as in v1).

## 2. Views

### 2.1 כוח אדם (home)
- Groups: **"ישירות למפקד הארגון"** first, then each מדור; header shows name, commander, count, collapse arrow.
- Person card (collapsed): name, commander badge, מ.א · type · degree, population chip, billet chip (`תקן N` / `על תקני`), release date. Tap → expands to **all** applicable fields (2-column grid).
- Actions in the expanded card: **העבר למדור** (bottom sheet of sections + "directly under head"), **מנה/הסר למפקד המדור**, **מנה/הסר למפקד הארגון**.
- **Search** (name / מ.א), **Filter sheet**, **Sort sheet** (direction toggle), removable chips of active filters. Sorting happens inside each section.
- Filter/sort cover **every field**: enums (population, type, degree, section, billet / על תקני), yes/no (bachelor, masters, גמו"ש א׳/ב׳, דמ"ח ג׳/ב׳/א׳), and dates (entry, release, first-submit and eligibility dates) with presets *past / within 90 days / within a year*. Free date ranges can follow later.
- Fields not applicable to a person are `null` and never match a yes/no filter.

### 2.2 תקנים
- Card: billet number, פנימי/חיצוני, קבוע/זמני, דמ"ח כן/לא, current person (or "פנוי").
- **History dropdown** per billet: all past/current occupants with date ranges.
- **Add billet** (sheet: number, scope, kind, dmah; unique-number validation) and **remove** (inline confirmation; warns if occupied).
- **Query**: free text (number or any occupant name, current or past) + toggle chips (internal/external, fixed/temporary, דמ"ח, filled/vacant).

### 2.3 סימולטור (side feature)
Same engine as v1: pick any past/future date and see sections, billets and the bench as of that date; tap-to-assign planned moves. Clearly labelled as simulation; in the MVP it is read-only toward real data (assignments made here are scratch scenarios).

## 3. State & logic

```
Zustand store (source of truth)  →  pure selectors  →  dumb components
  data:  sections, org, people, billets, assignments
  ui:    search text, filters{field→value}, sort{field,dir}, expanded ids, sheet state
  sim:   selectedDate, scenario assignments (separate slice, never written to `data`)
```
- **Filter/sort engine** is one generic pure module driven by a **field registry** (`key, label, type: text|num|enum|bool|date, appliesTo(rankType)`). The same registry renders the filter sheet, the sort sheet and the card's detail grid, so adding a field = one registry entry. Predicates: `enum → equals`, `bool → yes/no (null if n/a)`, `date → preset bucket` relative to "today".
- **Commands** (pure, unit-tested, undoable): `movePerson`, `setSectionCommander`, `setOrgCommander`, `addBillet`, `removeBillet`, `assign`, `unassign`. Each returns `{data, warnings}`; e.g. moving a section commander clears the pointer; removing an occupied billet closes its assignment and puts the person on the bench.
- **Simulator** (unchanged from v1): `getSnapshot(indexes, date)` over half-open assignment intervals, memoized per change-point segment; scenario edits live in the `sim` slice.
- **Validations** surfaced as warnings: person on two billets, population mismatch with billet, assignment past release, KEVA without entry date, section without commander.

## 4. Tech stack (unchanged, with two additions)
Vite + React + TypeScript (strict) · Tailwind v4 (logical properties only) · Radix/shadcn primitives · `vaul` bottom sheets · Zustand (+immer, persist, zundo) · date-fns (`he`) · zod · Vitest · Playwright (mobile emulation) · Heebo font.
Additions: **TanStack Virtual** for lists above ~300 people; **react-router** for the 3 tabs (deep link per view, filters in the URL query string so a filtered view can be shared).
Backend later: PostgreSQL (`daterange` + exclusion constraints for non-overlapping assignments), REST, auth + role-based access, audit log. **Synthetic data only** in the demo; personnel data needs the organization's security approval before any real data.

## 5. Mobile/RTL notes
- Tab bar at the bottom, sheets for filter/sort/move/add, 44px minimum targets, logical Tailwind classes only, `<bdi>` around numbers inside Hebrew text.
- Dense records (≈20 fields) are handled by **progressive disclosure** (collapsed card → expanded grid), not by horizontal tables. On desktop the same registry renders a sortable **table** with column filters.

## 6. Roadmap (≈3–4 weeks, one developer)
1. **Setup** — Vite/React/TS/Tailwind RTL, tab shell, i18n dictionary, deploy. *(1 d)*
2. **Domain + registry** — types, field registry with applicability rules, degree lists, zod schemas. *(1–2 d)*
3. **Seed data** — ~150 synthetic people across 4–5 sections, ~120 billets with history, edge cases (על תקני, officer with partial דמ"ח, direct-to-head). *(1 d)*
4. **כוח אדם view** — grouped list, expandable card, search. *(3 d)*
5. **Filter/sort engine + sheets** — all fields, chips, URL sync, unit tests. *(3 d)*
6. **Org commands** — move, commander assignment, undo, warnings. *(2 d)*
7. **תקנים view** — list, history dropdown, add/remove, query. *(3 d)*
8. **Simulator** — snapshot engine, time dock, bench, tap-to-assign (as in v1, reused). *(4–5 d)*
9. **Polish** — accessibility, performance with 1,000 people, Playwright E2E, demo script. *(2–3 d)*
10. **Post-MVP** — desktop table layout, Excel import/export, backend + roles + audit log, drag & drop.

## 7. Open questions
1. Exact degree lists per type (especially civilians) and whether a degree history is needed.
2. Do civilians and soldiers have a billet? (Mock: billet and entry-to-keva shown only for KEVA.)
3. Is `על תקני` only for KEVA, or also for mandatory soldiers without a billet (v1's "Mandatory-No-Billet")?
4. Can one person command both a section and the org? Can a section have deputy commanders?
5. דמ"ח ג׳/ב׳/א׳ — are they sequential (must finish ג׳ before ב׳), and should eligibility dates be computed automatically from first-submit date + a rule?
6. Does "removing a billet" with a current occupant move that person to על תקני automatically?
7. Who may edit (view-only vs. planner roles), and which fields are sensitive?
