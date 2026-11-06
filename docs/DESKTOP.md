# גרסת שולחן עבודה — Desktop Plan

> Extends `docs/ARCHITECTURE.md` (v2). Planning only. Mock-up: the "Personnel & Billets Mockup" Artifact, second row (3 desktop screens, 1280×800).

## 1. Principle: one codebase, one logic layer, two layouts

The domain model, field registry, filter/sort engine, commands and snapshot engine (ARCHITECTURE §1–3) are **shared and unchanged**. Desktop only adds a different presentation layer, switched at the Tailwind `lg` breakpoint (≥1024px). No logic is duplicated.

| Concern | Mobile | Desktop |
|---|---|---|
| Navigation | Bottom tab bar | **Right-hand rail** (RTL): כוח אדם, תקנים, then "כלים נוספים → סימולטור" |
| People | Grouped cards, tap to expand | **Wide table**, grouped by מדור, all fields as columns |
| Filtering | Bottom sheet | **Per-column filter under each header**, plus a section filter in the toolbar |
| Sorting | Sort sheet | Click a column header (↑/↓) |
| Details & actions | Expand in card, sheets for move | **Persistent side panel** (left in RTL): full details, move dropdown, commander buttons |
| Billets | Cards, history dropdown | Table with column filters, inline history row, **always-visible "add billet" panel** |
| Simulator | Slider dock + bench sheet | Time panel on top, sections side by side, **bench as a permanent side column**, confirm dialog |

## 2. Layout shell (RTL)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Rail 208px │  Top bar: title · count · search · export · add           │ Details
│ (right)    │  Toolbar: section filter · column groups · clear filters  │ panel
│            │  ┌───────────────────────────────────────────────────┐    │ 320px
│  כוח אדם   │  │ sticky header: sort + filter per column           │    │ (left)
│  תקנים     │  │ ▾ ישירות למפקד הארגון (n)                         │    │
│  ─────     │  │ ▾ מדור מבצעים (n) · מפקד: …                       │    │
│  סימולטור  │  │   row … row …   (name column sticky on the right) │    │
│            │  └───────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```
- The **name column is sticky** at the inline-start (right) edge; the header row is sticky at the top; the table scrolls in both directions.
- ~20 columns do not fit, so columns are **grouped and toggled**: *base* (always), *השכלה והכשרה*, *דמ"ח (קצינים)*. Later: a full column picker and saved column sets.
- Selecting a row opens the details panel (the same field registry that renders the mobile card renders the panel and the table cells).

## 3. Technical additions for desktop

| Need | Choice |
|---|---|
| Data grid | **TanStack Table** (headless) fed by the field registry: sorting, per-column filters, column visibility, grouping by section; our existing engine remains the source of truth for filter semantics |
| Large lists | **TanStack Virtual** for row virtualization (1,000+ people stay smooth) |
| Drag & drop | **dnd-kit** with pointer + keyboard sensors: drag a person row onto a section in a section-tree sidebar (desktop only); same `movePerson` command as the dropdown |
| Multi-select & bulk actions | Checkbox column; bulk **move to section**, bulk export; shift-click range select |
| Keyboard | Arrow keys to move between rows, Enter opens panel, `/` focuses search, `Esc` closes panel / dialogs, `?` shortcut help; full focus management for Hebrew screen readers |
| Saved views | Named filter + sort + column sets (stored per user), also encoded in the URL query string so views can be shared |
| Export | Excel export of the **current filtered/sorted view** (SheetJS client-side in the demo, server-side later) |
| Print | Print stylesheet for a section roster |
| Density | Compact / comfortable row height toggle (44px default) |
| Window sizing | Min width 1024px; rail collapses to icons below 1200px; details panel becomes an overlay below 1100px |

## 4. Simulator on desktop (side tool, richer)
- Same `getSnapshot(date)` engine and scenario slice.
- Adds: **side-by-side comparison** (two dates, diff highlighting: who moved, which billets opened/closed), a per-section **Gantt view** of billet occupancy over time, and drag-from-bench onto a billet. Scenarios can be named and saved; applying a scenario to real data is a separate, permission-gated command (post-MVP).

## 5. Roles & safety (becomes visible on desktop)
- Role-based UI: viewer / section planner / admin. Edit controls (move, commander, add/remove billet) are hidden or disabled by role.
- **Audit log** panel (who moved whom, when) and confirm dialogs for destructive actions (remove billet with occupant).
- Sensitive-field masking option (e.g. education/דמ"ח visible only to authorized roles).

## 6. Roadmap (after the mobile MVP, ≈3 weeks)
1. **Shell** — responsive layout switch at `lg`, rail navigation, details panel container. *(2 d)*
2. **People table** — TanStack Table on the field registry, sticky name column/header, grouped rows, column-group toggles, per-column filters. *(4 d)*
3. **Details panel + actions** — reuse commands; keyboard navigation. *(2 d)*
4. **Billets table** — inline history, add panel, remove with confirmation. *(2 d)*
5. **Virtualization, multi-select, bulk move, Excel export, saved views.** *(4 d)*
6. **Drag & drop** onto section tree (dnd-kit). *(2 d)*
7. **Simulator desktop** — bench column, comparison mode, Gantt. *(4 d)*
8. **Roles, audit panel, print styles, a11y + Playwright desktop E2E.** *(3 d)*

## 7. Open questions (desktop-specific)
1. Minimum screen size/resolution used in the field (e.g. 1366×768 laptops vs. large monitors)?
2. Must the table show *all* columns at once, or are grouped/optional columns acceptable?
3. Is bulk editing (move many people at once) needed, and who may do it?
4. Is Excel export of the filtered view enough, or is import also required?
5. Are printed section rosters needed, and in what format?
6. Should the simulator support comparing two dates / saving named scenarios in the first desktop release?
