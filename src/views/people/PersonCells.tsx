import { formatDate } from '../../domain/dates';
import { POP_LABELS, RANK_LABELS, applicable, fixCombo } from '../../domain/rules';
import type { PersonRow } from '../../domain/types';
import { editOptions, type FieldDef } from '../../logic/fields';
import type { PersonDraft } from '../../logic/people';

export const toDraft = (r: PersonRow): PersonDraft => ({ ...r, mid: String(r.mid) });

export const emptyDraft = (sectionId: string | null): PersonDraft => fixCombo({
  id: 0, name: '', mid: '', pop: 'keva', rank: 'officer', degree: 'סגן', program: null,
  sectionId, entryDate: null, releaseDate: null, billet: null,
});

/** Merge a patch into a draft and keep population / type / degree / program consistent. */
export const patchDraft = (d: PersonDraft, patch: Partial<PersonDraft>): PersonDraft => fixCombo({ ...d, ...patch });

const Dash = () => <span className="text-muted">—</span>;

export function CellView({ row, f }: { row: PersonRow; f: FieldDef }) {
  if (!applicable(f.key, row)) return <Dash />;
  const v = (row as unknown as Record<string, unknown>)[f.key];
  switch (f.key) {
    case 'pop': return <span className={`chip chip-${row.pop}`}>{POP_LABELS[row.pop]}</span>;
    case 'rank': return <>{RANK_LABELS[row.rank]}</>;
    case 'billet': return row.billet ? <span className="chip chip-neutral">תקן {row.billet}</span> : <span className="chip chip-bench">על תקני</span>;
    case 'program': return row.program ? <>{row.program}</> : <Dash />;
  }
  if (f.type === 'bool') return <span className={`chip ${v ? 'chip-yes' : 'chip-no'}`}>{v ? 'כן' : 'לא'}</span>;
  if (f.type === 'date') return v ? <>{formatDate(v as string)}</> : <Dash />;
  return v === null || v === undefined || v === '' ? <Dash /> : <>{String(v)}</>;
}

interface EditorProps {
  f: FieldDef;
  draft: PersonDraft;
  onChange: (patch: Partial<PersonDraft>) => void;
  id?: string;
  large?: boolean;
}

/** One editor per field type; used both for inline row editing and in the add-person dialog. */
export function FieldEditor({ f, draft, onChange, id, large }: EditorProps) {
  if (!applicable(f.key, draft)) return <Dash />;
  const cls = `input${large ? ' input-lg' : ''}`;
  const a11y = id ? { id } : { 'aria-label': f.label };
  const raw = (draft as unknown as Record<string, unknown>)[f.key];

  switch (f.type) {
    case 'text':
      return <input {...a11y} className={cls} value={draft.name} placeholder="שם מלא" onChange={(e) => onChange({ name: e.target.value })} />;
    case 'num':
      return <input {...a11y} className={cls} inputMode="numeric" value={draft.mid} placeholder="7 ספרות" onChange={(e) => onChange({ mid: e.target.value.replace(/\D/g, '') })} />;
    case 'billet':
      return (
        <input {...a11y} className={cls} inputMode="numeric" placeholder="ריק = על תקני" value={draft.billet ?? ''}
          onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); onChange({ billet: Number.isNaN(n) ? null : n }); }} />
      );
    case 'date':
      return <input {...a11y} type="date" className={cls} value={(raw as string | null) ?? ''} onChange={(e) => onChange({ [f.key]: e.target.value || null })} />;
    case 'bool':
      return (
        <select {...a11y} className={cls} value={raw ? 'yes' : 'no'} onChange={(e) => onChange({ [f.key]: e.target.value === 'yes' })}>
          <option value="no">לא</option>
          <option value="yes">כן</option>
        </select>
      );
    case 'enum': {
      const value = f.key === 'program' ? draft.program ?? '' : String(raw ?? '');
      return (
        <select {...a11y} className={cls} value={value}
          onChange={(e) => onChange({ [f.key]: f.key === 'program' ? e.target.value || null : e.target.value })}>
          {editOptions(f.key, draft).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
  }
}
