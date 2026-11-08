# ניהול כוח אדם ותקנים — Desktop MVP

Hebrew, RTL desktop web app for managing personnel by section (מדורים), billets (תקנים) and grants (מענקים ותמריצים).
Design: compact ("דחוס") with the navy & amber palette. Plans: `docs/ARCHITECTURE.md`, `docs/DESKTOP.md`.

> The demo data is synthetic. Do not enter real personnel data before the server is installed and protected (see the install guide).

## Run

```bash
npm install
npm run dev          # http://localhost:5173 — local demo mode (data in the browser)
npm test             # unit tests (Vitest), including the server
npm run build        # typecheck + production build into dist/
npm run server       # build the server and run it on http://localhost:8080 serving dist/ (data in ./data)
npm run package      # offline release: release/personnel-billets (+ .tar.gz and .zip)
npm run package:single  # ONE html file (release/personnel-billets-standalone.html): open by double-click, no server, local mode
```

Requires Node 20+. Minimum window width 1024px.

## Two ways to run

| Mode | When | Where the data lives |
|---|---|---|
| **Server** | The page is served by `server.mjs` (the production / air-gapped install). Several users share the same data. | `DATA_DIR` on the server (put it on the shared NFS) |
| **Local demo** | The page is opened without the server (dev server, static hosting, an artifact). | This browser only (localStorage) |

The app detects the mode at start-up (`/api/health`). **Install guide for an offline environment with a shared NFS: [`docs/INSTALL.md`](docs/INSTALL.md)** (Hebrew and English; also inside the release folder).

### Server design (for whoever maintains it)

- One bundled file (`server.mjs`), **no npm dependencies, no internet**. Fonts are bundled; the Content-Security-Policy allows only the app's own origin.
- Data folder: `state.json` (replaced atomically), `audit.jsonl` (append-only change log), `backups/` (timestamped copies), `server.lock`.
- **One writer per folder**: a lock file with a heartbeat. A second server on the same folder refuses to start. A lock left by a dead process on the same machine is taken over immediately; one from another machine expires after 2 minutes (or use `FORCE_UNLOCK=1`).
- Saving uses optimistic concurrency: a save is based on a version; if somebody saved first the server answers 409, the browser refreshes the data and tells the user to repeat the change. Browsers poll for new versions every 4 seconds.
- **No login.** The user name entered at first use is recorded in the change log but is not authentication. Restrict access with the network and file permissions (see the install guide).

## Structure

```
src/
  domain/      types, dates, business rules (degrees per population/type, programs, applicability)
  logic/       pure functions: field registry, filter/sort/grouping, placement, billets, grants,
               change-log diff, section history, attention list, data checks, backup, bulk move,
               saved views, date comparison, spreadsheet mapping, simulator engine (+ *.test.ts)
  store/       Zustand store, change tracking, synthetic seed data
  sync/        server detection, saving, polling, conflicts (browser side)
  components/  menu, dialogs, charts, boot screens, shared inputs
  io/          Excel read / write (ExcelJS, loaded on demand), file download
  views/       people, person, section, billets, grants, overview, history, simulator
server/        the Node server (datastore with lock and backups, HTTP, entry point) + its tests
scripts/       package.mjs — builds the offline release
docs/          ARCHITECTURE.md, DESKTOP.md, INSTALL.md
```

All business rules live in `domain/` and `logic/` as pure, unit-tested functions; views only call them.
The field registry (`logic/fields.ts`) drives the people table columns, filters, sorting, inline editors and the add form.

## Status

| Area | State |
|---|---|
| כוח אדם | Table by section (commander first, degree high → low), column sort and filters, date filters (year / month / between dates), inline edit, move / appoint, add, tree, section management, **bulk selection and move**, **saved views** (shareable as a link), links to person and section pages, Excel export / import |
| דף איש צוות | Details, billet history, dated section history, grants, **notes**, that person's change log, edit and move |
| דף מדור | Commander, members, degree distribution, releases chart, billets of the members |
| תקנים | Query and filters, inline edit, history dropdown, add and delete with confirmation, Excel export / import |
| מענקים ותמריצים | Per-person history (latest first), filters and sort, add / edit / delete, Excel export / import |
| תמונת מצב | Releases, education (everyone it applies to), officer programs, billet turnover, **"needs attention" list**, **data checks** (error badge in the menu) |
| יומן שינויים | Who changed what and when (readable Hebrew lines); filter by text / type / user / dates; export |
| סימולטור | State on any date (uses the dated section history), what-if scenario, **comparison of two dates** |
| ניהול נתונים | **Backup to one file, validated restore** (the server keeps a copy first), server info |

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
