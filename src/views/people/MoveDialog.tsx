import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import type { Person } from '../../domain/types';
import { placementLabel, placementOf, type PlacementKey } from '../../logic/people';
import { useStore } from '../../store/store';

/** Floating window: choose where the person sits in the organization and whether they command it. */
export function MoveDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const { sections, commanders, people, placePerson, showToast } = useStore();
  const current = placementOf(person, commanders);
  const [choice, setChoice] = useState<PlacementKey>(current);
  const nameOf = (id: number | null) => (id === null ? null : people.find((p) => p.id === id)?.name ?? null);

  const keys: PlacementKey[] = ['orgcmd', 'org', ...sections.flatMap((s) => [`sec:${s.id}`, `cmd:${s.id}`] as PlacementKey[])];

  const holderOf = (k: PlacementKey): number | null => {
    if (k === 'orgcmd') return commanders.org;
    if (k.startsWith('cmd:')) return commanders.sections[k.slice(4)] ?? null;
    return null;
  };
  const subtitle = (k: PlacementKey) => {
    if (k === current) return 'המיקום הנוכחי';
    const holder = holderOf(k);
    if (k === 'orgcmd' || k.startsWith('cmd:')) return holder && holder !== person.id ? `כעת: ${nameOf(holder)}` : 'לא מונה';
    return k === 'org' ? 'ללא מדור' : 'איש צוות במדור';
  };

  const warnings: string[] = [];
  const replaced = holderOf(choice);
  if (replaced !== null && replaced !== person.id && choice !== current) {
    warnings.push(`${nameOf(replaced)} יפסיק/תפסיק לשמש ${placementLabel(choice, sections)} ויישאר/תישאר ${choice === 'orgcmd' ? 'כפוף/ה ישירות' : 'במדור'}.`);
  }
  if (current === 'orgcmd' && choice !== 'orgcmd') warnings.push('לא יהיה רע"ן עד שימונה רע"ן חדש.');
  if (current.startsWith('cmd:') && choice !== current) {
    const secName = sections.find((x) => x.id === current.slice(4))?.name ?? '';
    warnings.push(`ל${secName} לא יהיה מפקד עד שימונה מפקד חדש.`);
  }

  const apply = () => {
    if (choice !== current) {
      placePerson(person.id, choice);
      showToast(`${person.name} — ${placementLabel(choice, sections)}`);
    }
    onClose();
  };

  return (
    <Dialog
      title="שינוי מיקום בארגון"
      onClose={onClose}
      footer={<>
        <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
        <button type="button" className="btn btn-primary h-[38px] px-5" onClick={apply}>אישור</button>
      </>}
    >
      <p className="m-0 mb-3 text-sm text-muted">
        {person.degree} {person.name} · כרגע: <strong className="text-ink">{placementLabel(current, sections)}</strong>
      </p>
      <div role="radiogroup" aria-label="מיקום חדש" className="grid grid-cols-2 gap-2">
        {keys.map((k) => {
          const sel = k === choice;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={sel}
              data-autofocus={sel ? true : undefined}
              onClick={() => setChoice(k)}
              className={`flex min-h-[50px] items-center gap-2.5 rounded border-[1.5px] px-3 text-start hover:bg-soft ${sel ? 'border-primary bg-tint' : 'border-line2'}`}
            >
              <span className={`h-4 w-4 shrink-0 rounded-full border-line2 ${sel ? 'border-[5px] border-primary' : 'border-2'}`} />
              <span className="flex flex-col">
                <span className="text-sm font-bold">{placementLabel(k, sections)}</span>
                <span className="text-xs text-muted">{subtitle(k)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {warnings.length > 0 && (
        <div className="mt-3 rounded bg-[#fdf0d5] px-3 py-2.5 text-[13px] font-medium text-[#6b3f00]">{warnings.join(' ')}</div>
      )}
    </Dialog>
  );
}
