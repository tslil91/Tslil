# ניהול כוח אדם ותקנים — Desktop MVP

Hebrew, RTL desktop web app for managing personnel by section (מדורים), billets (תקנים) and grants (מענקים ותמריצים).
Design: compact ("דחוס") with the navy & amber palette. Plans: `docs/ARCHITECTURE.md`, `docs/DESKTOP.md`.

> Demo only: all data is synthetic and stored in the browser (localStorage). Do not enter real personnel data.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build into dist/
```

Requires Node 20+. Minimum window width 1024px.

## Structure

```
src/
  domain/      types, date helpers, business rules (degrees per population/type, programs, applicability)
  logic/       pure functions: field registry, filter/sort/grouping, placement in the org,
               billet assignments & history, grants, spreadsheet mapping & import validation,
               simulator engine (+ *.test.ts)
  store/       Zustand store (persisted) and synthetic seed data
  components/  rail navigation, dialogs, toast, icons, shared inputs
  io/          Excel read / write (ExcelJS, loaded on demand)
  views/       people (table / tree / move / add / inline edit), billets, grants, simulator
```

All business rules live in `domain/` and `logic/` as pure, unit-tested functions; views only call them.
The field registry (`logic/fields.ts`) drives the people table columns, filters, sorting, inline editors and the add form.

## Status

| View | State |
|---|---|
| כוח אדם | Table grouped by section (commander first, degree high → low), column sort & filters, column groups, inline edit, move / appoint via dialog, add person, hierarchy tree, section management (add / rename / delete), Excel export / import |
| תקנים | Query & filters, inline edit of internal/external, fixed/temporary and דמ"ח, history dropdown, add and delete with confirmation, Excel export (with history sheet) / import |
| מענקים ותמריצים | Per-person history (latest first), filters & sort, add, edit and delete (for correcting mistakes), Excel export / import |
| סימולטור | Any date ± 2 years: sections, billets, על תקני, releases; change-point slider; what-if scenario (assign / release) stored separately from real data |

## Excel

- **Export** writes the rows currently shown (after search and filters) to `.xlsx`: right-to-left sheets, frozen header, real Excel dates (dd/mm/yyyy).
- **Import** reads the same format (the export file is also the template), shows a preview — new, updated, unchanged and every row error with its row number — and applies only the valid rows after confirmation.
  - People are matched by מ.א, billets by billet number, grants by מזהה (empty מזהה = new grant, person matched by מ.א).
  - Columns missing from the file keep their current values. Imports never delete. Commander roles and billet occupancy history are not imported.
  - Limits: `.xlsx` only, 5MB, 5,000 rows.

## Simulator model

- State on a date is computed from dated billet assignments (half-open `[start, end)`), release dates and keva entry dates.
- The scenario is a list of what-if operations (assign from a date / release from a date) applied on top of the real assignments; it never modifies them. A planned assignment ends automatically where the billet already has a later occupant.
- Known limitation: section membership has no history yet, so past dates show people in their current section.
