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

---

## 9. Revision 3 — decisions and new features

### 9.1 Decisions
- **Design: ג׳ · דחוס** (narrow icon rail, square corners, 36–40px rows, zebra stripes) with **palette 1 · כחול צי וענבר**, applied to every desktop view (כוח אדם, תקנים, מענקים ותמריצים, סימולטור). The other design/palette options are kept only as theme tokens.
- All assumptions in §8.1 are confirmed (רס"ר once; civilians below uniformed personnel; אע"ב above אע"צ).

### 9.2 New personnel field: תוכנית (program, optional)
| Type | Allowed values |
|---|---|
| חייל | מט"ל |
| קצין (חובה או קבע) | עתודה, אקדמזיציה, פיון, תלפיות, פסגות |
| נגד / אזרח | not applicable |

Column in the table after דרגה; filterable (including "ללא"), sortable, editable inline, part of the add form. Changing the type clears a program that is no longer valid.

### 9.3 New view: מענקים ותמריצים (grants & incentives)
Data model:
```
Grant   id, personId, type (VOUCHER שובר | GRANT מענק | INCENTIVE תמריץ),
        signingMonths? (משך חתימה, optional), signingStart?, signingEnd?,
        amount (₪), amountBasis (GROSS ברוטו | NET נטו), enteredAt, enteredBy
```
- **List**: one row per person who has at least one grant — name, מ.א, degree, section, number of records, latest grant (type, amount, date) and totals split into gross / net.
- **Dropdown per person** (▾ at the row start) opens the grant history, **latest first** (by signing start, or entry date when there is no signing period); the newest one is marked "אחרון".
- Search (name / מ.א), filters (type, gross/net, section), sort (name, count, latest, total), expand / collapse all.
- **Add grant** = floating dialog: person, type, signing duration in months (optional), signing start and end, amount, gross/net. When duration and start are given, the end date is filled in automatically (still editable). Validation: person and positive amount required, start required when a duration is set, end after start.
- Totals never mix gross and net amounts.
- Production: amounts and grants are sensitive — visible only to authorized roles, every change written to the audit log.

---

## 10. Implementation status (code started)
- Stack in use: Vite 6, React 19, TypeScript 5.8 (strict), Tailwind CSS 4, Zustand 5 (persisted to localStorage), Vitest 3.
- Implemented: כוח אדם, תקנים, מענקים ותמריצים (including grant **edit and delete**, for correcting entry mistakes, with confirmation), **Excel export / import** for all three, and the **simulator** (see README for the rules).
- Billet ↔ person is stored as dated billet assignments; changing a person's billet closes the old period and opens a new one, so the billet history fills itself.
- Not yet: section-membership history for the simulator, applying a scenario to real data, roles/authentication, audit log, backend.


---

## 11. Revision 4 — change log, server for an offline NFS install, and productivity features

### 11.1 Decisions
- **Environment:** air-gapped, only a shared NFS. Therefore: a single Node server process (zero npm dependencies, one file) keeps the data in files on the NFS directory; users only need a browser. Files are written atomically, the change log is append-only, a lock file allows one writer, automatic backups are kept. No database server (SQLite over NFS is unsafe for concurrent access).
- **Identity:** no login was requested, so the change log records a **self-declared user name** (asked once per browser). It is documentation, not security.
- **Concurrency:** optimistic versioning. Whoever saves first wins; the other user is told, the data refreshes, and they repeat the change. Simple and predictable, with no silent overwrites.
- **Section history:** the app records dated section membership (derived from every change to a person's section), so the simulator and the date comparison are accurate for past dates from the moment recording started; before that, people are shown in their current section.
- **Saved views** are personal (kept in the browser) and can be shared as a link; they are not shared data.

### 11.2 Features
1. **Change log**: every change to people, sections, commanders, billets, billet assignments, grants and notes becomes a readable entry with time and user. A screen (filters and export) and each person's page show it.
4. **Backup / restore**: one JSON file; restore is validated field by field and by references, shows what it will load, asks for confirmation, and (on the server) a copy of the current state is kept first.
5. **"Needs attention"**: releases of people still on a billet, vacant billets (and for how long), long-time על תקני, officers' דמ"ח eligibility near or overdue, grant signings that end. The windows are personal settings.
6. **Data checks**: commanders missing or misplaced, double-booked billets or people, non-keva on a billet, released but still on a billet, impossible dates, invalid degree or program, duplicate מ.א, broken references. Errors show as a badge in the menu.
8. **Bulk actions**: checkboxes per row, per group and for all visible rows; move to a section (with a preview, including commanders who lose their command); export the selection. Actions only apply to people that are currently visible.
9. **Saved views**: named combinations of search, filters, sorting, columns and table/tree view; sharing as a link (validated when opened).
10. **Person page** and 11. **Section page**: see the README status table.
15. **Comparison of two dates**: KPI changes, who changed section, who left or joined, billet occupancy changes, who entered or left על תקני.

### 11.3 Not done / limits
- No authentication or per-field permissions (item 2 of the suggestions list); the server must be protected at network and file-permission level.
- Commander changes are not part of the dated history, so past dates show current commanders.
- Two users saving at the same moment: the second must repeat the change (by design).
- The server keeps all data and the change log in memory: fine for thousands of people and hundreds of thousands of log entries, not millions.
- Plain HTTP (no TLS); put an internal reverse proxy in front if TLS is required.
