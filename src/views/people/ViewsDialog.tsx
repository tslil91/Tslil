import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { IconLink, IconTrash } from '../../components/Icons';
import { MAX_VIEWS, decodeView, describeFilterCount, encodeView, loadViews, storeViews, validateViewName, type SavedView, type ViewState } from '../../logic/views';

/** The view as a link that opens the people table with the same filters, sorting and columns. */
export const viewLink = (v: ViewState) => `${window.location.origin}${window.location.pathname}#/people?view=${encodeView(v)}`;

/** Copy text. Works on plain-HTTP pages too (where navigator.clipboard is unavailable). */
async function copy(text: string): Promise<boolean> {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch { /* fall through */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

interface Props { current: ViewState; onApply: (v: ViewState) => void; onClose: () => void; toast: (m: string) => void }

/** Named combinations of filters, sorting and columns, kept in this browser. Each can be shared as a link. */
export function ViewsDialog({ current, onApply, onClose, toast }: Props) {
  const [views, setViews] = useState<SavedView[]>(() => loadViews());
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkText, setLinkText] = useState('');
  const [pasted, setPasted] = useState('');

  const persist = (next: SavedView[]) => { setViews(next); storeViews(next); };
  const save = () => {
    const err = validateViewName(name, views);
    if (err) { setError(err); return; }
    persist([...views, { ...current, id: `${Date.now()}`, name: name.trim() }]);
    setName(''); setError(null);
    toast(`התצוגה "${name.trim()}" נשמרה`);
  };
  const share = async (v: ViewState) => {
    const link = viewLink(v);
    setLinkText(link);
    toast((await copy(link)) ? 'הקישור הועתק' : 'סמן/י והעתק/י את הקישור מהתיבה');
  };
  const openPasted = () => {
    const m = pasted.match(/[?&]view=([A-Za-z0-9_-]+)/) ?? pasted.trim().match(/^([A-Za-z0-9_-]+)$/);
    const v = m ? decodeView(m[1]) : null;
    if (!v) { setError('הקישור אינו תקין.'); return; }
    onApply(v); onClose();
  };

  return (
    <Dialog title="תצוגות שמורות" width={620} onClose={onClose} footer={<button type="button" className="btn btn-primary h-[38px] px-5" onClick={onClose}>סגירה</button>}>
      <div className="flex flex-col gap-4">
        <form className="flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label htmlFor="view-name" className="label">שמירת התצוגה הנוכחית ({describeFilterCount(current)})</label>
          <div className="flex gap-2">
            <input id="view-name" className="input input-lg flex-1" placeholder="למשל: קצינים שמשתחררים השנה" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setError(null); }} />
            <button type="submit" className="btn btn-primary h-[38px]" disabled={views.length >= MAX_VIEWS}>שמירה</button>
          </div>
          {error && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{error}</p>}
          <p className="m-0 text-xs text-muted">התצוגה כוללת חיפוש, סינונים, מיון, עמודות מוצגות ותצוגת טבלה / עץ. התצוגות נשמרות בדפדפן זה בלבד; לשיתוף עם אחרים — העתקת קישור.</p>
        </form>

        <section className="flex flex-col gap-1">
          <h3 className="m-0 text-[13px] font-bold">התצוגות שלי ({views.length})</h3>
          {views.length === 0 && <p className="m-0 text-sm text-muted">עדיין לא נשמרו תצוגות.</p>}
          <ul className="m-0 list-none p-0">
            {views.map((v) => (
              <li key={v.id} className="flex items-center gap-2 border-b border-line py-1.5">
                <button type="button" className="flex min-w-0 flex-1 flex-col text-start hover:underline" onClick={() => { onApply(v); onClose(); toast(`נטענה התצוגה "${v.name}"`); }}>
                  <span className="text-sm font-bold">{v.name}</span>
                  <span className="text-xs text-muted">{describeFilterCount(v)} · {v.view === 'tree' ? 'עץ' : 'טבלה'}</span>
                </button>
                <button type="button" className="icon-btn" title="העתקת קישור לתצוגה" aria-label={`העתקת קישור לתצוגה ${v.name}`} onClick={() => void share(v)}><IconLink size={16} /></button>
                <button type="button" className="icon-btn icon-btn-danger" title="מחיקת התצוגה" aria-label={`מחיקת התצוגה ${v.name}`} onClick={() => persist(views.filter((x) => x.id !== v.id))}><IconTrash size={15} /></button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-1.5 border-t border-line pt-3">
          <div className="flex items-center gap-2">
            <button type="button" className="btn" onClick={() => void share(current)}><IconLink size={15} />קישור לתצוגה הנוכחית</button>
          </div>
          {linkText && <input readOnly aria-label="קישור לתצוגה" className="input font-mono text-xs" dir="ltr" value={linkText} onFocus={(e) => e.currentTarget.select()} />}
          <label htmlFor="view-paste" className="label mt-1">פתיחת תצוגה מקישור שקיבלת</label>
          <div className="flex gap-2">
            <input id="view-paste" className="input flex-1" dir="ltr" placeholder="הדבק/י כאן קישור" value={pasted} onChange={(e) => { setPasted(e.target.value); setError(null); }} />
            <button type="button" className="btn" disabled={!pasted.trim()} onClick={openPasted}>פתיחה</button>
          </div>
        </section>
      </div>
    </Dialog>
  );
}
