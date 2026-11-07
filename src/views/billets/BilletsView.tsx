import { useState } from 'react';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { IconChevron, IconPlus, IconTrash } from '../../components/Icons';
import { PageHeader, SearchBox } from '../../components/PageHeader';
import { formatDate } from '../../domain/dates';
import type { Billet, BilletKind, BilletScope } from '../../domain/types';
import { billetHistory, openAssignment, validateNewBillet } from '../../logic/billets';
import { useStore } from '../../store/store';
import { ImportDialog } from '../../components/ImportDialog';
import { downloadWorkbook } from '../../io/excel';
import { billetSheets, planBilletImport } from '../../logic/sheets';
import { todayISO } from '../../domain/dates';
import { Segmented } from '../../components/Segmented';

const GRID = '52px 130px 170px 170px 140px minmax(220px, 1fr) 64px';
const SCOPE: Record<BilletScope, string> = { int: 'פנימי', ext: 'חיצוני' };
const KIND: Record<BilletKind, string> = { fix: 'קבוע', tmp: 'זמני' };

type BilletFilters = { scope?: string; kind?: string; dmah?: string; fill?: string };

export function BilletsView() {
  const s = useStore();
  const [query, setQuery] = useState('');
  const [f, setF] = useState<BilletFilters>({});
  const [dir, setDir] = useState<1 | -1>(1);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Billet | null>(null);
  const [importing, setImporting] = useState(false);
  const midOf = (a: { personId: number | null }) => (a.personId !== null ? s.people.find((p) => p.id === a.personId)?.mid ?? null : null);
  const sheets = (list: Billet[]) => billetSheets(list, s.assignments, (a) => nameOf(a.personId, a.personName), midOf);

  const nameOf = (personId: number | null, fallback: string) => (personId !== null ? s.people.find((p) => p.id === personId)?.name ?? fallback : fallback);
  const q = query.trim();
  const shown = s.billets
    .filter((b) => {
      const cur = openAssignment(s.assignments, b.id);
      if (q && !String(b.id).includes(q) && !s.assignments.some((a) => a.billetId === b.id && nameOf(a.personId, a.personName).includes(q))) return false;
      if (f.scope && b.scope !== f.scope) return false;
      if (f.kind && b.kind !== f.kind) return false;
      if (f.dmah && (b.dmah ? 'yes' : 'no') !== f.dmah) return false;
      if (f.fill && (cur ? 'filled' : 'free') !== f.fill) return false;
      return true;
    })
    .sort((a, b) => (a.id - b.id) * dir);
  const filledCount = s.billets.filter((b) => openAssignment(s.assignments, b.id)).length;
  const hasFilters = q !== '' || Object.values(f).some(Boolean);

  const update = (b: Billet, patch: Partial<Omit<Billet, 'id'>>, label: string) => {
    s.updateBillet(b.id, patch);
    s.showToast(`תקן ${b.id} עודכן: ${label}`);
  };

  const filterSelect = (key: keyof BilletFilters, label: string, options: [string, string][]) => (
    <select className="input max-w-[160px]" aria-label={`סינון ${label}`} value={f[key] ?? ''} onChange={(e) => setF((x) => ({ ...x, [key]: e.target.value || undefined }))}>
      <option value="">הכל</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  const removingOccupant = removing ? openAssignment(s.assignments, removing.id) : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="תקנים" subtitle={`${shown.length} מתוך ${s.billets.length} תקנים · ${filledCount} מאוישים`}>
        <SearchBox value={query} onChange={setQuery} placeholder="שאילתה: מספר תקן או שם משובץ (גם בעבר)" width={340} />
        {hasFilters && <button type="button" className="btn" onClick={() => { setF({}); setQuery(''); }}>נקה סינון</button>}
        <button type="button" className="btn" title="ייצוא התקנים המוצגים והיסטוריית השיבוץ שלהם" onClick={() => { void downloadWorkbook(`billets-${todayISO()}`, sheets(shown)); }}>ייצוא ל־Excel</button>
        <button type="button" className="btn" onClick={() => setImporting(true)}>ייבוא מ־Excel</button>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><IconPlus size={16} />הוספת תקן</button>
      </PageHeader>

      <div className="m-3.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-line bg-surface">
        <div className="grid shrink-0 items-end border-b-2 border-line2 bg-head py-2" style={{ gridTemplateColumns: GRID }}>
          <span className="label px-2.5">היסטוריה</span>
          <div className="flex flex-col gap-1 px-2.5">
            <button type="button" className="text-start text-[13px] font-bold" aria-label="מיון לפי מספר תקן" onClick={() => setDir((d) => (d === 1 ? -1 : 1))}>
              מספר תקן <span className="text-accent">{dir === 1 ? '↑' : '↓'}</span>
            </button>
            <span className="h-[30px]" />
          </div>
          <div className="flex flex-col gap-1 px-2.5"><span className="text-[13px] font-bold">פנימי / חיצוני</span>{filterSelect('scope', 'פנימי / חיצוני', [['int', 'פנימי'], ['ext', 'חיצוני']])}</div>
          <div className="flex flex-col gap-1 px-2.5"><span className="text-[13px] font-bold">קבוע / זמני</span>{filterSelect('kind', 'קבוע / זמני', [['fix', 'קבוע'], ['tmp', 'זמני']])}</div>
          <div className="flex flex-col gap-1 px-2.5"><span className="text-[13px] font-bold">דמ"ח</span>{filterSelect('dmah', 'דמ"ח', [['yes', 'כן'], ['no', 'לא']])}</div>
          <div className="flex flex-col gap-1 px-2.5"><span className="text-[13px] font-bold">משובץ כעת</span>{filterSelect('fill', 'משובץ כעת', [['filled', 'מאויש'], ['free', 'פנוי']])}</div>
          <span className="label px-2.5">מחיקה</span>
        </div>

        <div className="zebra min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 && <p className="p-10 text-center text-[15px] text-muted">לא נמצאו תקנים התואמים לשאילתה.</p>}
          {shown.map((b) => {
            const cur = openAssignment(s.assignments, b.id);
            const isOpen = !!open[b.id];
            const hist = billetHistory(s.assignments, b.id);
            return (
              <div key={b.id}>
                  <div className={`row grid min-h-10 items-center border-b border-line text-[13px] ${isOpen ? 'row-active' : ''}`} style={{ gridTemplateColumns: GRID }}>
                    <span className="px-2.5">
                      <button type="button" className="icon-btn" aria-expanded={isOpen} title="היסטוריית שיבוץ" aria-label={`היסטוריית שיבוץ של תקן ${b.id}`} onClick={() => setOpen((o) => ({ ...o, [b.id]: !isOpen }))}>
                        <IconChevron size={16} open={isOpen} />
                      </button>
                    </span>
                    <span className="px-2.5 text-[15px] font-bold">{b.id}</span>
                    <span className="px-2.5">
                      <select className="input font-semibold" aria-label={`פנימי או חיצוני לתקן ${b.id}`} value={b.scope} onChange={(e) => update(b, { scope: e.target.value as BilletScope }, SCOPE[e.target.value as BilletScope])}>
                        <option value="int">פנימי</option><option value="ext">חיצוני</option>
                      </select>
                    </span>
                    <span className="px-2.5">
                      <select className="input font-semibold" aria-label={`קבוע או זמני לתקן ${b.id}`} value={b.kind} onChange={(e) => update(b, { kind: e.target.value as BilletKind }, KIND[e.target.value as BilletKind])}>
                        <option value="fix">קבוע</option><option value="tmp">זמני</option>
                      </select>
                    </span>
                    <span className="px-2.5">
                      <select className="input font-semibold" aria-label={`דמ"ח לתקן ${b.id}`} value={b.dmah ? 'yes' : 'no'} onChange={(e) => update(b, { dmah: e.target.value === 'yes' }, `דמ"ח ${e.target.value === 'yes' ? 'כן' : 'לא'}`)}>
                        <option value="yes">כן</option><option value="no">לא</option>
                      </select>
                    </span>
                    <span className={`px-2.5 font-semibold ${cur ? '' : 'text-danger'}`}>{cur ? nameOf(cur.personId, cur.personName) : 'פנוי'}</span>
                    <span className="px-2.5">
                      <button type="button" className="icon-btn icon-btn-danger" title="מחיקת תקן" aria-label={`מחיקת תקן ${b.id}`} onClick={() => setRemoving(b)}><IconTrash size={17} /></button>
                    </span>
                  </div>
                  {isOpen && (
                    <div className="border-b-2 border-line2 bg-surface py-2.5 ps-16 pe-6">
                      <span className="label">היסטוריית שיבוץ — תקן {b.id}</span>
                      {hist.length === 0 && <p className="m-0 py-2 text-[13px] text-muted">לא היו שיבוצים בתקן זה.</p>}
                      <ul className="m-0 list-none p-0">
                        {hist.map((h) => (
                          <li key={h.id} className="flex max-w-[540px] items-center gap-3 border-b border-line py-1.5">
                            <span className={`h-2 w-2 rounded-full ${h.end ? 'bg-line2' : 'bg-[#15803d]'}`} aria-hidden="true" />
                            <span className="flex-1 text-sm font-semibold">{nameOf(h.personId, h.personName)}</span>
                            <span className="text-[13px] text-muted">{formatDate(h.start)} – {h.end ? formatDate(h.end) : 'היום'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {adding && <AddBilletDialog onClose={() => setAdding(false)} />}
      {importing && (
        <ImportDialog
          title="ייבוא תקנים מ־Excel"
          sheetName="תקנים"
          noun="תקנים"
          rulesHint="השורות מותאמות לפי מספר תקן: תקן קיים יעודכן, תקן חדש ייווסף (חובה למלא פנימי / חיצוני, קבוע / זמני ו־דמ&quot;ח). עמודת 'משובץ כעת' וגיליון ההיסטוריה אינם מיובאים — שיבוץ נעשה במסך כוח אדם. תקנים אינם נמחקים בייבוא."
          plan={(t) => planBilletImport(t, s.billets)}
          apply={(pl) => { s.importBillets([...pl.creates, ...pl.updates]); s.showToast(`יובאו ${pl.creates.length} תקנים חדשים ו־${pl.updates.length} עדכונים`); }}
          template={() => sheets(s.billets)}
          templateFile={`billets-${todayISO()}`}
          onClose={() => setImporting(false)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`למחוק את תקן ${removing.id}?`}
          message={removingOccupant
            ? `בתקן משובץ כעת ${nameOf(removingOccupant.personId, removingOccupant.personName)}. מחיקת התקן תעביר אותו/ה למצב על תקני ותמחק את היסטוריית התקן. לא ניתן לבטל פעולה זו.`
            : 'התקן וההיסטוריה שלו יימחקו. לא ניתן לבטל פעולה זו.'}
          confirmLabel="כן, מחק"
          onCancel={() => setRemoving(null)}
          onConfirm={() => { s.deleteBillet(removing.id); s.showToast(`תקן ${removing.id} נמחק`); setRemoving(null); }}
        />
      )}
    </div>
  );
}

function AddBilletDialog({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [idText, setIdText] = useState('');
  const [scope, setScope] = useState<BilletScope>('int');
  const [kind, setKind] = useState<BilletKind>('fix');
  const [dmah, setDmah] = useState<'yes' | 'no'>('no');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const err = validateNewBillet(idText, s.billets);
    if (err) { setError(err); return; }
    s.addBillet({ id: Number(idText), scope, kind, dmah: dmah === 'yes' });
    s.showToast(`תקן ${idText} נוסף`);
    onClose();
  };
  return (
    <Dialog title="הוספת תקן חדש" width={420} onClose={onClose}
      footer={<>
        <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
        <button type="button" className="btn btn-primary h-[38px] px-5" onClick={save}>הוספה</button>
      </>}>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nb-id" className="label">מספר תקן</label>
          <input id="nb-id" className="input input-lg" inputMode="numeric" placeholder="לדוגמה 1030" value={idText} onChange={(e) => { setIdText(e.target.value.replace(/\D/g, '')); setError(null); }} />
        </div>
        <Segmented label="פנימי / חיצוני" value={scope} onChange={setScope} options={[['int', 'פנימי'], ['ext', 'חיצוני']]} />
        <Segmented label="קבוע / זמני" value={kind} onChange={setKind} options={[['fix', 'קבוע'], ['tmp', 'זמני']]} />
        <Segmented label='דמ"ח' value={dmah} onChange={setDmah} options={[['yes', 'כן'], ['no', 'לא']]} />
        {error && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

