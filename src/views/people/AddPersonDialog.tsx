import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { applicable } from '../../domain/rules';
import { FIELDS, NAME_FIELD } from '../../logic/fields';
import { validatePerson } from '../../logic/people';
import { occupantOf, useStore } from '../../store/store';
import type { PersonRow } from '../../domain/types';
import { FieldEditor, emptyDraft, patchDraft, toDraft } from './PersonCells';

/** Add a person, or (with `person`) edit all of a person's details in one form. */
export function AddPersonDialog({ onClose, person }: { onClose: () => void; person?: PersonRow }) {
  const s = useStore();
  const [draft, setDraft] = useState(() => (person ? toDraft(person) : emptyDraft(s.sections[0]?.id ?? null)));
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Parameters<typeof patchDraft>[1]) => { setDraft((d) => patchDraft(d, patch)); setError(null); };

  const isOrgCmd = !!person && s.commanders.org === person.id; // the head of the organization belongs to no section
  const fields = [NAME_FIELD, ...FIELDS].filter((f) => applicable(f.key, draft));

  const save = () => {
    const err = validatePerson(draft, s.people, s.billets, occupantOf(s));
    if (err) { setError(err); return; }
    const p = s.savePerson(draft);
    s.showToast(person ? `הנתונים של ${p.name} עודכנו` : `${p.name} נוסף/ה`);
    onClose();
  };

  return (
    <Dialog
      title={person ? `עריכת ${person.name}` : 'הוספת איש צוות'}
      width={780}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
        <button type="button" className="btn btn-primary h-[38px] px-5" onClick={save}>{person ? 'שמירה' : 'הוספה'}</button>
      </>}
    >
      <div className="grid grid-cols-3 gap-x-3.5 gap-y-3 p-0.5">
        {fields.slice(0, 2).map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label htmlFor={`np-${f.key}`} className="label">{f.label}</label>
            <FieldEditor f={f} draft={draft} onChange={change} id={`np-${f.key}`} large />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label htmlFor="np-section" className="label">מיקום בארגון</label>
          <select id="np-section" className="input input-lg" disabled={isOrgCmd} title={isOrgCmd ? 'מפקד הארגון אינו משויך למדור' : undefined} value={draft.sectionId ?? ''} onChange={(e) => change({ sectionId: e.target.value || null })}>
            <option value="">כפוף ישירות למפקד הארגון</option>
            {s.sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
          </select>
        </div>
        {fields.slice(2).map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label htmlFor={`np-${f.key}`} className="label">{f.key === 'billet' ? 'מספר תקן' : f.label}</label>
            <FieldEditor f={f} draft={draft} onChange={change} id={`np-${f.key}`} large />
          </div>
        ))}
      </div>
      <p className="mt-3 mb-0 text-xs text-muted">השדות מוצגים לפי סוג האוכלוסייה והסוג. מספר תקן ריק = על תקני. מינוי למפקד נעשה דרך כפתור ⇅ (שינוי מיקום).</p>
      {error && <p role="alert" className="mt-2 mb-0 text-[13px] font-semibold text-danger">{error}</p>}
    </Dialog>
  );
}
