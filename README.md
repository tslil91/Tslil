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
               billet assignments & history, grants (+ *.test.ts)
  store/       Zustand store (persisted) and synthetic seed data
  components/  rail navigation, dialogs, toast, icons, shared inputs
  views/       people (table / tree / move / add / inline edit), billets, grants, simulator (placeholder)
```

All business rules live in `domain/` and `logic/` as pure, unit-tested functions; views only call them.
The field registry (`logic/fields.ts`) drives the people table columns, filters, sorting, inline editors and the add form.

## Status

| View | State |
|---|---|
| כוח אדם | Table grouped by section (commander first, degree high → low), column sort & filters, column groups, inline edit, move / appoint via dialog, add person, hierarchy tree |
| תקנים | Query & filters, inline edit of internal/external, fixed/temporary and דמ"ח, history dropdown, add and delete with confirmation |
| מענקים ותמריצים | Per-person history (latest first), filters & sort, add, edit and delete (for correcting mistakes) |
| סימולטור | Placeholder — next phase |
