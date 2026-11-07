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

---

## 8. Revision 2 — after review (supersedes the matching parts above)

### 8.1 Confirmed domain rules
| Population | Allowed type | Degrees (low → high) |
|---|---|---|
| חובה | חייל | טוראי, רב"ט, סמל, סמ"ר |
| חובה | קצין | סג"מ, סגן |
| קבע | קצין | סגן, סרן, רס"ן, סא"ל, אל"מ |
| קבע | נגד | סמ"ר, רס"ל, רס"ר, רס"מ, רס"ב, רנ"ג |
| אזרח | אזרח | אע"צ, אע"ב |

- Population is now **3 values**: קבע / חובה / אזרח. Choosing a population limits the type; choosing the type limits the degree (enforced in add and edit forms).
- **Only קבע have a billet** (number or על תקני); billet and entry-to-keva are hidden for חובה / אזרח.
- **The organization commander is not a section commander** and sits at the organization level (no section). Appointing an org commander removes any section command and section membership; moving them into a section removes the org command.
- **דמ"ח dates are entered manually** (no calculation rules).
- Global degree order for sorting (high → low): אל"מ, סא"ל, רס"ן, סרן, סגן, סג"מ, רנ"ג, רס"ב, רס"מ, רס"ר, רס"ל, סמ"ר, סמל, רב"ט, טוראי, אע"ב, אע"צ. *Assumption:* civilians are ranked below uniformed personnel and אע"ב above אע"צ; "רס"ר" appeared twice in the list and was treated as one entry.

### 8.2 Personnel view (desktop)
- Default order inside every group: **commander first**, then **degree high → low**. Column sorting still works; a "חזרה לסדר דרגות" button restores the default. The commander stays pinned first in any sort.
- Summary side panel **removed**; table uses the full width.
- **Table / עץ היררכי toggle**: the tree shows the org commander on top, then one column per group (directly-subordinate + each section) with the section commander card and members by degree.
- Every row starts (right side, RTL) with two buttons: **⇅ change location** and **✎ edit**. Rows are no longer clickable.
- **Change location = floating dialog**: radio-style choices — מפקד הארגון, כפוף ישירות, איש צוות ב־<מדור>, מפקד <מדור>; shows who will be replaced and warns when the org is left without a commander.
- **Inline editing**: ✎ turns the row into editors (text / number / date / select), with dependent selects (population → type → degree), applicability rules, validation (required name & מ.א, unique מ.א, billet not already taken), ✔ save / ✕ cancel.
- **Add personnel** opens a dialog whose fields appear according to population/type; same validation; new person lands in the chosen location.

### 8.3 Billets view (desktop)
- History is **not a column**: a ▾ button at the start of each row opens the history below the row.
- **Add billet** = button → floating dialog (number, internal/external, fixed/temporary, דמ"ח).
- **Delete** = trash button → confirmation dialog (warns if the billet is occupied).
- Columns 2–4 (פנימי/חיצוני, קבוע/זמני, דמ"ח) are **editable in place** with dropdowns; every change shows a confirmation toast (and goes to the audit log in production).

### 8.4 Design options and color palettes
Implemented as two theme tokens (`design` × `palette`) — CSS variables + layout classes, so any combination works and switching is a config change, not a rewrite.

| Design | Description | Best for |
|---|---|---|
| **א׳ · פיקוד** | Dark side rail, medium radius, 44px rows | Recommended default; balanced |
| **ב׳ · מרחב** | Light top navigation, large headings, floating table card, 52px rows | Occasional users, presentations |
| **ג׳ · דחוס** | Narrow icon rail, square corners, 36px rows, zebra stripes | Power users handling many people |

| Palette | Navigation | Primary | Accent | Background |
|---|---|---|---|---|
| **1 · כחול צי וענבר** | #12263A | #12263A | #B4531A | #F3F5F7 |
| **2 · ירוק זית** | #2E3A26 | #3E5232 | #8A5F0E | #F4F3EE |
| **3 · צפחה וטורקיז** | #1E2A32 | #0B6A73 | #0B6A73 | #F5F7F8 |

Semantic colors (קבע blue, חובה amber, אזרח purple, yes green, vacant red) stay the same in all palettes so meaning never changes with the theme. All text/background pairs target WCAG AA (4.5:1).
