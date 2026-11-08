import { useMemo, useState } from 'react';
import { Card } from '../../components/charts';
import { ConfirmDialog } from '../../components/Dialog';
import { IconEdit, IconMove, IconTrash } from '../../components/Icons';
import { PageHeader } from '../../components/PageHeader';
import { formatDate, formatMoney } from '../../domain/dates';
import { POP_LABELS, RANK_LABELS, applicable } from '../../domain/rules';
import type { PersonRow } from '../../domain/types';
import { LogRow, when } from '../../components/LogRow';
import { billetByPerson } from '../../logic/billets';
import { FIELDS } from '../../logic/fields';
import { BASIS_LABELS, GRANT_TYPE_LABELS, grantDate, latestFirst, totals } from '../../logic/grants';
import { SINCE_ALWAYS, periodsOf } from '../../logic/history';
import { placementLabel, placementOf } from '../../logic/people';
import { go, sectionHref } from '../../nav';
import { useStore } from '../../store/store';
import { useAudit } from '../../sync/useAudit';
import { AddPersonDialog } from '../people/AddPersonDialog';
import { MoveDialog } from '../people/MoveDialog';
import { RemovePersonDialog } from '../people/RemovePersonDialog';
import { isActivePerson } from '../../domain/rules';
import { CellView } from '../people/PersonCells';

/** One place for everything about a person: details, billet and section history, grants, notes and the change log. */
export function PersonView({ id }: { id?: string | null }) {
  const s = useStore();
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [removeNote, setRemoveNote] = useState<number | null>(null);
  const pid = Number(id);
  const person = s.people.find((p) => p.id === pid) ?? null;
  const log = useAudit({ personId: Number.isFinite(pid) ? pid : undefined, limit: 100 });

  const billet = useMemo(() => billetByPerson(s.assignments).get(pid) ?? null, [s.assignments, pid]);
  const row: PersonRow | null = person ? { ...person, billet } : null;

  if (!person || !row) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="איש צוות" subtitle="לא נמצא" />
        <div className="m-3.5 rounded border border-line bg-surface p-8 text-sm"><p className="m-0 mb-3">לא נמצא איש צוות עם המזהה הזה (ייתכן שנמחק).</p><a href="#/people" className="btn btn-primary no-underline">חזרה לכוח אדם</a></div>
      </div>
    );
  }

  const secName = (sid: string | null) => (sid ? s.sections.find((x) => x.id === sid)?.name ?? sid : 'כפוף ישירות לרע"ן');
  const place = placementOf(person, s.commanders);
  const billets = s.assignments.filter((a) => a.personId === pid).sort((a, b) => (a.start < b.start ? 1 : -1));
  const periods = periodsOf(s.sectionHistory, pid);
  const grants = latestFirst(s.grants.filter((g) => g.personId === pid));
  const t = totals(grants);
  const notes = s.notes.filter((n) => n.personId === pid).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const fields = FIELDS.filter((f) => applicable(f.key, row));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title={person.name} subtitle={`${person.degree} · ${RANK_LABELS[person.rank]} · ${POP_LABELS[person.pop]} · מ.א ${person.mid}`}>
        <a href="#/people" className="btn no-underline">‹ חזרה לכוח אדם</a>
        {isActivePerson(person) && <button type="button" className="btn" onClick={() => setMoving(true)}><IconMove size={16} />שינוי מיקום</button>}
        <button type="button" className="btn" onClick={() => setRemoving(true)}><IconTrash size={16} />הסרה</button>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}><IconEdit size={16} />עריכה</button>
      </PageHeader>

      {!isActivePerson(person) && (
        <div role="status" className="mx-3.5 mt-3 flex shrink-0 items-center gap-3 rounded bg-[#fdf0d5] px-4 py-2.5 text-[13px] font-medium text-[#6b3f00]">
          <span className="flex-1"><strong>{person.name}</strong> עזב/ה את היחידה ב־{formatDate(person.leftAt)}{person.leftNote ? ` · ${person.leftNote}` : ''}. לא מופיע/ה בטבלה, בתמונת המצב ובסימולטור; ההיסטוריה נשמרת.</span>
          <button type="button" className="btn" onClick={() => { const err = s.restorePersonToUnit(person.id); s.showToast(err ?? `${person.name} הוחזר/ה ליחידה`); }}>החזרה ליחידה</button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-3.5">
          <Card title="פרטים" subtitle="כל השדות הרלוונטיים לסוג ולאוכלוסייה">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`chip chip-${person.pop}`}>{POP_LABELS[person.pop]}</span>
              {place === 'orgcmd' && <span className="chip chip-cmd">רע"ן</span>}
              {place.startsWith('cmd:') && <span className="chip chip-cmd">מפקד המדור</span>}
              <span className="text-[13px] text-muted">מיקום בארגון:</span>
              <a className="text-[13px] font-semibold text-accent underline" href={sectionHref(person.sectionId)}>{placementLabel(place, s.sections)}</a>
            </div>
            <dl className="m-0 grid grid-cols-3 gap-x-4">
              {fields.map((f) => (
                <div key={f.key} className="flex min-h-[46px] flex-col justify-center border-b border-line py-1">
                  <dt className="text-xs text-muted">{f.label}</dt>
                  <dd className="m-0 text-[13.5px] font-semibold"><CellView row={row} f={f} /></dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="תקנים" subtitle={billet ? `כרגע בתקן ${billet}` : person.pop === 'keva' ? 'כרגע על תקני' : 'תקנים רלוונטיים לקבע בלבד'}>
            {billets.length === 0 ? <p className="m-0 text-sm text-muted">אין היסטוריית שיבוץ.</p> : (
              <ul className="m-0 list-none p-0">
                {billets.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 border-b border-line py-1.5 text-[13px]">
                    <span className={`h-2 w-2 rounded-full ${a.end ? 'bg-line2' : 'bg-[#15803d]'}`} aria-hidden="true" />
                    <a href={`#/billets?q=${a.billetId}`} className="font-bold text-ink underline">תקן {a.billetId}</a>
                    <span className="flex-1 text-muted">{formatDate(a.start)} – {a.end ? formatDate(a.end) : 'היום'}</span>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="m-0 mt-1 text-[13px] font-bold">מדורים לאורך הזמן</h3>
            <ul className="m-0 list-none p-0">
              {periods.map((p) => (
                <li key={p.id} className="flex items-center gap-2 border-b border-line py-1.5 text-[13px]">
                  <span className={`h-2 w-2 rounded-full ${p.end ? 'bg-line2' : 'bg-[#15803d]'}`} aria-hidden="true" />
                  <a href={sectionHref(p.sectionId)} className="font-semibold text-ink underline">{secName(p.sectionId)}</a>
                  <span className="flex-1 text-muted">{p.start === SINCE_ALWAYS ? 'עד' : `${formatDate(p.start)} –`} {p.start === SINCE_ALWAYS ? (p.end ? formatDate(p.end) : 'היום') : p.end ? formatDate(p.end) : 'היום'}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="מענקים ותמריצים" subtitle={grants.length ? `${grants.length} רשומות · ${[t.gross ? `${formatMoney(t.gross)} ברוטו` : '', t.net ? `${formatMoney(t.net)} נטו` : ''].filter(Boolean).join(' · ')}` : 'אין רשומות'}
            action={<button type="button" className="btn" onClick={() => go('#/grants')}>למסך המענקים</button>}>
            {grants.length === 0 ? <p className="m-0 text-sm text-muted">לא נרשמו מענקים לאיש צוות זה.</p> : (
              <ul className="m-0 list-none p-0">
                {grants.map((g, i) => (
                  <li key={g.id} className="flex items-center gap-2 border-b border-line py-1.5 text-[13px]">
                    <span className={`chip chip-${g.type}`}>{GRANT_TYPE_LABELS[g.type]}</span>
                    {i === 0 && <span className="chip chip-accent">אחרון</span>}
                    <span className="font-bold">{formatMoney(g.amount)}</span>
                    <span className="text-muted">{BASIS_LABELS[g.basis]}</span>
                    <span className="flex-1 text-muted">{g.signingStart ? `${formatDate(g.signingStart)} – ${formatDate(g.signingEnd)}` : `הוזן ${formatDate(grantDate(g))}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="הערות" subtitle="מידע חופשי על איש הצוות. כל הערה נרשמת עם שם הכותב והזמן">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (noteText.trim()) { s.addNote(pid, noteText); setNoteText(''); } }}>
              <label htmlFor="note-text" className="sr-only">הערה חדשה</label>
              <textarea id="note-text" rows={2} maxLength={2000} placeholder="כתיבת הערה…" value={noteText} onChange={(e) => setNoteText(e.target.value)}
                className="input h-auto min-h-[56px] flex-1 resize-y py-1.5" />
              <button type="submit" className="btn btn-primary self-end" disabled={!noteText.trim()}>הוספה</button>
            </form>
            {notes.length === 0 && <p className="m-0 text-sm text-muted">אין הערות.</p>}
            <ul className="m-0 list-none p-0">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 border-b border-line py-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="m-0 whitespace-pre-wrap break-words text-[13.5px] leading-snug">{n.text}</p>
                    <span className="text-xs text-muted">{n.author} · {when(n.createdAt)}</span>
                  </div>
                  <button type="button" className="icon-btn icon-btn-danger" title="מחיקת הערה" aria-label="מחיקת הערה" onClick={() => setRemoveNote(n.id)}><IconTrash size={15} /></button>
                </li>
              ))}
            </ul>
          </Card>

          <Card wide title="יומן שינויים של איש הצוות" subtitle={log.loading ? 'טוען…' : `${log.total} רישומים${log.total > log.entries.length ? ` (מוצגים ${log.entries.length} האחרונים)` : ''}`}
            action={<a href="#/history" className="btn no-underline">ליומן המלא</a>}>
            {log.error && <p role="alert" className="m-0 text-sm text-danger">לא ניתן לטעון את היומן מהשרת.</p>}
            {!log.loading && log.entries.length === 0 && <p className="m-0 text-sm text-muted">אין שינויים רשומים.</p>}
            <ul className="m-0 list-none p-0">{log.entries.map((e) => <LogRow key={e.id} e={e} />)}</ul>
          </Card>
        </div>
      </div>

      {editing && <AddPersonDialog person={row} onClose={() => setEditing(false)} />}
      {moving && <MoveDialog person={person} onClose={() => setMoving(false)} />}
      {removing && <RemovePersonDialog person={person} onClose={() => setRemoving(false)} onDeleted={() => go('#/people')} />}
      {removeNote !== null && (
        <ConfirmDialog title="למחוק את ההערה?" message="ההערה תימחק. המחיקה תירשם ביומן השינויים." confirmLabel="כן, מחק" onCancel={() => setRemoveNote(null)}
          onConfirm={() => { s.deleteNote(removeNote); setRemoveNote(null); }} />
      )}
    </div>
  );
}

