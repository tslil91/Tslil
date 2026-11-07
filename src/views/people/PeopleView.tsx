import { useMemo, useState } from 'react';
import { IconCheck, IconChevron, IconEdit, IconMove, IconPlus, IconTable, IconTree, IconX } from '../../components/Icons';
import { PageHeader, SearchBox } from '../../components/PageHeader';
import { todayISO } from '../../domain/dates';
import type { Person, PersonRow } from '../../domain/types';
import { billetByPerson } from '../../logic/billets';
import { FIELDS, filterOptions, type FieldDef, type FieldKey } from '../../logic/fields';
import { DEFAULT_SORT, groupPeople, matchesFilters, validatePerson, type Filters, type PersonDraft, type SortState } from '../../logic/people';
import { occupantOf, useStore } from '../../store/store';
import { AddPersonDialog } from './AddPersonDialog';
import { MoveDialog } from './MoveDialog';
import { CellView, FieldEditor, patchDraft, toDraft } from './PersonCells';
import { PeopleTree } from './PeopleTree';

const ACTIONS_W = 96;
const NAME_W = 210;

export function PeopleView() {
  const s = useStore();
  const today = todayISO();
  const [view, setView] = useState<'table' | 'tree'>('table');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [showEdu, setShowEdu] = useState(true);
  const [showDmah, setShowDmah] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [moving, setMoving] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);

  const rows: PersonRow[] = useMemo(() => {
    const map = billetByPerson(s.assignments);
    return s.people.map((p) => ({ ...p, billet: map.get(p.id) ?? null }));
  }, [s.people, s.assignments]);

  const shown = rows.filter((r) => matchesFilters(r, filters, query, today));
  const filtering = query.trim() !== '' || Object.values(filters).some(Boolean);
  const groups = groupPeople(shown, s.sections, s.commanders, sort, s.people).filter((g) => !filtering || g.rows.length > 0);

  const visible = FIELDS.filter((f) => f.group === 'base' || (f.group === 'edu' && showEdu) || (f.group === 'dmah' && showDmah));
  const gridCols = `${ACTIONS_W}px ${NAME_W}px ${visible.map((f) => `${f.width}px`).join(' ')}`;
  const filterCount = Object.values(filters).filter(Boolean).length;
  const isDefaultSort = sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir;

  const setFilter = (key: FieldKey | 'section', value: string) => setFilters((f) => ({ ...f, [key]: value || undefined }));
  const toggleSort = (key: FieldKey) => setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === 'degree' ? -1 : 1 }));
  const arrow = (key: FieldKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');
  const sortLabel = sort.key === 'name' ? 'שם' : FIELDS.find((f) => f.key === sort.key)?.label ?? '';

  const saveDraft = () => {
    if (!draft) return;
    const err = validatePerson(draft, s.people, s.billets, occupantOf(s));
    if (err) { s.showToast(err); return; }
    const p = s.savePerson(draft);
    s.showToast(`הנתונים של ${p.name} עודכנו`);
    setDraft(null);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="כוח אדם" subtitle={`${shown.length} מתוך ${rows.length} אנשים`}>
        <div role="group" aria-label="תצוגה" className="inline-flex gap-0.5 rounded bg-soft p-[3px]">
          {([['table', 'טבלה', <IconTable key="t" size={16} />], ['tree', 'עץ היררכי', <IconTree key="r" size={16} />]] as const).map(([v, label, icon]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-semibold ${view === v ? 'bg-surface text-ink shadow' : 'text-muted'}`}>
              {icon}{label}
            </button>
          ))}
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="חיפוש לפי שם או מ.א" />
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><IconPlus size={16} />הוספת איש צוות</button>
      </PageHeader>

      {view === 'tree' ? (
        <>
          <div className="h-3" />
          <PeopleTree people={shown} onMove={setMoving} />
        </>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-2.5 px-3.5 py-2">
            <label htmlFor="sec-filter" className="text-[13px] font-semibold">מדור:</label>
            <select id="sec-filter" className="input w-[200px]" value={filters.section ?? ''} onChange={(e) => setFilter('section', e.target.value)}>
              <option value="">כל הארגון</option>
              <option value="none">מפקד הארגון וכפופים ישירות</option>
              {s.sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
            </select>
            <span className="h-6 w-px bg-line2" />
            <span className="text-[13px] font-semibold">עמודות:</span>
            <button type="button" className={`btn ${showEdu ? 'btn-on' : ''}`} aria-pressed={showEdu} onClick={() => setShowEdu((v) => !v)}>השכלה והכשרה</button>
            <button type="button" className={`btn ${showDmah ? 'btn-on' : ''}`} aria-pressed={showDmah} onClick={() => setShowDmah((v) => !v)}>דמ"ח (קצינים)</button>
            <span className="flex-1" />
            <span className="text-[13px] text-muted">
              מיון: <strong className="text-ink">{sortLabel} {isDefaultSort ? '(גבוה ← נמוך)' : arrow(sort.key)}</strong> · מפקד ראשון
            </span>
            {!isDefaultSort && <button type="button" className="btn" onClick={() => setSort(DEFAULT_SORT)}>חזרה לסדר דרגות</button>}
            {filterCount > 0 && <button type="button" className="btn" onClick={() => setFilters({})}>נקה {filterCount} סינונים</button>}
          </div>

          <div className="mx-3.5 mb-3 min-h-0 flex-1 overflow-auto rounded border border-line bg-surface">
            <div className="inline-block min-w-full">
              {/* header */}
              <div className="sticky top-0 z-20 grid min-w-max border-b-2 border-line2 bg-head" style={{ gridTemplateColumns: gridCols }}>
                <div className="sticky start-0 z-30 flex items-end bg-head px-2 py-1.5"><span className="label">פעולות</span></div>
                <div className="sticky z-30 flex flex-col gap-1 border-e border-line bg-head px-2 py-1.5" style={{ insetInlineStart: ACTIONS_W }}>
                  <SortButton label="שם" arrow={arrow('name')} onClick={() => toggleSort('name')} />
                  <span className="h-[30px]" />
                </div>
                {visible.map((f) => <HeaderCell key={f.key} f={f} arrow={arrow(f.key)} onSort={() => toggleSort(f.key)} value={filters[f.key] ?? ''} onFilter={(v) => setFilter(f.key, v)} />)}
              </div>

              {groups.length === 0 && <p className="p-10 text-center text-[15px] text-muted">לא נמצאו אנשים התואמים לסינון.</p>}

              {groups.map((g) => {
                const open = !collapsed[g.id];
                return (
                  <section key={g.id} aria-label={g.name}>
                    <div className="min-w-max border-b border-line2 bg-group">
                      <button type="button" aria-expanded={open} onClick={() => setCollapsed((c) => ({ ...c, [g.id]: open }))}
                        className="sticky start-0 inline-flex h-[34px] items-center gap-3 px-3.5">
                        <IconChevron size={16} open={open} className="text-muted" />
                        <span className="text-sm font-bold">{g.name}</span>
                        <span className="chip chip-neutral">{g.rows.length}</span>
                        <span className="text-xs text-muted">{g.commanderLabel}: {g.commander ? `${g.commander.degree} ${g.commander.name}` : 'לא מונה'}</span>
                      </button>
                    </div>
                    {open && (
                      <div className="zebra">
                        {g.rows.map((r) => {
                          const editing = draft?.id === r.id ? draft : null;
                          return (
                            <div key={r.id} className={`row grid min-h-9 min-w-max items-center border-b border-line text-[12.5px] ${editing ? 'row-active' : ''}`} style={{ gridTemplateColumns: gridCols }}>
                              <span className="sticky start-0 z-10 flex h-full items-center gap-0.5 bg-inherit px-1.5">
                                {editing ? (
                                  <>
                                    <button type="button" className="icon-btn icon-btn-ok" title="שמירה" aria-label="שמירת השינויים" onClick={saveDraft}><IconCheck size={16} /></button>
                                    <button type="button" className="icon-btn" title="ביטול" aria-label="ביטול העריכה" onClick={() => setDraft(null)}><IconX size={14} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" className="icon-btn" title="שינוי מיקום בארגון" aria-label={`שינוי מיקום בארגון של ${r.name}`} onClick={() => setMoving(r)}><IconMove size={17} /></button>
                                    <button type="button" className="icon-btn" title="עריכת נתונים" aria-label={`עריכת הנתונים של ${r.name}`} onClick={() => setDraft(toDraft(r))}><IconEdit size={16} /></button>
                                  </>
                                )}
                              </span>
                              <span className="sticky z-10 flex h-full min-w-0 items-center gap-1.5 overflow-hidden border-e border-line bg-inherit px-2 font-semibold" style={{ insetInlineStart: ACTIONS_W }}>
                                {editing ? (
                                  <FieldEditor f={{ key: 'name', label: 'שם', type: 'text', group: 'base', width: NAME_W }} draft={editing} onChange={(p) => setDraft((d) => d && patchDraft(d, p))} />
                                ) : (
                                  <>
                                    <span className="truncate">{r.name}</span>
                                    {s.commanders.org === r.id && <span className="chip chip-cmd">מפקד הארגון</span>}
                                    {r.sectionId && s.commanders.sections[r.sectionId] === r.id && <span className="chip chip-cmd">מפקד המדור</span>}
                                  </>
                                )}
                              </span>
                              {visible.map((f) => (
                                <span key={f.key} className="flex min-w-0 items-center overflow-hidden whitespace-nowrap px-2">
                                  {editing
                                    ? <FieldEditor f={f} draft={editing} onChange={(p) => setDraft((d) => d && patchDraft(d, p))} />
                                    : <CellView row={r} f={f} />}
                                </span>
                              ))}
                            </div>
                          );
                        })}
                        {g.rows.length === 0 && <p className="sticky start-0 m-0 px-4 py-3 text-[13px] text-muted">אין אנשים בקבוצה זו.</p>}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}

      {moving && <MoveDialog person={moving} onClose={() => setMoving(null)} />}
      {adding && <AddPersonDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function SortButton({ label, arrow, onClick }: { label: string; arrow: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`מיון לפי ${label}`} className="flex items-center gap-1 text-[13px] font-bold">
      {label} <span className="text-accent">{arrow}</span>
    </button>
  );
}

function HeaderCell({ f, arrow, onSort, value, onFilter }: { f: FieldDef; arrow: string; onSort: () => void; value: string; onFilter: (v: string) => void }) {
  const options = filterOptions(f);
  return (
    <div className="flex min-w-0 flex-col gap-1 px-2 py-1.5">
      <SortButton label={f.label} arrow={arrow} onClick={onSort} />
      {options.length > 0 ? (
        <select className="input" aria-label={`סינון ${f.label}`} value={value} onChange={(e) => onFilter(e.target.value)}>
          <option value="">הכל</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : <span className="h-[30px]" />}
    </div>
  );
}
