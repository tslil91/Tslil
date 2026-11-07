import { IconMove } from '../../components/Icons';
import { POP_LABELS, RANK_LABELS, degreeIndex } from '../../domain/rules';
import type { Person } from '../../domain/types';
import { personHref } from '../../nav';
import { useStore } from '../../store/store';

function MoveButton({ person, onMove }: { person: Person; onMove: (p: Person) => void }) {
  return (
    <button type="button" className="icon-btn" title="שינוי מיקום בארגון" aria-label={`שינוי מיקום בארגון של ${person.name}`} onClick={() => onMove(person)}>
      <IconMove size={16} />
    </button>
  );
}

/** Hierarchy: org commander on top, then one column per group with its commander and members by degree. */
export function PeopleTree({ people, onMove }: { people: Person[]; onMove: (p: Person) => void }) {
  const { sections, commanders } = useStore();
  const all = useStore((s) => s.people);
  const byId = (id: number | null) => (id === null ? null : all.find((p) => p.id === id) ?? null);
  const top = byId(commanders.org);
  const byDegree = (a: Person, b: Person) => degreeIndex(b.degree) - degreeIndex(a.degree);
  const columns = [{ id: null as string | null, name: 'כפופים ישירות' }, ...sections].map((col) => {
    const cmdId = col.id ? commanders.sections[col.id] ?? null : null;
    return {
      ...col,
      commander: byId(cmdId),
      members: people.filter((p) => p.sectionId === col.id && p.id !== cmdId && p.id !== commanders.org).sort(byDegree),
    };
  });
  const span = 100 / (columns.length * 2);

  return (
    <div className="mx-3.5 mb-3 min-h-0 flex-1 overflow-auto rounded border border-line bg-surface p-5">
      <div className="flex flex-col items-center">
        <div className="flex min-w-[280px] flex-col items-center gap-1 rounded border-2 border-primary px-4 py-3">
          <span className="label">מפקד הארגון</span>
          {top ? <a href={personHref(top.id)} className="text-[17px] font-bold text-ink no-underline hover:underline">{top.name}</a> : <span className="text-[17px] font-bold">לא מונה</span>}
          <span className="text-[13px] text-muted">{top ? `${top.degree} · ${RANK_LABELS[top.rank]}` : 'יש למנות מפקד ארגון'}</span>
          {top && <button type="button" className="btn mt-1 h-7" onClick={() => onMove(top)}>שינוי מיקום</button>}
        </div>
        <div className="h-5 w-0.5 bg-line2" />
      </div>
      <div className="h-0.5 bg-line2" style={{ marginInline: `${span}%` }} />
      <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((col) => (
          <div key={col.id ?? 'org'} className="flex flex-col gap-2">
            <div className="h-5 w-0.5 self-center bg-line2" />
            <div className="flex items-center gap-2 rounded bg-group px-3 py-2">
              <span className="flex-1 text-[15px] font-bold">{col.name}</span>
              <span className="chip chip-neutral">{col.members.length + (col.commander ? 1 : 0)}</span>
            </div>
            {col.id && (col.commander ? (
              <div className="flex items-center gap-2 rounded border-2 border-primary bg-surface px-2.5 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="label">מפקד המדור</span>
                  <a href={personHref(col.commander.id)} className="text-sm font-bold text-ink no-underline hover:underline">{col.commander.name}</a>
                  <span className="text-xs text-muted">{col.commander.degree} · {RANK_LABELS[col.commander.rank]}</span>
                </span>
                <MoveButton person={col.commander} onMove={onMove} />
              </div>
            ) : (
              <div className="rounded border border-dashed border-line2 px-2.5 py-2 text-[13px] text-muted">לא מונה מפקד מדור</div>
            ))}
            <ul className="m-0 flex list-none flex-col gap-1.5 border-s-2 border-line p-0 ps-3.5">
              {col.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded border border-line bg-surface px-2.5 py-1.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <a href={personHref(m.id)} className="text-[13px] font-semibold text-ink no-underline hover:underline">{m.name}</a>
                    <span className="text-xs text-muted">{m.degree} · {RANK_LABELS[m.rank]}</span>
                  </span>
                  <span className={`chip chip-${m.pop}`}>{POP_LABELS[m.pop]}</span>
                  <MoveButton person={m} onMove={onMove} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
