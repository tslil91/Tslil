import { useMemo, useState } from 'react';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { IconChevron, IconEdit, IconPlus, IconTrash } from '../../components/Icons';
import { PageHeader, SearchBox } from '../../components/PageHeader';
import { Segmented } from '../../components/Segmented';
import { formatDate, formatMoney, todayISO } from '../../domain/dates';
import type { Grant, GrantBasis, GrantType, Person } from '../../domain/types';
import { nextId } from '../../logic/billets';
import {
  BASIS_LABELS, GRANT_TYPE_LABELS, draftFromGrant, emptyGrantDraft, grantDate, grantFromDraft,
  latestFirst, totals, updateGrantDraft, validateGrant, type GrantDraft,
} from '../../logic/grants';
import { useStore } from '../../store/store';

const GRID = '52px 200px 110px 100px 160px 90px minmax(240px, 1fr) 240px';
const SUB_GRID = '120px 120px 120px 120px 130px 90px 110px 76px';
type SortKey = 'name' | 'count' | 'latest' | 'total';

const totalText = (list: Grant[]) => {
  const t = totals(list);
  const parts = [t.gross ? `${formatMoney(t.gross)} ברוטו` : '', t.net ? `${formatMoney(t.net)} נטו` : ''].filter(Boolean);
  return parts.join(' · ') || '—';
};

export function GrantsView() {
  const s = useStore();
  const [query, setQuery] = useState('');
  const [fType, setFType] = useState('');
  const [fBasis, setFBasis] = useState('');
  const [fSec, setFSec] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'latest', dir: -1 });
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<Grant | 'new' | null>(null);
  const [removing, setRemoving] = useState<Grant | null>(null);

  const secName = (id: string | null) => (id ? s.sections.find((x) => x.id === id)?.name ?? id : 'כפוף ישירות');

  const rows = useMemo(() => {
    const q = query.trim();
    const list = s.people
      .filter((p) => (!q || p.name.includes(q) || String(p.mid).includes(q)) && (!fSec || (p.sectionId ?? 'none') === fSec))
      .map((p) => ({ p, grants: latestFirst(s.grants.filter((g) => g.personId === p.id && (!fType || g.type === fType) && (!fBasis || g.basis === fBasis))) }))
      .filter((x) => x.grants.length > 0);
    const value = (x: { p: Person; grants: Grant[] }): string | number => {
      switch (sort.key) {
        case 'name': return x.p.name;
        case 'count': return x.grants.length;
        case 'total': return x.grants.reduce((a, g) => a + g.amount, 0);
        case 'latest': return grantDate(x.grants[0]);
      }
    };
    return list.sort((a, b) => {
      const x = value(a), y = value(b);
      const r = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'he') : x < y ? -1 : x > y ? 1 : 0;
      return r * sort.dir;
    });
  }, [s.people, s.grants, query, fType, fBasis, fSec, sort]);

  const allShown = rows.flatMap((r) => r.grants);
  const setSortKey = (key: SortKey) => setSort((c) => (c.key === key ? { key, dir: c.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');
  const sortHead = (k: SortKey, label: string) => (
    <button type="button" className="text-start text-[13px] font-bold" aria-label={`מיון לפי ${label}`} onClick={() => setSortKey(k)}>{label} <span className="text-accent">{arrow(k)}</span></button>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="מענקים ותמריצים" subtitle={`${rows.length} אנשים · ${allShown.length} רשומות · ${totalText(allShown)}`}>
        <SearchBox value={query} onChange={setQuery} placeholder="חיפוש לפי שם או מ.א" />
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><IconPlus size={16} />הוספת מענק</button>
      </PageHeader>

      <div className="flex shrink-0 items-center gap-2.5 px-3.5 py-2">
        <label htmlFor="g-type" className="text-[13px] font-semibold">סוג:</label>
        <select id="g-type" className="input w-[120px]" value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">הכל</option>
          {(Object.keys(GRANT_TYPE_LABELS) as GrantType[]).map((t) => <option key={t} value={t}>{GRANT_TYPE_LABELS[t]}</option>)}
        </select>
        <label htmlFor="g-basis" className="text-[13px] font-semibold">ברוטו / נטו:</label>
        <select id="g-basis" className="input w-[110px]" value={fBasis} onChange={(e) => setFBasis(e.target.value)}>
          <option value="">הכל</option><option value="gross">ברוטו</option><option value="net">נטו</option>
        </select>
        <label htmlFor="g-sec" className="text-[13px] font-semibold">מדור:</label>
        <select id="g-sec" className="input w-[180px]" value={fSec} onChange={(e) => setFSec(e.target.value)}>
          <option value="">כל הארגון</option>
          <option value="none">כפופים ישירות</option>
          {s.sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
        </select>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={() => setOpen(Object.fromEntries(rows.map((r) => [r.p.id, true])))}>פתח הכל</button>
        <button type="button" className="btn" onClick={() => setOpen({})}>סגור הכל</button>
      </div>

      <div className="mx-3.5 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-line bg-surface">
        <div className="grid min-h-10 shrink-0 items-center border-b-2 border-line2 bg-head" style={{ gridTemplateColumns: GRID }}>
          <span />
          <span className="px-2">{sortHead('name', "שם")}</span>
          <span className="px-2 text-[13px] font-bold">מ.א</span>
          <span className="px-2 text-[13px] font-bold">דרגה</span>
          <span className="px-2 text-[13px] font-bold">מדור</span>
          <span className="px-2">{sortHead('count', "רשומות")}</span>
          <span className="px-2">{sortHead('latest', "המענק האחרון")}</span>
          <span className="px-2">{sortHead('total', 'סה"כ')}</span>
        </div>
        <div className="zebra min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 && <p className="p-10 text-center text-[15px] text-muted">לא נמצאו מענקים התואמים לסינון.</p>}
          {rows.map(({ p, grants }) => {
            const isOpen = !!open[p.id];
            const last = grants[0];
            return (
              <div key={p.id}>
                <div className={`row grid min-h-10 items-center border-b border-line text-[13px] ${isOpen ? 'row-active' : ''}`} style={{ gridTemplateColumns: GRID }}>
                  <span className="px-2">
                    <button type="button" className="icon-btn" aria-expanded={isOpen} title="היסטוריית מענקים" aria-label={`היסטוריית מענקים של ${p.name}`} onClick={() => setOpen((o) => ({ ...o, [p.id]: !isOpen }))}>
                      <IconChevron size={16} open={isOpen} />
                    </button>
                  </span>
                  <span className="truncate px-2 font-bold">{p.name}</span>
                  <span className="px-2">{p.mid}</span>
                  <span className="px-2">{p.degree}</span>
                  <span className="truncate px-2">{secName(p.sectionId)}</span>
                  <span className="px-2"><span className="chip chip-neutral">{grants.length}</span></span>
                  <span className="flex items-center gap-1.5 px-2"><span className={`chip chip-${last.type}`}>{GRANT_TYPE_LABELS[last.type]}</span>{formatMoney(last.amount)} · {formatDate(grantDate(last))}</span>
                  <span className="px-2 font-semibold">{totalText(grants)}</span>
                </div>
                {isOpen && (
                  <div className="border-b-2 border-line2 bg-surface py-1.5 ps-14 pe-3.5">
                    <div className="grid min-h-[30px] items-center border-b border-line2" style={{ gridTemplateColumns: SUB_GRID }}>
                      {['סוג', 'משך חתימה', 'תחילת חתימה', 'סיום חתימה', 'סכום', 'ברוטו / נטו', 'הוזן בתאריך', 'פעולות'].map((h) => <span key={h} className="label px-2">{h}</span>)}
                    </div>
                    {grants.map((g, i) => (
                      <div key={g.id} className="grid min-h-[34px] items-center border-b border-line text-[13px]" style={{ gridTemplateColumns: SUB_GRID }}>
                        <span className="flex items-center gap-1.5 px-2"><span className={`chip chip-${g.type}`}>{GRANT_TYPE_LABELS[g.type]}</span>{i === 0 && <span className="chip chip-accent">אחרון</span>}</span>
                        <span className="px-2">{g.signingMonths ? `${g.signingMonths} חודשים` : '—'}</span>
                        <span className="px-2">{formatDate(g.signingStart)}</span>
                        <span className="px-2">{formatDate(g.signingEnd)}</span>
                        <span className="px-2 font-bold">{formatMoney(g.amount)}</span>
                        <span className="px-2">{BASIS_LABELS[g.basis]}</span>
                        <span className="px-2 text-muted">{formatDate(g.enteredAt)}</span>
                        <span className="flex gap-0.5 px-1">
                          <button type="button" className="icon-btn" title="תיקון רשומה" aria-label={`תיקון ${GRANT_TYPE_LABELS[g.type]} של ${p.name}`} onClick={() => setEditing(g)}><IconEdit size={15} /></button>
                          <button type="button" className="icon-btn icon-btn-danger" title="מחיקת רשומה" aria-label={`מחיקת ${GRANT_TYPE_LABELS[g.type]} של ${p.name}`} onClick={() => setRemoving(g)}><IconTrash size={15} /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <GrantDialog
          grant={editing === 'new' ? null : editing}
          people={s.people}
          onClose={() => setEditing(null)}
          onSave={(g, isNew) => {
            s.saveGrant(g);
            const name = s.people.find((x) => x.id === g.personId)?.name ?? '';
            s.showToast(isNew ? `${GRANT_TYPE_LABELS[g.type]} נוסף ל${name}` : `הרשומה של ${name} תוקנה`);
            setOpen((o) => ({ ...o, [g.personId]: true }));
            setEditing(null);
          }}
          nextGrantId={nextId(s.grants)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="למחוק את הרשומה?"
          message={`${GRANT_TYPE_LABELS[removing.type]} בסך ${formatMoney(removing.amount)} ${BASIS_LABELS[removing.basis]} של ${s.people.find((x) => x.id === removing.personId)?.name ?? ''} יימחק. מחיקה מיועדת לתיקון טעות הזנה בלבד.`}
          confirmLabel="כן, מחק"
          onCancel={() => setRemoving(null)}
          onConfirm={() => { s.deleteGrant(removing.id); s.showToast('הרשומה נמחקה'); setRemoving(null); }}
        />
      )}
    </div>
  );
}

function GrantDialog({ grant, people, onClose, onSave, nextGrantId }: {
  grant: Grant | null; people: Person[]; onClose: () => void; onSave: (g: Grant, isNew: boolean) => void; nextGrantId: number;
}) {
  const [d, setD] = useState<GrantDraft>(() => (grant ? draftFromGrant(grant) : emptyGrantDraft()));
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<GrantDraft>) => { setD((x) => updateGrantDraft(x, patch)); setError(null); };
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  const save = () => {
    const err = validateGrant(d);
    if (err) { setError(err); return; }
    onSave(grantFromDraft(d, grant?.id ?? nextGrantId, grant?.enteredAt ?? todayISO()), !grant);
  };
  return (
    <Dialog title={grant ? 'תיקון רשומת מענק' : 'הוספת מענק / תמריץ'} width={580} onClose={onClose}
      footer={<>
        <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
        <button type="button" className="btn btn-primary h-[38px] px-5" onClick={save}>שמירה</button>
      </>}>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <label htmlFor="g-person" className="label">שם איש הצוות</label>
          <select id="g-person" className="input input-lg" value={d.personId} onChange={(e) => change({ personId: e.target.value })}>
            <option value="">בחר/י איש צוות…</option>
            {sorted.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.degree} · {p.mid}</option>)}
          </select>
        </div>
        <Segmented<GrantType> label="סוג" value={d.type} onChange={(type) => change({ type })} options={[['voucher', 'שובר'], ['grant', 'מענק'], ['incentive', 'תמריץ']]} />
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="g-months" className="label">משך חתימה (חודשים) — רשות</label>
            <input id="g-months" className="input input-lg" inputMode="numeric" placeholder="לדוגמה 24" value={d.signingMonths} onChange={(e) => change({ signingMonths: e.target.value.replace(/\D/g, '') })} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="g-start" className="label">תחילת חתימה</label>
            <input id="g-start" type="date" className="input input-lg" value={d.signingStart} onChange={(e) => change({ signingStart: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="g-end" className="label">סיום חתימה</label>
            <input id="g-end" type="date" className="input input-lg" value={d.signingEnd} onChange={(e) => change({ signingEnd: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="g-amount" className="label">סכום (₪)</label>
            <input id="g-amount" className="input input-lg" inputMode="decimal" placeholder="לדוגמה 25000" value={d.amount} onChange={(e) => change({ amount: e.target.value.replace(/[^\d.]/g, '') })} />
          </div>
          <Segmented<GrantBasis> label="ברוטו / נטו" value={d.basis} onChange={(basis) => change({ basis })} options={[['gross', 'ברוטו'], ['net', 'נטו']]} />
        </div>
        <p className="m-0 text-xs text-muted">כשמוזנים משך חתימה ותאריך תחילה, תאריך הסיום מחושב אוטומטית (ניתן לשנות).</p>
        {error && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
