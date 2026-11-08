import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { pickData } from '../../domain/data';
import { todayISO } from '../../domain/dates';
import type { Person } from '../../domain/types';
import { removalBlocker, removalImpact } from '../../logic/removal';
import { useStore } from '../../store/store';
import { CommanderDialog, type Unit } from './CommanderDialog';

/**
 * Remove a person in one of two ways:
 *  - "left the unit": leaves the active list, all history is kept, can be undone;
 *  - "delete": entered by mistake — the person and everything about them is removed.
 */
export function RemovePersonDialog({ person, onClose, onDeleted }: { person: Person; onClose: () => void; onDeleted?: () => void }) {
  const s = useStore();
  const data = pickData(s);
  const today = todayISO();
  const [mode, setMode] = useState<'left' | 'delete'>('left');
  const [leftAt, setLeftAt] = useState(today);
  const [note, setNote] = useState('');
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState<Unit | null>(null);

  const blocker = removalBlocker(data, person.id);
  const impact = removalImpact(data, person.id);
  const unit: Unit | null = data.commanders.org === person.id ? { kind: 'org' }
    : (() => { const sec = Object.entries(data.commanders.sections).find(([, c]) => c === person.id)?.[0]; return sec ? { kind: 'section' as const, id: sec } : null; })();

  const submit = () => {
    const err = mode === 'left' ? s.markPersonLeft(person.id, leftAt, note) : s.deletePersonForGood(person.id);
    if (err) { setError(err); return; }
    s.showToast(mode === 'left' ? `${person.name} הוסר/ה מהיחידה (עזב/ה ב־${leftAt.split('-').reverse().join('/')})` : `${person.name} נמחק/ה לצמיתות`);
    if (mode === 'delete') onDeleted?.();
    onClose();
  };

  return (
    <>
      <Dialog title={`הסרת ${person.name}`} width={580} onClose={onClose}
        footer={<>
          <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
          <button type="button" className={`btn h-[38px] px-5 ${mode === 'delete' ? 'btn-danger' : 'btn-primary'}`}
            disabled={!!blocker || (mode === 'delete' && !sure) || (mode === 'left' && !leftAt)} onClick={submit}>
            {mode === 'left' ? 'הסרה מהיחידה' : 'מחיקה לצמיתות'}
          </button>
        </>}>
        {blocker && (
          <div role="alert" className="mb-3 flex items-center gap-3 rounded bg-[#fdf0d5] px-3 py-2.5 text-[13px] font-medium text-[#6b3f00]">
            <span className="flex-1">{blocker}</span>
            {unit && <button type="button" className="btn" onClick={() => setChanging(unit)}>החלפת מפקד</button>}
          </div>
        )}
        <div role="radiogroup" aria-label="סוג ההסרה" className="flex flex-col gap-2">
          {([
            ['left', 'עזב/ה את היחידה', 'יוצא/ת מהרשימה הפעילה. כל ההיסטוריה נשמרת וניתן להחזיר.'],
            ['delete', 'מחיקה — הוזן/ה בטעות', 'האדם וכל מה ששייך אליו נמחקים. לא ניתן לבטל (מלבד שחזור מגיבוי).'],
          ] as const).map(([v, label, sub]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => { setMode(v); setError(null); }}
              className={`flex items-start gap-2.5 rounded border-[1.5px] px-3 py-2.5 text-start hover:bg-soft ${mode === v ? (v === 'delete' ? 'border-danger bg-danger-soft' : 'border-primary bg-tint') : 'border-line2'}`}>
              <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-line2 ${mode === v ? `border-[5px] ${v === 'delete' ? 'border-danger' : 'border-primary'}` : 'border-2'}`} />
              <span className="flex flex-col"><span className="text-sm font-bold">{label}</span><span className="text-xs text-muted">{sub}</span></span>
            </button>
          ))}
        </div>

        {mode === 'left' && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-[170px_1fr] gap-3">
              <div className="flex flex-col gap-1"><label htmlFor="left-date" className="label">תאריך העזיבה</label><input id="left-date" type="date" className="input input-lg" value={leftAt} max={today} onChange={(e) => { setLeftAt(e.target.value); setError(null); }} /></div>
              <div className="flex flex-col gap-1"><label htmlFor="left-note" className="label">הערה (רשות)</label><input id="left-note" className="input input-lg" maxLength={200} placeholder="למשל: שוחרר / הועבר ליחידה אחרת" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <ul className="m-0 list-none rounded bg-bg p-3 text-[13px] leading-relaxed">
              <li>• לא יופיע/תופיע בטבלה, בתמונת המצב, בהתראות ובסימולטור (מתאריך העזיבה).</li>
              {impact.openBillet !== null && <li>• יוסר/תוסר מתקן {impact.openBillet} (התקן יתפנה) בתאריך העזיבה.</li>}
              <li>• נשמרים: היסטוריית תקנים ומדורים, מענקים, הערות ויומן השינויים.</li>
              <li>• אפשר להחזיר מ"הצג את מי שהוסרו" או מדף האדם.</li>
            </ul>
          </div>
        )}

        {mode === 'delete' && (
          <div className="mt-3 flex flex-col gap-3">
            <ul className="m-0 list-none rounded bg-danger-soft p-3 text-[13px] leading-relaxed text-danger">
              <li>• הנתונים של <strong>{person.name}</strong> יימחקו.</li>
              {impact.openBillet !== null && <li>• תקן {impact.openBillet} יתפנה.</li>}
              <li>• יימחקו גם: {impact.grants} מענקים, {impact.notes} הערות, {impact.assignments} שיבוצים בתקנים (גם מההיסטוריה של התקנים), {impact.sectionPeriods} תקופות מדור.</li>
              <li>• ביומן השינויים תישאר שורה על המחיקה.</li>
            </ul>
            <p className="m-0 text-xs text-muted">אם האדם שירת ביחידה בפועל — הסרה כ"עזב/ה את היחידה" שומרת את ההיסטוריה ומתאימה יותר.</p>
            <label className="flex items-center gap-2 text-[13px] font-semibold"><input type="checkbox" className="h-4 w-4 accent-[#8a2d1b]" checked={sure} onChange={(e) => setSure(e.target.checked)} />אני מבין/ה שהמחיקה סופית</label>
          </div>
        )}
        {error && <p role="alert" className="m-0 mt-3 text-[13px] font-semibold text-danger">{error}</p>}
      </Dialog>
      {changing && <CommanderDialog unit={changing} onClose={() => setChanging(null)} />}
    </>
  );
}
