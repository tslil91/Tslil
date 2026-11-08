import { useMemo, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { plural } from '../../components/charts';
import { bulkMove, type BulkDest } from '../../logic/bulk';
import { useStore } from '../../store/store';

/** Move all the selected people to one place. Shows exactly what will happen before it does. */
export function BulkMoveDialog({ ids, onClose, onDone }: { ids: number[]; onClose: () => void; onDone: () => void }) {
  const { sections, people, commanders, bulkMovePeople, showToast } = useStore();
  const [dest, setDest] = useState<BulkDest>(sections[0] ? { kind: 'section', id: sections[0].id } : { kind: 'org' });
  const preview = useMemo(() => bulkMove(people, commanders, ids, dest), [people, commanders, ids, dest]);
  const options: { dest: BulkDest; label: string; sub: string }[] = [
    ...sections.map((s) => ({ dest: { kind: 'section', id: s.id } as BulkDest, label: s.name, sub: 'איש צוות במדור' })),
    { dest: { kind: 'org' }, label: 'כפופים ישירות לרע"ן', sub: 'ללא מדור' },
  ];
  const same = (a: BulkDest, b: BulkDest) => a.kind === b.kind && (a.kind === 'org' || (b.kind === 'section' && a.id === b.id));
  const destName = dest.kind === 'org' ? 'כפופים ישירות' : sections.find((s) => s.id === dest.id)?.name ?? '';

  const apply = () => {
    const r = bulkMovePeople(ids, dest);
    showToast(r.moved > 0 ? `${plural(r.moved, 'אדם אחד הועבר', 'אנשים הועברו')} אל ${destName}${r.skipped.length ? ` · ${r.skipped.length} דולגו` : ''}` : 'לא בוצעו שינויים');
    onDone();
    onClose();
  };

  return (
    <Dialog title={`העברת ${plural(ids.length, 'אדם אחד', 'אנשים')} אל…`} width={560} onClose={onClose}
      footer={<>
        <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
        <button type="button" className="btn btn-primary h-[38px] px-5" disabled={preview.moved === 0} onClick={apply}>
          {preview.moved > 0 ? `העברת ${plural(preview.moved, 'אדם אחד', 'אנשים')}` : 'אין מה להעביר'}
        </button>
      </>}>
      <div role="radiogroup" aria-label="יעד" className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const sel = same(o.dest, dest);
          return (
            <button key={o.label} type="button" role="radio" aria-checked={sel} onClick={() => setDest(o.dest)}
              className={`flex min-h-[50px] items-center gap-2.5 rounded border-[1.5px] px-3 text-start hover:bg-soft ${sel ? 'border-primary bg-tint' : 'border-line2'}`}>
              <span className={`h-4 w-4 shrink-0 rounded-full border-line2 ${sel ? 'border-[5px] border-primary' : 'border-2'}`} />
              <span className="flex flex-col"><span className="text-sm font-bold">{o.label}</span><span className="text-xs text-muted">{o.sub}</span></span>
            </button>
          );
        })}
      </div>
      <ul className="m-0 mt-3 list-none rounded bg-bg p-3 text-[13px] leading-relaxed">
        <li><strong>{preview.moved}</strong> יועברו אל {destName}</li>
        {preview.unchanged > 0 && <li><strong>{preview.unchanged}</strong> כבר שם — ללא שינוי</li>}
        {preview.commandsEnded > 0 && <li className="text-[#6b3f00]"><strong>{preview.commandsEnded}</strong> מפקדי מדור יפסיקו לשמש מפקדים (הם עוברים למדור אחר)</li>}
        {preview.skipped.map((k) => <li key={k.id} className="text-danger">{k.name}: לא יועבר/ה — {k.reason}</li>)}
      </ul>
    </Dialog>
  );
}
