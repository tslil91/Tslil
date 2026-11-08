import { useMemo, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { pickData } from '../../domain/data';
import { isActivePerson } from '../../domain/rules';
import { degreeIndex } from '../../domain/rules';
import { useStore } from '../../store/store';

export type Unit = { kind: 'org' } | { kind: 'section'; id: string };

/** Choose who commands the organization (רע"ן) or a section. The previous commander simply stays as an ordinary member. */
export function CommanderDialog({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const s = useStore();
  const data = pickData(s);
  const [q, setQ] = useState('');
  const currentId = unit.kind === 'org' ? data.commanders.org : data.commanders.sections[unit.id] ?? null;
  const unitName = unit.kind === 'org' ? 'רע"ן' : data.sections.find((x) => x.id === unit.id)?.name ?? '';
  const post = unit.kind === 'org' ? 'רע"ן' : `מפקד ${unitName}`;
  const [choice, setChoice] = useState<number | null>(currentId);
  const sectionName = (id: string | null) => (id ? data.sections.find((x) => x.id === id)?.name ?? id : 'כפוף ישירות לרע"ן');
  const nameOf = (id: number | null) => data.people.find((p) => p.id === id)?.name ?? '';
  const inUnit = (sec: string | null) => (unit.kind === 'org' ? sec === null : sec === unit.id);

  const people = useMemo(() => data.people.filter(isActivePerson)
    .filter((p) => !q.trim() || p.name.includes(q.trim()) || String(p.mid).includes(q.trim()))
    .sort((a, b) => Number(inUnit(b.sectionId)) - Number(inUnit(a.sectionId)) || degreeIndex(b.degree) - degreeIndex(a.degree) || a.name.localeCompare(b.name, 'he')),
  [data.people, q, unit]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = choice === null ? null : data.people.find((p) => p.id === choice) ?? null;
  const notes: string[] = [];
  if (chosen && chosen.id !== currentId) {
    if (unit.kind === 'section' && chosen.sectionId !== unit.id) notes.push(`${chosen.name} יועבר/תועבר אל ${unitName} (כרגע: ${sectionName(chosen.sectionId)}).`);
    if (unit.kind === 'org' && chosen.sectionId !== null) notes.push(`${chosen.name} יצא/תצא מ${sectionName(chosen.sectionId)} — רע"ן אינו משויך למדור.`);
    const other = Object.entries(data.commanders.sections).find(([sec, c]) => c === chosen.id && !(unit.kind === 'section' && sec === unit.id));
    if (other) notes.push(`${chosen.name} יפסיק/תפסיק לשמש מפקד ${sectionName(other[0])}.`);
    if (data.commanders.org === chosen.id && unit.kind === 'section') notes.push(`${chosen.name} יפסיק/תפסיק לשמש רע"ן.`);
  }
  if (currentId !== null && choice !== currentId) notes.push(`${nameOf(currentId)} יישאר/תישאר ${unit.kind === 'org' ? 'כפוף/ה ישירות' : 'במדור'}, ללא תפקיד פיקוד.`);
  if (choice === null && currentId !== null) notes.push(`ל${unit.kind === 'org' ? 'ארגון' : unitName} לא יהיה ${unit.kind === 'org' ? 'רע"ן' : 'מפקד'} עד שימונה אחר.`);

  const apply = () => {
    if (choice === currentId) { onClose(); return; }
    s.setCommander(unit, choice);
    s.showToast(choice === null ? `הוסר ה${unit.kind === 'org' ? 'רע"ן' : `מפקד של ${unitName}`}` : `${nameOf(choice)} מונה/תה ל${post}`);
    onClose();
  };

  return (
    <Dialog title={`החלפת ${post}`} width={560} onClose={onClose}
      footer={<>
        <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
        <button type="button" className="btn btn-primary h-[38px] px-5" disabled={choice === currentId} onClick={apply}>אישור</button>
      </>}>
      <p className="m-0 mb-2 text-sm text-muted">כרגע: <strong className="text-ink">{currentId !== null ? nameOf(currentId) : 'לא מונה'}</strong></p>
      <label htmlFor="cmd-q" className="sr-only">חיפוש איש צוות</label>
      <input id="cmd-q" className="input input-lg mb-2" placeholder="חיפוש לפי שם או מ.א" value={q} onChange={(e) => setQ(e.target.value)} />
      <div role="radiogroup" aria-label="מפקד חדש" className="max-h-[300px] overflow-y-auto rounded border border-line">
        <button type="button" role="radio" aria-checked={choice === null} onClick={() => setChoice(null)}
          className={`flex min-h-10 w-full items-center gap-2.5 border-b border-line px-3 text-start hover:bg-soft ${choice === null ? 'bg-tint' : ''}`}>
          <span className={`h-4 w-4 shrink-0 rounded-full border-line2 ${choice === null ? 'border-[5px] border-primary' : 'border-2'}`} />
          <span className="text-sm font-semibold">ללא {unit.kind === 'org' ? 'רע"ן' : 'מפקד'} (להשאיר ריק)</span>
        </button>
        {people.map((p) => {
          const sel = choice === p.id;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={sel} onClick={() => setChoice(p.id)}
              className={`flex min-h-11 w-full items-center gap-2.5 border-b border-line px-3 text-start hover:bg-soft ${sel ? 'bg-tint' : ''}`}>
              <span className={`h-4 w-4 shrink-0 rounded-full border-line2 ${sel ? 'border-[5px] border-primary' : 'border-2'}`} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">{p.name}</span><span className="text-xs text-muted">{p.degree} · {sectionName(p.sectionId)}</span></span>
              {p.id === currentId && <span className="chip chip-cmd">מכהן/ת</span>}
              {p.id !== currentId && !inUnit(p.sectionId) && <span className="chip chip-neutral">{unit.kind === 'org' ? 'יצא/תצא ממדור' : 'ממדור אחר'}</span>}
            </button>
          );
        })}
        {people.length === 0 && <p className="m-0 p-4 text-sm text-muted">לא נמצאו אנשים.</p>}
      </div>
      {notes.length > 0 && <ul className="m-0 mt-3 list-none rounded bg-[#fdf0d5] p-3 text-[13px] leading-relaxed text-[#6b3f00]">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </Dialog>
  );
}
